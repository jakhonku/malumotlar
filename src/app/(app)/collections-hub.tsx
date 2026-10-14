import Link from "next/link";
import { CalendarClock, CheckCircle2, ClipboardList, Clock3, FileCheck2, MapPinned, Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getRegions } from "@/lib/queries";
import { listSignedFiles } from "@/lib/signed-files";
import { AUDIENCE_LABELS, type CollectionRow } from "@/lib/collections";
import { fmtDate } from "@/lib/format";
import { getProfile } from "@/lib/auth";
import { Badge, buttonClass, Card, CardBody, EmptyState, PageHeader, cn } from "@/components/ui/primitives";

interface E { collection_id: string; region_id: string; district_id: string | null; scope: string; status: "submitted" | "revision" | "approved" | "draft" }

function Mini({ icon: Icon, label, value, of, tone, alert }: { icon: React.ComponentType<{ className?: string }>; label: string; value: number; of?: number; tone: string; alert?: boolean }) {
  return (
    <div className={cn("rounded-lg border p-2.5", alert ? "border-amber-300 bg-amber-50" : "border-slate-200 bg-slate-50")}>
      <p className="flex items-center gap-1 text-[11px] font-medium text-slate-500"><Icon className={cn("h-3.5 w-3.5", tone)} />{label}</p>
      <p className="mt-0.5 text-xl font-bold text-slate-900">{value}{of !== undefined && <span className="text-sm font-semibold text-slate-400"> / {of}</span>}</p>
    </div>
  );
}

/** Vazirlik bosh sahifasi: har bir ma’lumot yig‘ish — alohida karta. Kartani ochsangiz, o‘sha yig‘ishning butun ish maydoni ochiladi. */
export async function CollectionsHub() {
  const supabase = await createClient();
  const me = await getProfile();
  const [{ data: colsRaw }, { data: entRaw }, regions, { data: distRaw }] = await Promise.all([
    supabase.from("collections").select("*").order("created_at", { ascending: false }),
    supabase.from("collection_entries").select("collection_id, region_id, district_id, scope, status").neq("status", "draft").limit(50000),
    getRegions(supabase),
    supabase.from("districts").select("id, region_id").eq("is_active", true).limit(3000),
  ]);
  const cols = (colsRaw ?? []) as CollectionRow[];
  const entries = (entRaw ?? []) as E[];
  const districtsByRegion = new Map<string, number>();
  for (const d of distRaw ?? []) districtsByRegion.set(d.region_id, (districtsByRegion.get(d.region_id) ?? 0) + 1);
  const today = new Date().toISOString().slice(0, 10);

  const cards = await Promise.all(
    cols.map(async (c) => {
      const mine = entries.filter((e) => e.collection_id === c.id);
      const signed = await listSignedFiles(c.id).catch(() => []);
      const regionsSent = new Set(mine.map((e) => e.region_id)).size;
      const unitsOf = (rid: string) => {
        const ks = new Set(mine.filter((e) => e.region_id === rid).map((e) => (e.scope === "regional" ? "regional" : e.district_id ?? "")));
        return ks.size;
      };
      const total = regions.reduce((a, r) => a + (c.audience !== "district" ? 1 : 0) + (c.audience !== "regional" ? districtsByRegion.get(r.id) ?? 0 : 0), 0);
      const sentUnits = regions.reduce((a, r) => a + unitsOf(r.id), 0);
      const count = (s: E["status"]) => mine.filter((e) => e.status === s).length;
      const late = !!c.deadline && c.deadline < today;
      return {
        c, late, total, sentUnits, regionsSent, pdf: new Set(signed.map((f) => f.regionId)).size,
        waiting: count("submitted"), approved: count("approved"), returned: count("revision"),
      };
    }),
  );
  const sorted = cards.slice().sort((a, b) => Number(b.c.is_active) - Number(a.c.is_active) || b.waiting - a.waiting);
  const waitingAll = cards.filter((x) => x.c.is_active).reduce((a, x) => a + x.waiting, 0);

  return (
    <>
      <PageHeader title="Ma’lumot yig‘ishlar" description="Har bir yig‘ish alohida karta. Kartani oching — o‘sha yig‘ishning KPI, kelgan ma’lumotlari, tekshirish, imzolangan PDF va hisoboti bitta joyda; boshqa yig‘ishlar bilan aralashmaydi.">
        {me?.role === "super_admin" && (
          <Link href="/collections/new" className={buttonClass("default", "lg")}><Plus className="h-5 w-5" /> Yangi ma’lumot yig‘ish</Link>
        )}
      </PageHeader>

      {waitingAll > 0 && (
        <p className="mb-4 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm font-medium text-amber-900">
          Jami <b>{waitingAll}</b> ta yozuv tekshirishingizni kutmoqda — tegishli kartani oching.
        </p>
      )}

      {cols.length === 0 ? (
        <Card>
          <EmptyState title="Hali ma’lumot yig‘ish yaratilmagan" text="Birinchisini yarating — masalan, «Yangi yil tadbirlari» shablonidan boshlang.">
            {me?.role === "super_admin" && <Link href="/collections/new?template=newyear" className={buttonClass("default", "default", "mt-2")}>Yangi yil shablonidan boshlash</Link>}
          </EmptyState>
        </Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {sorted.map(({ c, late, total, sentUnits, regionsSent, pdf, waiting, approved, returned }) => {
            const pct = total ? Math.round((sentUnits / total) * 100) : 0;
            return (
              <Link key={c.id} href={`/collections/${c.id}`} className="group block focus:outline-none">
                <Card className="h-full border-2 border-transparent transition-all group-hover:border-blue-700 group-hover:shadow-md group-focus-visible:border-blue-700">
                  <CardBody className="space-y-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h2 className="flex items-center gap-2 text-xl font-semibold text-slate-900"><ClipboardList className="h-5 w-5 shrink-0 text-blue-800" /><span className="truncate">{c.title}</span></h2>
                        <p className="mt-1 text-xs text-slate-500">
                          {AUDIENCE_LABELS[c.audience]} · {c.fields.length} ta maydon
                        </p>
                      </div>
                      {!c.is_active ? <Badge tone="red">Yopiq</Badge> : late ? <Badge tone="amber">Muddat o‘tgan</Badge> : <Badge tone="green">Faol</Badge>}
                    </div>

                    {c.description && <p className="line-clamp-2 text-sm text-slate-600">{c.description}</p>}

                    <div>
                      <div className="mb-1 flex items-center justify-between text-xs text-slate-600">
                        <span>Kiritilgan hududlar (viloyat va tuman/shaharlar)</span>
                        <b className="text-slate-900">{sentUnits} / {total} · {pct}%</b>
                      </div>
                      <div className="h-2.5 overflow-hidden rounded-full bg-slate-200">
                        <div className={cn("h-full rounded-full", pct === 100 ? "bg-emerald-600" : "bg-blue-700")} style={{ width: `${pct}%` }} />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                      <Mini icon={MapPinned} label="Viloyat yuborgan" value={regionsSent} of={regions.length} tone="text-blue-700" />
                      <Mini icon={Clock3} label="Tekshiruv kutmoqda" value={waiting} tone="text-amber-600" alert={waiting > 0} />
                      <Mini icon={CheckCircle2} label="Tasdiqlangan" value={approved} tone="text-emerald-600" />
                      <Mini icon={FileCheck2} label="Imzolangan PDF" value={pdf} of={regions.length} tone="text-violet-600" />
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3 text-sm">
                      <span className="flex items-center gap-1 text-slate-600">
                        <CalendarClock className="h-4 w-4" />
                        {c.deadline ? `Muddat: ${fmtDate(c.deadline)}` : "Muddat belgilanmagan"}
                        {returned > 0 && <span className="ml-2 text-amber-700">· {returned} ta qaytarilgan</span>}
                      </span>
                      <span className="font-semibold text-blue-800 group-hover:underline">Ochish →</span>
                    </div>
                  </CardBody>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </>
  );
}
