import "server-only";
import { redirect } from "next/navigation";
import { getProfile } from "@/lib/auth";
import { deriveToken } from "@/lib/region-token";
import type { Profile } from "@/lib/types";

/** Ma'lumotni faqat tizimga kirgan hudud boshqarmasi mas'uli kiritadi. */
export async function getManager(): Promise<(Profile & { region_id: string }) | null> {
  const p = await getProfile();
  return p && p.role === "region_manager" && p.region_id ? (p as Profile & { region_id: string }) : null;
}

/** Sahifa uchun: kirmagan → /login, boshqa rol → bosh sahifa. */
export async function requireManager() {
  const p = await getProfile();
  if (!p) redirect("/login");
  const m = await getManager();
  if (!m) redirect("/");
  return m;
}

/** Sahifa uchun: havola (token) faqat shu mas'ulning o'z hududiniki bo'lishi shart. */
export async function requireManagerToken(collectionId: string, token: string) {
  const m = await requireManager();
  if (token !== deriveToken(collectionId, m.region_id)) redirect("/boshqarma");
  return m;
}
