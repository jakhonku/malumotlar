import { notFound, redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { adminUpdateEntry } from "@/app/actions/collections";
import type { CollectionRow, EntryRow } from "@/lib/collections";
import { regionSelf } from "@/lib/brand";
import { DynamicForm } from "@/components/collections/dynamic-form";
import { PageHeader } from "@/components/ui/primitives";

export const dynamic = "force-dynamic";

/** Administrator yuborilgan ma’lumotni tahrirlaydi (holati o‘zgarmaydi). */
export default async function AdminEditEntry({ params }: { params: Promise<{ id: string; eid: string }> }) {
  await requireRole("super_admin");
  const { id, eid } = await params;
  const supabase = await createClient();
  const [{ data: colRaw }, { data: entRaw }] = await Promise.all([
    supabase.from("collections").select("*").eq("id", id).maybeSingle(),
    supabase.from("collection_entries").select("*, region:regions(name), district:districts(name)").eq("id", eid).eq("collection_id", id).maybeSingle(),
  ]);
  if (!colRaw || !entRaw) notFound();
  const col = colRaw as CollectionRow;
  const e = entRaw as EntryRow;
  if (e.status === "draft") redirect(`/collections/${id}/entries/${eid}`);

  const where = e.district?.name ? `${e.region?.name} · ${e.district.name}` : `${e.region?.name} (${regionSelf(e.region?.name ?? "").toLowerCase()})`;

  return (
    <>
      <PageHeader title={`${col.entry_label}ni tahrirlash`} description="Administrator tahriri: o‘zgartirishlar darhol saqlanadi, yozuv holati o‘zgarmaydi." />
      <DynamicForm
        collection={{ id: col.id, title: col.title, entry_label: col.entry_label, fields: col.fields }}
        token={null}
        entryId={e.id}
        geo={{ scope: e.scope, region_id: e.region_id, district_id: e.district_id ?? "" }}
        geoLabel={where}
        initial={e.answers}
        adminSave={{ save: adminUpdateEntry.bind(null, e.id), redirectTo: `/collections/${id}/entries/${eid}` }}
      />
    </>
  );
}
