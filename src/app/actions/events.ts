"use server";

import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth";
import { draftSchema, returnReasonSchema, submitSchema, type EventFormValues } from "@/lib/validators";
import { buildEventPayload, toFieldErrors } from "@/lib/event-payload";

export interface SaveResult {
  ok: boolean;
  id?: string;
  error?: string;
  /** zod xatolari: maydon yo‘li → xabar */
  fieldErrors?: Record<string, string>;
  duplicates?: { id: string; title: string; address: string | null; start_date: string | null }[];
}

type Mode = "draft" | "validate" | "submit";

// Postgres "raise exception" (P0001) xabarlari foydalanuvchiga mo‘ljallangan; boshqa xatolar yashiriladi.
function dbMessage(error: { code?: string; message: string }): string {
  if (error.code === "P0001") return error.message;
  if (error.code === "42501") return "Bu amalni bajarishga ruxsat yo‘q";
  if (error.code === "23514" || error.code === "23505") return "Kiritilgan ma’lumotlar cheklovlarga mos kelmadi. Maydonlarni tekshiring.";
  return "Server xatosi yuz berdi. Birozdan so‘ng qayta urinib ko‘ring.";
}


export async function checkDuplicates(
  values: Pick<EventFormValues, "address" | "event_date">,
  excludeId?: string,
): Promise<SaveResult["duplicates"]> {
  const profile = await getProfile();
  if (!profile || !values.address || !values.event_date) return [];
  const supabase = await createClient();
  let q = supabase
    .from("events")
    .select("id,title,address,start_date")
    .ilike("address", values.address.trim().replace(/[%_]/g, ""))
    .eq("start_date", values.event_date)
    .limit(20);
  if (excludeId) q = q.neq("id", excludeId);
  const { data } = await q;
  return data ?? [];
}

export async function saveEvent(eventId: string | null, values: EventFormValues, mode: Mode): Promise<SaveResult> {
  const profile = await getProfile();
  if (!profile) return { ok: false, error: "Sessiya tugagan. Qayta kiring." };
  if (profile.role === "observer") return { ok: false, error: "Kuzatuvchi ma’lumot kirita olmaydi" };

  const parsed = (mode === "draft" ? draftSchema : submitSchema).safeParse(values);
  if (!parsed.success) {
    return { ok: false, error: "Ba’zi maydonlar noto‘g‘ri to‘ldirilgan", fieldErrors: toFieldErrors(parsed.error.issues) };
  }
  const v = parsed.data;

  const duplicates = await checkDuplicates(
    { address: v.address ?? "", event_date: v.event_date ?? "" },
    eventId ?? undefined,
  );
  if (mode === "validate") return { ok: true, duplicates };

  const supabase = await createClient();
  const payload = buildEventPayload(v);

  const { data: id, error } = await supabase.rpc("save_event", { p_event_id: eventId, p_data: payload });
  if (error) return { ok: false, error: dbMessage(error) };

  if (mode === "submit") {
    const { error: tErr } = await supabase.rpc("transition_event", { p_event_id: id, p_action: "submit", p_comment: null });
    if (tErr) return { ok: false, id: id as string, error: dbMessage(tErr) };
  }
  return { ok: true, id: id as string, duplicates };
}

export async function transitionEvent(
  eventId: string,
  action: "submit" | "forward" | "return" | "approve" | "reopen",
  comment?: string,
): Promise<{ ok: boolean; error?: string }> {
  const profile = await getProfile();
  if (!profile) return { ok: false, error: "Sessiya tugagan. Qayta kiring." };
  if (action === "return" || action === "reopen") {
    const r = returnReasonSchema.safeParse(comment ?? "");
    if (!r.success) return { ok: false, error: r.error.issues[0].message };
  }
  const supabase = await createClient();
  const { error } = await supabase.rpc("transition_event", {
    p_event_id: eventId,
    p_action: action,
    p_comment: comment?.trim() || null,
  });
  if (error) return { ok: false, error: dbMessage(error) };
  return { ok: true };
}

export async function deleteEvent(eventId: string): Promise<{ ok: boolean; error?: string }> {
  const profile = await getProfile();
  if (!profile) return { ok: false, error: "Sessiya tugagan. Qayta kiring." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("delete_event", { p_event_id: eventId });
  if (error) return { ok: false, error: dbMessage(error) };
  return { ok: true };
}

export async function markNotificationsRead(): Promise<void> {
  const profile = await getProfile();
  if (!profile) return;
  const supabase = await createClient();
  await supabase.from("notifications").update({ is_read: true }).eq("is_read", false);
}
