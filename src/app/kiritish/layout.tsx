import Link from "next/link";
import { Snowflake } from "lucide-react";

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen">
      <header className="bg-slate-900 text-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-4">
          <Link href="/kiritish" className="flex items-center gap-3">
            <Snowflake className="h-7 w-7 text-blue-300" />
            <span className="leading-tight">
              <span className="block text-sm font-bold">O‘zbekiston Respublikasi Madaniyat vazirligi</span>
              <span className="block text-xs text-slate-300">Yangi yil tadbirlari ma’lumotlarini yig‘ish</span>
            </span>
          </Link>
          <Link href="/login" className="text-xs text-slate-300 underline-offset-4 hover:text-white hover:underline">
            Vazirlik xodimlari uchun kirish
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-8">{children}</main>
    </div>
  );
}
