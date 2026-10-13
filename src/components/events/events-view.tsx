import Link from "next/link";
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getDistricts, getRegions, listEvents, parseFilters, type EventFilters } from "@/lib/queries";
import { PAGE_SIZE } from "@/lib/constants";
import type { Profile } from "@/lib/types";
import { fmtDate } from "@/lib/format";
import { formatPhone } from "@/lib/phone";
import { buttonClass, Card, EmptyState, Table, Td, Th } from "@/components/ui/primitives";
import { ScopeBadge, StatusBadge } from "@/components/ui/status-badge";
import { FilterBar } from "./filter-bar";

type SP = Record<string, string | string[] | undefined>;

function qs(sp: SP, patch: Record<string, string | undefined>) {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) {
    const val = Array.isArray(v) ? v[0] : v;
    if (val) p.set(k, val);
  }
  for (const [k, v] of Object.entries(patch)) {
    if (v) p.set(k, v);
    else p.delete(k);
  }
  const s = p.toString();
  return s ? `?${s}` : "";
}

export async function EventsView({
  profile, searchParams, basePath, fixedScope, extra,
}: {
  profile: Profile;
  searchParams: SP;
  basePath: string;
  fixedScope?: "regional" | "district";
  extra?: Partial<EventFilters>;
}) {
  const supabase = await createClient();
  const filters: EventFilters = { ...parseFilters(searchParams), ...(fixedScope ? { scope: fixedScope } : {}), ...extra };
  if (profile.role === "region_manager") filters.region = profile.region_id ?? undefined;

  const [{ rows, total }, regions, districts] = await Promise.all([
    listEvents(supabase, filters),
    getRegions(supabase),
    getDistricts(supabase),
  ]);

  const page = filters.page ?? 1;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const sort = filters.sort ?? "start_date";

  const sortLink = (key: string, label: string) => {
    const active = sort === key;
    const nextDir = active && filters.dir !== "desc" ? "desc" : "asc";
    return (
      <Link href={`${basePath}${qs(searchParams, { sort: key, dir: nextDir, page: undefined })}`} className="inline-flex items-center gap-1 hover:text-blue-800">
        {label}
        {active && (filters.dir === "desc" ? <ArrowDown className="h-3 w-3" /> : <ArrowUp className="h-3 w-3" />)}
      </Link>
    );
  };

  return (
    <div className="space-y-4">
      <FilterBar
        regions={regions.map((r) => ({ id: r.id, name: r.name }))}
        districts={districts.map((d) => ({ id: d.id, name: d.name, region_id: d.region_id }))}
        fixedScope={fixedScope}
        lockedRegion={profile.role === "region_manager" ? profile.region_id : undefined}
        showStatus={!extra?.status}
      />

      <Card>
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 text-sm text-slate-600">
          <span>Topildi: <b className="text-slate-900">{total}</b> ta tadbir</span>
          <span>Sahifa {page} / {pages}</span>
        </div>
        {rows.length === 0 ? (
          <EmptyState title="Tadbirlar topilmadi" text="Filtrlarni o‘zgartirib ko‘ring yoki yangi tadbir kiriting." />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>№</Th>
                <Th>Hudud</Th>
                <Th>Daraja</Th>
                <Th>Tuman/shahar</Th>
                <Th>Manzil</Th>
                <Th>{sortLink("start_date", "Sana")}</Th>
                <Th>Mas’ul ijrochi</Th>
                <Th>{sortLink("status", "Holati")}</Th>
                <Th><span className="sr-only">Amal</span></Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((e, i) => {
                const primary = e.responsibles?.find((r) => r.is_primary) ?? e.responsibles?.[0];
                return (
                  <tr key={e.id} className="hover:bg-slate-50">
                    <Td className="text-slate-500">{(page - 1) * PAGE_SIZE + i + 1}</Td>
                    <Td>{e.region?.name}</Td>
                    <Td><ScopeBadge scope={e.event_scope} /></Td>
                    <Td>{e.district?.name ?? <span className="text-slate-400">—</span>}</Td>
                    <Td className="min-w-40">{e.address ?? "—"}</Td>
                    <Td className="whitespace-nowrap">
                      {fmtDate(e.start_date)}
                      {e.end_date && e.end_date !== e.start_date && <div className="text-xs text-slate-500">– {fmtDate(e.end_date)}</div>}
                    </Td>
                    <Td className="min-w-40">
                      {primary ? (
                        <>
                          {primary.full_name}
                          <div className="text-xs text-slate-500">{primary.position}</div>
                          <div className="whitespace-nowrap text-xs text-slate-500">{formatPhone(primary.phone)}</div>
                        </>
                      ) : "—"}
                    </Td>
                    <Td><StatusBadge status={e.status} /></Td>
                    <Td>
                      <Link href={`/events/${e.id}`} className={buttonClass("outline", "sm")}>Batafsil</Link>
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        )}
        {pages > 1 && (
          <nav className="flex items-center justify-between border-t border-slate-200 px-4 py-3" aria-label="Sahifalash">
            <Link
              aria-disabled={page <= 1}
              className={buttonClass("outline", "sm", page <= 1 ? "pointer-events-none opacity-40" : "")}
              href={`${basePath}${qs(searchParams, { page: String(page - 1) })}`}
            >
              <ChevronLeft className="h-4 w-4" /> Oldingi
            </Link>
            <span className="text-sm text-slate-600">{page} / {pages}</span>
            <Link
              aria-disabled={page >= pages}
              className={buttonClass("outline", "sm", page >= pages ? "pointer-events-none opacity-40" : "")}
              href={`${basePath}${qs(searchParams, { page: String(page + 1) })}`}
            >
              Keyingi <ChevronRight className="h-4 w-4" />
            </Link>
          </nav>
        )}
      </Card>
    </div>
  );
}
