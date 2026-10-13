import { notFound, redirect } from "next/navigation";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getDistricts, getEvent, getRegions } from "@/lib/queries";
import { canEditEvent } from "@/lib/workflow";
import { EventForm } from "@/components/events/event-form";
import { PageHeader } from "@/components/ui/primitives";
import type { EventFormValues } from "@/lib/validators";

export default async function EditEventPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const profile = await requireProfile();
  const supabase = await createClient();
  const e = await getEvent(supabase, id);
  if (!e) notFound();
  if (!canEditEvent(e, profile)) redirect(`/events/${id}`);

  const [regions, districts] = await Promise.all([getRegions(supabase, true), getDistricts(supabase, { includeInactive: true })]);

  const initial: EventFormValues = {
    scope: e.event_scope,
    region_id: e.region_id,
    district_id: e.district_id ?? "",
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
  if (initial.responsibles.length === 0) {
    initial.responsibles = [{ full_name: "", position: "", organization: "", phone: "", is_primary: true, notes: "" }];
  }

  return (
    <>
      <PageHeader title="Tadbirni tahrirlash" description={e.title} />
      <EventForm
        eventId={e.id}
        initial={initial}
        ctx={{ role: profile.role, regionId: profile.region_id, districtId: profile.district_id, canEditDistricts: profile.can_edit_districts }}
        regions={regions.map((r) => ({ id: r.id, name: r.name }))}
        districts={districts.map((d) => ({ id: d.id, name: d.name, region_id: d.region_id }))}
        lockedGeo
        lockedLabel="Tadbir hududi va ko‘lamini o‘zgartirib bo‘lmaydi."
      />
    </>
  );
}
