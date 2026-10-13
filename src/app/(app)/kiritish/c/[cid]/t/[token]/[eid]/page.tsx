import { regionSelf } from "@/lib/brand";
import { requireManagerToken } from "@/lib/manager-guard";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCollection, getEntryGroup, isOpen, unitLabel } from "@/lib/public-collection";
import { DynamicForm, type GeoChooser } from "@/components/collections/dynamic-form";

export const dynamic = "force-dynamic";

export default async function CollectionEditEntry({ params }: { params: Promise<{ cid: string; token: string; eid: string }> }) {
  const { cid, token, eid } = await params;
  await requireManagerToken(cid, token);
  const col = await getCollection(cid);
  const group = col ? await getEntryGroup(cid, token) : null;
  const entry = group?.entries.find((e) => e.id === eid);
  if (!col || !group || !entry) notFound();
  if (!isOpen(col) || entry.status === "approved") redirect(`/kiritish/c/${col.id}/t/${token}`);

  const chooser: GeoChooser | undefined =
    group.groupMode === "region"
      ? {
          districts: entry.district_id ? [{ id: entry.district_id, name: entry.district?.name ?? "" }] : [],
          allowRegional: true,
          selfLabel: regionSelf(group.regionName),
          initial: entry.scope === "regional" ? "regional" : (entry.district_id ?? ""),
        }
      : undefined;

  return (
    <>
      <h1 className="mb-4 text-2xl font-bold text-slate-900">{col.entry_label}ni tahrirlash</h1>
      {entry.status === "revision" && entry.review_comment && (
        <div role="alert" className="mb-4 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
          <p className="font-semibold">Vazirlik ma’lumotni qayta ishlashga qaytardi</p>
          <p className="mt-1">Sabab: {entry.review_comment}</p>
        </div>
      )}
      <DynamicForm
        collection={{ id: col.id, title: col.title, entry_label: col.entry_label, fields: col.fields, allow_multiple: col.allow_multiple }}
        entryStatus={entry.status}
        token={token}
        entryId={entry.id}
        geo={{ scope: entry.scope, region_id: group.regionId, district_id: entry.district_id ?? "", group_mode: group.groupMode }}
        geoLabel={unitLabel(group)}
        initial={entry.answers}
        chooser={chooser}
      />
    </>
  );
}
