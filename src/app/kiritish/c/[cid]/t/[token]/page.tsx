import Link from "next/link";
import { notFound } from "next/navigation";
import { Plus } from "lucide-react";
import { entryUnit, getCollection, getEntryGroup, isOpen, unitLabel } from "@/lib/public-collection";
import { createAdminClient } from "@/lib/supabase/admin";
import { displayValue } from "@/lib/collections";
import { Badge, buttonClass, Card, CardBody, CardHeader, CardTitle, Table, Td, Th } from "@/components/ui/primitives";
import { StatusBadge } from "@/components/ui/status-badge";
import { LinkPanel } from "@/app/kiritish/t/[token]/token-panel";
import { EntrySubmit } from "@/components/collections/entry-submit";

export const dynamic = "force-dynamic";

export default async function CollectionUnitPage({ params }: { params: Promise<{ cid: string; token: string }> }) {
  const { cid, token } = await params;
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
    if (col.audience !== "district") checklist.push({ key: "regional", name: "Viloyatning o‘zi", unit: "regional", ...stat((e) => e.scope === "regional") });
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

      <LinkPanel token={token} base={base} />

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

      <div className="flex flex-wrap items-center gap-2">
        {open && (col.allow_multiple || regionMode) && (
          <Link href={`${base}/t/${token}/yangi`} className={buttonClass("default")}><Plus className="h-4 w-4" /> Yana {label.toLowerCase()} qo‘shish</Link>
        )}
        {open && pending.length > 1 && <EntrySubmit collectionId={col.id} token={token} entryId={null} count={pending.length} label={`Hammasini yuborish (${pending.length})`} />}
        <span className="text-sm text-slate-600">Jami: <b>{group.entries.length}</b> · yuborilmagan: <b>{pending.length}</b></span>
      </div>

      <div className="space-y-3">
        {group.entries.map((e, i) => {
          const editable = open && (e.status === "draft" || e.status === "revision");
          return (
            <Card key={e.id}>
              <CardBody className="space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <h2 className="text-base font-semibold text-slate-900">
                    {i + 1}. {regionMode && <span className="mr-1 rounded bg-blue-50 px-2 py-0.5 text-sm text-blue-900">{entryUnit(e)}</span>}
                    {displayValue(col.fields[0], e.answers[col.fields[0].key]) || label}
                  </h2>
                  <StatusBadge status={e.status} />
                </div>
                <dl className="grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
                  {col.fields.slice(1, 6).map((f) => {
                    const v = displayValue(f, e.answers[f.key]);
                    return v ? (
                      <div key={f.key} className="flex gap-2"><dt className="text-slate-500">{f.label}:</dt><dd className="font-medium text-slate-900">{v}</dd></div>
                    ) : null;
                  })}
                </dl>
                {e.status === "revision" && e.review_comment && (
                  <div role="alert" className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900"><b>Qaytarish sababi:</b> {e.review_comment}</div>
                )}
                {e.status === "submitted" && <p className="text-xs text-slate-500">Vazirlik ko‘rib chiqmoqda.</p>}
                {e.status === "approved" && <p className="text-xs text-emerald-700">Tasdiqlangan. Rahmat!</p>}
                {editable && (
                  <div className="flex flex-wrap gap-2 pt-1">
                    <Link href={`${base}/t/${token}/${e.id}`} className={buttonClass("outline", "sm")}>Tahrirlash</Link>
                    <EntrySubmit collectionId={col.id} token={token} entryId={e.id} label="Yuborish" />
                  </div>
                )}
              </CardBody>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
