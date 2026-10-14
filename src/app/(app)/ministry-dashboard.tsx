import Link from "next/link";
import { notFound } from "next/navigation";
import { CheckCircle2, Clock3, FileCheck2, MapPinned, Undo2 } from "lucide-react";
import { subDays, format } from "date-fns";
import { createClient } from "@/lib/supabase/server";
import { getRegions } from "@/lib/queries";
import { listSignedFiles } from "@/lib/signed-files";
import { avatarUrls } from "@/lib/avatars";
import type { CollectionRow } from "@/lib/collections";
import { fmtDateTime } from "@/lib/format";
import { regionSelf } from "@/lib/brand";
import { getProfile } from "@/lib/auth";
import { DeadlineTimer } from "@/components/deadline-timer";
import { rateRegion, type Level } from "@/lib/performance";
import { kpiScore, stageOf, type PdfState } from "@/lib/kpi";
import { Badge, buttonClass, Card, CardBody, CardHeader, CardTitle, EmptyState, Table, Td, Th, cn } from "@/components/ui/primitives";
import { DayBars, Donut, ProgressBars, type BarRow } from "@/components/charts/charts";

interface Ent {
  id: string; region_id: string; district_id: string | null; scope: "regional" | "district";
  status: "submitted" | "revision" | "approved" | "draft"; created_at: string; submitted_at: string | null; updated_at: string;
  region: { name: string } | null; district: { name: string } | null;
}

const DOT: Record<Level, string> = { green: "bg-emerald-600", yellow: "bg-amber-500", red: "bg-red-600", gray: "bg-slate-400" };
const BAR: Record<Level, string> = { green: "bg-emerald-600", yellow: "bg-amber-500", red: "bg-red-600", gray: "bg-slate-400" };
const PILL: Record<Level, string> = { green: "bg-emerald-100 text-emerald-800", yellow: "bg-amber-100 text-amber-900", red: "bg-red-100 text-red-800", gray: "bg-slate-100 text-slate-700" };

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

/** Tanlangan BITTA ma’lumot yig‘ishning umumiy ko‘rinishi: KPI, jarayon, tekshirish navbati (boshqa yig‘ishlar bilan aralashmaydi). */
export async function CollectionOverview({ collectionId }: { collectionId: string }) {
  const supabase = await createClient();
  const { data: colRaw } = await supabase.from("collections").select("*").eq("id", collectionId).maybeSingle();
  if (!colRaw) notFound();
  const col = colRaw as CollectionRow;
  const base = `/collections/${col.id}`;

  const [{ data: entRaw }, regions, { data: distRaw }, signed] = await Promise.all([
    supabase
      .from("collection_entries")
      .select("id, region_id, district_id, scope, status, created_at, submitted_at, updated_at, region:regions(name), district:districts(name)")
      .eq("collection_id", col.id)
      .order("submitted_at", { ascending: true, nullsFirst: false })
      .limit(20000),
    getRegions(supabase),
    supabase.from("districts").select("id, region_id").eq("is_active", true).limit(3000),
    listSignedFiles(col.id).catch(() => []),
  ]);
  const entries = ((entRaw ?? []) as unknown as Ent[]).filter((e) => e.status !== "draft");
  // viloyat boshqarma boshliqlari (F.I.Sh. va 3x4 rasm — profilidan)
  const { data: mgrRaw } = await supabase.from("profiles").select("full_name,position,avatar_path,region_id").eq("role", "region_manager").eq("is_active", true);
  const mgrUrls = await avatarUrls((mgrRaw ?? []).map((m) => m.avatar_path as string | null));
  const mgrOf = new Map<string, { name: string; position: string | null; url: string | null }>();
  for (const m of mgrRaw ?? []) {
    if (!m.region_id || mgrOf.has(m.region_id as string)) continue;
    mgrOf.set(m.region_id as string, { name: m.full_name as string, position: (m.position as string | null) ?? null, url: m.avatar_path ? mgrUrls.get(m.avatar_path as string) ?? null : null });
  }
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
    // hudud (birlik) darajasida: yuborilgan / tasdiqlangan / tekshiruvda / qaytarilgan
    const unitStatus = new Map<string, Ent["status"][]>();
    for (const e of mine) {
      const k = e.scope === "regional" ? "regional" : (e.district_id ?? "");
      unitStatus.set(k, [...(unitStatus.get(k) ?? []), e.status]);
    }
    const units = [...unitStatus.values()];
    const unitsApproved = units.filter((l) => l.every((x) => x === "approved")).length;
    const unitsRevision = units.filter((l) => l.includes("revision")).length;
    const unitsReview = units.filter((l) => !l.includes("revision") && l.includes("submitted")).length;
    const pdfFiles = signed.filter((f) => f.regionId === r.id);
    const pdfAt = pdfFiles.reduce<number>((m, f) => Math.max(m, f.uploadedAt.getTime()), 0);
    const lastChange = mine.reduce<number>((m, e) => Math.max(m, new Date(e.updated_at).getTime()), 0);
    const pdfState: PdfState = pdfFiles.length === 0 ? "none" : lastChange > pdfAt + 60_000 ? "stale" : "fresh";
    const kpi = kpiScore({
      total, sent: sentUnits, approved: unitsApproved, entries: mine.length, returned: mine.filter((e) => everReturned.has(e.id)).length,
      lastSubmittedAt: lastAt, startAt: col.created_at, deadline: col.deadline, pdf: pdfState, now: new Date(),
    });
    const stage = stageOf({ total, sent: sentUnits, approved: unitsApproved, revision: unitsRevision, submitted: unitsReview, pdf: pdfState });
    const oldestWaiting = mine.filter((e) => e.status === "submitted" && e.submitted_at).reduce<string | null>((m, e) => (!m || e.submitted_at! < m ? e.submitted_at : m), null);
    return {
      rating, lastAt, kpi, stage, pdfState, total, sentUnits, unitsApproved, unitsRevision, unitsReview, oldestWaiting,
      r, sent: mine.length > 0, ownSent,
      dTotal: districtsByRegion.get(r.id) ?? 0, dSent: dIds.size, dApproved: dApproved.size,
      pending: mine.filter((e) => e.status === "submitted").length, pdf: pdfRegions.has(r.id),
    };
  });
  // jadval — rasmiy ro‘yxat tartibida (Qoraqalpog‘iston Respublikasi birinchi); KPI o‘rni alohida ko‘rsatiladi
  const byScore = perRegion.slice().sort((a, b) => b.kpi.score - a.kpi.score);
  const place = new Map(byScore.map((x, i) => [x.r.id, i + 1]));
  const ranked = perRegion.slice().sort((a, b) => a.r.sort_order - b.r.sort_order);
  const started = perRegion.filter((x) => x.sent);
  const avgKpi = started.length ? Math.round(started.reduce((a, x) => a + x.kpi.score, 0) / started.length) : 0;
  const finished = perRegion.filter((x) => x.stage.stage === "done").length;
  const overdue = perRegion.filter((x) => x.rating.label === "Muddat o‘tdi").length;
  const ministryTurn = perRegion.filter((x) => x.stage.owner === "ministry").length;
  const regionTurn = perRegion.filter((x) => x.stage.owner === "region").length;
  const oldestMs = perRegion.reduce<number | null>((m, x) => { const t = x.oldestWaiting ? new Date(x.oldestWaiting).getTime() : null; return t !== null && (m === null || t < m) ? t : m; }, null);
  const oldestDays = oldestMs === null ? null : Math.floor((new Date().getTime() - oldestMs) / 86_400_000);
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
      href: `${base}/hudud/${x.r.id}`,
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
  
  return (
    <>
      {col.deadline && <div className="mb-5"><DeadlineTimer deadline={col.deadline} title={`«${col.title}» — ma’lumot yig‘ish muddati`} /></div>}

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Kpi icon={MapPinned} label="Hududlar yuborgan" value={regionsSent} of={regions.length} tone="text-blue-700" />
        {showDistricts
          ? <Kpi icon={MapPinned} label="Tuman/shaharlar" value={sentDistricts} of={totalDistricts} tone="text-blue-700" />
          : <Kpi icon={MapPinned} label="Kelgan yozuvlar" value={entries.length} tone="text-blue-700" />}
        <Kpi icon={Clock3} label="Tekshirish kutmoqda" value={waiting} tone="text-amber-600" href={`${base}/hududlar?status=submitted`} />
        <Kpi icon={CheckCircle2} label="Tasdiqlangan" value={approved} tone="text-emerald-600" href={`${base}/hududlar?status=approved`} />
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

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Kpi icon={FileCheck2} label="O‘rtacha KPI (boshlaganlar)" value={avgKpi} of={100} tone="text-blue-700" />
        <Kpi icon={CheckCircle2} label="Yakunlagan viloyatlar" value={finished} of={regions.length} tone="text-emerald-600" />
        <Kpi icon={Clock3} label="Vazirlik tekshiruvida" value={ministryTurn} tone="text-amber-600" href={`${base}/hududlar?status=submitted`} />
        <Kpi icon={MapPinned} label="Viloyat javobida" value={regionTurn} tone="text-violet-600" />
        <Kpi icon={Undo2} label="Muddati o‘tgan" value={overdue} tone="text-red-600" />
      </div>
      {oldestDays !== null && oldestDays >= 2 && (
        <p role="alert" className="mb-4 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm font-medium text-amber-900">
          Eng eski tekshiruv kutayotgan yozuv {oldestDays} kundan beri turibdi — navbatni ko‘rib chiqing (pastdagi «Tekshirish navbati»).
        </p>
      )}

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Viloyatlar KPI — jarayon, tezlik va sifat</CardTitle>
          <p className="mt-1 text-xs text-slate-600">
            KPI ball (0–100) = qamrov 35% + o‘z vaqtida 25% + aniqlik 25% + imzolangan PDF 15%. PDF faqat hamma narsa tasdiqlangach hisoblanadi — vazirlik kechiksa, viloyat jazolanmaydi.
          </p>
        </CardHeader>
        <Table>
          <thead><tr><Th>№</Th><Th>Viloyat</Th><Th>Bosqich / kimda</Th><Th>Qamrov</Th><Th>Tasdiqlangan</Th><Th>Aniqlik</Th><Th>O‘z vaqtida</Th><Th>PDF</Th><Th>KPI</Th><Th><span className="sr-only">Ochish</span></Th></tr></thead>
          <tbody>
            {ranked.map((x, i) => (
              <tr key={x.r.id}>
                <Td className="text-slate-500">{i + 1}</Td>
                <Td className="font-medium">
                  <div className="flex items-center gap-3">
                    {mgrOf.get(x.r.id)?.url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={mgrOf.get(x.r.id)!.url!} alt="" className="h-12 w-9 shrink-0 rounded object-cover ring-1 ring-slate-300" />
                    ) : (
                      <span className="flex h-12 w-9 shrink-0 items-center justify-center rounded bg-slate-100 text-xs text-slate-400">—</span>
                    )}
                    <span>
                      {x.r.name}
                      {mgrOf.get(x.r.id) && <span className="block text-xs font-normal text-slate-500">{mgrOf.get(x.r.id)!.name}{mgrOf.get(x.r.id)!.position ? ` · ${mgrOf.get(x.r.id)!.position}` : ""}</span>}
                    </span>
                  </div>
                </Td>
                <Td className="min-w-44">
                  <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold", PILL[x.rating.level])} title={x.rating.detail}>
                    <i className={cn("inline-block h-2 w-2 rounded-full", DOT[x.rating.level])} /> {x.stage.label}
                  </span>
                  <p className="mt-0.5 text-[11px] text-slate-500">
                    {x.stage.owner === "ministry" ? "Kimda: vazirlik" : x.stage.owner === "region" ? "Kimda: viloyat" : "Yopilgan"}
                    {x.unitsRevision > 0 && ` · ${x.unitsRevision} ta qaytarilgan`}
                  </p>
                </Td>
                <Td className="min-w-32">
                  <div className="flex items-center gap-2">
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-200"><div className={cn("h-full", BAR[x.rating.level])} style={{ width: `${x.rating.progress}%` }} /></div>
                    <span className="w-14 text-right text-xs font-semibold">{x.sentUnits}/{x.total}</span>
                  </div>
                </Td>
                <Td className="whitespace-nowrap text-xs font-semibold">{x.unitsApproved}/{x.total}</Td>
                <Td>{x.rating.accuracy === null ? <span className="text-slate-400">—</span> : <b className={x.rating.accuracy >= 90 ? "text-emerald-700" : x.rating.accuracy >= 70 ? "text-amber-700" : "text-red-700"}>{x.rating.accuracy}%</b>}</Td>
                <Td>{x.sent ? <b className={x.kpi.parts.timeliness >= 90 ? "text-emerald-700" : x.kpi.parts.timeliness >= 60 ? "text-amber-700" : "text-red-700"}>{Math.round(x.kpi.parts.timeliness)}%</b> : <span className="text-slate-400">—</span>}</Td>
                <Td>
                  {x.pdfState === "fresh" ? <Link href={`${base}/pdf`} className="text-xs font-semibold text-emerald-700 hover:underline">✓ Yuborilgan</Link>
                    : x.pdfState === "stale" ? <Link href={`${base}/pdf`} className="text-xs font-semibold text-amber-700 hover:underline" title="PDF yuborilgandan keyin ma’lumot o‘zgargan">⚠ Eskirgan</Link>
                    : <span className="text-xs text-slate-400">—</span>}
                </Td>
                <Td>
                  <span className={cn("inline-flex min-w-14 items-center justify-center rounded-md px-2 py-1 text-sm font-bold", PILL[x.kpi.level])} title={x.kpi.grade}>{x.sent ? x.kpi.score : "—"}</span>
                  {x.sent && <span className="mt-0.5 block text-[11px] text-slate-500">reyting: {place.get(x.r.id)}-o‘rin</span>}
                </Td>
                <Td><Link href={`${base}/hudud/${x.r.id}`} className={buttonClass("outline", "sm")}>Tekshirish</Link></Td>
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
                        <Td><Link href={`${base}/entries/${e.id}`} className={buttonClass("default", "sm")}>Tekshirish</Link></Td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
                {waiting > queue.length && (
                  <p className="border-t border-slate-200 px-4 py-2 text-sm">
                    <Link href={`${base}/hududlar?status=submitted`} className="text-blue-800 hover:underline">Yana {waiting - queue.length} ta — hammasini ko‘rish →</Link>
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
