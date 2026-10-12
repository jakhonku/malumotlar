import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCollection, getEntryGroup, isOpen, unitLabel } from "@/lib/public-collection";
import { DynamicForm } from "@/components/collections/dynamic-form";

export const dynamic = "force-dynamic";

export default async function CollectionAddEntry({ params }: { params: Promise<{ cid: string; token: string }> }) {
  const { cid, token } = await params;
  const col = await getCollection(cid);
  const group = col ? await getEntryGroup(cid, token) : null;
  if (!col || !group) notFound();
  if (!isOpen(col) || !col.allow_multiple) redirect(`/kiritish/c/${col.id}/t/${token}`);

  return (
    <>
      <Link href={`/kiritish/c/${col.id}/t/${token}`} className="mb-3 inline-block text-sm text-slate-600 hover:text-blue-800">← Hudud sahifasiga qaytish</Link>
      <h1 className="mb-4 text-2xl font-bold text-slate-900">Yana {col.entry_label.toLowerCase()} qo‘shish</h1>
      <DynamicForm
        collection={{ id: col.id, title: col.title, entry_label: col.entry_label, fields: col.fields }}
        token={token}
        entryId={null}
        geo={{ scope: group.scope, region_id: group.regionId, district_id: group.districtId ?? "" }}
        geoLabel={unitLabel(group)}
        initial={{}}
      />
    </>
  );
}
