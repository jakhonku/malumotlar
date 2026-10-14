import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CalendarClock, ClipboardList } from "lucide-react";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { AUDIENCE_LABELS, type CollectionRow } from "@/lib/collections";
import { fmtDate } from "@/lib/format";
import { Badge } from "@/components/ui/primitives";
import { CollectionToggle } from "@/components/collections/collection-toggle";
import { WorkspaceTabs } from "@/components/collections/workspace-tabs";

export const dynamic = "force-dynamic";

/** Vazirlik uchun: har bir ma’lumot yig‘ish — alohida ish maydoni (o‘z bo‘limlari bilan). */
export default async function CollectionWorkspaceLayout({ children, params }: { children: React.ReactNode; params: Promise<{ id: string }> }) {
  const profile = await requireProfile();
  if (profile.role !== "super_admin" && profile.role !== "observer") return <>{children}</>;
  const { id } = await params;
  const supabase = await createClient();
  const { data } = await supabase.from("collections").select("*").eq("id", id).maybeSingle();
  if (!data) notFound();
  const col = data as CollectionRow;
  const late = !!col.deadline && col.deadline < new Date().toISOString().slice(0, 10);
  const admin = profile.role === "super_admin";

  return (
    <>
      <Link href="/" className="mb-3 inline-flex items-center gap-1.5 text-sm font-medium text-blue-800 hover:underline">
        <ArrowLeft className="h-4 w-4" /> Barcha ma’lumot yig‘ishlar
      </Link>
      <header className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900"><ClipboardList className="h-6 w-6 shrink-0 text-blue-800" />{col.title}</h1>
          <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-slate-600">
            {!col.is_active ? <Badge tone="red">Yopiq</Badge> : late ? <Badge tone="amber">Muddat o‘tgan — kechikib qabul qilinmoqda</Badge> : <Badge tone="green">Faol</Badge>}
            <span>{AUDIENCE_LABELS[col.audience]}</span>
            <span>{col.fields.length} ta maydon</span>
            {col.deadline && <span className="flex items-center gap-1"><CalendarClock className="h-4 w-4" /> Muddat: {fmtDate(col.deadline)}</span>}
          </p>
          {col.description && <p className="mt-1 max-w-3xl text-sm text-slate-500">{col.description}</p>}
        </div>
        {admin && <CollectionToggle id={col.id} active={col.is_active} />}
      </header>
      <WorkspaceTabs id={col.id} canEdit={admin} />
      {children}
    </>
  );
}
