import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { eventTemplate, newYearTemplate, statsTemplate, type CollectionInput } from "@/lib/collections";
import { CollectionBuilder } from "@/components/collections/collection-builder";
import { buttonClass, PageHeader } from "@/components/ui/primitives";

export default async function NewCollectionPage({ searchParams }: { searchParams: Promise<{ template?: string }> }) {
  await requireRole("super_admin");
  const sp = await searchParams;
  const tpl = sp.template ?? "";
  const fromTemplate = ["newyear", "event", "stats"].includes(tpl);
  const initial: CollectionInput =
    tpl === "newyear" ? newYearTemplate()
    : tpl === "event" ? eventTemplate()
    : tpl === "stats" ? statsTemplate()
    : { title: "", description: "", entry_label: "Yozuv", audience: "both", allow_multiple: false, is_active: true, deadline: null, fields: [] };

  return (
    <>
      <PageHeader title="Yangi ma’lumot yig‘ish" description="Nima haqida ma’lumot yig‘moqchisiz va qaysi maydonlar to‘ldirilishi kerakligini belgilang.">
        <Link href="/collections/new" className={buttonClass(tpl ? "outline" : "default")}>Bo‘sh forma</Link>
        <Link href="/collections/new?template=event" className={buttonClass(tpl === "event" ? "default" : "outline")}>Tadbir shabloni</Link>
        <Link href="/collections/new?template=stats" className={buttonClass(tpl === "stats" ? "default" : "outline")}>Statistika shabloni</Link>
        <Link href="/collections/new?template=newyear" className={buttonClass(tpl === "newyear" ? "default" : "outline")}>Yangi yil shabloni</Link>
      </PageHeader>
      <CollectionBuilder key={fromTemplate ? tpl : "blank"} id={null} initial={initial} />
    </>
  );
}
