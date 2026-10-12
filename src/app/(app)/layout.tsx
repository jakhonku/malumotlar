import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Sidebar } from "@/components/layout/sidebar";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const profile = await requireProfile();
  const supabase = await createClient();

  const [{ count: unread }, region, district] = await Promise.all([
    supabase.from("notifications").select("id", { count: "exact", head: true }).eq("is_read", false),
    profile.region_id ? supabase.from("regions").select("name").eq("id", profile.region_id).maybeSingle() : null,
    profile.district_id ? supabase.from("districts").select("name").eq("id", profile.district_id).maybeSingle() : null,
  ]);

  const scopeLabel =
    profile.role === "super_admin"
      ? "Respublika bo‘yicha"
      : [region?.data?.name, district?.data?.name].filter(Boolean).join(" · ") || "Respublika bo‘yicha";

  return (
    <div className="min-h-screen">
      <Sidebar role={profile.role} fullName={profile.full_name} scopeLabel={scopeLabel} unread={unread ?? 0} />
      <main className="px-4 py-6 lg:ml-72 lg:px-8">
        <div className="mx-auto max-w-7xl">{children}</div>
      </main>
    </div>
  );
}
