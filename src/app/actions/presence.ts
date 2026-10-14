"use server";

import { getProfile } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

/** «Men shu yerdaman» belgisi: oxirgi faollik vaqtini yangilaydi (kamida 45 soniyada bir marta yoziladi). */
export async function touchPresence(): Promise<void> {
  const me = await getProfile();
  if (!me) return;
  const now = Date.now();
  await createAdminClient()
    .from("profiles")
    .update({ last_seen_at: new Date(now).toISOString() })
    .eq("id", me.id)
    .or(`last_seen_at.is.null,last_seen_at.lt.${new Date(now - 45_000).toISOString()}`);
}
