import { requireProfile } from "@/lib/auth";
import { EventsView } from "@/components/events/events-view";
import { PageHeader } from "@/components/ui/primitives";

export default async function DistrictEventsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const profile = await requireProfile();
  const sp = await searchParams;
  return (
    <>
      <PageHeader title="Tuman va shahar tadbirlari" description="Tuman/shahar mas’ullari mustaqil kiritgan tadbirlar." />
      <EventsView profile={profile} searchParams={sp} basePath="/events/district" fixedScope="district" />
    </>
  );
}
