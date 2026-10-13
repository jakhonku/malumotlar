"use server";

import { getProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendPush } from "@/lib/push";
import { regionOrgName } from "@/lib/brand";

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

  // push-xabarnoma: kim yozganini ko'rsatadi
  const admin = createAdminClient();
  const preview = text.length > 140 ? `${text.slice(0, 137)}…` : text;
  if (p.role === "super_admin") {
    let to: string[] = [];
    if (thread) to = [thread];
    else {
      const { data } = await admin.from("profiles").select("id").eq("role", "region_manager").eq("is_active", true).limit(500);
      to = (data ?? []).map((r) => r.id);
    }
    await sendPush(to, {
      title: thread ? "Vazirlikdan xabar" : "Vazirlikdan umumiy xabar",
      body: preview, url: thread ? `/chat?u=${thread}` : "/chat?u=all", tag: thread ?? "all",
    });
  } else {
    const { data: reg } = p.region_id ? await admin.from("regions").select("name").eq("id", p.region_id).maybeSingle() : { data: null };
    const who = reg?.name ? regionOrgName(reg.name) : p.full_name;
    const { data } = await admin.from("profiles").select("id").eq("role", "super_admin").eq("is_active", true).limit(50);
    await sendPush((data ?? []).map((r) => r.id), { title: who, body: preview, url: `/chat?u=${p.id}`, tag: p.id });
  }
  return { ok: true };
}

export async function markChatRead(threadKey: string): Promise<void> {
  const p = await getProfile();
  if (!p || (threadKey !== "all" && !UUID_RE.test(threadKey))) return;
  await (await createClient()).rpc("chat_mark_read", { p_thread_key: threadKey });
}
