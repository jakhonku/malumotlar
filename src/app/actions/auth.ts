"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { LOGIN_DOMAIN } from "@/lib/constants";
import { takeOverSession } from "@/lib/single-session";

interface LoginState {
  error?: string;
}

const loginSchema = z.object({
  login: z.string().trim().min(3, "Loginni kiriting").max(120),
  password: z.string().min(1, "Parolni kiriting").max(200),
});

export async function signIn(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const parsed = loginSchema.safeParse({ login: formData.get("login"), password: formData.get("password") });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const login = parsed.data.login.toLowerCase();
  const email = login.includes("@") ? login : `${login}@${LOGIN_DOMAIN}`;

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password: parsed.data.password });
  if (error || !data.user) return { error: "Login yoki parol noto‘g‘ri" };

  const { data: profile } = await supabase.from("profiles").select("is_active,role").eq("id", data.user.id).maybeSingle();
  if (!profile || !profile.is_active) {
    await supabase.auth.signOut();
    return { error: "Hisobingiz faol emas. Vazirlik administratori bilan bog‘laning." };
  }
  if (data.session) await takeOverSession(data.user.id, data.session.access_token);
  // to‘g‘ridan-to‘g‘ri o‘z sahifasiga (bosh sahifa orqali qo‘shimcha yo‘naltirish yo‘q — bitta tarmoq aylanishi kam)
  redirect(profile.role === "region_manager" ? "/boshqarma" : "/");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

export async function changePassword(
  _prev: { error?: string; ok?: boolean },
  formData: FormData,
): Promise<{ error?: string; ok?: boolean }> {
  const parsed = z
    .object({
      password: z.string().min(8, "Parol kamida 8 belgi bo‘lsin").max(72),
      confirm: z.string(),
    })
    .refine((v) => v.password === v.confirm, { message: "Parollar bir xil emas", path: ["confirm"] })
    .safeParse({ password: formData.get("password"), confirm: formData.get("confirm") });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) return { error: "Parolni o‘zgartirib bo‘lmadi. Qayta urinib ko‘ring." };
  return { ok: true };
}
