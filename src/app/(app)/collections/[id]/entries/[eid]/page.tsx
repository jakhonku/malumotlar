import { regionKind, regionSelf } from "@/lib/brand";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { displayValue, type CollectionRow, type EntryRow } from "@/lib/collections";
import { fmtDateTime } from "@/lib/format";
import { Badge, Card, CardBody, CardHeader, CardTitle, PageHeader } from "@/components/ui/primitives";
import { StatusBadge } from "@/components/ui/status-badge";
import { EntryReview } from "@/components/collections/entry-review";

export default async function EntryDetailPage({ params }: { params: Promise<{ id: string; eid: string }> }) {
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

  const actions: ("approve" | "return" | "reopen")[] =
    profile.role !== "super_admin" ? [] : e.status === "submitted" ? ["approve", "return"] : e.status === "approved" ? ["reopen"] : [];

  return (
    <>
      <Link href={`/collections/${col.id}`} className="mb-3 inline-flex items-center gap-1 text-sm text-slate-600 hover:text-blue-800">
        <ArrowLeft className="h-4 w-4" /> {col.title}
      </Link>
      <PageHeader title={`${col.entry_label}: ${e.district?.name ?? e.region?.name}`} description={e.district?.name ? e.region?.name : regionSelf(e.region?.name ?? "")}>
        {e.scope === "regional" ? <Badge tone="blue">{regionKind(e.region?.name ?? "") === "respublika" ? "Respublika darajasi" : regionKind(e.region?.name ?? "") === "shahar" ? "Shahar darajasi" : "Viloyat darajasi"}</Badge> : <Badge>Tuman/shahar darajasi</Badge>}
        <StatusBadge status={e.status} />
      </PageHeader>

      {e.status === "revision" && e.review_comment && (
        <div role="alert" className="mb-4 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
          <p className="font-semibold">Qaytarish sababi</p>
          <p className="mt-1">{e.review_comment}</p>
        </div>
      )}

      <div className="mb-4"><EntryReview entryId={e.id} actions={actions} /></div>

      <Card>
        <CardHeader><CardTitle>Kiritilgan ma’lumot</CardTitle></CardHeader>
        <CardBody>
          <dl>
            {col.fields.map((f) => {
              const val = displayValue(f, e.answers[f.key]);
              return (
                <div key={f.key} className="grid gap-1 border-b border-slate-100 py-2.5 text-sm sm:grid-cols-3">
                  <dt className="font-medium text-slate-500">{f.label}</dt>
                  <dd className="whitespace-pre-line text-slate-900 sm:col-span-2">{val || <span className="text-slate-400">Kiritilmagan</span>}</dd>
                </div>
              );
            })}
          </dl>
          <p className="mt-4 text-xs text-slate-500">
            Yaratilgan: {fmtDateTime(e.created_at)} · Yangilangan: {fmtDateTime(e.updated_at)}
            {e.submitted_at && ` · Yuborilgan: ${fmtDateTime(e.submitted_at)}`}
            {e.approved_at && ` · Tasdiqlangan: ${fmtDateTime(e.approved_at)}`}
          </p>
        </CardBody>
      </Card>
    </>
  );
}
