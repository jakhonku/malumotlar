import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, ArrowRight, Pencil } from "lucide-react";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { displayValue, type CollectionRow, type EntryRow, type RowObj } from "@/lib/collections";
import { regionSelf } from "@/lib/brand";
import { fmtDateTime } from "@/lib/format";
import { buttonClass, Card, CardBody, CardHeader, CardTitle, Table, Td, Th } from "@/components/ui/primitives";
import { StatusBadge } from "@/components/ui/status-badge";
import { EntryReview } from "@/components/collections/entry-review";

export const dynamic = "force-dynamic";

/** Bitta kelgan yozuvni alohida sahifada ko‘rish va tekshirish (tasdiqlash / qaytarish / tahrirlash). */
export default async function EntryReviewPage({ params }: { params: Promise<{ id: string; eid: string }> }) {
  const profile = await requireProfile();
  if (profile.role === "district_manager") redirect("/");
  const { id, eid } = await params;
  const supabase = await createClient();
  const [{ data: colRaw }, { data: entRaw }] = await Promise.all([
    supabase.from("collections").select("*").eq("id", id).maybeSingle(),
    supabase.from("collection_entries").select("*, region:regions(name), district:districts(name)").eq("id", eid).eq("collection_id", id).maybeSingle(),
  ]);
  if (!colRaw || !entRaw) notFound();
  const col = colRaw as CollectionRow;
  const e = entRaw as EntryRow;
  if (e.status === "draft") redirect(profile.role === "region_manager" ? "/boshqarma" : `/collections/${id}/hududlar`);
  if (profile.role === "region_manager") redirect(`/collections/${id}/hudud/${e.region_id}#e-${eid}`);

  const admin = profile.role === "super_admin";
  const regionName = e.region?.name ?? "";
  const unit = e.district?.name ?? regionSelf(regionName);

  // tekshiruv navbati: keyingi/oldingi kutayotgan yozuv
  const { data: queueRaw } = await supabase
    .from("collection_entries").select("id")
    .eq("collection_id", id).eq("status", "submitted").is("deleted_at", null)
    .order("submitted_at", { ascending: true }).limit(500);
  const queue = (queueRaw ?? []).map((q) => q.id as string).filter((x) => x !== eid);
  const nextId = queue[0];

  const actions = !admin ? [] : e.status === "submitted" ? (["approve", "return"] as const) : e.status === "approved" ? (["reopen"] as const) : [];

  return (
    <>
      <Link href={`/collections/${id}/hududlar`} className="mb-3 inline-flex items-center gap-1.5 text-sm font-medium text-blue-800 hover:underline">
        <ArrowLeft className="h-4 w-4" /> Kelgan ma’lumotlar
      </Link>
      <header className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-500">{regionName}</p>
          <h2 className="text-2xl font-bold text-slate-900">{unit}</h2>
          <p className="mt-1 flex flex-wrap items-center gap-3 text-sm text-slate-600">
            <StatusBadge status={e.status} />
            {e.submitted_at && <span>Yuborilgan: {fmtDateTime(e.submitted_at)}</span>}
            {e.approved_at && e.status === "approved" && <span>Tasdiqlangan: {fmtDateTime(e.approved_at)}</span>}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {actions.length > 0 && <EntryReview entryId={e.id} actions={[...actions]} />}
          {admin && <Link href={`/collections/${id}/entries/${e.id}/edit`} className={buttonClass("outline")}><Pencil className="h-4 w-4" /> Tahrirlash</Link>}
          {nextId && <Link href={`/collections/${id}/entries/${nextId}`} className={buttonClass("default")}>Keyingi ({queue.length}) <ArrowRight className="h-4 w-4" /></Link>}
        </div>
      </header>

      {e.status === "revision" && e.review_comment && (
        <p role="alert" className="mb-4 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900"><b>Qaytarish sababi:</b> {e.review_comment}</p>
      )}

      <Card>
        <CardHeader><CardTitle>Kiritilgan ma’lumot</CardTitle></CardHeader>
        <CardBody className="space-y-5">
          {col.fields.map((f) => {
            const raw = e.answers[f.key];
            if (f.type === "rows") {
              const cols = f.columns ?? [];
              const rows = (Array.isArray(raw) ? (raw as RowObj[]) : []).filter((r) => cols.some((c) => r[c.key] !== null && r[c.key] !== undefined && r[c.key] !== ""));
              return (
                <div key={f.key}>
                  <p className="mb-1 text-sm font-semibold text-slate-700">{f.label}</p>
                  {rows.length === 0 ? <p className="text-slate-400">—</p> : (
                    <Table>
                      <thead><tr><Th>№</Th>{cols.map((c) => <Th key={c.key}>{c.label}</Th>)}</tr></thead>
                      <tbody>
                        {rows.map((r, i) => (
                          <tr key={i}><Td className="text-slate-500">{i + 1}</Td>{cols.map((c) => <Td key={c.key}>{r[c.key] ?? <span className="text-slate-300">—</span>}</Td>)}</tr>
                        ))}
                      </tbody>
                    </Table>
                  )}
                </div>
              );
            }
            const text = displayValue(f, raw);
            return (
              <div key={f.key} className="grid gap-1 sm:grid-cols-[16rem_1fr] sm:gap-4">
                <p className="text-sm font-semibold text-slate-700">{f.label}{f.required && <span className="text-red-600"> *</span>}</p>
                <p className="whitespace-pre-line text-slate-900">{text || <span className="text-slate-300">—</span>}</p>
              </div>
            );
          })}
        </CardBody>
      </Card>
    </>
  );
}
