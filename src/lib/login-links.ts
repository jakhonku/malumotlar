import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { headers } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { LOGIN_DOMAIN } from "@/lib/constants";

/** Havola amal qilish muddati (kun). Yangi havola yaratilsa, shu foydalanuvchining eskisi darhol bekor bo‘ladi. */
export const LINK_DAYS = 2;

/** Toshkent vaqti: dd.MM.yyyy HH:mm */
export const fmtTashkent = (iso: string) =>
  new Intl.DateTimeFormat("ru-RU", { timeZone: "Asia/Tashkent", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(iso)).replace(",", "");
const sha = (s: string) => createHash("sha256").update(s).digest("hex");

/** Saytning haqiqiy manzili (so‘rov qayerdan kelgan bo‘lsa, shu): https://domen */
export async function siteOrigin(): Promise<string> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

/** Foydalanuvchi uchun yangi havola yaratadi; avvalgilari bekor qilinadi. Havolaning o‘zi faqat shu yerda ko‘rinadi. */
export async function issueLoginLink(userId: string, createdBy: string): Promise<{ ok: true; token: string; expiresAt: string } | { ok: false; error: string }> {
  const admin = createAdminClient();
  const { data: p } = await admin.from("profiles").select("id,role,is_active").eq("id", userId).maybeSingle();
  if (!p || !p.is_active) return { ok: false, error: "Foydalanuvchi topilmadi yoki faol emas" };
  if (p.role !== "region_manager") return { ok: false, error: "Tezkor havola faqat viloyat boshqarmasi uchun yaratiladi" };
  await admin.from("login_links").update({ revoked_at: new Date().toISOString() }).eq("user_id", userId).is("revoked_at", null);
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + LINK_DAYS * 86_400_000).toISOString();
  const { error } = await admin.from("login_links").insert({ user_id: userId, token_hash: sha(token), created_by: createdBy, expires_at: expiresAt });
  if (error) return { ok: false, error: "Havolani saqlab bo‘lmadi (0019 migratsiyasi ishga tushirilganmi?)" };
  return { ok: true, token, expiresAt };
}

/** Havola to‘g‘ri bo‘lsa, foydalanuvchining login (email) manzilini qaytaradi va ishlatilganini yozadi. */
export async function resolveLoginLink(token: string): Promise<{ userId: string; email: string } | null> {
  if (!/^[A-Za-z0-9_-]{40,60}$/.test(token)) return null;
  const admin = createAdminClient();
  const { data: l } = await admin.from("login_links").select("id,user_id,expires_at,revoked_at,use_count").eq("token_hash", sha(token)).maybeSingle();
  if (!l || l.revoked_at || new Date(l.expires_at) < new Date()) return null;
  const { data: p } = await admin.from("profiles").select("username,role,is_active").eq("id", l.user_id).maybeSingle();
  if (!p || !p.is_active || p.role !== "region_manager") return null;
  await admin.from("login_links").update({ last_used_at: new Date().toISOString(), use_count: (l.use_count ?? 0) + 1 }).eq("id", l.id);
  await admin.from("audit_logs").insert({ user_id: l.user_id, action: "login.link", entity_type: "user", entity_id: l.user_id, details: {} });
  return { userId: l.user_id, email: `${p.username}@${LOGIN_DOMAIN}` };
}
