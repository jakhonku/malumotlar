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
  const [regions, districts] = await Promise.all([getRegions(supabase, true), getDistricts(supabase, { includeInactive: true })]);
  // ustunlar migratsiyalar bilan qo‘shilgan (0017 rasm, 0021 oxirgi faollik): bo‘lmasa, kamroq ustun bilan ham ro‘yxat ochilaversin
  const base = "id,username,full_name,role,region_id,district_id,phone,can_edit_districts,is_active";
  let data: Record<string, unknown>[] | null = null;
  for (const cols of [`${base},position,avatar_path,last_seen_at`, `${base},position,avatar_path`, base]) {
    const r = await supabase.from("profiles").select(cols).order("full_name").limit(1000);
    if (!r.error) { data = r.data as unknown as Record<string, unknown>[]; break; }
  }
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
  // oxirgi kirish (login) vaqti — Supabase Auth dan
  const signedIn = new Map<string, string>();
  try {
    const { data: au } = await createAdminClient().auth.admin.listUsers({ page: 1, perPage: 1000 });
    for (const a of au?.users ?? []) if (a.last_sign_in_at) signedIn.set(a.id, a.last_sign_in_at);
  } catch { /* ko‘rsatilmaydi */ }
  const nowMs = new Date().getTime();
  const users = sorted.map((u) => {
    const seen = (u.last_seen_at as string | null) ?? null;
    const ago = seen ? nowMs - new Date(seen).getTime() : null;
    const si = signedIn.get(u.id as string) ?? null;
    return {
      ...u,
      avatar_url: u.avatar_path ? urls.get(u.avatar_path as string) ?? null : null,
      link: linkOf.get(u.id as string) ?? null,
      presence: {
        online: ago !== null && ago < 5 * 60_000,
        seen: seen ? fmtTashkent(seen) : null,
        agoMin: ago === null ? null : Math.floor(ago / 60_000),
        signedIn: si ? fmtTashkent(si) : null,
      },
    };
  });
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
