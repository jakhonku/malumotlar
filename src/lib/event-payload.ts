import type { z } from "zod";
import type { draftSchema } from "./validators";

type Parsed = z.output<typeof draftSchema>;

/** «Urgut» → «Urgut tumani» / «Urgut shahri» (ro‘yxatdagi nomlar bilan bir xil ko‘rinish uchun). */
export function normalizeDistrictName(name: string | undefined, type: "tuman" | "shahar" | undefined): string | null {
  const n = (name ?? "").trim().replace(/\s+/g, " ");
  if (!n) return null;
  if (/(tumani|shahri|tuman|shahar)$/i.test(n)) return n;
  return `${n} ${type === "shahar" ? "shahri" : "tumani"}`;
}

export function toFieldErrors(issues: { path: PropertyKey[]; message: string }[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const i of issues) {
    const key = i.path.map(String).join(".");
    if (!(key in out)) out[key] = i.message;
  }
  return out;
}

/** Tadbir nomi so‘ralmaydi: «Tadbir turi — manzil» ko‘rinishida avtomatik hosil qilinadi (ro‘yxat, xabarnoma uchun). */
export function autoTitle(v: { event_type?: string; address?: string; title?: string }): string {
  const base = v.event_type?.trim() || "Yangi yil tadbiri";
  const addr = (v.address ?? "").trim().replace(/\s+/g, " ");
  const t = addr ? `${base} — ${addr.length > 80 ? addr.slice(0, 77) + "…" : addr}` : base;
  return t.length >= 3 ? t : "Yangi yil tadbiri";
}

/** Zod dan o‘tgan qiymatlarni save_event / public_save_event uchun JSON ga aylantiradi. */
export function buildEventPayload(v: Parsed) {
  return {
    scope: v.scope,
    region_id: v.region_id || null,
    district_id: v.district_id && v.district_id !== "__new__" ? v.district_id : null,
    new_district_name:
      v.district_id && v.district_id !== "__new__" ? null : normalizeDistrictName(v.new_district_name, v.new_district_type),
    new_district_type: v.new_district_type ?? "tuman",
    event: {
      title: autoTitle(v),
      event_type: v.event_type,
      description: v.description,
      venue_name: null,
      address: v.address,
      location_note: v.location_note,
      start_date: v.start_date || null,
      end_date: v.end_date || v.start_date || null,
      start_time: null,
      end_time: null,
      organization_name: v.organization_name,
      notes: v.notes,
    },
    artists: v.artists,
    participants: v.participants.map((p) => ({ ...p, participant_count: p.participant_count === "" ? null : p.participant_count })),
    responsibles: v.responsibles,
  };
}
