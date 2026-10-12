import { requireProfile } from "@/lib/auth";
import { EventsView } from "@/components/events/events-view";
import { PageHeader } from "@/components/ui/primitives";

export default async function EventsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const profile = await requireProfile();
  const sp = await searchParams;
  return (
    <>
      <PageHeader
        title={profile.role === "district_manager" ? "Mening tadbirlarim" : "Barcha tadbirlar"}
        description="Qidiruv, filtr va saralash orqali kerakli tadbirni toping."
      />
      <EventsView profile={profile} searchParams={sp} basePath="/events" />
    </>
  );
}
