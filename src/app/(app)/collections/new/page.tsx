import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { newYearTemplate, type CollectionInput } from "@/lib/collections";
import { CollectionBuilder } from "@/components/collections/collection-builder";
import { buttonClass, PageHeader } from "@/components/ui/primitives";

export default async function NewCollectionPage({ searchParams }: { searchParams: Promise<{ template?: string }> }) {
  await requireRole("super_admin");
  const sp = await searchParams;
  const fromTemplate = sp.template === "newyear";
  const initial: CollectionInput = fromTemplate
    ? newYearTemplate()
    : { title: "", description: "", entry_label: "Yozuv", audience: "both", allow_multiple: true, is_active: true, deadline: null, fields: [] };

  return (
    <>
      <PageHeader title="Yangi ma’lumot yig‘ish" description="Nima haqida ma’lumot yig‘moqchisiz va qaysi maydonlar to‘ldirilishi kerakligini belgilang.">
        {!fromTemplate && (
          <Link href="/collections/new?template=newyear" className={buttonClass("outline")}>Yangi yil tadbirlari shablonini yuklash</Link>
        )}
      </PageHeader>
      <CollectionBuilder key={fromTemplate ? "tpl" : "blank"} id={null} initial={initial} />
    </>
  );
}
