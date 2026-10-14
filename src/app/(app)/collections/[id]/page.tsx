import { redirect } from "next/navigation";
import { requireProfile } from "@/lib/auth";
import { CollectionOverview } from "../../ministry-dashboard";

export const dynamic = "force-dynamic";

/** Vazirlik: tanlangan yig‘ishning umumiy ko‘rinishi va viloyatlar KPI. Viloyat boshqarmasi — hisobotga. */
export default async function CollectionHomePage({ params }: { params: Promise<{ id: string }> }) {
  const profile = await requireProfile();
  const { id } = await params;
  if (profile.role === "district_manager") redirect("/");
  if (profile.role === "region_manager") redirect(`/collections/${id}/hisobot`);
  return <CollectionOverview collectionId={id} />;
}
