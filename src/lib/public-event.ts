import "server-only";
import { createHash } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { EVENT_SELECT } from "@/lib/queries";
import type { EventFormValues } from "@/lib/validators";
import type { EventRow } from "@/lib/types";

export const TOKEN_RE = /^[0-9a-f]{48}$/;

export interface PublicGroup {
  events: EventRow[];
  /** Qaytarilgan tadbirlar uchun sabab: eventId → izoh */
  reasons: Record<string, string>;
  /** Hudud havolasi qaysi hududga tegishli */
  scope: "regional" | "district";
  regionId: string;
  districtId: string | null;
  regionName: string;
  districtName: string | null;
}

/** Hudud havolasi (token) bo‘yicha barcha tadbirlarni topadi (service_role; faqat token egasi ko‘ra oladi). */
export async function getGroupByToken(token: string): Promise<PublicGroup | null> {
  if (!TOKEN_RE.test(token)) return null;
  const hash = createHash("sha256").update(token).digest("hex");
  const admin = createAdminClient();
  const { data } = await admin
    .from("events")
    .select(EVENT_SELECT)
    .eq("edit_token_hash", hash)
    .is("deleted_at", null)
    .order("created_at");
  const events = (data ?? []) as unknown as EventRow[];
  if (events.length === 0) return null;
  for (const e of events) {
    for (const k of ["artists", "participants", "responsibles"] as const) {
      (e[k] as { sort_order?: number }[] | undefined)?.sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
    }
  }

  const reasons: Record<string, string> = {};
  const returned = events.filter((e) => e.status === "revision").map((e) => e.id);
  if (returned.length) {
    const { data: hist } = await admin
      .from("event_status_history")
      .select("event_id,comment,created_at")
      .in("event_id", returned)
      .in("action", ["return", "reopen"])
      .order("created_at", { ascending: true });
    for (const h of hist ?? []) if (h.comment) reasons[h.event_id] = h.comment; // oxirgisi ustun
  }

  const first = events[0];
  return {
    events,
    reasons,
    scope: first.event_scope,
    regionId: first.region_id,
    districtId: first.district_id,
    regionName: first.region?.name ?? "",
    districtName: first.district?.name ?? null,
  };
}

/** Tadbirni forma qiymatlariga aylantiradi. */
export function eventToFormValues(e: EventRow): EventFormValues {
  const v: EventFormValues = {
    scope: e.event_scope,
    region_id: e.region_id,
    district_id: e.district_id ?? "",
    new_district_name: "",
    new_district_type: "tuman",
    title: e.title,
    event_type: e.event_type ?? "",
    description: e.description ?? "",
    organization_name: e.organization_name ?? "",
    notes: e.notes ?? "",
    address: e.address ?? "",
    location_note: e.location_note ?? "",
    start_date: e.start_date ?? "",
    end_date: e.end_date && e.end_date !== e.start_date ? e.end_date : "",
    artists: (e.artists ?? []).map((a) => ({
      artist_name: a.artist_name, artist_type: a.artist_type, performance_type: a.performance_type ?? "",
      role_description: a.role_description ?? "", notes: a.notes ?? "",
    })),
    participants: (e.participants ?? []).map((p) => ({
      participant_name: p.participant_name, participant_category: p.participant_category ?? "",
      participant_count: p.participant_count ?? "", participation_role: p.participation_role ?? "", notes: p.notes ?? "",
    })),
    responsibles: (e.responsibles ?? []).map((r) => ({
      full_name: r.full_name, position: r.position, organization: r.organization ?? "", phone: r.phone,
      is_primary: r.is_primary, notes: r.notes ?? "",
    })),
  };
  if (v.responsibles.length === 0) {
    v.responsibles = [{ full_name: "", position: "", organization: "", phone: "", is_primary: true, notes: "" }];
  }
  return v;
}
