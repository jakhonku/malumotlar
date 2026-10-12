import { redirect } from "next/navigation";
import { requireProfile } from "@/lib/auth";
import { PeopleList } from "@/components/events/people-list";
import { PageHeader } from "@/components/ui/primitives";

export default async function ResponsiblesPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const profile = await requireProfile();
  if (profile.role === "district_manager") redirect("/");
  const sp = await searchParams;
  return (
    <>
      <PageHeader title="Mas’ul ijrochilar" description="Tadbirlarga biriktirilgan mas’ul ijrochilar va ularning telefonlari." />
      <PeopleList kind="responsibles" searchParams={sp} basePath="/responsibles" />
    </>
  );
}
