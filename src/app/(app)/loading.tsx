/** Sahifa almashganda darhol ko‘rinadigan yengil skelet — serverdan javob kelguncha «qotib qolgan» tuyg‘usi bo‘lmaydi. */
export default function Loading() {
  return (
    <div className="animate-pulse space-y-4" aria-busy="true" aria-label="Yuklanmoqda">
      <div className="h-8 w-64 rounded bg-slate-200" />
      <div className="h-4 w-96 max-w-full rounded bg-slate-200" />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-24 rounded-xl bg-slate-200" />)}
      </div>
      <div className="h-64 rounded-xl bg-slate-200" />
    </div>
  );
}
