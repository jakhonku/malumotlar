"use server";

import { getProfile } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendPush } from "@/lib/push";

export async function savePushSubscription(sub: { endpoint: string; keys: { p256dh: string; auth: string } }): Promise<{ ok: boolean; error?: string }> {
  const p = await getProfile();
  if (!p) return { ok: false, error: "Tizimga kiring" };
  if (!sub?.endpoint?.startsWith("https://") || !sub.keys?.p256dh || !sub.keys?.auth) return { ok: false, error: "Obuna noto‘g‘ri" };
  const { error } = await createAdminClient()
    .from("push_subscriptions")
    .upsert({ user_id: p.id, endpoint: sub.endpoint, p256dh: sub.keys.p256dh, auth: sub.keys.auth }, { onConflict: "endpoint" });
  return error ? { ok: false, error: "Obunani saqlab bo‘lmadi (baza yangilanmagan bo‘lishi mumkin)" } : { ok: true };
}

export async function removePushSubscription(endpoint: string): Promise<void> {
  const p = await getProfile();
  if (!p) return;
  await createAdminClient().from("push_subscriptions").delete().eq("endpoint", endpoint).eq("user_id", p.id);
}

/** Sinov: o‘zingizga xabarnoma yuboradi va natijani qaytaradi (qaysi bosqichda muammo borligini ko‘rsatadi). */
export async function sendTestPush(): Promise<{ ok: boolean; message: string }> {
  const p = await getProfile();
  if (!p) return { ok: false, message: "Tizimga kiring" };
  const st = await sendPush([p.id], { title: "Sinov xabarnomasi", body: "Push-xabarnoma ishlayapti ✅", url: "/chat", tag: "test" });
  if (!st.configured) return { ok: false, message: "Serverda push kalitlari sozlanmagan" };
  if (st.subscriptions === 0) return { ok: false, message: "Bu akkaunt uchun obuna topilmadi — «Push xabarnomani yoqish»ni bosing" };
  if (st.sent === 0) return { ok: false, message: `Yuborib bo‘lmadi (${st.errors.join(", ") || "noma’lum xato"})` };
  return { ok: true, message: `Yuborildi (${st.sent} ta qurilma). Xabarnoma chiqmasa, brauzer/Windows sozlamalarini tekshiring.` };
}
