import Link from "next/link";
import { ClipboardList } from "lucide-react";
import { redirect } from "next/navigation";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { AUDIENCE_LABELS, type CollectionRow } from "@/lib/collections";
import { fmtDate } from "@/lib/format";
import { Badge, buttonClass, Card, CardBody, EmptyState, PageHeader } from "@/components/ui/primitives";

export default async function CollectionsPage() {
  const profile = await requireProfile();
  if (profile.role === "district_manager") redirect("/");
  if (profile.role !== "region_manager") redirect("/");
  const supabase = await createClient();
  const [{ data }, { data: entries }] = await Promise.all([
    supabase.from("collections").select("*").order("created_at", { ascending: false }),
    supabase.from("collection_entries").select("collection_id,status").limit(50000),
  ]);
  const cols = (data ?? []) as CollectionRow[];
  const stat = new Map<string, { total: number; submitted: number; approved: number }>();
  for (const e of entries ?? []) {
    const s = stat.get(e.collection_id) ?? { total: 0, submitted: 0, approved: 0 };
    s.total++;
    if (e.status === "submitted") s.submitted++;
    if (e.status === "approved") s.approved++;
    stat.set(e.collection_id, s);
  }

  return (
    <>
      <PageHeader title="Ma’lumot yig‘ish" description="Vazirlik ochgan ma’lumot yig‘ishlar. Kartani oching va o‘z hududingiz ma’lumotini kiriting.">
      </PageHeader>

      {cols.length === 0 ? (
        <Card>
          <EmptyState title="Hozircha ma’lumot yig‘ish ochilmagan" text="Vazirlik yangi yig‘ishni ochganda shu yerda ko‘rinadi.">
          </EmptyState>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {cols.map((c) => {
            const s = stat.get(c.id) ?? { total: 0, submitted: 0, approved: 0 };
            const closed = !c.is_active || (c.deadline && c.deadline < new Date().toISOString().slice(0, 10));
            return (
              <Link key={c.id} href={`/collections/${c.id}`}>
                <Card className="h-full transition-shadow hover:shadow-md">
                  <CardBody className="space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900"><ClipboardList className="h-5 w-5 text-blue-800" />{c.title}</h2>
                      {closed ? <Badge tone="red">Yopiq</Badge> : <Badge tone="green">Faol</Badge>}
                    </div>
                    {c.description && <p className="line-clamp-2 text-sm text-slate-600">{c.description}</p>}
                    <p className="text-xs text-slate-500">
                      {AUDIENCE_LABELS[c.audience]} · {c.fields.length} ta maydon{c.deadline ? ` · muddat: ${fmtDate(c.deadline)}` : ""}
                    </p>
                    <div className="flex gap-4 text-sm">
                      <span>Jami: <b>{s.total}</b></span>
                      <span>Kutilmoqda: <b className="text-blue-800">{s.submitted}</b></span>
                      <span>Tasdiqlangan: <b className="text-emerald-700">{s.approved}</b></span>
                    </div>
                  </CardBody>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </>
  );
}
