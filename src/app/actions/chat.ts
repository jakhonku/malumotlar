"use server";

import { getProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** thread: null — umumiy xabar (faqat admin), aks holda suhbat egasining profil id si. */
export async function sendChatMessage(thread: string | null, body: string): Promise<{ ok: boolean; error?: string }> {
  const p = await getProfile();
  if (!p || (p.role !== "super_admin" && p.role !== "region_manager")) return { ok: false, error: "Ruxsat yo‘q" };
  if (thread !== null && !UUID_RE.test(thread)) return { ok: false, error: "Suhbat noto‘g‘ri" };
  const text = body.trim();
  if (!text) return { ok: false, error: "Xabar matnini yozing" };
  if (text.length > 4000) return { ok: false, error: "Xabar 4000 belgidan oshmasin" };
  const supabase = await createClient();
  const { error } = await supabase.rpc("send_message", { p_thread: thread, p_body: text });
  if (error) return { ok: false, error: error.message.includes("Faqat vazirlik") ? "Faqat vazirlik bilan yozishma mumkin" : "Xabar yuborilmadi" };
  return { ok: true };
}

export async function markChatRead(threadKey: string): Promise<void> {
  const p = await getProfile();
  if (!p || (threadKey !== "all" && !UUID_RE.test(threadKey))) return;
  await (await createClient()).rpc("chat_mark_read", { p_thread_key: threadKey });
}
