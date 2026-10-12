import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getDistricts, getRegions } from "@/lib/queries";
import { Card, CardBody, CardHeader, CardTitle, PageHeader } from "@/components/ui/primitives";
import { PasswordForm } from "@/components/events/password-form";
import { TerritoryManager } from "@/components/events/territory-manager";
import { ROLE_LABELS } from "@/lib/constants";
import { formatPhone } from "@/lib/phone";

export default async function SettingsPage() {
  const profile = await requireProfile();
  const supabase = await createClient();
  const admin = profile.role === "super_admin";
  const [regions, districts] = admin
    ? await Promise.all([getRegions(supabase, true), getDistricts(supabase, { includeInactive: true })])
    : [[], []];

  return (
    <>
      <PageHeader title="Sozlamalar" />
      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Profil</CardTitle></CardHeader>
          <CardBody>
            <dl className="space-y-2 text-sm">
              <div><dt className="text-slate-500">F.I.Sh.</dt><dd className="font-medium">{profile.full_name}</dd></div>
              <div><dt className="text-slate-500">Login</dt><dd className="font-medium">{profile.username}</dd></div>
              <div><dt className="text-slate-500">Rol</dt><dd className="font-medium">{ROLE_LABELS[profile.role]}</dd></div>
              {profile.phone && <div><dt className="text-slate-500">Telefon</dt><dd className="font-medium">{formatPhone(profile.phone)}</dd></div>}
            </dl>
          </CardBody>
        </Card>
        <Card>
          <CardHeader><CardTitle>Parolni o‘zgartirish</CardTitle></CardHeader>
          <CardBody><PasswordForm /></CardBody>
        </Card>
      </div>
      {admin && (
        <section className="mt-8">
          <h2 className="mb-1 text-lg font-semibold text-slate-900">Hududlar ro‘yxatini boshqarish</h2>
          <p className="mb-3 text-sm text-slate-600">
            Hududlar o‘chirilmaydi — faolsizlantiriladi. Faolsiz hududlar yangi tadbir kiritishda ko‘rinmaydi, avvalgi ma’lumotlar saqlanadi.
          </p>
          <TerritoryManager regions={regions} districts={districts} />
        </section>
      )}
    </>
  );
}
