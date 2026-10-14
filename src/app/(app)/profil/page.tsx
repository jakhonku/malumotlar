import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { avatarUrls } from "@/lib/avatars";
import { ROLE_LABELS } from "@/lib/constants";
import { formatPhone } from "@/lib/phone";
import { Card, CardBody, PageHeader } from "@/components/ui/primitives";
import { ProfileForm } from "@/components/profile/profile-form";

export const dynamic = "force-dynamic";

/** Har bir foydalanuvchi o‘z profilini (F.I.Sh., lavozim, telefon, 3x4 rasm) to‘ldiradi. Majburiy emas; vazirlik ko‘radi. */
export default async function ProfilePage() {
  const profile = await requireProfile();
  const urls = await avatarUrls([profile.avatar_path]);
  const supabase = await createClient();
  const [{ data: region }, { data: district }] = await Promise.all([
    profile.region_id ? supabase.from("regions").select("name").eq("id", profile.region_id).maybeSingle() : Promise.resolve({ data: null }),
    profile.district_id ? supabase.from("districts").select("name").eq("id", profile.district_id).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  const scope = [region?.name, district?.name].filter(Boolean).join(" · ") || "Respublika bo‘yicha";
  return (
    <>
      <PageHeader title="Mening profilim" description={`${ROLE_LABELS[profile.role]} · login: ${profile.username}. Ma’lumotlarni to‘ldirish majburiy emas, lekin vazirlik sizni tanishi uchun foydali.`} />
      <Card className="mb-4 border-blue-200 bg-blue-50/60">
        <CardBody className="flex flex-wrap items-center gap-x-8 gap-y-2 text-sm">
          <div><p className="text-xs uppercase tracking-wide text-slate-500">Viloyat / hudud</p><p className="text-lg font-semibold text-slate-900">{scope}</p></div>
          <div><p className="text-xs uppercase tracking-wide text-slate-500">Rol</p><p className="font-medium text-slate-900">{ROLE_LABELS[profile.role]}</p></div>
          <p className="text-xs text-slate-500">Viloyat F.I.Sh. o‘zgarganda ham o‘zgarmaydi — vazirlik sizni shu viloyat bo‘yicha ko‘radi.</p>
        </CardBody>
      </Card>
      <Card>
        <CardBody>
          <ProfileForm
            initial={{
              full_name: profile.full_name,
              position: profile.position ?? "",
              phone: formatPhone(profile.phone),
              avatarUrl: profile.avatar_path ? urls.get(profile.avatar_path) ?? null : null,
              hasPhoto: !!profile.avatar_path,
            }}
          />
        </CardBody>
      </Card>
    </>
  );
}
