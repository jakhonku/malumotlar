import Link from "next/link";
import { redirect } from "next/navigation";
import { Megaphone } from "lucide-react";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { regionOrgName } from "@/lib/brand";
import { fmtDateTime } from "@/lib/format";
import { Card, PageHeader, cn } from "@/components/ui/primitives";
import { ChatView, type ChatMsg } from "@/components/chat/chat-view";

export const dynamic = "force-dynamic";

interface Person { id: string; full_name: string; role: string; region: { name: string } | null }
interface Msg { id: string; thread_user: string | null; sender_id: string; body: string; created_at: string }

export default async function ChatPage({ searchParams }: { searchParams: Promise<{ u?: string }> }) {
  const profile = await requireProfile();
  if (profile.role !== "super_admin" && profile.role !== "region_manager") redirect("/");
  const admin = profile.role === "super_admin";
  const supabase = await createClient();
  const { u } = await searchParams;

  const { data: unreadRaw } = await supabase.rpc("chat_unread_by_thread");
  const unread = new Map(((unreadRaw ?? []) as { thread_key: string; n: number }[]).map((r) => [r.thread_key, r.n]));

  let people: Person[] = [];
  if (admin) {
    const { data } = await supabase
      .from("profiles").select("id, full_name, role, region:regions(name)")
      .neq("role", "super_admin").eq("is_active", true).order("full_name").limit(300);
    people = (data ?? []) as unknown as Person[];
    people.sort((a, b) => Number(b.role === "region_manager") - Number(a.role === "region_manager") || a.full_name.localeCompare(b.full_name));
  }

  const key = admin
    ? u === "all" || (u && people.some((p) => p.id === u)) ? u! : "all"
    : u === "all" ? "all" : profile.id;
  const thread = key === "all" ? null : key;

  const q = supabase.from("messages").select("id, thread_user, sender_id, body, created_at").order("created_at", { ascending: false }).limit(200);
  const { data: msgRaw } = await (thread ? q.eq("thread_user", thread) : q.is("thread_user", null));
  const rows = ((msgRaw ?? []) as Msg[]).reverse();

  const personOf = (id: string) => people.find((p) => p.id === id);
  const messages: ChatMsg[] = rows.map((m) => ({
    id: m.id,
    mine: m.sender_id === profile.id,
    author: m.sender_id === profile.id ? "Siz" : admin ? (personOf(m.sender_id)?.full_name ?? "Foydalanuvchi") : "Vazirlik",
    body: m.body,
    at: fmtDateTime(m.created_at),
  }));

  const target = admin && key !== "all" ? personOf(key) : null;
  const title = admin
    ? key === "all" ? "Umumiy xabar — barcha viloyat boshqarmalariga" : (target?.region?.name ? regionOrgName(target.region.name) : target?.full_name ?? "")
    : key === "all" ? "Umumiy xabarlar" : "Vazirlik bilan yozishma";

  const link = (k: string) => `/chat?u=${k}`;
  const tab = (active: boolean) => cn("flex items-center justify-between gap-2 rounded-md px-3 py-2 text-sm", active ? "bg-blue-800 font-semibold text-white" : "text-slate-700 hover:bg-slate-100");
  const badge = (n?: number) => (n ? <span className="rounded-full bg-red-600 px-1.5 text-[10px] font-bold text-white">{n}</span> : null);

  return (
    <>
      <PageHeader
        title="Chat"
        description={admin ? "Viloyat boshqarmalari va xodimlar bilan yozishma, umumiy xabar yuborish." : "Vazirlik bilan yozishma va umumiy xabarlar."}
      />
      <div className="grid gap-4 lg:grid-cols-[18rem_1fr]">
        <Card className="max-h-[70vh] overflow-y-auto p-2">
          <nav aria-label="Suhbatlar" className="space-y-1">
            <Link href={link("all")} className={tab(key === "all")}>
              <span className="flex items-center gap-2"><Megaphone className="h-4 w-4" /> {admin ? "Umumiy xabar (hammaga)" : "Umumiy xabarlar"}</span>
              {key !== "all" && badge(unread.get("all"))}
            </Link>
            {admin ? (
              people.map((p) => (
                <Link key={p.id} href={link(p.id)} className={tab(key === p.id)}>
                  <span className="min-w-0">
                    <span className="block truncate">{p.region?.name && p.role === "region_manager" ? regionOrgName(p.region.name) : p.full_name}</span>
                    {p.role !== "region_manager" && <span className="block truncate text-xs opacity-80">{p.region?.name ?? "Xodim"}</span>}
                  </span>
                  {key !== p.id && badge(unread.get(p.id))}
                </Link>
              ))
            ) : (
              <Link href={link(profile.id)} className={tab(key !== "all")}>
                <span>Vazirlik bilan yozishma</span>
                {key === "all" && badge(unread.get(profile.id))}
              </Link>
            )}
          </nav>
        </Card>
        <div>
          <h2 className="mb-2 text-lg font-semibold text-slate-900">{title}</h2>
          <ChatView
            key={key}
            threadKey={key}
            thread={thread}
            messages={messages}
            unread={unread.get(key) ?? 0}
            canWrite={admin || key !== "all"}
            placeholder={admin ? (key === "all" ? "Barcha viloyat boshqarmalariga xabar…" : "Xabar yozing…") : "Vazirlikka xabar yozing…"}
          />
        </div>
      </div>
    </>
  );
}
