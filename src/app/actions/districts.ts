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
