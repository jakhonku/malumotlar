import { requireProfile } from "@/lib/auth";
import { EventsView } from "@/components/events/events-view";
import { PageHeader } from "@/components/ui/primitives";

export default async function RegionalEventsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const profile = await requireProfile();
  const sp = await searchParams;
  return (
    <>
      <PageHeader title="Hudud asosiy tadbirlari" description="Hudud miqyosidagi asosiy tadbirlar — tuman tadbirlaridan alohida." />
      <EventsView profile={profile} searchParams={sp} basePath="/events/regional" fixedScope="regional" />
    </>
  );
}
