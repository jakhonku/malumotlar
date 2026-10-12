import Link from "next/link";
import { ChevronLeft, ChevronRight, Search } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getRegions } from "@/lib/queries";
import { ARTIST_TYPE_LABELS, PAGE_SIZE } from "@/lib/constants";
import { formatPhone } from "@/lib/phone";
import { fmtDate } from "@/lib/format";
import { Badge, Button, buttonClass, Card, EmptyState, Input, Select, Table, Td, Th } from "@/components/ui/primitives";
import { StatusBadge } from "@/components/ui/status-badge";
import type { EventStatus } from "@/lib/constants";

type SP = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) || "";
const clean = (s: string) => s.replace(/[%,()*\\]/g, " ").trim();

interface EventRef {
  id: string; title: string; status: EventStatus; start_date: string | null;
  region: { name: string } | null; district: { name: string } | null;
}

export async function PeopleList({ kind, searchParams, basePath }: { kind: "artists" | "responsibles"; searchParams: SP; basePath: string }) {
  const supabase = await createClient();
  const regions = await getRegions(supabase);
  const q = clean(one(searchParams.q));
  const region = one(searchParams.region);
  const page = Math.max(1, Number(one(searchParams.page)) || 1);
  const from = (page - 1) * PAGE_SIZE;

  const table = kind === "artists" ? "event_artists" : "event_responsibles";
  const nameCol = kind === "artists" ? "artist_name" : "full_name";
  const ev = "events!inner(id,title,status,start_date,region_id,region:regions(name),district:districts(name))";

  let query = supabase.from(table).select(`*, ${ev}`, { count: "exact" });
  if (region) query = query.eq("events.region_id", region);
  if (q) {
    const digits = q.replace(/\D/g, "");
    query =
      kind === "responsibles" && digits.length >= 3
        ? query.or(`full_name.ilike.%${q}%,phone.ilike.%${digits}%,position.ilike.%${q}%`)
        : query.ilike(nameCol, `%${q}%`);
  }
  const { data, count } = await query.order(nameCol).range(from, from + PAGE_SIZE - 1);
  const rows = (data ?? []) as unknown as (Record<string, string | boolean | null> & { events: EventRef })[];
  const total = count ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const link = (p: number) => {
    const sp = new URLSearchParams();
    if (q) sp.set("q", q);
    if (region) sp.set("region", region);
    sp.set("page", String(p));
    return `${basePath}?${sp.toString()}`;
  };

  return (
    <div className="space-y-4">
      <form className="grid gap-3 rounded-lg border border-slate-200 bg-white p-4 sm:grid-cols-3">
        <Input name="q" defaultValue={q} placeholder={kind === "artists" ? "San’atkor yoki jamoa nomi" : "F.I.Sh., lavozim yoki telefon"} aria-label="Qidiruv" />
        <Select name="region" defaultValue={region} aria-label="Viloyat">
          <option value="">Barcha viloyatlar</option>
          {regions.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
        </Select>
        <div className="flex gap-2">
          <Button type="submit"><Search className="h-4 w-4" /> Qidirish</Button>
          <Link href={basePath} className={buttonClass("outline")}>Tozalash</Link>
        </div>
      </form>
      <Card>
        <div className="border-b border-slate-200 px-4 py-3 text-sm text-slate-600">Topildi: <b className="text-slate-900">{total}</b> ta yozuv</div>
        {rows.length === 0 ? <EmptyState title="Ma’lumot topilmadi" /> : (
          <Table>
            <thead>
              {kind === "artists" ? (
                <tr><Th>San’atkor / jamoa</Th><Th>Turi</Th><Th>Ijro yo‘nalishi</Th><Th>Tadbir</Th><Th>Hudud</Th><Th>Sana</Th><Th>Holati</Th></tr>
              ) : (
                <tr><Th>F.I.Sh.</Th><Th>Lavozimi</Th><Th>Telefon</Th><Th>Tadbir</Th><Th>Hudud</Th><Th>Sana</Th><Th>Holati</Th></tr>
              )}
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={String(r.id)} className="hover:bg-slate-50">
                  {kind === "artists" ? (
                    <>
                      <Td className="font-medium">{r.artist_name}</Td>
                      <Td>{ARTIST_TYPE_LABELS[r.artist_type as "artist" | "group"]}</Td>
                      <Td>{r.performance_type}</Td>
                    </>
                  ) : (
                    <>
                      <Td className="font-medium">{r.full_name} {r.is_primary && <Badge tone="blue">asosiy</Badge>}</Td>
                      <Td>{r.position}</Td>
                      <Td className="whitespace-nowrap">{formatPhone(r.phone as string)}</Td>
                    </>
                  )}
                  <Td><Link href={`/events/${r.events.id}`} className="text-blue-900 hover:underline">{r.events.title}</Link></Td>
                  <Td>{r.events.district?.name ?? r.events.region?.name}</Td>
                  <Td className="whitespace-nowrap">{fmtDate(r.events.start_date)}</Td>
                  <Td><StatusBadge status={r.events.status} /></Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
        {pages > 1 && (
          <nav className="flex items-center justify-between border-t border-slate-200 px-4 py-3" aria-label="Sahifalash">
            <Link href={link(page - 1)} aria-disabled={page <= 1} className={buttonClass("outline", "sm", page <= 1 ? "pointer-events-none opacity-40" : "")}><ChevronLeft className="h-4 w-4" /> Oldingi</Link>
            <span className="text-sm text-slate-600">{page} / {pages}</span>
            <Link href={link(page + 1)} aria-disabled={page >= pages} className={buttonClass("outline", "sm", page >= pages ? "pointer-events-none opacity-40" : "")}>Keyingi <ChevronRight className="h-4 w-4" /></Link>
          </nav>
        )}
      </Card>
    </div>
  );
}
