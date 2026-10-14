import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { displayValue, type CollectionRow, type EntryRow } from "@/lib/collections";
import { regionOrgName, regionSelf } from "@/lib/brand";
import { fmtDateTime } from "@/lib/format";
import { buttonClass, Card, EmptyState, PageHeader, Table, Td, Th, cn } from "@/components/ui/primitives";
import { StatusBadge } from "@/components/ui/status-badge";
import { EntryReview } from "@/components/collections/entry-review";
import { ApproveRegion } from "@/components/collections/approve-region";
import { ExportBar } from "@/components/collections/export-bar";
import { listSignedFiles } from "@/lib/signed-files";
import { ReturnSigned } from "@/components/collections/return-signed";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/** Bitta hududning yuborgan ma’lumotlari — jadval ko‘rinishida tekshirish (tasdiqlash / qaytarish / tahrirlash). */
export default async function RegionReviewPage({ params }: { params: Promise<{ id: string; rid: string }> }) {
  const profile = await requireProfile();
  if (profile.role === "district_manager") redirect("/");
  const { id, rid } = await params;
  if (profile.role === "region_manager" && profile.region_id !== rid) redirect("/boshqarma");
  const admin = profile.role === "super_admin";
  const supabase = await createClient();

  const [{ data: colRaw }, { data: region }, { data: entRaw }] = await Promise.all([
    supabase.from("collections").select("*").eq("id", id).maybeSingle(),
    supabase.from("regions").select("id,name").eq("id", rid).maybeSingle(),
    supabase
      .from("collection_entries")
      .select("*, district:districts(name)")
      .eq("collection_id", id).eq("region_id", rid).neq("status", "draft")
      .order("scope", { ascending: false }).limit(1000),
  ]);
  if (!colRaw || !region) notFound();
  const col = colRaw as CollectionRow;
  const rows = ((entRaw ?? []) as unknown as EntryRow[]).sort(
    (a, b) => Number(!!a.district_id) - Number(!!b.district_id) || (a.district?.name ?? "").localeCompare(b.district?.name ?? ""),
  );
  const count = (s: string) => rows.filter((r) => r.status === s).length;
  const waiting = count("submitted");
  const files = (await listSignedFiles(col.id, { regionId: rid }).catch(() => [])).sort((a, b) => b.uploadedAt.getTime() - a.uploadedAt.getTime());
  const last = files[0];
  let sender = "—";
  if (last) {
    const adm = createAdminClient();
    const { data: p } = last.by
      ? await adm.from("profiles").select("full_name").eq("id", last.by).maybeSingle()
      : await adm.from("profiles").select("full_name").eq("role", "region_manager").eq("region_id", rid).limit(1).maybeSingle();
    sender = p?.full_name ?? "—";
  }

  return (
    <>
      <PageHeader title={regionOrgName(region.name)} description={`${col.title} — yuborilgan ma’lumotlar jadvali`}>
        <Link href={`/malumotlar?c=${col.id}`} className={buttonClass("outline")}>Barcha hududlar</Link>
        {admin && <ApproveRegion collectionId={col.id} regionId={rid} count={waiting} />}
      </PageHeader>

      <div className="mb-4 flex flex-wrap gap-2 text-sm">
        <span className="rounded-full bg-sky-100 px-3 py-1 font-medium text-sky-900">Tekshiruv kutmoqda: {waiting}</span>
        <span className="rounded-full bg-emerald-100 px-3 py-1 font-medium text-emerald-900">Tasdiqlangan: {count("approved")}</span>
        <span className="rounded-full bg-amber-100 px-3 py-1 font-medium text-amber-900">Qaytarilgan: {count("revision")}</span>
      </div>

      <div className={cn("mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3 text-sm", last ? "border-emerald-300 bg-emerald-50" : "border-red-300 bg-red-50")}>
        {last ? (
          <>
            <p><b className="text-emerald-900">Imzolangan hujjat yuborilgan.</b> Yuborgan: {sender} · {fmtDateTime(last.uploadedAt.toISOString())}</p>
            <div className="flex flex-wrap gap-2">
              <a href={last.url} target="_blank" rel="noreferrer" className={buttonClass("success", "sm")}>PDF ni ochish</a>
              {admin && <ReturnSigned collectionId={col.id} regionId={rid} regionName={region.name} />}
            </div>
          </>
        ) : (
          <p><b className="text-red-900">Imzolangan hujjat (PDF) hali yuborilmagan.</b> Viloyat boshqarmasi hammasini kiritib, imzolab yuborgach shu yerda ko‘rinadi.</p>
        )}
      </div>

      <div className="mb-4"><ExportBar collectionId={col.id} regionId={rid} /></div>

      <Card>
        {rows.length === 0 ? (
          <EmptyState title="Bu hudud hali ma’lumot yubormagan" />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>№</Th>
                <Th>Tuman/shahar</Th>
                {col.fields.map((f) => <Th key={f.key}>{f.label}</Th>)}
                <Th>Holati</Th>
                {admin && <Th>Amallar</Th>}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={r.id} id={`e-${r.id}`} className={cn("scroll-mt-24 target:bg-amber-50", r.status === "submitted" && "bg-sky-50/40")}>
                  <Td className="text-slate-500">{i + 1}</Td>
                  <Td className="whitespace-nowrap font-medium">{r.district?.name ?? regionSelf(region.name)}</Td>
                  {col.fields.map((f) => (
                    <Td key={f.key} className="min-w-36 max-w-80 whitespace-pre-line">
                      {displayValue(f, r.answers[f.key]) || <span className="text-slate-300">—</span>}
                    </Td>
                  ))}
                  <Td className="min-w-40">
                    <StatusBadge status={r.status} />
                    {r.submitted_at && <p className="mt-1 text-xs text-slate-500">{fmtDateTime(r.submitted_at)}</p>}
                    {r.status === "revision" && r.review_comment && <p className="mt-1 max-w-52 text-xs text-amber-800"><b>Sabab:</b> {r.review_comment}</p>}
                  </Td>
                  {admin && (
                    <Td className="min-w-56">
                      <div className="flex flex-col items-start gap-1.5">
                        <EntryReview
                          entryId={r.id}
                          compact
                          actions={r.status === "submitted" ? ["approve", "return"] : r.status === "approved" ? ["reopen"] : []}
                        />
                        <Link href={`/collections/${col.id}/entries/${r.id}/edit`} className={buttonClass("ghost", "sm")}>Tahrirlash</Link>
                      </div>
                    </Td>
                  )}
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
    </>
  );
}
