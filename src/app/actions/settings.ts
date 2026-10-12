"use server";

import { z } from "zod";
import { getProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

type Result = { ok: boolean; error?: string };

async function adminOnly() {
  const p = await getProfile();
  return p && p.role === "super_admin" ? p : null;
}

async function audit(userId: string, action: string, entityId: string | null, details: Record<string, unknown>) {
  await createAdminClient().from("audit_logs").insert({ user_id: userId, action, entity_type: "territory", entity_id: entityId, details });
}

const regionSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(3, "Nomni kiriting").max(120),
  region_type: z.enum(["respublika", "viloyat", "shahar"]),
  is_active: z.boolean(),
});

const districtSchema = z.object({
  id: z.string().uuid().optional(),
  region_id: z.string().uuid(),
  name: z.string().trim().min(3, "Nomni kiriting").max(120),
  district_type: z.enum(["tuman", "shahar"]),
  is_active: z.boolean(),
});

function failure(error: { code?: string }): Result {
  return { ok: false, error: error.code === "23505" ? "Bunday nom allaqachon mavjud" : "Saqlab bo‘lmadi" };
}

export async function saveRegion(input: unknown): Promise<Result> {
  const me = await adminOnly();
  if (!me) return { ok: false, error: "Faqat vazirlik administratori uchun" };
  const parsed = regionSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const { id, ...v } = parsed.data;
  const supabase = await createClient();
  if (id) {
    const { error } = await supabase.from("regions").update(v).eq("id", id);
    if (error) return failure(error);
    await audit(me.id, "territory.region.update", id, v);
  } else {
    const { count } = await supabase.from("regions").select("id", { count: "exact", head: true });
    const code = v.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "hudud";
    const { data, error } = await supabase
      .from("regions")
      .insert({ ...v, code: `${code}-${Date.now().toString(36)}`, sort_order: (count ?? 0) + 1 })
      .select("id")
      .single();
    if (error) return failure(error);
    await audit(me.id, "territory.region.create", data.id, v);
  }
  return { ok: true };
}

export async function saveDistrict(input: unknown): Promise<Result> {
  const me = await adminOnly();
  if (!me) return { ok: false, error: "Faqat vazirlik administratori uchun" };
  const parsed = districtSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const { id, ...v } = parsed.data;
  const supabase = await createClient();
  if (id) {
    // tuman boshqa viloyatga ko‘chirilmaydi
    const rest = { name: v.name, district_type: v.district_type, is_active: v.is_active };
    const { error } = await supabase.from("districts").update(rest).eq("id", id);
    if (error) return failure(error);
    await audit(me.id, "territory.district.update", id, rest);
  } else {
    const { data, error } = await supabase.from("districts").insert(v).select("id").single();
    if (error) return failure(error);
    await audit(me.id, "territory.district.create", data.id, v);
  }
  return { ok: true };
}
