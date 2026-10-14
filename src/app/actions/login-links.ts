"use server";

import { getProfile } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { issueLoginLink, LINK_DAYS, siteOrigin } from "@/lib/login-links";
import { buildLoginLinksDocx } from "@/lib/report/login-links";
import { regionOrgName } from "@/lib/brand";

type One = { ok: boolean; url?: string; error?: string };
type All = { ok: boolean; count?: number; docx?: string; error?: string };

async function adminOnly() {
  const p = await getProfile();
  return p && p.role === "super_admin" ? p : null;
}

/** Bitta viloyat boshqarmasi uchun yangi tezkor kirish havolasi (eskisi bekor qilinadi). */
export async function makeLoginLink(userId: string): Promise<One> {
  const me = await adminOnly();
  if (!me) return { ok: false, error: "Bu amal faqat vazirlik administratori uchun" };
  const r = await issueLoginLink(userId, me.id);
  if (!r.ok) return r;
  await createAdminClient().from("audit_logs").insert({ user_id: me.id, action: "login.link.create", entity_type: "user", entity_id: userId, details: {} });
  return { ok: true, url: `${await siteOrigin()}/kirish/${r.token}` };
}

/** Barcha viloyat boshqarmalari uchun havolalar yaratib, Word hujjat (base64) qaytaradi. */
export async function makeAllLoginLinks(): Promise<All> {
  const me = await adminOnly();
  if (!me) return { ok: false, error: "Bu amal faqat vazirlik administratori uchun" };
  const admin = createAdminClient();
  const [{ data: profs }, { data: regs }] = await Promise.all([
    admin.from("profiles").select("id,region_id").eq("role", "region_manager").eq("is_active", true),
    admin.from("regions").select("id,name,sort_order").order("sort_order"),
  ]);
  const origin = await siteOrigin();
  const items: { org: string; url: string }[] = [];
  for (const r of regs ?? []) {
    const prof = (profs ?? []).find((x) => x.region_id === r.id);
    if (!prof) continue;
    const res = await issueLoginLink(prof.id as string, me.id);
    if (!res.ok) return { ok: false, error: res.error };
    items.push({ org: regionOrgName(r.name as string), url: `${origin}/kirish/${res.token}` });
  }
  if (!items.length) return { ok: false, error: "Viloyat boshqarmalari topilmadi" };
  await admin.from("audit_logs").insert({ user_id: me.id, action: "login.link.create_all", entity_type: "user", entity_id: null, details: { count: items.length } });
  const buf = await buildLoginLinksDocx(items, LINK_DAYS);
  return { ok: true, count: items.length, docx: buf.toString("base64") };
}
