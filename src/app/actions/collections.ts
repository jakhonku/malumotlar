"use server";

import { z } from "zod";
import { getProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { collectionInputSchema, newYearTemplate, validateAnswers, type CollectionRow } from "@/lib/collections";
import { returnReasonSchema } from "@/lib/validators";

type Result = { ok: boolean; id?: string; error?: string };

async function adminOnly() {
  const p = await getProfile();
  return p && p.role === "super_admin" ? p : null;
}

/** Yig'ish yaratish yoki yangilash. Faqat vazirlik administratori (RLS ham shuni talab qiladi). */
export async function saveCollection(id: string | null, input: unknown): Promise<Result> {
  const me = await adminOnly();
  if (!me) return { ok: false, error: "Bu amal faqat vazirlik administratori uchun" };
  const parsed = collectionInputSchema.safeParse(input);
  if (!parsed.success) {
    const i = parsed.error.issues[0];
    return { ok: false, error: i.message };
  }
  const v = parsed.data;
  const row = {
    title: v.title,
    description: v.description || null,
    entry_label: v.entry_label,
    audience: v.audience,
    allow_multiple: v.allow_multiple,
    is_active: v.is_active,
    deadline: v.deadline || null,
    fields: v.fields,
  };
  const supabase = await createClient();
  if (id) {
    if (!z.string().uuid().safeParse(id).success) return { ok: false, error: "Yig‘ish noto‘g‘ri" };
    const { error } = await supabase.from("collections").update(row).eq("id", id);
    if (error) return { ok: false, error: "Saqlab bo‘lmadi" };
    await supabase.rpc("log_action", { p_action: "collection.update", p_entity_type: "collection", p_entity_id: id, p_details: { title: v.title } });
    return { ok: true, id };
  }
  const { data, error } = await supabase.from("collections").insert({ ...row, created_by: me.id }).select("id").single();
  if (error) return { ok: false, error: "Yaratib bo‘lmadi" };
  await supabase.rpc("log_action", { p_action: "collection.create", p_entity_type: "collection", p_entity_id: data.id, p_details: { title: v.title } });
  return { ok: true, id: data.id };
}

export async function createNewYearTemplate(): Promise<Result> {
  return saveCollection(null, newYearTemplate());
}

export async function setCollectionActive(id: string, active: boolean): Promise<Result> {
  const me = await adminOnly();
  if (!me) return { ok: false, error: "Bu amal faqat vazirlik administratori uchun" };
  const supabase = await createClient();
  const { error } = await supabase.from("collections").update({ is_active: active }).eq("id", id);
  return error ? { ok: false, error: "Saqlab bo‘lmadi" } : { ok: true };
}

export async function reviewEntry(
  entryId: string,
  action: "approve" | "return" | "reopen",
  comment?: string,
): Promise<Result> {
  const me = await adminOnly();
  if (!me) return { ok: false, error: "Bu amal faqat vazirlik administratori uchun" };
  if (action !== "approve") {
    const r = returnReasonSchema.safeParse(comment ?? "");
    if (!r.success) return { ok: false, error: r.error.issues[0].message };
  }
  const supabase = await createClient();
  const { error } = await supabase.rpc("col_review", { p_entry: entryId, p_action: action, p_comment: comment?.trim() || null });
  if (error) return { ok: false, error: error.code === "P0001" ? error.message : "Amalni bajarib bo‘lmadi" };
  return { ok: true };
}

/** Administrator yuborilgan yozuvdagi ma'lumotni tahrirlaydi (holati o'zgarmaydi). */
export async function adminUpdateEntry(
  entryId: string,
  answers: Record<string, unknown>,
): Promise<{ ok: boolean; error?: string; fieldErrors?: Record<string, string> }> {
  const me = await adminOnly();
  if (!me) return { ok: false, error: "Bu amal faqat vazirlik administratori uchun" };
  if (!/^[0-9a-f-]{36}$/i.test(entryId)) return { ok: false, error: "Yozuv noto‘g‘ri" };
  const supabase = await createClient();
  const { data: e } = await supabase.from("collection_entries").select("collection_id").eq("id", entryId).maybeSingle();
  if (!e) return { ok: false, error: "Yozuv topilmadi" };
  const { data: col } = await supabase.from("collections").select("*").eq("id", e.collection_id).maybeSingle();
  if (!col) return { ok: false, error: "Ma’lumot yig‘ish topilmadi" };
  const v = validateAnswers((col as CollectionRow).fields, answers, false);
  if (!v.ok) return { ok: false, error: "Ba’zi maydonlar noto‘g‘ri to‘ldirilgan", fieldErrors: v.errors };
  const { error } = await supabase.rpc("col_admin_update", { p_entry: entryId, p_answers: v.values });
  return error ? { ok: false, error: error.message.includes("Qoralama") ? "Qoralamani tahrirlab bo‘lmaydi" : "Saqlab bo‘lmadi" } : { ok: true };
}

/** Hududning tekshiruv kutayotgan (yuborilgan) barcha yozuvlarini tasdiqlaydi. */
export async function approveRegionEntries(collectionId: string, regionId: string): Promise<{ ok: boolean; count?: number; error?: string }> {
  const me = await adminOnly();
  if (!me) return { ok: false, error: "Bu amal faqat vazirlik administratori uchun" };
  const uuid = /^[0-9a-f-]{36}$/i;
  if (!uuid.test(collectionId) || !uuid.test(regionId)) return { ok: false, error: "So‘rov noto‘g‘ri" };
  const supabase = await createClient();
  const { data } = await supabase
    .from("collection_entries").select("id").eq("collection_id", collectionId).eq("region_id", regionId).eq("status", "submitted").limit(1000);
  let done = 0;
  for (const row of data ?? []) {
    const { error } = await supabase.rpc("col_review", { p_entry: row.id, p_action: "approve", p_comment: null });
    if (error) return { ok: false, count: done, error: `${done} ta tasdiqlandi, keyin xatolik: ${error.message}` };
    done++;
  }
  return { ok: true, count: done };
}
