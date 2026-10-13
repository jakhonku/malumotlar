import Link from "next/link";
import { CheckCircle2, ChevronDown, XCircle } from "lucide-react";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Badge, Card, EmptyState, PageHeader, Table, Td, Th } from "@/components/ui/primitives";

interface RegionMon {
  region_id: string; region_name: string; regional_total: number; regional_approved: number;
  districts_total: number; districts_sent: number; districts_not_sent: number;
  events_total: number; events_approved: number; events_pending: number; events_revision: number;
}
interface DistMon {
  district_id: string; district_name: string; district_type: string; events_total: number;
  draft: number; submitted: number; revision: number; approved: number; sent: boolean;
}

export default async function MonitoringPage() {
  const profile = await requireProfile();
  const supabase = await createClient();
  const { data } = await supabase.rpc("monitoring_regions");
  let regions = (data ?? []) as RegionMon[];
  if (profile.role === "region_manager") regions = regions.filter((r) => r.region_id === profile.region_id);

  const details = await Promise.all(
    regions.map(async (r) => {
      const { data: d } = await supabase.rpc("monitoring_districts", { p_region_id: r.region_id });
      return [r.region_id, (d ?? []) as DistMon[]] as const;
    }),
  );
  const byRegion = new Map(details);

  return (
    <>
      <PageHeader
        title="Hududlar monitoringi"
        description="Har bir hududning topshiriq bajarish holati. Hudud asosiy tadbiri va tuman tadbirlari alohida tekshiriladi."
      />
      {regions.length === 0 ? (
        <Card><EmptyState title="Hududlar topilmadi" /></Card>
      ) : (
        <div className="space-y-3">
          {regions.map((r) => {
            const districts = byRegion.get(r.region_id) ?? [];
            return (
              <Card key={r.region_id}>
                <details open={profile.role === "region_manager"} className="group">
                  <summary className="flex cursor-pointer list-none flex-wrap items-center gap-x-6 gap-y-2 px-5 py-4 hover:bg-slate-50">
                    <ChevronDown className="h-4 w-4 text-slate-500 transition-transform group-open:rotate-180" />
                    <span className="min-w-48 flex-1 text-base font-semibold text-slate-900">{r.region_name}</span>
                    <span className="flex items-center gap-1 text-sm" title="Hududning asosiy tadbiri">
                      {r.regional_total > 0 ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <XCircle className="h-4 w-4 text-red-600" />}
                      Hudud asosiy: <b>{r.regional_total}</b>
                    </span>
                    <span className="text-sm">Tumanlar: <b className="text-emerald-700">{r.districts_sent}</b> / {r.districts_total}
                      {r.districts_not_sent > 0 && <span className="ml-1 text-red-700">({r.districts_not_sent} yubormagan)</span>}
                    </span>
                    <span className="text-sm">Tasdiqlangan: <b className="text-emerald-700">{r.events_approved}</b></span>
                    <span className="text-sm">Kutilayotgan: <b className="text-blue-800">{r.events_pending}</b></span>
                    {r.events_revision > 0 && <Badge tone="amber">Qaytarilgan: {r.events_revision}</Badge>}
                  </summary>
                  <div className="border-t border-slate-200">
                    <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-50 px-5 py-3 text-sm">
                      <span>
                        Hududning asosiy tadbirlari: <b>{r.regional_total}</b> ta (tasdiqlangan: {r.regional_approved})
                      </span>
                      <Link href={`/events/regional?region=${r.region_id}`} className="font-medium text-blue-800 hover:underline">Hudud tadbirlarini ko‘rish →</Link>
                    </div>
                    <Table>
                      <thead>
                        <tr><Th>Tuman/shahar</Th><Th>Ma’lumot holati</Th><Th>Tadbirlar</Th><Th>Tasdiqlangan</Th><Th>Kutilmoqda</Th><Th>Qaytarilgan</Th><Th>Qoralama</Th></tr>
                      </thead>
                      <tbody>
                        {districts.map((d) => (
                          <tr key={d.district_id} className="hover:bg-slate-50">
                            <Td>
                              <Link href={`/events/district?region=${r.region_id}&district=${d.district_id}`} className="font-medium text-blue-900 hover:underline">{d.district_name}</Link>
                            </Td>
                            <Td>
                              {d.sent ? <Badge tone="green">Ma’lumot yuborilgan</Badge>
                                : d.revision > 0 ? <Badge tone="amber">Qayta ishlashda</Badge>
                                : d.draft > 0 ? <Badge tone="slate">Qoralama bosqichida</Badge>
                                : <Badge tone="red">Ma’lumot yuborilmagan</Badge>}
                            </Td>
                            <Td>{d.events_total}</Td>
                            <Td>{d.approved}</Td>
                            <Td>{d.submitted}</Td>
                            <Td>{d.revision}</Td>
                            <Td>{d.draft}</Td>
                          </tr>
                        ))}
                      </tbody>
                    </Table>
                  </div>
                </details>
              </Card>
            );
          })}
        </div>
      )}
    </>
  );
}
