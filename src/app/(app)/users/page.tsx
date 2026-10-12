import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getDistricts, getRegions } from "@/lib/queries";
import { PageHeader } from "@/components/ui/primitives";
import { UsersManager, type UserRow } from "@/components/events/users-manager";

export default async function UsersPage() {
  await requireRole("super_admin");
  const supabase = await createClient();
  const [{ data }, regions, districts] = await Promise.all([
    supabase.from("profiles").select("id,username,full_name,role,region_id,district_id,phone,can_edit_districts,is_active").order("full_name").limit(1000),
    getRegions(supabase, true),
    getDistricts(supabase, { includeInactive: true }),
  ]);
  return (
    <>
      <PageHeader title="Foydalanuvchilar" description="Foydalanuvchilarni yarating, hududlarga biriktiring va rollarini boshqaring." />
      <UsersManager
        users={(data ?? []) as UserRow[]}
        regions={regions.map((r) => ({ id: r.id, name: r.name }))}
        districts={districts.map((d) => ({ id: d.id, name: d.name, region_id: d.region_id }))}
      />
    </>
  );
}
