import { regionSelf } from "@/lib/brand";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Plus } from "lucide-react";
import { entryUnit, getCollection, getEntryGroup, isOpen, unitLabel } from "@/lib/public-collection";
import { createAdminClient } from "@/lib/supabase/admin";
import { displayValue } from "@/lib/collections";
import { Badge, buttonClass, Card, CardHeader, CardTitle, Table, Td, Th } from "@/components/ui/primitives";
import { StatusBadge } from "@/components/ui/status-badge";
import { requireManagerToken } from "@/lib/manager-guard";
import { EntrySubmit } from "@/components/collections/entry-submit";
import { EntryDelete } from "@/components/collections/entry-delete";
import { FileCheck2 } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function CollectionUnitPage({ params }: { params: Promise<{ cid: string; token: string }> }) {
  const { cid, token } = await params;
  await requireManagerToken(cid, token);
  const col = await getCollection(cid);
  const group = col ? await getEntryGroup(cid, token) : null;
  if (!col) redirect("/boshqarma");
  if (!group) redirect(`/kiritish/c/${col.id}`);

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
  const filled = checklist.filter((r) => r.count > 0).length;
  const pending = group.entries.filter((e) => e.status === "draft" || e.status === "revision");
  const base = `/kiritish/c/${col.id}`;
  const label = col.entry_label;

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

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-blue-300 bg-blue-50/50 p-4">
        <p className="max-w-2xl text-sm text-slate-700">
          Word/Excel yuklab olish va <b>imzolangan PDF</b> yuborish alohida sahifada. PDF ni barcha tuman/shaharlar ma’lumoti vazirlik tomonidan tasdiqlangandan keyin yuborasiz.
        </p>
        <Link href="/pdf-yuborish" className={buttonClass("default", "lg")}><FileCheck2 className="h-5 w-5" /> Imzolangan PDF sahifasi</Link>
      </div>
    </div>
  );
}
