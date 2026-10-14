import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getRegions } from "@/lib/queries";
import { displayValue, type CollectionRow, type EntryRow } from "@/lib/collections";
import { regionSelf } from "@/lib/brand";
import { fmtDateTime } from "@/lib/format";
import { Button, buttonClass, Card, EmptyState, Select, Table, Td, Th } from "@/components/ui/primitives";
import { StatusBadge } from "@/components/ui/status-badge";
import { ExportBar } from "@/components/collections/export-bar";

export const dynamic = "force-dynamic";

type SP = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) || "";
const SIZE = 50;
const STATUSES = [
  ["submitted", "Tekshirish kutmoqda"],
  ["approved", "Tasdiqlangan"],
  ["revision", "Qaytarilgan"],
] as const;

/** Kelgan (yuborilgan) ma’lumotlar — tanlangan BITTA yig‘ish bo‘yicha, to‘liq jadval ko‘rinishida. */
export default async function IncomingPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<SP> }) {
  const profile = await requireProfile();
  if (profile.role !== "super_admin" && profile.role !== "observer") redirect("/");
  const { id } = await params;
  const sp = await searchParams;
  const supabase = await createClient();

  const { data: colRaw } = await supabase.from("collections").select("*").eq("id", id).maybeSingle();
  if (!colRaw) notFound();
  const col = colRaw as CollectionRow;
  const status = STATUSES.some(([k]) => k === one(sp.status)) ? one(sp.status) : "";
  const region = one(sp.region);
  const page = Math.max(1, Number(one(sp.page)) || 1);
  const from = (page - 1) * SIZE;

  let q = supabase
    .from("collection_entries")
    .select("*, region:regions(name), district:districts(name)", { count: "exact" })
    .eq("collection_id", col.id)
    .neq("status", "draft");
  if (status) q = q.eq("status", status);
  if (/^[0-9a-f-]{36}$/i.test(region)) q = q.eq("region_id", region);
  const [{ data: rowsRaw, count }, regions] = await Promise.all([
    q.order("submitted_at", { ascending: false, nullsFirst: false }).range(from, from + SIZE - 1),
    getRegions(supabase),
  ]);
  const rows = (rowsRaw ?? []) as EntryRow[];
  const pages = Math.max(1, Math.ceil((count ?? 0) / SIZE));
  const qs = (patch: Record<string, string>) => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries({ status, region, ...patch })) if (v) p.set(k, v);
    const q = p.toString();
    return q ? `?${q}` : "";
  };

  return (
    <>
      <p className="mb-3 text-sm text-slate-600">Viloyat boshqarmalari yuborgan ma’lumotlar to‘liq jadval ko‘rinishida. Qoralamalar bu yerda ko‘rinmaydi. «Tekshirish» tugmasi orqali ma’lumotni tasdiqlang yoki qaytaring.</p>

      <form method="get" className="mb-3 flex flex-wrap gap-2">
        <Select name="status" defaultValue={status} className="max-w-56" aria-label="Holati">
          <option value="">Barcha holatlar</option>
          {STATUSES.map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </Select>
        <Select name="region" defaultValue={region} className="max-w-72" aria-label="Hudud">
          <option value="">Barcha hududlar</option>
          {regions.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
        </Select>
        <Button type="submit">Filtrlash</Button>
        <Link href={`/collections/${col.id}/hududlar`} className={buttonClass("outline")}>Tozalash</Link>
      </form>

      <div className="mb-4"><ExportBar collectionId={col.id} /></div>

      <Card>
        <div className="border-b border-slate-200 px-4 py-3 text-sm text-slate-600">
          <b className="text-slate-900">{col.title}</b> · topildi: <b className="text-slate-900">{count ?? 0}</b> ta
        </div>
        {rows.length === 0 ? (
          <EmptyState title="Hozircha yuborilgan ma’lumot yo‘q" text="Viloyat boshqarmalari yuborgach, shu yerda jadval bo‘lib chiqadi." />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>№</Th><Th>Hudud</Th><Th>Tuman/shahar</Th>
                {col.fields.map((f) => <Th key={f.key}>{f.label}</Th>)}
                <Th>Holati</Th><Th>Yuborilgan</Th><Th><span className="sr-only">Amal</span></Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={r.id} className="hover:bg-slate-50">
                  <Td className="text-slate-500">{from + i + 1}</Td>
                  <Td className="whitespace-nowrap font-medium"><Link href={`/collections/${col.id}/hudud/${r.region_id}`} className="text-blue-800 hover:underline">{r.region?.name}</Link></Td>
                  <Td className="whitespace-nowrap">{r.district?.name ?? regionSelf(r.region?.name ?? "")}</Td>
                  {col.fields.map((f) => (
                    <Td key={f.key} className="min-w-36 max-w-80 whitespace-pre-line">
                      {displayValue(f, r.answers[f.key]) || <span className="text-slate-300">—</span>}
                    </Td>
                  ))}
                  <Td>
                    <StatusBadge status={r.status} />
                    {r.status === "revision" && r.review_comment && <p className="mt-1 max-w-48 text-xs text-amber-800">{r.review_comment}</p>}
                  </Td>
                  <Td className="whitespace-nowrap text-xs">{fmtDateTime(r.submitted_at)}</Td>
                  <Td>
                    <div className="flex gap-1">
                      <Link href={`/collections/${col.id}/hudud/${r.region_id}#e-${r.id}`} className={buttonClass(r.status === "submitted" ? "default" : "outline", "sm")}>
                        {r.status === "submitted" ? "Tekshirish" : "Ochish"}
                      </Link>
                      {profile.role === "super_admin" && (
                        <Link href={`/collections/${col.id}/entries/${r.id}/edit`} className={buttonClass("outline", "sm")}>Tahrirlash</Link>
                      )}
                    </div>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
        {pages > 1 && (
          <nav className="flex items-center justify-between border-t border-slate-200 px-4 py-3" aria-label="Sahifalash">
            <Link href={`/collections/${col.id}/hududlar${qs({ page: String(page - 1) })}`} aria-disabled={page <= 1} className={buttonClass("outline", "sm", page <= 1 ? "pointer-events-none opacity-40" : "")}>Oldingi</Link>
            <span className="text-sm text-slate-600">{page} / {pages}</span>
            <Link href={`/collections/${col.id}/hududlar${qs({ page: String(page + 1) })}`} aria-disabled={page >= pages} className={buttonClass("outline", "sm", page >= pages ? "pointer-events-none opacity-40" : "")}>Keyingi</Link>
          </nav>
        )}
      </Card>
    </>
  );
}
