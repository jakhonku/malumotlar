import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Role } from "@/lib/constants";
import type { Profile } from "@/lib/types";

export const getProfile = cache(async (): Promise<Profile | null> => {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return null;
  const { data } = await supabase.from("profiles").select("*").eq("id", auth.user.id).maybeSingle();
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
