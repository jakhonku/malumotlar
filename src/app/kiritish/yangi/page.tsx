import Link from "next/link";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { EventForm } from "@/components/events/event-form";
import { emptyValues } from "@/lib/event-defaults";

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
type SP = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

export default async function PublicNewEvent({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const regionId = one(sp.region);
  const scope = one(sp.scope) === "district" ? "district" : "regional";
  const districtParam = one(sp.district);
  if (!UUID.test(regionId)) redirect("/kiritish");

  const admin = createAdminClient();
  const { data: region } = await admin.from("regions").select("id,name").eq("id", regionId).eq("is_active", true).maybeSingle();
  if (!region) redirect("/kiritish");

  const ctx = { role: "super_admin" as const, regionId: null, districtId: null, canEditDistricts: true };
  const initial = emptyValues(ctx);
  initial.scope = scope;
  initial.region_id = region.id;

  let districts: { id: string; name: string; region_id: string }[] = [];
  if (scope === "district") {
    if (districtParam === "__new__") {
      const name = one(sp.name).trim();
      if (name.length < 3) redirect("/kiritish");
      initial.district_id = "__new__";
      initial.new_district_name = name.slice(0, 120);
      initial.new_district_type = one(sp.type) === "shahar" ? "shahar" : "tuman";
    } else {
      if (!UUID.test(districtParam)) redirect("/kiritish");
      const { data: d } = await admin
        .from("districts")
        .select("id,name,region_id")
        .eq("id", districtParam)
        .eq("region_id", region.id)
        .eq("is_active", true)
        .maybeSingle();
      if (!d) redirect("/kiritish");
      districts = [d];
      initial.district_id = d.id;
    }
  }

  return (
    <>
      <Link href="/kiritish" className="mb-3 inline-block text-sm text-slate-600 hover:text-blue-800">← Hududni qayta tanlash</Link>
      <h1 className="mb-1 text-2xl font-bold text-slate-900">Tadbir ma’lumotini kiritish</h1>
      <p className="mb-5 text-sm text-slate-600">
        Tadbir qayerda va qachon o‘tishini kiriting. Saqlagandan so‘ng hududingiz havolasi beriladi — u orqali boshqa tadbirlarni ham qo‘shishingiz mumkin.
      </p>
      <EventForm
        eventId={null}
        initial={initial}
        ctx={ctx}
        regions={[region]}
        districts={districts}
        lockedGeo
        publicMode={{ token: null, eventId: null }}
      />
    </>
  );
}
