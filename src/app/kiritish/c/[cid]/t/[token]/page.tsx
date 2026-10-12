import Link from "next/link";
import { notFound } from "next/navigation";
import { Plus } from "lucide-react";
import { getCollection, getEntryGroup, isOpen, unitLabel } from "@/lib/public-collection";
import { displayValue } from "@/lib/collections";
import { buttonClass, Card, CardBody } from "@/components/ui/primitives";
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

      <div className="flex flex-wrap items-center gap-2">
        {open && col.allow_multiple && (
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
                  <h2 className="text-base font-semibold text-slate-900">{i + 1}. {displayValue(col.fields[0], e.answers[col.fields[0].key]) || label}</h2>
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
