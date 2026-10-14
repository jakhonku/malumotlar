import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { AVATAR_BUCKET } from "@/lib/constants";

export const MAX_AVATAR_BYTES = 900 * 1024;

let ready = false;
/** Maxfiy (private) rasm saqlash joyini bir marta yaratadi: faqat JPEG. */
export async function ensureAvatarBucket() {
  if (ready) return;
  const admin = createAdminClient();
  const { data } = await admin.storage.getBucket(AVATAR_BUCKET);
  if (!data) {
    const { error } = await admin.storage.createBucket(AVATAR_BUCKET, { public: false, fileSizeLimit: MAX_AVATAR_BYTES, allowedMimeTypes: ["image/jpeg"] });
    if (error && !/already exists/i.test(error.message)) throw new Error("Rasm saqlash joyini yaratib bo‘lmadi");
  }
  ready = true;
}

/** Rasm yo‘llari → vaqtinchalik (1 soatlik) havolalar. Rasmi yo‘qlar xaritaga kirmaydi. */
export async function avatarUrls(paths: (string | null | undefined)[]): Promise<Map<string, string>> {
  const list = [...new Set(paths.filter((p): p is string => !!p))];
  const out = new Map<string, string>();
  if (!list.length) return out;
  try {
    // ombor allaqachon bor (rasm yuklanganda yaratiladi) — har sahifada qo‘shimcha so‘rov yubormaymiz
    const { data } = await createAdminClient().storage.from(AVATAR_BUCKET).createSignedUrls(list, 3600);
    for (const r of data ?? []) if (r.path && r.signedUrl) out.set(r.path, r.signedUrl);
  } catch {
    /* rasm ko‘rinmasa ham sahifa ishlayveradi */
  }
  return out;
}
