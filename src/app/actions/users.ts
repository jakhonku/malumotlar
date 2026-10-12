"use server";

import { z } from "zod";
import { getProfile } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { LOGIN_DOMAIN } from "@/lib/constants";
import { normalizePhone } from "@/lib/phone";
import { userCreateSchema } from "@/lib/validators";

type Result = { ok: boolean; error?: string };

async function requireAdmin() {
  const p = await getProfile();
  if (!p || p.role !== "super_admin") return null;
  return p;
}

async function audit(userId: string, action: string, entityId: string | null, details: Record<string, unknown>) {
  const admin = createAdminClient();
  await admin.from("audit_logs").insert({ user_id: userId, action, entity_type: "user", entity_id: entityId, details });
}

/** Ro‘yxatda yo‘q tuman/shahar nomi yozilgan bo‘lsa, shu viloyat ostida yaratadi (yoki mavjudini topadi). */
async function resolveNewDistrict(regionId: string | null | undefined, name: unknown, type: unknown): Promise<string | null> {
  const raw = typeof name === "string" ? name.trim().replace(/\s+/g, " ") : "";
  if (!regionId || raw.length < 3) return null;
  const isCity = type === "shahar";
  const full = /(tumani|shahri|tuman|shahar)$/i.test(raw) ? raw : `${raw} ${isCity ? "shahri" : "tumani"}`;
  const admin = createAdminClient();
  const { data: found } = await admin.from("districts").select("id").eq("region_id", regionId).ilike("name", full.replace(/[%_]/g, "")).maybeSingle();
  if (found) return found.id;
  const { data, error } = await admin.from("districts").insert({ region_id: regionId, name: full, district_type: isCity ? "shahar" : "tuman" }).select("id").single();
  return error ? null : data.id;
}

function normalizeInput(v: z.infer<typeof userCreateSchema>) {
  const region = v.role === "super_admin" ? null : (v.region_id ?? null);
  const district = v.role === "district_manager" ? (v.district_id ?? null) : null;
  return {
    region_id: region,
    district_id: district,
    can_edit_districts: v.role === "region_manager" ? !!v.can_edit_districts : false,
  };
}

export async function createUser(input: unknown): Promise<Result> {
  const me = await requireAdmin();
  if (!me) return { ok: false, error: "Bu amal faqat vazirlik administratori uchun" };

  const parsed = userCreateSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const v = parsed.data;
  const extra = input as { new_district_name?: string; new_district_type?: string };
  if (v.role === "district_manager" && !v.district_id) {
    v.district_id = await resolveNewDistrict(v.region_id, extra.new_district_name, extra.new_district_type);
    if (!v.district_id) return { ok: false, error: "Tuman/shaharni tanlang yoki nomini yozing" };
  }

  let phone: string | null = null;
  if (v.phone) {
    phone = normalizePhone(v.phone);
    if (!phone) return { ok: false, error: "Telefon raqami noto‘g‘ri" };
  }

  const admin = createAdminClient();
  const { data: created, error: authErr } = await admin.auth.admin.createUser({
    email: `${v.username}@${LOGIN_DOMAIN}`,
    password: v.password,
    email_confirm: true,
  });
  if (authErr || !created.user) {
    return { ok: false, error: authErr?.message?.toLowerCase().includes("already") ? "Bunday login band" : "Foydalanuvchini yaratib bo‘lmadi" };
  }

  const scope = normalizeInput(v);
  const { error: profErr } = await admin.from("profiles").insert({
    id: created.user.id,
    username: v.username,
    full_name: v.full_name,
    role: v.role,
    phone,
    ...scope,
  });
  if (profErr) {
    await admin.auth.admin.deleteUser(created.user.id); // qisman yaratilgan hisobni qaytarish
    return { ok: false, error: profErr.code === "23505" ? "Bunday login band" : "Profilni saqlab bo‘lmadi. Hudud ma’lumotlarini tekshiring." };
  }
  await audit(me.id, "user.create", created.user.id, { username: v.username, role: v.role, ...scope });
  return { ok: true };
}

const updateSchema = z.object({
  id: z.string().uuid(),
  full_name: z.string().trim().min(3, "F.I.Sh. ni kiriting"),
  role: z.enum(["super_admin", "region_manager", "district_manager", "observer"]),
  region_id: z.string().uuid().nullable().optional(),
  district_id: z.string().uuid().nullable().optional(),
  phone: z.string().trim().optional(),
  can_edit_districts: z.boolean().optional(),
  is_active: z.boolean(),
});

export async function updateUser(input: unknown): Promise<Result> {
  const me = await requireAdmin();
  if (!me) return { ok: false, error: "Bu amal faqat vazirlik administratori uchun" };
  const parsed = updateSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const v = parsed.data;

  if (v.id === me.id && (!v.is_active || v.role !== "super_admin")) {
    return { ok: false, error: "O‘zingizning rolingizni o‘zgartirib yoki hisobingizni faolsizlantirib bo‘lmaydi" };
  }
  if ((v.role === "region_manager" || v.role === "district_manager") && !v.region_id) return { ok: false, error: "Viloyatni tanlang" };
  if (v.role === "district_manager" && !v.district_id) {
    const extra = input as { new_district_name?: string; new_district_type?: string };
    v.district_id = await resolveNewDistrict(v.region_id, extra.new_district_name, extra.new_district_type);
    if (!v.district_id) return { ok: false, error: "Tuman/shaharni tanlang yoki nomini yozing" };
  }

  let phone: string | null = null;
  if (v.phone) {
    phone = normalizePhone(v.phone);
    if (!phone) return { ok: false, error: "Telefon raqami noto‘g‘ri" };
  }

  const admin = createAdminClient();
  const scope = normalizeInput({ ...v, username: "x_user", password: "xxxxxxxx" });
  const { error } = await admin
    .from("profiles")
    .update({ full_name: v.full_name, role: v.role, phone, is_active: v.is_active, ...scope })
    .eq("id", v.id);
  if (error) return { ok: false, error: "Saqlab bo‘lmadi. Hudud ma’lumotlarini tekshiring." };

  // Faolsizlantirilgan foydalanuvchi tizimga kira olmasligi uchun auth darajasida ham bloklanadi
  await admin.auth.admin.updateUserById(v.id, { ban_duration: v.is_active ? "none" : "876000h" });
  await audit(me.id, "user.update", v.id, { role: v.role, is_active: v.is_active, ...scope });
  return { ok: true };
}

export async function resetPassword(userId: string, password: string): Promise<Result> {
  const me = await requireAdmin();
  if (!me) return { ok: false, error: "Bu amal faqat vazirlik administratori uchun" };
  if (!z.string().uuid().safeParse(userId).success) return { ok: false, error: "Foydalanuvchi noto‘g‘ri" };
  if (password.length < 8) return { ok: false, error: "Parol kamida 8 belgi bo‘lsin" };
  const admin = createAdminClient();
  const { error } = await admin.auth.admin.updateUserById(userId, { password });
  if (error) return { ok: false, error: "Parolni o‘zgartirib bo‘lmadi" };
  await audit(me.id, "user.reset_password", userId, {});
  return { ok: true };
}
