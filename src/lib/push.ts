import "server-only";
import webpush from "web-push";
import { createAdminClient } from "@/lib/supabase/admin";

export interface PushPayload { title: string; body: string; url: string; tag?: string }

let ready = false;
function init(): boolean {
  if (ready) return true;
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY, priv = process.env.VAPID_PRIVATE_KEY;
  if (!pub || !priv) return false;
  webpush.setVapidDetails(process.env.VAPID_SUBJECT || "mailto:admin@example.com", pub, priv);
  ready = true;
  return true;
}

/** Foydalanuvchilarga push yuboradi; yaroqsiz (o‘chirilgan) obunalar tozalanadi. Xatolik asosiy amalni to‘xtatmaydi. */
export async function sendPush(userIds: string[], payload: PushPayload): Promise<void> {
  if (!userIds.length || !init()) return;
  try {
    const admin = createAdminClient();
    const { data } = await admin.from("push_subscriptions").select("id,endpoint,p256dh,auth").in("user_id", userIds).limit(2000);
    const body = JSON.stringify(payload);
    await Promise.allSettled(
      (data ?? []).map(async (s) => {
        try {
          await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, body, { TTL: 86400 });
        } catch (e) {
          const code = (e as { statusCode?: number }).statusCode;
          if (code === 404 || code === 410) await admin.from("push_subscriptions").delete().eq("id", s.id);
        }
      }),
    );
  } catch {
    /* push — qo‘shimcha xizmat */
  }
}
