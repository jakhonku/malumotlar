import { regionKind, regionSelf } from "@/lib/brand";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronDown, ExternalLink, Pencil } from "lucide-react";
import { redirect } from "next/navigation";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getRegions } from "@/lib/queries";
import { AUDIENCE_LABELS, displayValue, type CollectionRow, type EntryRow } from "@/lib/collections";
import { PAGE_SIZE, STATUS_LABELS } from "@/lib/constants";
import { fmtDate } from "@/lib/format";
import { Badge, Button, buttonClass, Card, CardBody, EmptyState, PageHeader, Select, Table, Td, Th } from "@/components/ui/primitives";
import { StatusBadge } from "@/components/ui/status-badge";
import { listSignedFiles } from "@/lib/signed-files";
import { fmtDateTime } from "@/lib/format";
import { ExportBar } from "@/components/collections/export-bar";
import { CollectionToggle } from "@/components/collections/collection-toggle";

interface RegionMon { region_id: string; region_name: string; regional_total: number; regional_sent: number; districts_total: number; districts_sent: number; entries_total: number; entries_approved: number }
interface DistMon { district_id: string; district_name: string; entries_total: number; draft: number; submitted: number; revision: number; approved: number; sent: boolean }

type SP = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) || "";

export default async function CollectionReportPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<SP> }) {
  const profile = await requireProfile();
  if (profile.role === "district_manager") redirect("/");
  const { id } = await params;
  const sp = await searchParams;
  const supabase = await createClient();

  const { data: colRaw } = await supabase.from("collections").select("*").eq("id", id).maybeSingle();
  if (!colRaw) notFound();
  const col = colRaw as CollectionRow;
  const admin = profile.role === "super_admin";
  const seesDrafts = profile.role === "region_manager"; // vazirlik qoralamalarni ko‘rmaydi

  const status = one(sp.status);
  const region = profile.role === "region_manager" ? (profile.region_id ?? "") : one(sp.region);
  const scope = one(sp.scope);
  const page = Math.max(1, Number(one(sp.page)) || 1);

  let q = supabase
    .from("collection_entries")
    .select("*, region:regions(name), district:districts(name)", { count: "exact" })
    .eq("collection_id", id);
  if (status) q = q.eq("status", status);
  if (region) q = q.eq("region_id", region);
  if (scope === "regional" || scope === "district") q = q.eq("scope", scope);
  const from = (page - 1) * PAGE_SIZE;
  const [{ data: rowsRaw, count }, regions, { data: monRaw }] = await Promise.all([
    q.order("created_at", { ascending: false }).range(from, from + PAGE_SIZE - 1),
    getRegions(supabase),
    supabase.rpc("col_monitoring_regions", { p_collection: id }),
  ]);
  const rows = (rowsRaw ?? []) as EntryRow[];
  const pages = Math.max(1, Math.ceil((count ?? 0) / PAGE_SIZE));
  let mon = (monRaw ?? []) as RegionMon[];
  if (profile.role === "region_manager") mon = mon.filter((m) => m.region_id === profile.region_id);

  const distDetails = new Map<string, DistMon[]>(
    await Promise.all(
      mon.map(async (m) => {
        const { data } = await supabase.rpc("col_monitoring_districts", { p_collection: id, p_region: m.region_id });
        return [m.region_id, (data ?? []) as DistMon[]] as const;
      }),
    ),
  );

  const signed = await listSignedFiles(col.id, region ? { regionId: region } : undefined).catch(() => []);
  const dIds = signed.map((f) => f.unit).filter((u) => /^[0-9a-f-]{36}$/.test(u));
  const { data: dn } = dIds.length ? await supabase.from("districts").select("id,name").in("id", dIds) : { data: [] };
  const unitName = (u: string, rid?: string) => (u === "viloyat" ? regionSelf(regions.find((r) => r.id === rid)?.name ?? "") : u === "boshqarma" ? "Madaniyat boshqarmasi (hudud va tumanlar)" : (dn ?? []).find((d) => d.id === u)?.name ?? "Tuman");

  const preview = col.fields.slice(0, 3);
  const qs = (patch: Record<string, string>) => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries({ status, region: profile.role === "region_manager" ? "" : region, scope, ...patch })) if (v) p.set(k, v);
    const s = p.toString();
    return s ? `?${s}` : "";
  };
  const closed = !col.is_active || (col.deadline && col.deadline < new Date().toISOString().slice(0, 10));

  return (
    <>
      {!admin && profile.role === "region_manager" && (
        <PageHeader title={col.title} description={col.description ?? undefined}>
          <Link href="/collections" className={buttonClass("outline")}>← Ma’lumot yig‘ishlar</Link>
        </PageHeader>
      )}
      <p className="mb-4 text-sm text-slate-600">
        {AUDIENCE_LABELS[col.audience]} · {col.fields.length} ta maydon{col.deadline ? ` · muddat: ${fmtDate(col.deadline)}` : ""}
      </p>

      <div className="mb-6"><ExportBar collectionId={col.id} regionId={profile.role === "region_manager" ? (profile.region_id ?? undefined) : undefined} /></div>

      <h2 className="mb-2 text-lg font-semibold text-slate-900">Hududlar bo‘yicha holat</h2>
      <div className="mb-8 space-y-2">
        {mon.map((m) => {
          const details = distDetails.get(m.region_id) ?? [];
          return (
            <Card key={m.region_id}>
              <details className="group">
                <summary className="flex cursor-pointer list-none flex-wrap items-center gap-x-6 gap-y-1 px-5 py-3 hover:bg-slate-50">
                  <ChevronDown className="h-4 w-4 text-slate-500 transition-transform group-open:rotate-180" />
                  <span className="min-w-48 flex-1 font-semibold text-slate-900">{m.region_name}</span>
                  {col.audience !== "district" && (
                    <span className="text-sm">Viloyat: {m.regional_sent > 0 ? <b className="text-emerald-700">yuborgan ({m.regional_sent})</b> : <b className="text-red-700">yubormagan</b>}</span>
                  )}
                  {col.audience !== "regional" && (
                    <span className="text-sm">Tumanlar: <b className="text-emerald-700">{m.districts_sent}</b> / {m.districts_total}</span>
                  )}
                  <span className="text-sm">Tasdiqlangan: <b>{m.entries_approved}</b> / {m.entries_total}</span>
                </summary>
                {col.audience !== "regional" && (
                  <Table>
                    <thead><tr><Th>Tuman/shahar</Th><Th>Holati</Th><Th>Yozuvlar</Th><Th>Kutilmoqda</Th><Th>Tasdiqlangan</Th><Th>Qaytarilgan</Th>{seesDrafts && <Th>Qoralama</Th>}</tr></thead>
                    <tbody>
                      {details.map((d) => (
                        <tr key={d.district_id}>
                          <Td className="font-medium">{d.district_name}</Td>
                          <Td>{d.sent ? <Badge tone="green">Ma’lumot yuborilgan</Badge> : d.revision ? <Badge tone="amber">Qayta ishlashda</Badge> : d.draft && seesDrafts ? <Badge tone="slate">Qoralama</Badge> : <Badge tone="red">Ma’lumot yuborilmagan</Badge>}</Td>
                          <Td>{d.entries_total}</Td><Td>{d.submitted}</Td><Td>{d.approved}</Td><Td>{d.revision}</Td>{seesDrafts && <Td>{d.draft}</Td>}
                        </tr>
                      ))}
                    </tbody>
                  </Table>
                )}
              </details>
            </Card>
          );
        })}
      </div>

      <h2 className="mb-2 text-lg font-semibold text-slate-900">Imzolangan hujjatlar (PDF)</h2>
      <Card className="mb-8">
        {signed.length === 0 ? (
          <EmptyState title="Hozircha imzolangan hujjat yuborilmagan" />
        ) : (
          <Table>
            <thead><tr><Th>Viloyat</Th><Th>Hudud</Th><Th>Yuborilgan vaqt</Th><Th>Hajmi</Th><Th><span className="sr-only">Yuklab olish</span></Th></tr></thead>
            <tbody>
              {signed.map((f) => (
                <tr key={f.path}>
                  <Td className="font-medium">{regions.find((r) => r.id === f.regionId)?.name ?? "—"}</Td>
                  <Td>{unitName(f.unit, f.regionId)}</Td>
                  <Td className="whitespace-nowrap">{fmtDateTime(f.uploadedAt.toISOString())}</Td>
                  <Td>{f.size ? `${(f.size / 1024 / 1024).toFixed(1)} MB` : "—"}</Td>
                  <Td><a href={f.url} target="_blank" rel="noreferrer" className={buttonClass("outline", "sm")}>PDF ni ochish</a></Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>

      <h2 className="mb-2 text-lg font-semibold text-slate-900">Kiritilgan ma’lumotlar</h2>
      <form className="mb-3 flex flex-wrap gap-2" method="get">
        <Select name="status" defaultValue={status} className="max-w-52" aria-label="Holati">
          <option value="">Barcha holatlar</option>
          {Object.entries(STATUS_LABELS).filter(([k]) => seesDrafts || k !== "draft").map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </Select>
        {profile.role !== "region_manager" && (
          <Select name="region" defaultValue={region} className="max-w-64" aria-label="Viloyat">
            <option value="">Barcha viloyatlar</option>
            {regions.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
          </Select>
        )}
        <Select name="scope" defaultValue={scope} className="max-w-48" aria-label="Daraja">
          <option value="">Viloyat va tuman</option>
          <option value="regional">Faqat viloyat</option>
          <option value="district">Faqat tuman/shahar</option>
        </Select>
        <Button type="submit">Filtrlash</Button>
        <Link href={`/collections/${col.id}/hisobot`} className={buttonClass("outline")}>Tozalash</Link>
      </form>

      <Card>
        <div className="border-b border-slate-200 px-4 py-3 text-sm text-slate-600">Topildi: <b className="text-slate-900">{count ?? 0}</b> ta</div>
        {rows.length === 0 ? (
          <EmptyState title="Hozircha ma’lumot kiritilmagan" text="Viloyat boshqarmalari o‘z panelidan ma’lumot kiritadi." />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>№</Th><Th>Viloyat</Th><Th>Tuman/shahar</Th>
                {preview.map((f) => <Th key={f.key}>{f.label}</Th>)}
                <Th>Holati</Th><Th><span className="sr-only">Amal</span></Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={r.id} className="hover:bg-slate-50">
                  <Td className="text-slate-500">{from + i + 1}</Td>
                  <Td>{r.region?.name}</Td>
                  <Td>{r.district?.name ?? <Badge tone="blue">Viloyat o‘zi</Badge>}</Td>
                  {preview.map((f) => <Td key={f.key} className="max-w-56 truncate">{displayValue(f, r.answers[f.key]) || <span className="text-slate-400">—</span>}</Td>)}
                  <Td><StatusBadge status={r.status} /></Td>
                  <Td><Link href={`/collections/${col.id}/entries/${r.id}`} className={buttonClass("outline", "sm")}>Batafsil</Link></Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
        {pages > 1 && (
          <nav className="flex items-center justify-between border-t border-slate-200 px-4 py-3" aria-label="Sahifalash">
            <Link href={`/collections/${col.id}/hisobot${qs({ page: String(page - 1) })}`} aria-disabled={page <= 1} className={buttonClass("outline", "sm", page <= 1 ? "pointer-events-none opacity-40" : "")}>Oldingi</Link>
            <span className="text-sm text-slate-600">{page} / {pages}</span>
            <Link href={`/collections/${col.id}/hisobot${qs({ page: String(page + 1) })}`} aria-disabled={page >= pages} className={buttonClass("outline", "sm", page >= pages ? "pointer-events-none opacity-40" : "")}>Keyingi</Link>
          </nav>
        )}
      </Card>
    </>
  );
}
