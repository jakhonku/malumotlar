import { regionSelf } from "@/lib/brand";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Plus } from "lucide-react";
import { entryUnit, getCollection, getEntryGroup, isOpen, unitLabel } from "@/lib/public-collection";
import { createAdminClient } from "@/lib/supabase/admin";
import { displayValue } from "@/lib/collections";
import { Badge, buttonClass, Card, CardHeader, CardTitle, Table, Td, Th } from "@/components/ui/primitives";
import { StatusBadge } from "@/components/ui/status-badge";
import { requireManagerToken } from "@/lib/manager-guard";
import { EntrySubmit } from "@/components/collections/entry-submit";
import { EntryDelete } from "@/components/collections/entry-delete";
import { SignedUpload } from "@/components/collections/signed-upload";
import { listSignedFiles } from "@/lib/signed-files";
import { fmtDateTime } from "@/lib/format";
import { CardBody } from "@/components/ui/primitives";
import { FileDown, FileSpreadsheet } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function CollectionUnitPage({ params }: { params: Promise<{ cid: string; token: string }> }) {
  const { cid, token } = await params;
  await requireManagerToken(cid, token);
  const col = await getCollection(cid);
  const group = col ? await getEntryGroup(cid, token) : null;
  if (!col || !group) notFound();

  const open = isOpen(col);
  const regionMode = group.groupMode === "region";

  // Boshqarma rejimi: viloyat va barcha tuman/shaharlar bo'yicha to'ldirish holati
  type Row = { key: string; name: string; unit: string; count: number; sent: number };
  let checklist: Row[] = [];
  if (regionMode) {
    const { data: ds } = await createAdminClient()
      .from("districts").select("id,name").eq("region_id", group.regionId).eq("is_active", true)
      .order("district_type", { ascending: false }).order("name").limit(500);
    const all = group.entries;
    const stat = (pred: (e: (typeof all)[number]) => boolean) => {
      const list = all.filter(pred);
      return { count: list.length, sent: list.filter((e) => e.status === "submitted" || e.status === "approved").length };
    };
    if (col.audience !== "district") checklist.push({ key: "regional", name: regionSelf(group.regionName), unit: "regional", ...stat((e) => e.scope === "regional") });
    for (const d of ds ?? []) checklist.push({ key: d.id, name: d.name, unit: d.id, ...stat((e) => e.district_id === d.id) });
    if (col.audience === "regional") checklist = [];
  }
  const unitKey = group.groupMode === "region" ? "boshqarma" : group.districtId ?? "viloyat";
  const files = await listSignedFiles(col.id, { regionId: group.regionId, unit: unitKey }).catch(() => []);
  const exportHref = (f: string) => `/kiritish/export?c=${col.id}&t=${token}&format=${f}`;
  const filled = checklist.filter((r) => r.count > 0).length;
  const pending = group.entries.filter((e) => e.status === "draft" || e.status === "revision");
  const base = `/kiritish/c/${col.id}`;
  const label = col.entry_label;
  const unfilled = regionMode ? checklist.length - filled : 0;
  const uploadBlock =
    group.entries.length === 0
      ? "Avval ma’lumot kiriting va yuboring — shundan keyin imzolangan PDF ni yuborish mumkin bo‘ladi."
      : pending.length > 0
        ? `Hali yuborilmagan yozuvlar bor (${pending.length} ta). Avval hammasini «Yuborish» orqali yuboring, so‘ng imzolangan PDF ni yuklang.`
        : null;

  return (
    <div className="space-y-5">
      <div>
        <p className="text-xs uppercase tracking-wide text-slate-500">{col.title}</p>
        <h1 className="text-2xl font-bold text-slate-900">{unitLabel(group)}</h1>
      </div>

      {!open && <div role="alert" className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">Bu ma’lumot yig‘ish yopiq — yangi yozuv qo‘shib yoki yuborib bo‘lmaydi.</div>}

      {regionMode && checklist.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Hududlar bo‘yicha holat</CardTitle>
            <span className="text-sm text-slate-600">To‘ldirilgan: <b>{filled}</b> / {checklist.length}</span>
          </CardHeader>
          <Table>
            <thead><tr><Th>Hudud</Th><Th>Holati</Th><Th>Yozuvlar</Th><Th><span className="sr-only">Amal</span></Th></tr></thead>
            <tbody>
              {checklist.map((r) => (
                <tr key={r.key} className="hover:bg-slate-50">
                  <Td className="font-medium">{r.name}</Td>
                  <Td>
                    {r.sent > 0 ? <Badge tone="green">Yuborilgan</Badge> : r.count > 0 ? <Badge tone="amber">Yuborilmagan</Badge> : <Badge tone="red">Kiritilmagan</Badge>}
                  </Td>
                  <Td>{r.count}</Td>
                  <Td>
                    {open && (col.allow_multiple || r.count === 0) && (
                      <Link href={`${base}/t/${token}/yangi?unit=${r.unit}`} className={buttonClass(r.count ? "outline" : "default", "sm")}>
                        <Plus className="h-3.5 w-3.5" /> {r.count ? "Yana qo‘shish" : "Kiritish"}
                      </Link>
                    )}
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Kiritilgan ma’lumotlar jadvali</CardTitle>
          <span className="text-sm text-slate-600">Jami: <b>{group.entries.length}</b> · yuborilmagan: <b>{pending.length}</b></span>
        </CardHeader>
        <Table>
          <thead>
            <tr>
              <Th>№</Th>
              {regionMode && <Th>Hudud</Th>}
              {col.fields.map((f) => <Th key={f.key}>{f.label}</Th>)}
              <Th>Holati</Th>
              <Th><span className="sr-only">Amal</span></Th>
            </tr>
          </thead>
          <tbody>
            {group.entries.map((e, i) => {
              const editable = open && e.status !== "approved";
              const sendable = e.status === "draft" || e.status === "revision";
              return (
                <tr key={e.id} className="hover:bg-slate-50">
                  <Td className="text-slate-500">{i + 1}</Td>
                  {regionMode && <Td className="whitespace-nowrap font-medium">{entryUnit(e)}</Td>}
                  {col.fields.map((f) => (
                    <Td key={f.key} className="min-w-32 whitespace-pre-line">{displayValue(f, e.answers[f.key]) || <span className="text-slate-300">—</span>}</Td>
                  ))}
                  <Td>
                    <StatusBadge status={e.status} />
                    {e.status === "revision" && e.review_comment && (
                      <p className="mt-1 max-w-48 text-xs text-amber-800"><b>Sabab:</b> {e.review_comment}</p>
                    )}
                  </Td>
                  <Td>
                    {editable && (
                      <div className="flex items-center gap-1">
                        <Link href={`${base}/t/${token}/${e.id}`} className={buttonClass("outline", "sm")}>Tahrirlash</Link>
                        {sendable && <EntrySubmit collectionId={col.id} token={token} entryId={e.id} label="Yuborish" />}
                        {sendable && <EntryDelete collectionId={col.id} token={token} entryId={e.id} />}
                      </div>
                    )}
                  </Td>
                </tr>
              );
            })}
          </tbody>
        </Table>
      </Card>

      <div className="flex flex-wrap items-center gap-3 rounded-lg border border-slate-200 bg-white p-4">
        {open && (col.allow_multiple || regionMode) && (
          <Link href={`${base}/t/${token}/yangi`} className={buttonClass("outline", "lg")}><Plus className="h-4 w-4" /> Yana {label.toLowerCase()} qo‘shish</Link>
        )}
        {open && pending.length > 0 ? (
          <>
            <EntrySubmit collectionId={col.id} token={token} entryId={null} count={pending.length} label={`Hammasini yuborish (${pending.length})`} />
            <span className="text-sm text-slate-600">Har bir qatorni alohida «Yuborish» bilan yuborishingiz mumkin (qaysi tuman tayyor bo‘lsa shuni), yoki hammasini birga.</span>
          </>
        ) : (
          <span className="text-sm font-medium text-emerald-700">Yuboriladigan yozuv yo‘q.</span>
        )}
      </div>

      <Card className="border-blue-300">
        <CardHeader><CardTitle>Tasdiqlash: yuklab oling → imzolang → PDF yuboring</CardTitle></CardHeader>
        <CardBody className="space-y-4">
          <ol className="list-decimal space-y-1 pl-5 text-sm text-slate-700">
            <li>Barcha tuman/shaharlar (va o‘zingiz) ma’lumotini platformada kiriting va <b>«Yuborish»</b> orqali yuboring.</li>
            <li><b>Word</b> (yoki Excel) ko‘rinishida yuklab oling va chop eting.</li>
            <li>Rahbar imzosi va muhr qo‘ying, <b>skanerlab PDF</b> qiling.</li>
            <li>Imzolangan PDF ni shu yerdan yuboring — vazirlik uni ko‘radi.</li>
          </ol>
          {unfilled > 0 && (
            <p className="rounded-md bg-amber-50 p-2 text-sm text-amber-900">Diqqat: hali ma’lumot kiritilmagan hudud/tuman: <b>{unfilled}</b> ta (yuqoridagi ro‘yxatga qarang).</p>
          )}
          <div className="flex flex-wrap gap-2">
            <a href={exportHref("docx")} className={buttonClass("success", "lg")}><FileDown className="h-5 w-5" /> Word yuklab olish</a>
            <a href={exportHref("xlsx")} className={buttonClass("outline", "lg")}><FileSpreadsheet className="h-5 w-5" /> Excel yuklab olish</a>
          </div>
          <div className="border-t border-slate-200 pt-4">
            <p className="mb-2 text-sm font-medium text-slate-800">Imzolangan hujjatni (PDF) yuborish</p>
            {uploadBlock ? (
              <p role="status" className="rounded-md bg-amber-50 p-3 text-sm text-amber-900">{uploadBlock}</p>
            ) : (
              <SignedUpload collectionId={col.id} token={token} />
            )}
            {files.length > 0 ? (
              <ul className="mt-3 space-y-1 text-sm">
                {files.map((f) => (
                  <li key={f.path} className="flex flex-wrap items-center gap-2">
                    <Badge tone="green">Yuborilgan</Badge>
                    <a href={f.url} className="text-blue-800 underline" target="_blank" rel="noreferrer">Imzolangan hujjat · {fmtDateTime(f.uploadedAt.toISOString())}</a>
                    {f.size > 0 && <span className="text-xs text-slate-500">{(f.size / 1024 / 1024).toFixed(1)} MB</span>}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-sm text-amber-800">Imzolangan hujjat hali yuborilmagan.</p>
            )}
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
