import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PAGE_SIZE } from "@/lib/constants";
import { fmtDateTime } from "@/lib/format";
import { buttonClass, Card, EmptyState, PageHeader, Table, Td, Th } from "@/components/ui/primitives";

interface Row { id: number; action: string; entity_type: string; entity_id: string | null; details: Record<string, unknown>; created_at: string; user: { full_name: string; username: string } | null }

export default async function AuditPage({ searchParams }: { searchParams: Promise<{ page?: string; action?: string }> }) {
  await requireRole("super_admin");
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const supabase = await createClient();
  let q = supabase.from("audit_logs").select("id,action,entity_type,entity_id,details,created_at,user:profiles!user_id(full_name,username)", { count: "exact" });
  if (sp.action) q = q.ilike("action", `${sp.action.replace(/[%,()*\\]/g, "")}%`);
  const { data, count } = await q.order("id", { ascending: false }).range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
  const rows = (data ?? []) as unknown as Row[];
  const pages = Math.max(1, Math.ceil((count ?? 0) / PAGE_SIZE));
  const href = (p: number) => `/audit?page=${p}${sp.action ? `&action=${encodeURIComponent(sp.action)}` : ""}`;

  return (
    <>
      <PageHeader title="Audit jurnali" description="Muhim o‘zgarishlar tarixi. Yozuvlarni o‘zgartirib yoki o‘chirib bo‘lmaydi." />
      <form className="mb-4 flex gap-2">
        <input name="action" defaultValue={sp.action ?? ""} placeholder="Amal bo‘yicha filtr (masalan: event., user.)" className="h-10 w-full max-w-sm rounded-md border border-slate-300 bg-white px-3 text-sm" aria-label="Amal" />
        <button className={buttonClass("default")} type="submit">Filtrlash</button>
      </form>
      <Card>
        {rows.length === 0 ? <EmptyState title="Yozuvlar yo‘q" /> : (
          <Table>
            <thead><tr><Th>Vaqt</Th><Th>Foydalanuvchi</Th><Th>Amal</Th><Th>Obyekt</Th><Th>Tafsilot</Th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <Td className="whitespace-nowrap">{fmtDateTime(r.created_at)}</Td>
                  <Td>{r.user?.full_name ?? "—"}<div className="text-xs text-slate-500">{r.user?.username}</div></Td>
                  <Td className="font-mono text-xs">{r.action}</Td>
                  <Td>{r.entity_type === "event" && r.entity_id ? <Link href={`/events/${r.entity_id}`} className="text-blue-900 hover:underline">tadbir</Link> : r.entity_type}</Td>
                  <Td className="max-w-md break-words font-mono text-xs text-slate-600">{JSON.stringify(r.details)}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
        {pages > 1 && (
          <nav className="flex items-center justify-between border-t border-slate-200 px-4 py-3">
            <Link href={href(page - 1)} aria-disabled={page <= 1} className={buttonClass("outline", "sm", page <= 1 ? "pointer-events-none opacity-40" : "")}>Oldingi</Link>
            <span className="text-sm text-slate-600">{page} / {pages}</span>
            <Link href={href(page + 1)} aria-disabled={page >= pages} className={buttonClass("outline", "sm", page >= pages ? "pointer-events-none opacity-40" : "")}>Keyingi</Link>
          </nav>
        )}
      </Card>
    </>
  );
}
