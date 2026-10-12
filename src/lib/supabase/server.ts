import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export function isSupabaseConfigured(): boolean {
  return !!process.env.NEXT_PUBLIC_SUPABASE_URL && !!(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);
}

export function supabaseEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) {
    throw new Error("Supabase sozlanmagan: .env.local faylida NEXT_PUBLIC_SUPABASE_URL va NEXT_PUBLIC_SUPABASE_ANON_KEY ni kiriting.");
  }
  return { url, key };
}

/** Foydalanuvchi sessiyasi bilan ishlaydigan klient — RLS qo'llanadi. */
export async function createClient() {
  const { url, key } = supabaseEnv();
  const cookieStore = await cookies();
  return createServerClient(url, key, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (list) => {
        try {
          list.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Server Component ichida chaqirilganda cookie yozib bo'lmaydi — proxy yangilaydi.
        }
      },
    },
  });
}
