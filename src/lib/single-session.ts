import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { sessionIdOf } from "@/lib/session-utils";

/**
 * Yangi kirishdan keyin chaqiriladi: shu sessiyani yagona faol sessiya qiladi va foydalanuvchining
 * qolgan barcha sessiyalarini (boshqa qurilmalar) bekor qiladi. 0020 migratsiyasi bo‘lmasa — jimgina o‘tkazib yuboradi.
 */
export async function takeOverSession(userId: string, accessToken: string): Promise<void> {
  const sid = sessionIdOf(accessToken);
  if (!sid) return;
  const admin = createAdminClient();
  const { error } = await admin.from("profiles").update({ active_session_id: sid }).eq("id", userId);
  if (error) return; // 0020 hali ishga tushirilmagan
  // boshqa qurilmalardagi sessiyalarning yangilash tokenlari bekor qilinadi; eski sahifalar esa keyingi bosishdayoq chiqariladi
  await admin.auth.admin.signOut(accessToken, "others").catch(() => {});
}
