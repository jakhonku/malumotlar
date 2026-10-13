"use server";

import { createHash, randomBytes } from "node:crypto";
import { headers } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { buildEventPayload, normalizeDistrictName, toFieldErrors } from "@/lib/event-payload";
import { validateAnswers, type CollectionRow } from "@/lib/collections";
import { BUCKET, ensureBucket, signedPath } from "@/lib/signed-files";
import { deriveToken } from "@/lib/region-token";
import { missingMessage, missingUnits } from "@/lib/completeness";
import { regionSelf } from "@/lib/brand";
import { getManager } from "@/lib/manager-guard";
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

/** Eski «Yangi yil tadbirlari» ochiq formasi yopilgan — ma’lumot faqat «Ma’lumot yig‘ish» orqali olinadi. */
const LEGACY_FORM_CLOSED = true;
const LOGIN_NEEDED = "Tizimga kiring: ma’lumotni faqat hudud boshqarmasi mas’uli kiritadi.";

/** Faqat tizimga kirgan hudud mas'uli va faqat o'z hududining havolasi bilan. */
async function authorize(collectionId: string, token: string | null): Promise<{ ok: true; region: string; token: string } | { ok: false; error: string }> {
  const me = await getManager();
  if (!me) return { ok: false, error: LOGIN_NEEDED };
  if (!UUID_RE.test(collectionId)) return { ok: false, error: "Ma’lumot yig‘ish topilmadi" };
  const own = deriveToken(collectionId, me.region_id);
  if (token !== null && token !== own) return { ok: false, error: "Havola sizning hududingizga tegishli emas" };
  return { ok: true, region: me.region_id, token: own };
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
  if (LEGACY_FORM_CLOSED) return { ok: false, error: "Bu forma yopilgan. Ma’lumotni /kiritish sahifasidagi ochiq yig‘ishlar orqali kiriting." };
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
  if (LEGACY_FORM_CLOSED) return { ok: false, error: "Bu forma yopilgan." };
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
  if (entryId && !UUID_RE.test(entryId)) return { ok: false, error: "Yozuv noto‘g‘ri" };
  const auth = await authorize(collectionId, token);
  if (!auth.ok) return { ok: false, error: auth.error };
  if (geo.region_id !== auth.region) return { ok: false, error: "Faqat o‘z hududingiz ma’lumotini kiritishingiz mumkin" };
  const col = await loadCollection(collectionId);
  if (!col) return { ok: false, error: "Ma’lumot yig‘ish topilmadi" };
  geo = { ...geo, group_mode: col.audience === "regional" ? "unit" : "region" };

  const v = validateAnswers(col.fields, answers, false);
  if (!v.ok) return { ok: false, error: "Ba’zi maydonlar noto‘g‘ri to‘ldirilgan", fieldErrors: v.errors };
  if (mode === "draft" && Object.values(v.values).every((x) => x === null || x === false || (Array.isArray(x) && !x.length))) {
    return { ok: false, error: "Hech bo‘lmaganda bitta maydonni to‘ldiring" };
  }

  const admin = createAdminClient();
  const ip = await ipHash();
  // Doimiy hudud havolasi: yozuvlar bor bo'lsa shu havolaga qo'shiladi, yo'q bo'lsa yangi guruh ochiladi
  const { count: existing } = await admin
    .from("collection_entries").select("id", { count: "exact", head: true })
    .eq("collection_id", col.id).eq("edit_token_hash", sha256(auth.token)).is("deleted_at", null);
  const hasGroup = (existing ?? 0) > 0;
  token = hasGroup ? auth.token : null;
  const newToken = hasGroup ? null : auth.token;
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
  const finalToken = auth.token;

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
  if (entryId && !UUID_RE.test(entryId)) return { ok: false, error: "Yozuv noto‘g‘ri" };
  const auth = await authorize(collectionId, token);
  if (!auth.ok) return { ok: false, error: auth.error };
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
  if (!UUID_RE.test(entryId)) return { ok: false, error: "Yozuv noto‘g‘ri" };
  const auth = await authorize(collectionId, token);
  if (!auth.ok) return { ok: false, error: auth.error };
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
  const auth = await authorize(collectionId, token);
  if (!auth.ok) return { ok: false, error: auth.error };
  const admin = createAdminClient();
  const { data } = await admin
    .from("collection_entries")
    .select("region_id,district_id,scope,group_mode,status")
    .eq("collection_id", collectionId)
    .eq("edit_token_hash", sha256(token))
    .is("deleted_at", null)
    .order("created_at")
    .limit(500);
  const first = data?.[0];
  if (!first) return { ok: false, error: "Havola noto‘g‘ri yoki hali ma’lumot kiritilmagan" };
  if (data.some((e) => e.status === "draft" || e.status === "revision"))
    return { ok: false, error: "Avval barcha yozuvlarni «Yuborish» orqali yuboring, so‘ng imzolangan PDF ni yuklang." };
  // barcha hudud (viloyatning o'zi va tuman/shaharlar) kiritilgan bo'lishi shart
  const col = await loadCollection(collectionId);
  if (col && first.group_mode === "region") {
    const [{ data: ds }, { data: reg }] = await Promise.all([
      admin.from("districts").select("id,name").eq("region_id", first.region_id).eq("is_active", true).limit(500),
      admin.from("regions").select("name").eq("id", first.region_id).maybeSingle(),
    ]);
    const miss = missingUnits(col.audience, regionSelf(reg?.name ?? ""), ds ?? [], data);
    if (miss.length) return { ok: false, error: missingMessage(miss) };
  }
  const unit = first.group_mode === "region" ? "boshqarma" : first.district_id ?? "viloyat";
  await ensureBucket();
  const path = signedPath(collectionId, first.region_id, unit, (await getManager())?.id);
  const { data: up, error } = await admin.storage.from(BUCKET).createSignedUploadUrl(path);
  if (error || !up) return { ok: false, error: "Yuklashni boshlab bo‘lmadi. Qayta urinib ko‘ring." };
  return { ok: true, path: up.path, uploadToken: up.token };
}
