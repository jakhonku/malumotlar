"use server";

import { createHash, randomBytes } from "node:crypto";
import { headers } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { buildEventPayload, normalizeDistrictName, toFieldErrors } from "@/lib/event-payload";
import { validateAnswers, type CollectionRow } from "@/lib/collections";
import { BUCKET, ensureBucket, signedPath } from "@/lib/signed-files";
import { draftSchema, submitSchema, type EventFormValues } from "@/lib/validators";

export interface PublicSaveResult {
  ok: boolean;
  token?: string;
  error?: string;
  fieldErrors?: Record<string, string>;
}

const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");

async function ipHash(): Promise<string> {
  const h = await headers();
  const ip = (h.get("x-forwarded-for") ?? "").split(",")[0].trim() || h.get("x-real-ip") || "unknown";
  return sha256(`${ip}|${process.env.SUPABASE_SERVICE_ROLE_KEY?.slice(-12) ?? "salt"}`);
}

function dbMessage(error: { code?: string; message: string }): string {
  if (error.code === "P0001") return error.message;
  if (error.code === "23514" || error.code === "23505") return "Kiritilgan ma’lumotlar cheklovlarga mos kelmadi. Maydonlarni tekshiring.";
  return "Server xatosi yuz berdi. Birozdan so‘ng qayta urinib ko‘ring.";
}

const TOKEN_RE = /^[0-9a-f]{48}$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Ochiq forma: login talab qilinmaydi.
 * - token == null: yangi hudud havolasi yaratiladi (hudud formadan olinadi) va birinchi tadbir saqlanadi;
 * - token bor, eventId == null: shu hudud havolasiga yangi tadbir qo‘shiladi (hudud havoladan olinadi);
 * - token va eventId: mavjud tadbir tahrirlanadi.
 */
export async function savePublicEvent(
  token: string | null,
  eventId: string | null,
  values: EventFormValues,
  mode: "draft" | "validate" | "submit",
): Promise<PublicSaveResult> {
  if (token && !TOKEN_RE.test(token)) return { ok: false, error: "Hudud havolasi noto‘g‘ri" };
  if (eventId && !UUID_RE.test(eventId)) return { ok: false, error: "Tadbir noto‘g‘ri" };

  const parsed = (mode === "draft" ? draftSchema : submitSchema).safeParse(values);
  if (!parsed.success) {
    return { ok: false, error: "Ba’zi maydonlar noto‘g‘ri to‘ldirilgan", fieldErrors: toFieldErrors(parsed.error.issues) };
  }
  if (mode === "validate") return { ok: true, token: token ?? undefined };

  const admin = createAdminClient();
  const ip = await ipHash();
  const newToken = token ? null : randomBytes(24).toString("hex");

  const { data: id, error } = await admin.rpc("public_save_event", {
    p_token_hash: token ? sha256(token) : null,
    p_new_token_hash: newToken ? sha256(newToken) : null,
    p_ip_hash: ip,
    p_event_id: eventId,
    p_data: buildEventPayload(parsed.data),
  });
  if (error) return { ok: false, error: dbMessage(error) };
  const finalToken = (token ?? newToken)!;

  if (mode === "submit") {
    const { error: sErr } = await admin.rpc("public_submit_event", { p_token_hash: sha256(finalToken), p_event_id: id as string, p_ip_hash: ip });
    if (sErr) return { ok: false, token: finalToken, error: dbMessage(sErr) };
  }
  return { ok: true, token: finalToken };
}

/** Tadbirni (yoki eventId bo‘lmasa — havoladagi barcha tayyor tadbirlarni) yuborish. */
export async function submitPublicEvents(token: string, eventId: string | null): Promise<{ ok: boolean; sent?: number; error?: string }> {
  if (!TOKEN_RE.test(token)) return { ok: false, error: "Hudud havolasi noto‘g‘ri" };
  if (eventId && !UUID_RE.test(eventId)) return { ok: false, error: "Tadbir noto‘g‘ri" };
  const { data, error } = await createAdminClient().rpc("public_submit_event", {
    p_token_hash: sha256(token), p_event_id: eventId, p_ip_hash: await ipHash(),
  });
  return error ? { ok: false, error: dbMessage(error) } : { ok: true, sent: data as number };
}

/* ------------------------------------------------------------------ umumiy ma'lumot yig'ish (collections) */

export interface EntryGeo {
  scope: "regional" | "district";
  region_id: string;
  district_id: string; // "" | uuid | "__new__"
  new_district_name?: string;
  new_district_type?: "tuman" | "shahar";
  /** region — viloyat boshqarmasi: bitta havolada viloyat va barcha tumanlar */
  group_mode?: "unit" | "region";
}

export interface PublicEntryResult {
  ok: boolean;
  token?: string;
  error?: string;
  fieldErrors?: Record<string, string>;
}

async function loadCollection(id: string): Promise<CollectionRow | null> {
  if (!UUID_RE.test(id)) return null;
  const { data } = await createAdminClient().from("collections").select("*").eq("id", id).maybeSingle();
  return (data as CollectionRow | null) ?? null;
}

/** Hudud havolasi bo'yicha yozuv qo'shish/tahrirlash; mode=submit bo'lsa darhol yuboradi. */
export async function savePublicEntry(
  collectionId: string,
  token: string | null,
  entryId: string | null,
  geo: EntryGeo,
  answers: Record<string, unknown>,
  mode: "draft" | "submit",
): Promise<PublicEntryResult> {
  if (token && !TOKEN_RE.test(token)) return { ok: false, error: "Hudud havolasi noto‘g‘ri" };
  if (entryId && !UUID_RE.test(entryId)) return { ok: false, error: "Yozuv noto‘g‘ri" };
  const col = await loadCollection(collectionId);
  if (!col) return { ok: false, error: "Ma’lumot yig‘ish topilmadi" };

  const v = validateAnswers(col.fields, answers, mode === "draft");
  if (!v.ok) return { ok: false, error: "Ba’zi maydonlar noto‘g‘ri to‘ldirilgan", fieldErrors: v.errors };
  if (mode === "draft" && Object.values(v.values).every((x) => x === null || x === false || (Array.isArray(x) && !x.length))) {
    return { ok: false, error: "Hech bo‘lmaganda bitta maydonni to‘ldiring" };
  }

  const admin = createAdminClient();
  const ip = await ipHash();
  const newToken = token ? null : randomBytes(24).toString("hex");
  const isNew = geo.district_id === "__new__";

  const { data: id, error } = await admin.rpc("col_public_save", {
    p_collection: col.id,
    p_token_hash: token ? sha256(token) : null,
    p_new_token_hash: newToken ? sha256(newToken) : null,
    p_ip_hash: ip,
    p_entry_id: entryId,
    p_data: {
      group_mode: geo.group_mode === "region" ? "region" : "unit",
      scope: geo.scope,
      region_id: geo.region_id,
      district_id: geo.scope === "district" && !isNew && geo.district_id ? geo.district_id : null,
      new_district_name: geo.scope === "district" && isNew ? normalizeDistrictName(geo.new_district_name, geo.new_district_type) : null,
      new_district_type: geo.new_district_type ?? "tuman",
      answers: v.values,
    },
  });
  if (error) return { ok: false, error: dbMessage(error) };
  const finalToken = (token ?? newToken)!;

  if (mode === "submit") {
    const { error: sErr } = await admin.rpc("col_public_submit", {
      p_collection: col.id, p_token_hash: sha256(finalToken), p_entry_id: id as string, p_ip_hash: ip,
    });
    if (sErr) return { ok: false, token: finalToken, error: dbMessage(sErr) };
  }
  return { ok: true, token: finalToken };
}

/** Bitta yozuvni (yoki entryId bo'lmasa — havoladagi barcha tayyorlarini) yuboradi; majburiy maydonlar tekshiriladi. */
export async function submitPublicEntries(
  collectionId: string,
  token: string,
  entryId: string | null,
): Promise<{ ok: boolean; sent?: number; error?: string }> {
  if (!TOKEN_RE.test(token)) return { ok: false, error: "Hudud havolasi noto‘g‘ri" };
  if (entryId && !UUID_RE.test(entryId)) return { ok: false, error: "Yozuv noto‘g‘ri" };
  const col = await loadCollection(collectionId);
  if (!col) return { ok: false, error: "Ma’lumot yig‘ish topilmadi" };

  const admin = createAdminClient();
  let q = admin
    .from("collection_entries")
    .select("id,answers,status")
    .eq("collection_id", col.id)
    .eq("edit_token_hash", sha256(token))
    .is("deleted_at", null)
    .in("status", ["draft", "revision"]);
  if (entryId) q = q.eq("id", entryId);
  const { data: rows } = await q.order("created_at");
  const list = rows ?? [];
  for (let i = 0; i < list.length; i++) {
    const v = validateAnswers(col.fields, list[i].answers as Record<string, unknown>, false);
    if (!v.ok) {
      const firstKey = Object.keys(v.errors)[0];
      const label = col.fields.find((f) => f.key === firstKey)?.label ?? firstKey;
      return { ok: false, error: `${i + 1}-${col.entry_label.toLowerCase()}: «${label}» — ${v.errors[firstKey]}` };
    }
  }

  const { data, error } = await admin.rpc("col_public_submit", {
    p_collection: col.id, p_token_hash: sha256(token), p_entry_id: entryId, p_ip_hash: await ipHash(),
  });
  return error ? { ok: false, error: dbMessage(error) } : { ok: true, sent: data as number };
}

/** Hali yuborilmagan yozuvni o'chirish (token egasi). */
export async function deletePublicEntry(collectionId: string, token: string, entryId: string): Promise<{ ok: boolean; error?: string }> {
  if (!TOKEN_RE.test(token) || !UUID_RE.test(collectionId) || !UUID_RE.test(entryId)) return { ok: false, error: "Havola noto‘g‘ri" };
  const { error } = await createAdminClient().rpc("col_public_delete", {
    p_collection: collectionId, p_token_hash: sha256(token), p_entry_id: entryId, p_ip_hash: await ipHash(),
  });
  return error ? { ok: false, error: dbMessage(error) } : { ok: true };
}

/** Imzolangan PDF ni yuklash uchun bir martalik manzil (token egasi uchun). Fayl brauzerdan to'g'ridan-to'g'ri saqlash joyiga yuklanadi. */
export async function createSignedUpload(
  collectionId: string,
  token: string,
): Promise<{ ok: boolean; path?: string; uploadToken?: string; error?: string }> {
  if (!TOKEN_RE.test(token) || !UUID_RE.test(collectionId)) return { ok: false, error: "Havola noto‘g‘ri" };
  const admin = createAdminClient();
  const { data } = await admin
    .from("collection_entries")
    .select("region_id,district_id,scope,group_mode")
    .eq("collection_id", collectionId)
    .eq("edit_token_hash", sha256(token))
    .is("deleted_at", null)
    .order("created_at")
    .limit(1);
  const first = data?.[0];
  if (!first) return { ok: false, error: "Havola noto‘g‘ri yoki hali ma’lumot kiritilmagan" };
  const unit = first.group_mode === "region" ? "boshqarma" : first.district_id ?? "viloyat";
  await ensureBucket();
  const path = signedPath(collectionId, first.region_id, unit);
  const { data: up, error } = await admin.storage.from(BUCKET).createSignedUploadUrl(path);
  if (error || !up) return { ok: false, error: "Yuklashni boshlab bo‘lmadi. Qayta urinib ko‘ring." };
  return { ok: true, path: up.path, uploadToken: up.token };
}
