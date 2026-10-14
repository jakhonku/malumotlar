import { redirect } from "next/navigation";
import { getProfile } from "@/lib/auth";
import { isSupabaseConfigured } from "@/lib/supabase/server";
import { LoginForm } from "./login-form";
import { Emblem } from "@/components/brand/emblem";
import { DEPARTMENT_NAME } from "@/lib/brand";

export const dynamic = "force-dynamic";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ havola?: string; chiqarildi?: string }> }) {
  const sp = await searchParams;
  const configured = isSupabaseConfigured();
  const profile = configured ? await getProfile() : null;
  if (profile) redirect("/");

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-900 px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center text-white">
          <div className="mx-auto mb-5 flex h-44 w-44 items-center justify-center rounded-full bg-white p-2 shadow-2xl ring-4 ring-amber-500/40">
            <Emblem size={168} className="rounded-full" />
          </div>
          <p className="text-xs uppercase tracking-widest text-slate-300">O‘zbekiston Respublikasi</p>
          <h1 className="mt-1 text-2xl font-bold">Madaniyat vazirligi</h1>
          <p className="mt-2 text-sm font-medium text-slate-100">{DEPARTMENT_NAME}</p>
          <p className="mt-1 text-xs text-slate-300">Tadbirlar ma’lumotlarini yig‘ish va monitoring tizimi</p>
        </div>
        {sp.chiqarildi && (
          <p role="alert" className="mb-3 rounded-lg bg-amber-100 p-3 text-sm font-medium text-amber-900">Hisobingizga boshqa qurilma/brauzerdan kirildi, shuning uchun bu seans yopildi. Bitta hisobda bir vaqtda faqat bitta kishi ishlay oladi. Qayta kiring.</p>
        )}
        {sp.havola && (
          <p role="alert" className="mb-3 rounded-lg bg-amber-100 p-3 text-sm font-medium text-amber-900">Tezkor kirish havolasi eskirgan yoki bekor qilingan. Login va parol bilan kiring yoki vazirlikdan yangi havola so‘rang.</p>
        )}
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
