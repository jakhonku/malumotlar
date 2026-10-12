import { redirect } from "next/navigation";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getDistricts, getRegions } from "@/lib/queries";
import { EventForm } from "@/components/events/event-form";
import { emptyValues } from "@/lib/event-defaults";
import { PageHeader } from "@/components/ui/primitives";

export default async function NewEventPage({ searchParams }: { searchParams: Promise<{ scope?: string }> }) {
  const profile = await requireProfile();
  if (profile.role === "observer") redirect("/");
  const sp = await searchParams;
  const supabase = await createClient();
  const [regions, districts] = await Promise.all([getRegions(supabase), getDistricts(supabase)]);

  const ctx = {
    role: profile.role,
    regionId: profile.region_id,
    districtId: profile.district_id,
    canEditDistricts: profile.can_edit_districts,
  };
  const initial = emptyValues(ctx);
  if (profile.role !== "district_manager" && sp.scope === "district" && (profile.role === "super_admin" || profile.can_edit_districts)) {
    initial.scope = "district";
  }

  const hint =
    profile.role === "district_manager"
      ? "Tadbir avval viloyat mas’uliga yuboriladi, tekshiruvdan so‘ng vazirlikka o‘tadi."
      : profile.role === "region_manager"
        ? "Viloyatning asosiy tadbiri to‘g‘ridan-to‘g‘ri vazirlikka yuboriladi."
        : "Vazirlik administratori istalgan hudud uchun tadbir kirita oladi.";

  return (
    <>
      <PageHeader title="Yangi tadbir kiritish" description={hint} />
      <EventForm
        eventId={null}
        initial={initial}
        ctx={ctx}
        regions={regions.map((r) => ({ id: r.id, name: r.name }))}
        districts={districts.map((d) => ({ id: d.id, name: d.name, region_id: d.region_id }))}
      />
    </>
  );
}
