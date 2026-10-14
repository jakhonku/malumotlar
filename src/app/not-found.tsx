import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="max-w-md rounded-xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <p className="text-5xl font-bold text-blue-800">404</p>
        <h1 className="mt-3 text-xl font-semibold text-slate-900">Sahifa topilmadi</h1>
        <p className="mt-2 text-sm text-slate-600">Havola eskirgan yoki ma’lumot o‘chirilgan bo‘lishi mumkin. Bosh sahifaga qaytib, kerakli bo‘limni tanlang.</p>
        <Link href="/" className="mt-5 inline-flex items-center rounded-md bg-blue-800 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-900">Bosh sahifaga qaytish</Link>
      </div>
    </main>
  );
}
