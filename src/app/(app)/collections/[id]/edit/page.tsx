import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { CollectionInput, CollectionRow } from "@/lib/collections";
import { CollectionBuilder } from "@/components/collections/collection-builder";
import { PageHeader } from "@/components/ui/primitives";

export default async function EditCollectionPage({ params }: { params: Promise<{ id: string }> }) {
  await requireRole("super_admin");
  const { id } = await params;
  const supabase = await createClient();
  const { data } = await supabase.from("collections").select("*").eq("id", id).maybeSingle();
  if (!data) notFound();
  const c = data as CollectionRow;
  const initial: CollectionInput = {
    title: c.title, description: c.description ?? "", entry_label: c.entry_label, audience: c.audience,
    allow_multiple: c.allow_multiple, is_active: c.is_active, deadline: c.deadline, fields: c.fields,
  };
  return (
    <>
      <PageHeader title="Ma’lumot yig‘ishni tahrirlash" description={c.title} />
      <CollectionBuilder id={c.id} initial={initial} />
    </>
  );
}
