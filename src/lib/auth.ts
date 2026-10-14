import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Role } from "@/lib/constants";
import type { Profile } from "@/lib/types";

export const getProfile = cache(async (): Promise<Profile | null> => {
  const supabase = await createClient();
  // getClaims — JWT ni mahalliy tekshiradi (Supabase Auth ga qo‘shimcha tarmoq so‘rovi yo‘q): har sahifada bitta so‘rov kam
  const { data: auth } = await supabase.auth.getClaims();
  const uid = auth?.claims?.sub;
  if (!uid) return null;
  const { data } = await supabase.from("profiles").select("*").eq("id", uid).maybeSingle();
  if (!data || !data.is_active) return null;
  return data as Profile;
});

export async function requireProfile(): Promise<Profile> {
  const p = await getProfile();
  if (!p) redirect("/login");
  return p;
}

export async function requireRole(...roles: Role[]): Promise<Profile> {
  const p = await requireProfile();
  if (!roles.includes(p.role)) redirect("/");
  return p;
}

export const isMinistry = (p: Pick<Profile, "role">) => p.role === "super_admin" || p.role === "observer";
export const canWrite = (p: Pick<Profile, "role">) => p.role !== "observer";
