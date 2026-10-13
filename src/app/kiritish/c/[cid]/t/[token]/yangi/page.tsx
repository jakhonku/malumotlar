import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCollection, getEntryGroup, isOpen, unitLabel } from "@/lib/public-collection";
import { createAdminClient } from "@/lib/supabase/admin";
import { DynamicForm, type GeoChooser } from "@/components/collections/dynamic-form";

export const dynamic = "force-dynamic";

export default async function CollectionAddEntry({
  params, searchParams,
}: { params: Promise<{ cid: string; token: string }>; searchParams: Promise<{ unit?: string }> }) {
  const { cid, token } = await params;
  const sp = await searchParams;
  const col = await getCollection(cid);
  const group = col ? await getEntryGroup(cid, token) : null;
  if (!col || !group) notFound();
  const regionMode = group.groupMode === "region";
  if (!isOpen(col) || (!col.allow_multiple && !regionMode)) redirect(`/kiritish/c/${col.id}/t/${token}`);

  let chooser: GeoChooser | undefined;
  if (regionMode) {
    const { data: ds } = await createAdminClient()
      .from("districts").select("id,name").eq("region_id", group.regionId).eq("is_active", true)
      .order("district_type", { ascending: false }).order("name").limit(500);
    const filled = [...new Set(group.entries.map((e) => (e.scope === "regional" ? "regional" : (e.district_id ?? ""))))].filter(Boolean);
    chooser = { districts: ds ?? [], allowRegional: col.audience !== "district", initial: sp.unit ?? "", filled };
  }

  return (
    <>
      <Link href={`/kiritish/c/${col.id}/t/${token}`} className="mb-3 inline-block text-sm text-slate-600 hover:text-blue-800">← Hudud sahifasiga qaytish</Link>
      <h1 className="mb-4 text-2xl font-bold text-slate-900">Yana {col.entry_label.toLowerCase()} qo‘shish</h1>
      <DynamicForm
        collection={{ id: col.id, title: col.title, entry_label: col.entry_label, fields: col.fields }}
        token={token}
        entryId={null}
        geo={{ scope: group.scope, region_id: group.regionId, district_id: group.districtId ?? "", group_mode: group.groupMode }}
        geoLabel={unitLabel(group)}
        initial={{}}
        chooser={chooser}
      />
    </>
  );
}
