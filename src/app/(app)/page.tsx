import Link from "next/link";
import { FileDown } from "lucide-react";
import { redirect } from "next/navigation";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { listEvents } from "@/lib/queries";
import { Badge, buttonClass, Card, CardBody, CardHeader, CardTitle, EmptyState, PageHeader, Table, Td, Th } from "@/components/ui/primitives";
import { StatusBadge } from "@/components/ui/status-badge";
import { fmtDate } from "@/lib/format";
import { ROLE_LABELS } from "@/lib/constants";

interface Stats {
  total: number; regional: number; district: number; draft: number; pending: number;
  revision: number; approved: number; regions_total: number; regions_sent: number;
}

function Stat({ label, value, tone, href, hint }: { label: string; value: number | string; tone?: string; href?: string; hint?: string }) {
  const body = (
    <Card className={`h-full p-4 transition-shadow ${href ? "hover:shadow-md" : ""}`}>
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p className={`mt-2 text-3xl font-bold ${tone ?? "text-slate-900"}`}>{value}</p>
      {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
    </Card>
  );
  return href ? <Link href={href}>{body}</Link> : body;
}

export default async function DashboardPage() {
  const profile = await requireProfile();
  if (profile.role === "region_manager") redirect("/boshqarma");
  const supabase = await createClient();

  const [{ data: statsRaw }, recent] = await Promise.all([
    supabase.rpc("dashboard_stats"),
    listEvents(supabase, { sort: "updated_at", dir: "desc", page: 1 }),
  ]);
  const s = (statsRaw ?? {}) as Stats;

  const ministry = profile.role === "super_admin" || profile.role === "observer";
  const canReport = true;

  return (
    <>
      <PageHeader
        title="Bosh sahifa"
        description={`${ROLE_LABELS[profile.role]} — ${profile.full_name}`}
      >
        {canReport && (
          <Link href="/reports" className={buttonClass("success", "lg")}>
            <FileDown className="h-5 w-5" /> WORD HISOBOTINI YARATISH
          </Link>
        )}
      </PageHeader>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Jami tadbirlar" value={s.total ?? 0} href="/events" />
        {profile.role !== "district_manager" && (
          <Stat label="Hudud asosiy tadbirlari" value={s.regional ?? 0} href="/events/regional" />
        )}
        {profile.role !== "district_manager" && (
          <Stat label="Tuman va shahar tadbirlari" value={s.district ?? 0} href="/events/district" />
        )}
        {ministry && (
          <>
            <Stat label="Ma’lumot yuborgan hududlar" value={`${s.regions_sent ?? 0} / ${s.regions_total ?? 0}`} tone="text-emerald-700" href="/monitoring" />
            <Stat label="Ma’lumot yubormagan hududlar" value={Math.max(0, (s.regions_total ?? 0) - (s.regions_sent ?? 0))} tone="text-red-700" href="/monitoring" />
          </>
        )}
        <Stat label="Tasdiqlash kutilayotgan" value={s.pending ?? 0} tone="text-blue-800" href="/approvals" />
        <Stat label="Qayta ishlashga qaytarilgan" value={s.revision ?? 0} tone="text-amber-700" href="/events?status=revision" />
        <Stat label="Tasdiqlangan" value={s.approved ?? 0} tone="text-emerald-700" href="/events?status=approved" />
        <Stat label="Qoralamalar" value={s.draft ?? 0} href="/events?status=draft" />
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>So‘nggi yangilangan tadbirlar</CardTitle>
          <Link href="/events" className="text-sm font-medium text-blue-800 hover:underline">
            Barchasini ko‘rish →
          </Link>
        </CardHeader>
        {recent.rows.length === 0 ? (
          <EmptyState title="Hozircha tadbirlar kiritilmagan" text="Birinchi tadbirni kiritish uchun «Yangi tadbir kiritish» tugmasidan foydalaning.">
            {profile.role !== "observer" && (
              <Link href="/events/new" className={buttonClass("default", "default", "mt-2")}>
                Yangi tadbir kiritish
              </Link>
            )}
          </EmptyState>
        ) : (
          <CardBody className="p-0">
            <Table>
              <thead>
                <tr>
                  <Th>Tadbir</Th>
                  <Th>Hudud</Th>
                  <Th>Sana</Th>
                  <Th>Holati</Th>
                </tr>
              </thead>
              <tbody>
                {recent.rows.slice(0, 8).map((e) => (
                  <tr key={e.id} className="hover:bg-slate-50">
                    <Td>
                      <Link href={`/events/${e.id}`} className="font-medium text-blue-900 hover:underline">
                        {e.title}
                      </Link>
                    </Td>
                    <Td>
                      {e.district?.name ? e.district.name : <Badge tone="blue">Hudud asosiy</Badge>}
                      <div className="text-xs text-slate-500">{e.region?.name}</div>
                    </Td>
                    <Td className="whitespace-nowrap">{fmtDate(e.start_date)}</Td>
                    <Td>
                      <StatusBadge status={e.status} />
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </CardBody>
        )}
      </Card>
    </>
  );
}
