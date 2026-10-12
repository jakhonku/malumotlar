import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCollection, getEntryGroup, isOpen, unitLabel } from "@/lib/public-collection";
import { DynamicForm } from "@/components/collections/dynamic-form";

export const dynamic = "force-dynamic";

export default async function CollectionEditEntry({ params }: { params: Promise<{ cid: string; token: string; eid: string }> }) {
  const { cid, token, eid } = await params;
  const col = await getCollection(cid);
  const group = col ? await getEntryGroup(cid, token) : null;
  const entry = group?.entries.find((e) => e.id === eid);
  if (!col || !group || !entry) notFound();
  if (!isOpen(col) || (entry.status !== "draft" && entry.status !== "revision")) redirect(`/kiritish/c/${col.id}/t/${token}`);

  return (
    <>
      <Link href={`/kiritish/c/${col.id}/t/${token}`} className="mb-3 inline-block text-sm text-slate-600 hover:text-blue-800">← Hudud sahifasiga qaytish</Link>
      <h1 className="mb-4 text-2xl font-bold text-slate-900">{col.entry_label}ni tahrirlash</h1>
      {entry.status === "revision" && entry.review_comment && (
        <div role="alert" className="mb-4 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
          <p className="font-semibold">Vazirlik ma’lumotni qayta ishlashga qaytardi</p>
          <p className="mt-1">Sabab: {entry.review_comment}</p>
        </div>
      )}
      <DynamicForm
        collection={{ id: col.id, title: col.title, entry_label: col.entry_label, fields: col.fields }}
        token={token}
        entryId={entry.id}
        geo={{ scope: group.scope, region_id: group.regionId, district_id: group.districtId ?? "" }}
        geoLabel={unitLabel(group)}
        initial={entry.answers}
      />
    </>
  );
}
