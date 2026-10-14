import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Role } from "@/lib/constants";
import type { Profile } from "@/lib/types";
import { isKicked } from "@/lib/session-utils";

type State = { profile: Profile | null; kicked: boolean };

const loadState = cache(async (): Promise<State> => {
  const supabase = await createClient();
  // getClaims — JWT ni mahalliy tekshiradi (Supabase Auth ga qo‘shimcha tarmoq so‘rovi yo‘q): har sahifada bitta so‘rov kam
  const { data: auth } = await supabase.auth.getClaims();
  const uid = auth?.claims?.sub;
  if (!uid) return { profile: null, kicked: false };
  const { data } = await supabase.from("profiles").select("*").eq("id", uid).maybeSingle();
  if (!data || !data.is_active) return { profile: null, kicked: false };
  // bitta profilga bitta sessiya: boshqa joydan kirilgan bo‘lsa, bu sessiya yopiladi
  const sid = (auth?.claims as { session_id?: string } | undefined)?.session_id;
  if (isKicked(sid, (data as { active_session_id?: string | null }).active_session_id)) return { profile: null, kicked: true };
  return { profile: data as Profile, kicked: false };
});

export const getProfile = async (): Promise<Profile | null> => (await loadState()).profile;

export async function requireProfile(): Promise<Profile> {
  const s = await loadState();
  if (!s.profile) redirect(s.kicked ? "/login?chiqarildi=1" : "/login");
  return s.profile;
}

export async function requireRole(...roles: Role[]): Promise<Profile> {
  const p = await requireProfile();
  if (!roles.includes(p.role)) redirect("/");
  return p;
}

export const isMinistry = (p: Pick<Profile, "role">) => p.role === "super_admin" || p.role === "observer";
export const canWrite = (p: Pick<Profile, "role">) => p.role !== "observer";
