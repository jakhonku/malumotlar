import { redirect } from "next/navigation";
import { getProfile } from "@/lib/auth";
import { isSupabaseConfigured } from "@/lib/supabase/server";
import { LoginForm } from "./login-form";
import { Emblem } from "@/components/brand/emblem";
import { DEPARTMENT_NAME } from "@/lib/brand";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const configured = isSupabaseConfigured();
  const profile = configured ? await getProfile() : null;
  if (profile) redirect("/");

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-900 px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center text-white">
          <div className="mx-auto mb-4 flex h-28 w-28 items-center justify-center rounded-full bg-white shadow-lg">
            <Emblem size={88} />
          </div>
          <p className="text-xs uppercase tracking-widest text-slate-300">O‘zbekiston Respublikasi</p>
          <h1 className="mt-1 text-2xl font-bold">Madaniyat vazirligi</h1>
          <p className="mt-2 text-sm font-medium text-slate-100">{DEPARTMENT_NAME}</p>
          <p className="mt-1 text-xs text-slate-300">Tadbirlar ma’lumotlarini yig‘ish va monitoring tizimi</p>
        </div>
        <div className="rounded-xl bg-white p-6 shadow-2xl">
          <h2 className="mb-4 text-lg font-semibold text-slate-900">Tizimga kirish</h2>
          {configured ? (
            <LoginForm />
          ) : (
            <p role="alert" className="rounded-md bg-amber-50 p-3 text-sm text-amber-900">
              Tizim hali sozlanmagan: <code>.env.local</code> faylida <code>NEXT_PUBLIC_SUPABASE_URL</code> va{" "}
              <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code> qiymatlarini kiriting (README.md ga qarang).
            </p>
          )}
        </div>
      </div>
    </main>
  );
}
