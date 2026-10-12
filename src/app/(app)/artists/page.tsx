import { redirect } from "next/navigation";
import { requireProfile } from "@/lib/auth";
import { PeopleList } from "@/components/events/people-list";
import { PageHeader } from "@/components/ui/primitives";

export default async function ArtistsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const profile = await requireProfile();
  if (profile.role === "district_manager") redirect("/");
  const sp = await searchParams;
  return (
    <>
      <PageHeader title="San’atkorlar va ijodiy jamoalar" description="Barcha tadbirlardagi san’atkorlar va jamoalar ro‘yxati." />
      <PeopleList kind="artists" searchParams={sp} basePath="/artists" />
    </>
  );
}
