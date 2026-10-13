import Link from "next/link";
import { CheckCircle2, Clock3, FileCheck2, FileText, MapPinned, Table2, Undo2 } from "lucide-react";
import { subDays, format } from "date-fns";
import { createClient } from "@/lib/supabase/server";
import { getRegions } from "@/lib/queries";
import { listSignedFiles } from "@/lib/signed-files";
import type { CollectionRow } from "@/lib/collections";
import { fmtDate, fmtDateTime } from "@/lib/format";
import { regionSelf } from "@/lib/brand";
import { getProfile } from "@/lib/auth";
import { DeadlineTimer } from "@/components/deadline-timer";
import { LEVEL_ORDER, rateRegion, type Level } from "@/lib/performance";
import { Badge, buttonClass, Card, CardBody, CardHeader, CardTitle, EmptyState, PageHeader, Table, Td, Th, cn } from "@/components/ui/primitives";
import { DayBars, Donut, ProgressBars, type BarRow } from "@/components/charts/charts";

interface Ent {
  id: string; region_id: string; district_id: string | null; scope: "regional" | "district";
  status: "submitted" | "revision" | "approved" | "draft"; created_at: string; submitted_at: string | null;
  region: { name: string } | null; district: { name: string } | null;
}

const DOT: Record<Level, string> = { green: "bg-emerald-600", yellow: "bg-amber-500", red: "bg-red-600", gray: "bg-slate-400" };
const BAR: Record<Level, string> = { green: "bg-emerald-600", yellow: "bg-amber-500", red: "bg-red-600", gray: "bg-slate-400" };
const PILL: Record<Level, string> = { green: "bg-emerald-100 text-emerald-800", yellow: "bg-amber-100 text-amber-900", red: "bg-red-100 text-red-800", gray: "bg-slate-100 text-slate-700" };
const LEVEL_NAME: Record<Level, string> = { green: "A’lo / reja bo‘yicha", yellow: "E’tibor kerak", red: "Kechikmoqda / xato ko‘p", gray: "Boshlamagan" };

function Kpi({ icon: Icon, label, value, of, tone, href }: { icon: React.ComponentType<{ className?: string }>; label: string; value: number; of?: number; tone: string; href?: string }) {
  const body = (
    <Card className={cn("h-full p-4", href && "transition-shadow hover:shadow-md")}>
      <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-slate-500">
        <Icon className={cn("h-4 w-4", tone)} /> {label}
      </div>
      <p className="mt-2 text-3xl font-bold text-slate-900">
        {value}
        {of !== undefined && <span className="text-lg font-semibold text-slate-400"> / {of}</span>}
      </p>
    </Card>
  );
  return href ? <Link href={href}>{body}</Link> : body;
}

/** Vazirlik boshqaruv paneli: tanlangan BITTA ma’lumot yig‘ish bo‘yicha (boshqalari bilan aralashmaydi). */
export async function MinistryDashboard({ selected }: { selected?: string }) {
  const supabase = await createClient();
  const { data: colsRaw } = await supabase.from("collections").select("*").order("created_at", { ascending: false });
  const cols = (colsRaw ?? []) as CollectionRow[];

  if (cols.length === 0) {
    return (
      <>
        <PageHeader title="Boshqaruv paneli" />
        <Card>
          <EmptyState title="Hali ma’lumot yig‘ish yaratilmagan" text="Birinchi ma’lumot yig‘ishni yarating — natijalar shu yerda diagramma ko‘rinishida chiqadi.">
            <Link href="/collections/new?template=newyear" className={buttonClass("default", "default", "mt-2")}>Yangi yil shablonidan boshlash</Link>
          </EmptyState>
        </Card>
      </>
    );
  }

  const col = cols.find((c) => c.id === selected) ?? cols.find((c) => c.is_active) ?? cols[0];

  const [{ data: entRaw }, regions, { data: distRaw }, signed] = await Promise.all([
    supabase
      .from("collection_entries")
      .select("id, region_id, district_id, scope, status, created_at, submitted_at, region:regions(name), district:districts(name)")
      .eq("collection_id", col.id)
      .order("submitted_at", { ascending: true, nullsFirst: false })
      .limit(20000),
    getRegions(supabase),
    supabase.from("districts").select("id, region_id").eq("is_active", true).limit(3000),
    listSignedFiles(col.id).catch(() => []),
  ]);
  const entries = ((entRaw ?? []) as unknown as Ent[]).filter((e) => e.status !== "draft");
  const me = await getProfile();
  let everReturned = new Set<string>(entries.filter((e) => e.status === "revision").map((e) => e.id));
  if (me?.role === "super_admin" && entries.length) {
    const { data: logs } = await supabase
      .from("audit_logs").select("entity_id")
      .in("action", ["collection.entry.return", "collection.entry.reopen"]).eq("entity_type", "collection_entry")
      .in("entity_id", entries.map((e) => e.id).slice(0, 1500)).limit(5000);
    everReturned = new Set([...everReturned, ...(logs ?? []).map((l) => l.entity_id as string)]);
  }
  const districtsByRegion = new Map<string, number>();
  for (const d of distRaw ?? []) districtsByRegion.set(d.region_id, (districtsByRegion.get(d.region_id) ?? 0) + 1);
  const pdfRegions = new Set(signed.map((f) => f.regionId));

  const count = (s: Ent["status"]) => entries.filter((e) => e.status === s).length;
  const waiting = count("submitted");
  const approved = count("approved");
  const returned = count("revision");

  const perRegion = regions.map((r) => {
    const mine = entries.filter((e) => e.region_id === r.id);
    const dIds = new Set(mine.filter((e) => e.district_id).map((e) => e.district_id));
    const dApproved = new Set(mine.filter((e) => e.district_id && e.status === "approved").map((e) => e.district_id));
    const ownSent = mine.some((e) => e.scope === "regional");
    const dSent = dIds.size;
    const total = (col.audience !== "district" ? 1 : 0) + (col.audience !== "regional" ? (districtsByRegion.get(r.id) ?? 0) : 0);
    const sentUnits = (col.audience !== "regional" ? dSent : 0) + (col.audience !== "district" && ownSent ? 1 : 0);
    const lastAt = mine.reduce<string | null>((m, e) => (e.submitted_at && (!m || e.submitted_at > m) ? e.submitted_at : m), null);
    const rating = rateRegion({
      total, sent: sentUnits, entries: mine.length, returned: mine.filter((e) => everReturned.has(e.id)).length,
      lastSubmittedAt: lastAt, startAt: col.created_at, deadline: col.deadline, now: new Date(),
    });
    return {
      rating, lastAt,
      r, sent: mine.length > 0, ownSent,
      dTotal: districtsByRegion.get(r.id) ?? 0, dSent: dIds.size, dApproved: dApproved.size,
      pending: mine.filter((e) => e.status === "submitted").length, pdf: pdfRegions.has(r.id),
    };
  });
  const ranked = perRegion.slice().sort((a, b) => LEVEL_ORDER[a.rating.level] - LEVEL_ORDER[b.rating.level] || a.r.name.localeCompare(b.r.name));
  const regionsSent = perRegion.filter((x) => x.sent).length;
  const totalDistricts = perRegion.reduce((a, x) => a + x.dTotal, 0);
  const sentDistricts = perRegion.reduce((a, x) => a + x.dSent, 0);
  const pdfCount = perRegion.filter((x) => x.pdf).length;
  const showDistricts = col.audience !== "regional";

  const bars: BarRow[] = perRegion.map((x) => {
    const total = showDistricts ? Math.max(x.dTotal, 1) : 1;
    return {
      label: x.r.name,
      total,
      done: showDistricts ? x.dApproved : x.sent && !x.pending ? 1 : 0,
      partial: showDistricts ? Math.max(0, x.dSent - x.dApproved) : x.pending ? 1 : 0,
      sub: showDistricts ? `${x.dSent}/${x.dTotal} tuman` : x.sent ? "yuborgan" : "yubormagan",
      extra: x.pdf ? <Badge tone="green">PDF bor</Badge> : x.sent ? <Badge tone="amber">PDF yo‘q</Badge> : <Badge tone="red">kutilmoqda</Badge>,
      href: `/collections/${col.id}/hudud/${x.r.id}`,
    };
  });

  const today = new Date();
  const days = Array.from({ length: 14 }, (_, i) => {
    const d = subDays(today, 13 - i);
    const key = format(d, "yyyy-MM-dd");
    return { label: format(d, "dd.MM"), value: entries.filter((e) => (e.submitted_at ?? e.created_at).slice(0, 10) === key).length };
  });

  const queue = entries.filter((e) => e.status === "submitted").slice(0, 8);
  const missing = perRegion.filter((x) => !x.sent);
  const closed = !col.is_active || (col.deadline && col.deadline < today.toISOString().slice(0, 10));

  return (
    <>
      <PageHeader title="Boshqaruv paneli" description="Tanlangan ma’lumot yig‘ish bo‘yicha umumiy holat. Har bir yig‘ish alohida hisoblanadi.">
        <Link href={`/malumotlar?c=${col.id}`} className={buttonClass("default", "lg")}>
          <Table2 className="h-5 w-5" /> Kelgan ma’lumotlar (jadval)
        </Link>
        <Link href={`/collections/${col.id}`} className={buttonClass("outline", "lg")}>
          <FileText className="h-5 w-5" /> Hisobot
        </Link>
      </PageHeader>

      {cols.length > 1 && (
        <nav aria-label="Ma’lumot yig‘ishlar" className="mb-5 flex flex-wrap gap-2">
          {cols.map((c) => (
            <Link
              key={c.id} href={`/?c=${c.id}`} aria-current={c.id === col.id ? "page" : undefined}
              className={cn("rounded-full border px-4 py-1.5 text-sm", c.id === col.id ? "border-blue-800 bg-blue-800 font-semibold text-white" : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50")}
            >
              {c.title}
            </Link>
          ))}
        </nav>
      )}

      {col.deadline && <div className="mb-5"><DeadlineTimer deadline={col.deadline} title={`«${col.title}» — ma’lumot yig‘ish muddati`} /></div>}

      <div className="mb-5 flex flex-wrap items-center gap-2 text-sm text-slate-600">
        <b className="text-slate-900">{col.title}</b>
        {closed ? <Badge tone="red">Yopiq</Badge> : <Badge tone="green">Faol</Badge>}
        {col.deadline && <span>Muddat: {fmtDate(col.deadline)}</span>}
      </div>

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Kpi icon={MapPinned} label="Hududlar yuborgan" value={regionsSent} of={regions.length} tone="text-blue-700" />
        {showDistricts
          ? <Kpi icon={MapPinned} label="Tuman/shaharlar" value={sentDistricts} of={totalDistricts} tone="text-blue-700" />
          : <Kpi icon={MapPinned} label="Kelgan yozuvlar" value={entries.length} tone="text-blue-700" />}
        <Kpi icon={Clock3} label="Tekshirish kutmoqda" value={waiting} tone="text-amber-600" href={`/collections/${col.id}?status=submitted`} />
        <Kpi icon={CheckCircle2} label="Tasdiqlangan" value={approved} tone="text-emerald-600" href={`/collections/${col.id}?status=approved`} />
        <Kpi icon={FileCheck2} label="Imzolangan PDF" value={pdfCount} of={regions.length} tone="text-violet-600" />
      </div>

      <div className="mb-6 grid gap-4 lg:grid-cols-[22rem_1fr]">
        <Card>
          <CardHeader><CardTitle>Qabul qilingan ma’lumotlar holati</CardTitle></CardHeader>
          <CardBody>
            <Donut
              centerLabel="ma’lumot"
              slices={[
                { label: "Tekshiruv kutmoqda", value: waiting, color: "#38bdf8" },
                { label: "Tasdiqlangan", value: approved, color: "#059669" },
                { label: "Qaytarilgan", value: returned, color: "#f59e0b" },
              ]}
            />
          </CardBody>
        </Card>
        <Card>
          <CardHeader><CardTitle>Oxirgi 14 kunda kelgan ma’lumotlar</CardTitle></CardHeader>
          <CardBody><DayBars days={days} /></CardBody>
        </Card>
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Hududlar reytingi — tezlik va aniqlik</CardTitle>
          <p className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600">
            {(["green", "yellow", "red"] as Level[]).map((lv) => (
              <span key={lv} className="flex items-center gap-1">
                <i className={cn("inline-block h-2.5 w-2.5 rounded-full", DOT[lv])} />
                {LEVEL_NAME[lv]}: <b>{ranked.filter((x) => x.rating.level === lv).length}</b>
              </span>
            ))}
            <span>· Aniqlik = tuzatishga qaytarilmagan yozuvlar ulushi</span>
          </p>
        </CardHeader>
        <Table>
          <thead><tr><Th>Hudud</Th><Th>Holat</Th><Th>Bajarilish</Th><Th>Aniqlik</Th><Th>Oxirgi yuborish</Th><Th><span className="sr-only">Ochish</span></Th></tr></thead>
          <tbody>
            {ranked.map((x) => (
              <tr key={x.r.id}>
                <Td className="font-medium">{x.r.name}</Td>
                <Td>
                  <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold", PILL[x.rating.level])} title={x.rating.detail}>
                    <i className={cn("inline-block h-2 w-2 rounded-full", DOT[x.rating.level])} /> {x.rating.label}
                  </span>
                </Td>
                <Td className="min-w-32">
                  <div className="flex items-center gap-2">
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-200"><div className={cn("h-full", BAR[x.rating.level])} style={{ width: `${x.rating.progress}%` }} /></div>
                    <span className="w-9 text-right text-xs font-semibold">{x.rating.progress}%</span>
                  </div>
                </Td>
                <Td>{x.rating.accuracy === null ? <span className="text-slate-400">—</span> : <b className={x.rating.accuracy >= 90 ? "text-emerald-700" : x.rating.accuracy >= 70 ? "text-amber-700" : "text-red-700"}>{x.rating.accuracy}%</b>}</Td>
                <Td className="whitespace-nowrap text-xs">{x.lastAt ? fmtDateTime(x.lastAt) : "—"}</Td>
                <Td><Link href={`/collections/${col.id}/hudud/${x.r.id}`} className={buttonClass("outline", "sm")}>Tekshirish</Link></Td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Card>

      <div className="mb-6 grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Hududlar bo‘yicha bajarilish</CardTitle>
            <p className="mt-1 flex flex-wrap gap-x-4 text-xs text-slate-500">
              <span className="flex items-center gap-1"><i className="inline-block h-2.5 w-2.5 rounded-sm bg-emerald-600" /> tasdiqlangan</span>
              <span className="flex items-center gap-1"><i className="inline-block h-2.5 w-2.5 rounded-sm bg-sky-400" /> tekshiruv kutmoqda</span>
            </p>
          </CardHeader>
          <CardBody><ProgressBars rows={bars} /></CardBody>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader><CardTitle>Tekshirish navbati</CardTitle></CardHeader>
            {queue.length === 0 ? (
              <EmptyState title="Tekshirishni kutayotgan yozuv yo‘q" />
            ) : (
              <>
                <Table>
                  <thead><tr><Th>Hudud</Th><Th>Tuman/shahar</Th><Th>Yuborilgan</Th><Th><span className="sr-only">Amal</span></Th></tr></thead>
                  <tbody>
                    {queue.map((e) => (
                      <tr key={e.id}>
                        <Td className="font-medium">{e.region?.name}</Td>
                        <Td>{e.district?.name ?? regionSelf(e.region?.name ?? "")}</Td>
                        <Td className="whitespace-nowrap text-xs">{fmtDateTime(e.submitted_at)}</Td>
                        <Td><Link href={`/collections/${col.id}/hudud/${e.region_id}#e-${e.id}`} className={buttonClass("default", "sm")}>Tekshirish</Link></Td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
                {waiting > queue.length && (
                  <p className="border-t border-slate-200 px-4 py-2 text-sm">
                    <Link href={`/collections/${col.id}?status=submitted`} className="text-blue-800 hover:underline">Yana {waiting - queue.length} ta — hammasini ko‘rish →</Link>
                  </p>
                )}
              </>
            )}
          </Card>

          <Card>
            <CardHeader><CardTitle>Hali yubormagan hududlar ({missing.length})</CardTitle></CardHeader>
            <CardBody>
              {missing.length === 0 ? (
                <p className="text-sm font-medium text-emerald-700">Barcha hududlar ma’lumot yuborgan.</p>
              ) : (
                <ul className="flex flex-wrap gap-2">
                  {missing.map((x) => <li key={x.r.id}><Badge tone="red">{x.r.name}</Badge></li>)}
                </ul>
              )}
              {returned > 0 && (
                <p className="mt-3 flex items-center gap-1 text-sm text-amber-700"><Undo2 className="h-4 w-4" /> Tuzatishga qaytarilgan: {returned} ta</p>
              )}
            </CardBody>
          </Card>
        </div>
      </div>
    </>
  );
}
