import Link from "next/link";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { fmtDateTime } from "@/lib/format";
import { Badge, Card, EmptyState, PageHeader } from "@/components/ui/primitives";
import { MarkReadButton } from "./mark-read";

interface N { id: string; title: string; message: string; is_read: boolean; created_at: string; event_id: string | null }

export default async function NotificationsPage() {
  await requireProfile();
  const supabase = await createClient();
  const { data } = await supabase.from("notifications").select("*").order("created_at", { ascending: false }).limit(100);
  const rows = (data ?? []) as N[];
  const unread = rows.filter((r) => !r.is_read).length;
  return (
    <>
      <PageHeader title="Xabarlar" description="Tadbirlar holati bo‘yicha bildirishnomalar.">
        {unread > 0 && <MarkReadButton />}
      </PageHeader>
      <Card>
        {rows.length === 0 ? <EmptyState title="Xabarlar yo‘q" /> : (
          <ul className="divide-y divide-slate-100">
            {rows.map((n) => (
              <li key={n.id} className={`px-5 py-3 ${n.is_read ? "" : "bg-blue-50/50"}`}>
                <div className="flex items-center gap-2">
                  <p className="font-medium text-slate-900">{n.title}</p>
                  {!n.is_read && <Badge tone="blue">yangi</Badge>}
                </div>
                <p className="text-sm text-slate-700">{n.message}</p>
                <p className="mt-0.5 text-xs text-slate-500">
                  {fmtDateTime(n.created_at)}
                  {n.event_id && <> · <Link href={`/events/${n.event_id}`} className="text-blue-800 hover:underline">Tadbirni ochish</Link></>}
                </p>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}
