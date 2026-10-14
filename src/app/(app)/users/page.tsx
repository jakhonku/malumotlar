import { requireRole } from "@/lib/auth";
import { avatarUrls } from "@/lib/avatars";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { fmtTashkent } from "@/lib/login-links";
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
  const order = new Map(regions.map((r) => [r.id, r.sort_order]));
  const roleRank: Record<string, number> = { super_admin: 0, observer: 1, region_manager: 2, district_manager: 3 };
  const sorted = (data ?? []).slice().sort((a, b) =>
    (roleRank[a.role as string] ?? 9) - (roleRank[b.role as string] ?? 9) ||
    (order.get(a.region_id as string) ?? 999) - (order.get(b.region_id as string) ?? 999) ||
    String(a.full_name).localeCompare(String(b.full_name)));
  // tezkor kirish havolalari holati (0019 hali ishga tushirilmagan bo‘lsa — bo‘sh)
  const { data: links } = await createAdminClient().from("login_links").select("user_id,expires_at,revoked_at,use_count,created_at").order("created_at", { ascending: false }).limit(2000);
  const linkOf = new Map<string, { state: "faol" | "eskirgan" | "bekor"; until: string; uses: number }>();
  for (const l of links ?? []) {
    if (linkOf.has(l.user_id as string)) continue; // eng yangisi
    const expired = new Date(l.expires_at as string) < new Date();
    linkOf.set(l.user_id as string, { state: l.revoked_at ? "bekor" : expired ? "eskirgan" : "faol", until: fmtTashkent(l.expires_at as string), uses: (l.use_count as number) ?? 0 });
  }
  const users = sorted.map((u) => ({ ...u, avatar_url: u.avatar_path ? urls.get(u.avatar_path as string) ?? null : null, link: linkOf.get(u.id as string) ?? null }));
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
