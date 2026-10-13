import { createAdminClient } from "@/lib/supabase/admin";
import { Card, CardBody } from "@/components/ui/primitives";
import { OpenByLink } from "../open-by-link";
import { UnitPicker } from "../unit-picker";

export const dynamic = "force-dynamic";

export default async function StandardEventsLanding() {
  const admin = createAdminClient();
  const [{ data: regions }, { data: districts }] = await Promise.all([
    admin.from("regions").select("id,name").eq("is_active", true).order("sort_order"),
    admin.from("districts").select("id,name,region_id").eq("is_active", true).order("district_type", { ascending: false }).order("name").limit(2000),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Yangi yil tadbirlari qayerda va qachon o‘tkaziladi?</h1>
        <p className="mt-2 max-w-3xl text-slate-600">
          Har bir hudud (viloyat, Qoraqalpog‘iston Respublikasi, Toshkent shahri) va har bir tuman/shahar o‘z hududidagi Yangi yil tadbirlari haqidagi ma’lumotni <b>alohida</b> to‘ldiradi.
          Login va parol kerak emas. Masalan, Toshkent viloyati o‘z tadbirlarini, Yuqori Chirchiq tumani esa o‘z tadbirlarini kiritadi.
        </p>
      </div>

      <Card>
        <CardBody>
          <UnitPicker regions={regions ?? []} districts={districts ?? []} />
        </CardBody>
      </Card>

      <Card>
        <CardBody>
          <h2 className="font-semibold text-slate-900">Avval kiritgan ma’lumotni ochish</h2>
          <p className="mb-3 text-sm text-slate-600">Hududingiz havolasini (yoki undagi kodni) kiriting — tadbir qo‘shish, tuzatish va yuborish mumkin.</p>
          <OpenByLink />
        </CardBody>
      </Card>
    </div>
  );
}
