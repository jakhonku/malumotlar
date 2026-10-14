import Link from "next/link";
import { redirect } from "next/navigation";
import { Check, FileCheck2, FileDown, FileSpreadsheet, Lock } from "lucide-react";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { deriveToken } from "@/lib/region-token";
import { getSignedReturn, listSignedFiles, signedReadiness } from "@/lib/signed-files";
import type { CollectionRow } from "@/lib/collections";
import { fmtDate, fmtDateTime } from "@/lib/format";
import { SignedUpload } from "@/components/collections/signed-upload";
import { Badge, buttonClass, Card, CardBody, EmptyState, PageHeader, cn } from "@/components/ui/primitives";

export const dynamic = "force-dynamic";

/** Viloyat boshqarmasi uchun: imzolangan PDF ni yuborish (barcha tuman ma’lumoti tasdiqlangandan keyin). */
export default async function SignedPdfPage() {
  const profile = await requireProfile();
  if (profile.role !== "region_manager" || !profile.region_id) redirect("/");
  const rid = profile.region_id;
  const supabase = await createClient();
  const { data } = await supabase.from("collections").select("*").order("created_at", { ascending: false });
  const cols = (data ?? []) as CollectionRow[];

  const cards = await Promise.all(
    cols.map(async (c) => {
      const [ready, files, ret] = await Promise.all([
        signedReadiness(c.id, rid),
        listSignedFiles(c.id, { regionId: rid }).catch(() => []),
        getSignedReturn(c.id, rid).catch(() => null),
      ]);
      return { c, ready, files: files.sort((a, b) => b.uploadedAt.getTime() - a.uploadedAt.getTime()), ret };
    }),
  );
  const visible = cards.filter(({ c, ready, files }) => c.is_active || files.length > 0 || ready.approved > 0);

  return (
    <>
      <PageHeader title="Imzolangan PDF" description="Barcha tuman/shaharlar ma’lumoti vazirlik tomonidan tasdiqlangach, Word’ni imzolab, skanerlab shu yerdan yuboring." />
      {visible.length === 0 ? (
        <Card><EmptyState title="Hozircha ma’lumot yig‘ish yo‘q" /></Card>
      ) : (
        <div className="space-y-5">
          {visible.map(({ c, ready, files, ret }) => {
            const last = files[0];
            const stale = !!last && !!ready.lastChangeAt && ready.lastChangeAt.getTime() > last.uploadedAt.getTime() + 60_000;
            const token = deriveToken(c.id, rid);
            const pct = ready.total ? Math.round((ready.approved / ready.total) * 100) : 0;
            return (
              <Card key={c.id}>
                <CardBody className="space-y-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <h2 className="text-xl font-semibold text-slate-900">{c.title}</h2>
                      {c.deadline && <p className="text-sm text-slate-600">Muddat: {fmtDate(c.deadline)}</p>}
                    </div>
                    {last ? (
                      <Badge tone="green"><FileCheck2 className="mr-1 inline h-3 w-3" />Yuborilgan</Badge>
                    ) : (
                      <Badge tone={ready.ready ? "amber" : "slate"}>{ready.ready ? "Yuborishga tayyor" : "Hali tayyor emas"}</Badge>
                    )}
                  </div>

                  <div>
                    <div className="mb-1 flex justify-between text-sm">
                      <span className="font-medium text-slate-800">Vazirlik tasdiqlagan hududlar</span>
                      <span className="text-slate-600">{ready.approved} / {ready.total}</span>
                    </div>
                    <div className="h-2.5 overflow-hidden rounded-full bg-slate-200" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
                      <div className={cn("h-full rounded-full", ready.ready ? "bg-emerald-600" : "bg-blue-700")} style={{ width: `${pct}%` }} />
                    </div>
                    {!ready.ready && (
                      <p className="mt-2 text-sm text-slate-700">
                        {ready.missing.length > 0 && <>Kiritilmagan: <b>{ready.missing.length}</b> ta. </>}
                        {ready.waiting > 0 && <>Tasdiq kutilmoqda: <b>{ready.waiting}</b> ta. </>}
                        <Link href="/boshqarma" className="text-blue-800 underline">Hududlar holatini ko‘rish</Link>
                      </p>
                    )}
                  </div>

                  {stale && (
                    <p role="alert" className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm font-medium text-amber-900">
                      Imzolangan PDF yuborilgandan keyin ma’lumot o‘zgargan ({fmtDateTime(ready.lastChangeAt!.toISOString())}). Yangi Word ni yuklab, imzolab, PDF ni qayta yuboring.
                    </p>
                  )}

                  {ret && !last && (
                    <p role="alert" className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm font-medium text-red-900">
                      Vazirlik imzolangan PDF ni qaytardi ({fmtDateTime(ret.at.toISOString())}). Sabab: {ret.reason} — tuzatib, yangisini yuboring.
                    </p>
                  )}

                  <ol className="grid gap-2 sm:grid-cols-3">
                    <li className={cn("flex items-start gap-2 rounded-lg border p-3 text-sm", ready.ready ? "border-emerald-300 bg-emerald-50" : "border-slate-200 bg-slate-50")}>
                      <span className={cn("flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold", ready.ready ? "bg-emerald-600 text-white" : "bg-slate-300 text-slate-700")}>{ready.ready ? <Check className="h-4 w-4" /> : 1}</span>
                      <span><b className="block">Hammasi tasdiqlansin</b><span className="text-xs text-slate-600">tuman/shaharlar ma’lumoti</span></span>
                    </li>
                    <li className="flex items-start gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-300 text-xs font-bold text-slate-700">2</span>
                      <span><b className="block">Word → imzo → skaner</b><span className="text-xs text-slate-600">yuklab olib imzolang</span></span>
                    </li>
                    <li className={cn("flex items-start gap-2 rounded-lg border p-3 text-sm", last ? "border-emerald-300 bg-emerald-50" : "border-slate-200 bg-slate-50")}>
                      <span className={cn("flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold", last ? "bg-emerald-600 text-white" : "bg-slate-300 text-slate-700")}>{last ? <Check className="h-4 w-4" /> : 3}</span>
                      <span><b className="block">PDF yuborish</b><span className="text-xs text-slate-600">imzolangan skan</span></span>
                    </li>
                  </ol>

                  {ready.missing.length >= ready.total ? (
                    <p className="rounded-md bg-slate-50 p-3 text-sm text-slate-600">Word/Excel hujjat ma’lumot kiritilgandan keyin shu yerda paydo bo‘ladi. <Link href="/boshqarma" className="text-blue-800 underline">Ma’lumot kiritish</Link></p>
                  ) : (
                  <div className="flex flex-wrap gap-2">
                    <a href={`/kiritish/export?c=${c.id}&t=${token}&format=docx`} className={buttonClass("success")}><FileDown className="h-4 w-4" /> Word yuklab olish</a>
                    <a href={`/kiritish/export?c=${c.id}&t=${token}&format=xlsx`} className={buttonClass("outline")}><FileSpreadsheet className="h-4 w-4" /> Excel yuklab olish</a>
                  </div>
                  )}

                  <div className="border-t border-slate-200 pt-4">
                    {ready.ready ? (
                      <>
                        <p className="mb-2 text-sm font-medium text-slate-800">{last ? "Yangi imzolangan PDF yuborish (oldingisi o‘rniga)" : "Imzolangan PDF ni yuborish"}</p>
                        <SignedUpload collectionId={c.id} />
                      </>
                    ) : (
                      <p role="status" className="flex items-start gap-2 rounded-md bg-amber-50 p-3 text-sm text-amber-900">
                        <Lock className="mt-0.5 h-4 w-4 shrink-0" /> {ready.message}
                      </p>
                    )}
                    {files.length > 0 && (
                      <ul className="mt-3 space-y-1 text-sm">
                        {files.map((f) => (
                          <li key={f.path} className="flex flex-wrap items-center gap-2">
                            <Badge tone="green">Yuborilgan</Badge>
                            <a href={f.url} target="_blank" rel="noreferrer" className="text-blue-800 underline">Imzolangan hujjat · {fmtDateTime(f.uploadedAt.toISOString())}</a>
                            {f.size > 0 && <span className="text-xs text-slate-500">{(f.size / 1024 / 1024).toFixed(1)} MB</span>}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </CardBody>
              </Card>
            );
          })}
        </div>
      )}
    </>
  );
}
