"use server";

import { revalidatePath } from "next/cache";
import { getManager } from "@/lib/manager-guard";
import { createAdminClient } from "@/lib/supabase/admin";
import { normalizeDistrictName } from "@/lib/event-payload";

/** Viloyat boshqarmasi o‘z hududiga ro‘yxatda yo‘q tuman/shaharni qo‘lda qo‘shadi. */
export async function addMyDistrict(name: string, type: "tuman" | "shahar"): Promise<{ ok: boolean; error?: string }> {
  const me = await getManager();
  if (!me) return { ok: false, error: "Tizimga kiring" };
  const clean = (name ?? "").trim();
  if (clean.length < 3 || clean.length > 100) return { ok: false, error: "Nomi 3–100 belgidan iborat bo‘lsin" };
  if (!/^[\p{L}\p{M}0-9 .'‘’ʻ`-]+$/u.test(clean)) return { ok: false, error: "Nomda ruxsat etilmagan belgilar bor" };
  const full = normalizeDistrictName(clean, type === "shahar" ? "shahar" : "tuman");
  if (!full) return { ok: false, error: "Nomni kiriting" };

  const admin = createAdminClient();
  const { data: dup } = await admin.from("districts").select("id,is_active").eq("region_id", me.region_id).ilike("name", full).maybeSingle();
  if (dup) {
    if (dup.is_active) return { ok: false, error: "Bunday tuman/shahar ro‘yxatda allaqachon bor" };
    await admin.from("districts").update({ is_active: true }).eq("id", dup.id);
  } else {
    const { data: created, error } = await admin
      .from("districts").insert({ region_id: me.region_id, name: full, district_type: type === "shahar" ? "shahar" : "tuman" })
      .select("id").single();
    if (error || !created) return { ok: false, error: "Qo‘shib bo‘lmadi. Qayta urinib ko‘ring." };
    await admin.from("audit_logs").insert({
      user_id: me.id, action: "territory.district.create", entity_type: "territory", entity_id: created.id,
      details: { name: full, region_id: me.region_id, source: "region_panel" },
    });
  }
  revalidatePath("/boshqarma");
  return { ok: true };
}

/** Viloyat boshqarmasi o‘z hududidagi tuman/shahar nomini (va turini) tuzatadi — bog‘langan yozuvlar saqlanadi. */
export async function renameMyDistrict(id: string, name: string, type: "tuman" | "shahar"): Promise<{ ok: boolean; error?: string }> {
  const me = await getManager();
  if (!me) return { ok: false, error: "Tizimga kiring" };
  const clean = (name ?? "").trim();
  if (clean.length < 3 || clean.length > 100) return { ok: false, error: "Nomi 3–100 belgidan iborat bo‘lsin" };
  if (!/^[\p{L}\p{M}0-9 .'‘’ʻ`-]+$/u.test(clean)) return { ok: false, error: "Nomda ruxsat etilmagan belgilar bor" };
  const full = normalizeDistrictName(clean, type === "shahar" ? "shahar" : "tuman");
  if (!full) return { ok: false, error: "Nomni kiriting" };

  const admin = createAdminClient();
  const { data: cur } = await admin.from("districts").select("id,name,district_type,region_id").eq("id", id).maybeSingle();
  if (!cur || cur.region_id !== me.region_id) return { ok: false, error: "Bu tuman/shahar sizning hududingizga tegishli emas" };
  const dtype = type === "shahar" ? "shahar" : "tuman";
  if (cur.name === full && cur.district_type === dtype) return { ok: true };
  const { data: dup } = await admin.from("districts").select("id").eq("region_id", me.region_id).ilike("name", full.replace(/[%_]/g, "")).neq("id", id).maybeSingle();
  if (dup) return { ok: false, error: "Bunday nomli tuman/shahar ro‘yxatda allaqachon bor" };

  const { error } = await admin.from("districts").update({ name: full, district_type: dtype }).eq("id", id);
  if (error) return { ok: false, error: "Saqlab bo‘lmadi. Qayta urinib ko‘ring." };
  await admin.from("audit_logs").insert({
    user_id: me.id, action: "territory.district.rename", entity_type: "territory", entity_id: id,
    details: { from: cur.name, to: full, type: dtype, region_id: me.region_id, source: "region_panel" },
  });
  revalidatePath("/boshqarma");
  return { ok: true };
}

/** Mavjud bo‘lmagan/xato qo‘shilgan tuman-shaharni ro‘yxatdan chiqaradi. Faqat unga hech qanday ma’lumot kiritilmagan bo‘lsa. */
export async function hideMyDistrict(id: string): Promise<{ ok: boolean; error?: string }> {
  const me = await getManager();
  if (!me) return { ok: false, error: "Tizimga kiring" };
  const admin = createAdminClient();
  const { data: cur } = await admin.from("districts").select("id,name,region_id,is_active").eq("id", id).maybeSingle();
  if (!cur || cur.region_id !== me.region_id) return { ok: false, error: "Bu tuman/shahar sizning hududingizga tegishli emas" };
  const [{ count: c1 }, { count: c2 }] = await Promise.all([
    admin.from("collection_entries").select("id", { count: "exact", head: true }).eq("district_id", id).is("deleted_at", null),
    admin.from("events").select("id", { count: "exact", head: true }).eq("district_id", id),
  ]);
  if ((c1 ?? 0) + (c2 ?? 0) > 0) return { ok: false, error: "Bu tuman/shaharga ma’lumot kiritilgan — chiqarib bo‘lmaydi. Nomi xato bo‘lsa, uni tahrirlang." };
  const { error } = await admin.from("districts").update({ is_active: false }).eq("id", id);
  if (error) return { ok: false, error: "Amalni bajarib bo‘lmadi" };
  await admin.from("audit_logs").insert({
    user_id: me.id, action: "territory.district.hide", entity_type: "territory", entity_id: id,
    details: { name: cur.name, region_id: me.region_id, source: "region_panel" },
  });
  revalidatePath("/boshqarma");
  return { ok: true };
}
