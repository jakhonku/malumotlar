import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getDistricts, getRegions } from "@/lib/queries";
import { PageHeader } from "@/components/ui/primitives";
import { ReportForm } from "@/components/events/report-form";

export default async function ReportsPage() {
  const profile = await requireProfile();
  const supabase = await createClient();
  const [regions, districts] = await Promise.all([getRegions(supabase), getDistricts(supabase)]);
  const visibleRegions = profile.region_id ? regions.filter((r) => r.id === profile.region_id) : regions;

  return (
    <>
      <PageHeader
        title="Word hisobotlari"
        description="Rasmiy .docx hujjat server tomonida yaratiladi: A4, Times New Roman, jadval sarlavhalari har sahifada takrorlanadi."
      />
      <div className="max-w-3xl">
        <ReportForm
          role={profile.role}
          regions={visibleRegions.map((r) => ({ id: r.id, name: r.name }))}
          districts={districts.map((d) => ({ id: d.id, name: d.name, region_id: d.region_id }))}
          lockedRegion={profile.region_id}
          lockedDistrict={profile.district_id}
        />
      </div>
    </>
  );
}
