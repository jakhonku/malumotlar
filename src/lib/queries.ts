import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { PAGE_SIZE, type EventScope, type EventStatus } from "./constants";
import type { District, EventRow, Region } from "./types";

export const EVENT_SELECT =
  "*, region:regions(name), district:districts(name), artists:event_artists(*), participants:event_participants(*), responsibles:event_responsibles(*)";

export interface EventFilters {
  q?: string;
  region?: string;
  district?: string;
  scope?: EventScope;
  type?: string;
  from?: string;
  to?: string;
  artist?: string;
  responsible?: string;
  phone?: string;
  status?: EventStatus[];
  stage?: string;
  page?: number;
  sort?: string;
  dir?: "asc" | "desc";
}

type Raw = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) || undefined;

const STATUSES: EventStatus[] = ["draft", "submitted", "revision", "approved"];

export function parseFilters(sp: Raw): EventFilters {
  const statusRaw = one(sp.status);
  const status = statusRaw
    ? (statusRaw.split(",").filter((s) => (STATUSES as string[]).includes(s)) as EventStatus[])
    : undefined;
  const scope = one(sp.scope);
  return {
    q: one(sp.q),
    region: one(sp.region),
    district: one(sp.district),
    scope: scope === "regional" || scope === "district" ? scope : undefined,
    type: one(sp.type),
    from: one(sp.from),
    to: one(sp.to),
    artist: one(sp.artist),
    responsible: one(sp.responsible),
    phone: one(sp.phone),
    status: status?.length ? status : undefined,
    stage: one(sp.stage),
    page: Math.max(1, Number(one(sp.page)) || 1),
    sort: one(sp.sort),
    dir: one(sp.dir) === "desc" ? "desc" : "asc",
  };
}

const SORTABLE = new Set(["start_date", "title", "status", "updated_at", "created_at"]);

// PostgREST filtr qiymatlaridagi maxsus belgilarni olib tashlaydi
const clean = (s: string) => s.replace(/[%,()*\\]/g, " ").trim();

async function eventIdsFrom(
  supabase: SupabaseClient,
  table: string,
  column: string,
  term: string,
): Promise<string[]> {
  const { data } = await supabase.from(table).select("event_id").ilike(column, `%${term}%`).limit(5000);
  return (data ?? []).map((r: { event_id: string }) => r.event_id);
}

/** Filtrlarni qo‘llaydi. Child jadvallar bo‘yicha qidiruv avval tadbir ID larini topadi. */
// PostgREST filtr quruvchisining generik tiplari juda murakkab; bu yerda kengaytirilgan tip qo‘llanadi.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Q = any;

async function applyFilters(
  supabase: SupabaseClient,
  query: Q,
  f: EventFilters,
): Promise<{ query: Q; empty: boolean }> {
  let q = query;
  if (f.region) q = q.eq("region_id", f.region);
  if (f.district) q = q.eq("district_id", f.district);
  if (f.scope) q = q.eq("event_scope", f.scope);
  if (f.type) q = q.eq("event_type", f.type);
  if (f.status?.length) q = q.in("status", f.status);
  if (f.stage) q = q.eq("stage", f.stage);
  if (f.from) q = q.gte("end_date", f.from);
  if (f.to) q = q.lte("start_date", f.to);
  if (f.q) {
    const t = clean(f.q);
    if (t) q = q.or(`title.ilike.%${t}%,address.ilike.%${t}%,organization_name.ilike.%${t}%`);
  }

  const idSets: string[][] = [];
  if (f.artist && clean(f.artist)) idSets.push(await eventIdsFrom(supabase, "event_artists", "artist_name", clean(f.artist)));
  if (f.responsible && clean(f.responsible))
    idSets.push(await eventIdsFrom(supabase, "event_responsibles", "full_name", clean(f.responsible)));
  if (f.phone) {
    const digits = f.phone.replace(/\D/g, "");
    if (digits) idSets.push(await eventIdsFrom(supabase, "event_responsibles", "phone", digits));
  }
  if (idSets.length) {
    const ids = idSets.reduce((a, b) => a.filter((x) => b.includes(x)));
    if (!ids.length) return { query: q, empty: true };
    q = q.in("id", ids);
  }
  return { query: q, empty: false };
}

export async function listEvents(
  supabase: SupabaseClient,
  f: EventFilters,
  opts: { paginate?: boolean } = { paginate: true },
): Promise<{ rows: EventRow[]; total: number }> {
  const base = supabase.from("events").select(EVENT_SELECT, { count: "exact" });
  const { query, empty } = await applyFilters(supabase, base, f);
  if (empty) return { rows: [], total: 0 };

  const sort = f.sort && SORTABLE.has(f.sort) ? f.sort : "start_date";
  let q = query.order(sort, { ascending: f.dir !== "desc", nullsFirst: false }).order("title");
  if (opts.paginate !== false) {
    const from = ((f.page ?? 1) - 1) * PAGE_SIZE;
    q = q.range(from, from + PAGE_SIZE - 1);
  }
  const { data, count, error } = await q;
  if (error) throw new Error("Ma’lumotlarni yuklashda xatolik: " + error.message);
  return { rows: (data ?? []) as EventRow[], total: count ?? 0 };
}

/** Hisobot uchun barcha mos tadbirlar (1000 talik bo‘laklarda). */
export async function listAllEvents(supabase: SupabaseClient, f: EventFilters): Promise<EventRow[]> {
  const out: EventRow[] = [];
  for (let from = 0; ; from += 1000) {
    const base = supabase.from("events").select(EVENT_SELECT);
    const { query, empty } = await applyFilters(supabase, base, f);
    if (empty) return [];
    const { data, error } = await query.order("start_date", { nullsFirst: false }).order("id").range(from, from + 999);
    if (error) throw new Error("Hisobot ma’lumotlarini yuklashda xatolik: " + error.message);
    out.push(...((data ?? []) as EventRow[]));
    if (!data || data.length < 1000) break;
  }
  return out;
}

export async function getEvent(supabase: SupabaseClient, id: string): Promise<EventRow | null> {
  const { data } = await supabase.from("events").select(EVENT_SELECT).eq("id", id).maybeSingle();
  if (!data) return null;
  const e = data as EventRow;
  for (const k of ["artists", "participants", "responsibles"] as const) {
    (e[k] as { sort_order?: number }[] | undefined)?.sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
  }
  return e;
}

export async function getRegions(supabase: SupabaseClient, includeInactive = false): Promise<Region[]> {
  let q = supabase.from("regions").select("*").order("sort_order");
  if (!includeInactive) q = q.eq("is_active", true);
  const { data } = await q;
  return (data ?? []) as Region[];
}

export async function getDistricts(
  supabase: SupabaseClient,
  opts: { regionId?: string; includeInactive?: boolean } = {},
): Promise<District[]> {
  let q = supabase.from("districts").select("*").order("district_type", { ascending: false }).order("name");
  if (opts.regionId) q = q.eq("region_id", opts.regionId);
  if (!opts.includeInactive) q = q.eq("is_active", true);
  const { data } = await q.limit(2000);
  return (data ?? []) as District[];
}
