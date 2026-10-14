import { requireRole } from "@/lib/auth";
import { avatarUrls } from "@/lib/avatars";
import { createClient } from "@/lib/supabase/server";
import { getDistricts, getRegions } from "@/lib/queries";
import { PageHeader } from "@/components/ui/primitives";
import { UsersManager, type UserRow } from "@/components/events/users-manager";

export default async function UsersPage() {
  await requireRole("super_admin");
  const supabase = await createClient();
  const [{ data: withPhoto, error: photoErr }, regions, districts] = await Promise.all([
    supabase.from("profiles").select("id,username,full_name,role,region_id,district_id,phone,position,avatar_path,can_edit_districts,is_active").order("full_name").limit(1000),
    getRegions(supabase, true),
    getDistricts(supabase, { includeInactive: true }),
  ]);
  // 0017 migratsiyasi hali ishga tushirilmagan bo‘lsa ham ro‘yxat ochilaversin
  const data: Record<string, unknown>[] | null = photoErr
    ? (await supabase.from("profiles").select("id,username,full_name,role,region_id,district_id,phone,can_edit_districts,is_active").order("full_name").limit(1000)).data
    : withPhoto;
  const urls = await avatarUrls((data ?? []).map((u) => u.avatar_path as string | null));
  const users = (data ?? []).map((u) => ({ ...u, avatar_url: u.avatar_path ? urls.get(u.avatar_path as string) ?? null : null }));
  return (
    <>
      <PageHeader title="Foydalanuvchilar" description="Foydalanuvchilarni yarating, hududlarga biriktiring va rollarini boshqaring." />
      <UsersManager
        users={users as unknown as UserRow[]}
        regions={regions.map((r) => ({ id: r.id, name: r.name }))}
        districts={districts.map((d) => ({ id: d.id, name: d.name, region_id: d.region_id }))}
      />
    </>
  );
}
