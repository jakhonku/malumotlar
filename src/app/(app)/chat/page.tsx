import { redirect } from "next/navigation";
import { MessageSquare } from "lucide-react";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { regionOrgName } from "@/lib/brand";
import { dayLabel, tzDay, tzTime } from "@/lib/format";
import { ChatList, type ThreadItem } from "@/components/chat/chat-list";
import { ChatView, type ChatMsg } from "@/components/chat/chat-view";
import { cn } from "@/components/ui/primitives";

export const dynamic = "force-dynamic";

interface Person { id: string; full_name: string; role: string; region: { name: string; sort_order: number } | null }
interface Msg { id: string; thread_user: string | null; sender_id: string; body: string; created_at: string }

const short = (m: Msg | undefined, me: string) => (m ? `${m.sender_id === me ? "Siz: " : ""}${m.body.replace(/\s+/g, " ").slice(0, 70)}` : "");
const listTime = (iso: string) => (tzDay(iso) === tzDay(new Date()) ? tzTime(iso) : dayLabel(iso) === "Kecha" ? "Kecha" : `${tzDay(iso).slice(8, 10)}.${tzDay(iso).slice(5, 7)}`);

export default async function ChatPage({ searchParams }: { searchParams: Promise<{ u?: string }> }) {
  const profile = await requireProfile();
  if (profile.role !== "super_admin" && profile.role !== "region_manager") redirect("/");
  const admin = profile.role === "super_admin";
  const supabase = await createClient();
  const { u } = await searchParams;

  const [{ data: unreadRaw }, { data: recentRaw }, peopleRes] = await Promise.all([
    supabase.rpc("chat_unread_by_thread"),
    supabase.from("messages").select("id, thread_user, sender_id, body, created_at").order("created_at", { ascending: false }).limit(1500),
    admin
      ? supabase.from("profiles").select("id, full_name, role, region:regions(name, sort_order)").neq("role", "super_admin").eq("is_active", true).limit(300)
      : Promise.resolve({ data: [] }),
  ]);
  const unread = new Map(((unreadRaw ?? []) as { thread_key: string; n: number }[]).map((r) => [r.thread_key, r.n]));
  const recent = (recentRaw ?? []) as Msg[];
  const lastOf = new Map<string, Msg>();
  for (const m of recent) {
    const k = m.thread_user ?? "all";
    if (!lastOf.has(k)) lastOf.set(k, m);
  }

  const people = ((peopleRes.data ?? []) as unknown as Person[]);
  const nameOf = (p: Person) => (p.region?.name && p.role === "region_manager" ? p.region.name : p.full_name);

  // ro‘yxat
  let threads: ThreadItem[];
  if (admin) {
    const all: ThreadItem = {
      key: "all", name: "Umumiy xabar", sub: "Barcha viloyat boshqarmalariga", pinned: true,
      preview: short(lastOf.get("all"), profile.id) || "Hammaga bir vaqtda yozish",
      time: lastOf.get("all") ? listTime(lastOf.get("all")!.created_at) : "", unread: 0,
    };
    const items = people.map((p) => {
      const last = lastOf.get(p.id);
      return {
        t: {
          key: p.id, name: nameOf(p), sub: p.role === "region_manager" ? `Madaniyat boshqarmasi · ${p.full_name}` : p.full_name,
          preview: short(last, profile.id), time: last ? listTime(last.created_at) : "", unread: unread.get(p.id) ?? 0,
        } satisfies ThreadItem,
        at: last ? new Date(last.created_at).getTime() : 0,
        order: p.region?.sort_order ?? 999,
      };
    });
    // yangi yozishmalar tepada; yozishma yo‘qlari — viloyatlar tartibida
    items.sort((a, b) => b.at - a.at || a.order - b.order || a.t.name.localeCompare(b.t.name));
    threads = [all, ...items.map((x) => x.t)];
  } else {
    const lm = lastOf.get(profile.id), la = lastOf.get("all");
    threads = [
      { key: profile.id, name: "Vazirlik", sub: "Madaniyat vazirligi", preview: short(lm, profile.id), time: lm ? listTime(lm.created_at) : "", unread: unread.get(profile.id) ?? 0 },
      { key: "all", name: "Umumiy xabarlar", sub: "Vazirlikdan barcha boshqarmalarga", preview: short(la, profile.id), time: la ? listTime(la.created_at) : "", unread: unread.get("all") ?? 0 },
    ];
  }

  const valid = (k: string | undefined) => !!k && threads.some((t) => t.key === k);
  const key = valid(u) ? u! : admin ? null : profile.id;
  const active = key ? threads.find((t) => t.key === key)! : null;

  let messages: ChatMsg[] = [];
  if (key) {
    const thread = key === "all" ? null : key;
    const q = supabase.from("messages").select("id, thread_user, sender_id, body, created_at").order("created_at", { ascending: false }).limit(300);
    const { data } = await (thread ? q.eq("thread_user", thread) : q.is("thread_user", null));
    const nameById = new Map(people.map((p) => [p.id, nameOf(p)]));
    messages = ((data ?? []) as Msg[]).reverse().map((m) => ({
      id: m.id, mine: m.sender_id === profile.id,
      author: m.sender_id === profile.id ? "Siz" : admin ? (nameById.get(m.sender_id) ?? "Foydalanuvchi") : "Vazirlik",
      body: m.body, time: tzTime(m.created_at), day: dayLabel(m.created_at),
    }));
  }

  const title = active ? (admin && active.key !== "all" && active.sub === "Madaniyat boshqarmasi" ? regionOrgName(active.name) : active.name) : "";

  return (
    <div className="-mx-4 -my-6 lg:mx-0 lg:my-0">
      <div className="flex h-[calc(100dvh-4rem)] overflow-hidden bg-white lg:h-[calc(100dvh-3rem)] lg:rounded-xl lg:border lg:border-slate-200 lg:shadow-sm">
        <aside className={cn("w-full shrink-0 border-r border-slate-200 bg-white lg:block lg:w-80 xl:w-96", key ? "hidden" : "block")}>
          <ChatList threads={threads} activeKey={key} searchable={admin} />
        </aside>
        <section className={cn("min-w-0 flex-1", key ? "block" : "hidden lg:block")}>
          {active ? (
            <ChatView
              key={key!}
              threadKey={key!}
              thread={key === "all" ? null : key}
              title={title}
              subtitle={admin ? (active.key === "all" ? "Umumiy xabar — barcha viloyat boshqarmalariga" : active.sub) : active.sub}
              messages={messages}
              unread={unread.get(key!) ?? 0}
              canWrite={admin || key !== "all"}
              placeholder={admin && key === "all" ? "Barcha boshqarmalarga xabar…" : "Xabar yozing…"}
            />
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-2 bg-[#e8eef5] text-slate-500">
              <MessageSquare className="h-12 w-12 opacity-40" />
              <p className="text-sm font-medium">Suhbatni tanlang</p>
              <p className="text-xs">Chapdagi ro‘yxatdan viloyatni toping yoki qidiring</p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
