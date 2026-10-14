"use server";

import { revalidatePath } from "next/cache";
import { getProfile } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { AVATAR_BUCKET } from "@/lib/constants";
import { ensureAvatarBucket, MAX_AVATAR_BYTES } from "@/lib/avatars";
import { normalizePhone } from "@/lib/phone";

type Result = { ok: boolean; error?: string };

/** Foydalanuvchi o‘z profilini to‘ldiradi: F.I.Sh., lavozim, telefon va ixtiyoriy 3x4 rasm. */
export async function saveMyProfile(fd: FormData): Promise<Result> {
  const me = await getProfile();
  if (!me) return { ok: false, error: "Tizimga kiring" };

  const fullName = String(fd.get("full_name") ?? "").trim().replace(/\s+/g, " ");
  const position = String(fd.get("position") ?? "").trim().replace(/\s+/g, " ");
  const phoneRaw = String(fd.get("phone") ?? "").trim();
  if (fullName.length < 3 || fullName.length > 100) return { ok: false, error: "F.I.Sh. 3–100 belgidan iborat bo‘lsin" };
  if (!/^[\p{L}\p{M}0-9 .'‘’ʻ`-]+$/u.test(fullName)) return { ok: false, error: "F.I.Sh. da ruxsat etilmagan belgilar bor" };
  if (position.length > 120) return { ok: false, error: "Lavozim 120 belgidan oshmasin" };
  const phone = phoneRaw ? normalizePhone(phoneRaw) : null;
  if (phoneRaw && !phone) return { ok: false, error: "Telefon raqami noto‘g‘ri (masalan: +998 90 123 45 67)" };

  const admin = createAdminClient();
  const patch: Record<string, unknown> = { full_name: fullName, position: position || null, phone };

  const photo = fd.get("photo");
  if (photo instanceof File && photo.size > 0) {
    if (photo.size > MAX_AVATAR_BYTES) return { ok: false, error: "Rasm hajmi katta. Boshqa rasm tanlang." };
    const buf = Buffer.from(await photo.arrayBuffer());
    if (!(buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff)) return { ok: false, error: "Faqat rasm (JPG/PNG) yuklash mumkin" };
    await ensureAvatarBucket();
    const path = `${me.id}.jpg`;
    const { error } = await admin.storage.from(AVATAR_BUCKET).upload(path, buf, { contentType: "image/jpeg", upsert: true });
    if (error) return { ok: false, error: "Rasmni yuklab bo‘lmadi. Qayta urinib ko‘ring." };
    patch.avatar_path = path;
  } else if (fd.get("remove_photo") === "1" && me.avatar_path) {
    await admin.storage.from(AVATAR_BUCKET).remove([me.avatar_path]);
    patch.avatar_path = null;
  }

  const { error } = await admin.from("profiles").update(patch).eq("id", me.id);
  if (error) return { ok: false, error: "Saqlab bo‘lmadi. Qayta urinib ko‘ring." };
  await admin.from("audit_logs").insert({ user_id: me.id, action: "profile.update", entity_type: "user", entity_id: me.id, details: { photo: !!patch.avatar_path } });
  revalidatePath("/", "layout");
  return { ok: true };
}

/** Profil rasmini darhol o‘chiradi (saqlash tugmasini bosish shart emas). */
export async function removeMyPhoto(): Promise<Result> {
  const me = await getProfile();
  if (!me) return { ok: false, error: "Tizimga kiring" };
  const admin = createAdminClient();
  if (me.avatar_path) await admin.storage.from(AVATAR_BUCKET).remove([me.avatar_path]);
  const { error } = await admin.from("profiles").update({ avatar_path: null }).eq("id", me.id);
  if (error) return { ok: false, error: "Rasmni o‘chirib bo‘lmadi. Qayta urinib ko‘ring." };
  await admin.from("audit_logs").insert({ user_id: me.id, action: "profile.photo.remove", entity_type: "user", entity_id: me.id, details: {} });
  revalidatePath("/", "layout");
  return { ok: true };
}
