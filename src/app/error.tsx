"use client";

import Link from "next/link";

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="max-w-md rounded-xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <h1 className="text-xl font-semibold text-slate-900">Kutilmagan xatolik</h1>
        <p className="mt-2 text-sm text-slate-600">Sahifani yuklashda muammo bo‘ldi. Qayta urinib ko‘ring; takrorlansa, bosh sahifaga qayting.</p>
        <div className="mt-5 flex justify-center gap-2">
          <button onClick={reset} className="cursor-pointer rounded-md bg-blue-800 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-900">Qayta urinish</button>
          <Link href="/" className="rounded-md border border-slate-300 px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50">Bosh sahifa</Link>
        </div>
      </div>
    </main>
  );
}
