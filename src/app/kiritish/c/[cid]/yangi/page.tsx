import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCollection, isOpen, UUID_RE } from "@/lib/public-collection";
import { regionOrgName } from "@/lib/brand";
import type { EntryGeo } from "@/app/actions/public";
import { DynamicForm, type GeoChooser } from "@/components/collections/dynamic-form";

export const dynamic = "force-dynamic";

type SP = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

export default async function CollectionNewEntry({ params, searchParams }: { params: Promise<{ cid: string }>; searchParams: Promise<SP> }) {
  const { cid } = await params;
  const sp = await searchParams;
  const col = await getCollection(cid);
  if (!col) notFound();
  if (!isOpen(col)) redirect(`/kiritish/c/${col.id}`);

  const regionId = one(sp.region);
  const regionMode = one(sp.mode) === "region" && col.audience !== "regional";
  const scope = one(sp.scope) === "district" ? "district" : "regional";
  if (
    !UUID_RE.test(regionId) ||
    (!regionMode && ((col.audience === "regional" && scope !== "regional") || (col.audience === "district" && scope !== "district")))
  ) {
    redirect(`/kiritish/c/${col.id}`);
  }

  const admin = createAdminClient();
  const { data: region } = await admin.from("regions").select("id,name").eq("id", regionId).eq("is_active", true).maybeSingle();
  if (!region) redirect(`/kiritish/c/${col.id}`);

  const geo: EntryGeo = { scope, region_id: region.id, district_id: "" };
  let label = `${region.name} (viloyatning o‘zi)`;
  let chooser: GeoChooser | undefined;
  if (regionMode) {
    const { data: ds } = await admin
      .from("districts").select("id,name").eq("region_id", region.id).eq("is_active", true)
      .order("district_type", { ascending: false }).order("name").limit(500);
    geo.group_mode = "region";
    geo.scope = "regional";
    label = `${regionOrgName(region.name)} (hudud va barcha tuman/shaharlar)`;
    chooser = { districts: ds ?? [], allowRegional: col.audience !== "district", initial: col.audience === "district" ? "" : "regional" };
  } else if (scope === "district") {
    const districtParam = one(sp.district);
    if (districtParam === "__new__") {
      const name = one(sp.name).trim();
      if (name.length < 3) redirect(`/kiritish/c/${col.id}`);
      geo.district_id = "__new__";
      geo.new_district_name = name.slice(0, 120);
      geo.new_district_type = one(sp.type) === "shahar" ? "shahar" : "tuman";
      label = `${region.name} · ${geo.new_district_name} (yangi)`;
    } else {
      if (!UUID_RE.test(districtParam)) redirect(`/kiritish/c/${col.id}`);
      const { data: d } = await admin.from("districts").select("id,name").eq("id", districtParam).eq("region_id", region.id).eq("is_active", true).maybeSingle();
      if (!d) redirect(`/kiritish/c/${col.id}`);
      geo.district_id = d.id;
      label = `${region.name} · ${d.name}`;
    }
  }

  return (
    <>
      <Link href={`/kiritish/c/${col.id}`} className="mb-3 inline-block text-sm text-slate-600 hover:text-blue-800">← Hududni qayta tanlash</Link>
      <h1 className="mb-1 text-2xl font-bold text-slate-900">{col.title}</h1>
      <p className="mb-5 text-sm text-slate-600">
        Ma’lumotni kiriting. Saqlagandan so‘ng hududingiz havolasi beriladi — u orqali {col.allow_multiple ? `boshqa ${col.entry_label.toLowerCase()}larni ham qo‘shish, ` : ""}tuzatish va yuborish mumkin.
      </p>
      <DynamicForm collection={{ id: col.id, title: col.title, entry_label: col.entry_label, fields: col.fields }} token={null} entryId={null} geo={geo} geoLabel={label} initial={{}} chooser={chooser} />
    </>
  );
}
