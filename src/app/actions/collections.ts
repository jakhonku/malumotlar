"use server";

import { z } from "zod";
import { getProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { collectionInputSchema, newYearTemplate } from "@/lib/collections";
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
