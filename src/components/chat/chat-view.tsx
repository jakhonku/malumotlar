"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Send } from "lucide-react";
import { sendChatMessage, markChatRead } from "@/app/actions/chat";
import { Textarea, cn } from "@/components/ui/primitives";
import { Avatar } from "./chat-list";

export interface ChatMsg { id: string; mine: boolean; author: string; body: string; time: string; day: string }

export function ChatView({
  threadKey, thread, title, subtitle, messages, canWrite, unread, placeholder,
}: {
  threadKey: string; thread: string | null; title: string; subtitle?: string;
  messages: ChatMsg[]; canWrite: boolean; unread: number; placeholder: string;
}) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const endRef = useRef<HTMLDivElement>(null);
  const showAuthor = threadKey === "all";

  // yangi xabarlarni olish va o‘qilgan deb belgilash
  useEffect(() => {
    const t = setInterval(() => router.refresh(), 8000);
    return () => clearInterval(t);
  }, [router]);
  useEffect(() => {
    if (unread > 0) markChatRead(threadKey).then(() => router.refresh());
  }, [unread, threadKey, router]);
  useEffect(() => { endRef.current?.scrollIntoView({ block: "end" }); }, [messages.length, threadKey]);

  function send(e?: React.FormEvent) {
    e?.preventDefault();
    if (!text.trim() || pending) return;
    start(async () => {
      const res = await sendChatMessage(thread, text);
      if (!res.ok) return setError(res.error ?? "Xabar yuborilmadi");
      setText("");
      setError(null);
      router.refresh();
    });
  }

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center gap-3 border-b border-slate-200 bg-white px-3 py-2.5">
        <Link href="/chat" className="rounded-full p-2 text-slate-600 hover:bg-slate-100 lg:hidden" aria-label="Orqaga"><ArrowLeft className="h-5 w-5" /></Link>
        <Avatar name={title} all={threadKey === "all"} size={40} />
        <div className="min-w-0 leading-tight">
          <p className="truncate font-semibold text-slate-900">{title}</p>
          {subtitle && <p className="truncate text-xs text-slate-500">{subtitle}</p>}
        </div>
      </header>

      <div className="flex-1 space-y-1 overflow-y-auto bg-[#e8eef5] px-3 py-3" aria-live="polite">
        {messages.length === 0 && <p className="py-16 text-center text-sm text-slate-500">Hozircha xabar yo‘q. Birinchi bo‘lib yozing.</p>}
        {messages.map((m, i) => {
          const newDay = i === 0 || messages[i - 1].day !== m.day;
          const prevSame = i > 0 && !newDay && messages[i - 1].mine === m.mine;
          return (
            <div key={m.id}>
              {newDay && (
                <p className="my-3 text-center"><span className="rounded-full bg-slate-500/50 px-3 py-0.5 text-xs font-medium text-white">{m.day}</span></p>
              )}
              <div className={cn("flex", m.mine ? "justify-end" : "justify-start", prevSame ? "mt-0.5" : "mt-2")}>
                <div className={cn("max-w-[82%] rounded-2xl px-3 py-1.5 text-sm shadow-sm sm:max-w-[70%]", m.mine ? "rounded-br-sm bg-blue-700 text-white" : "rounded-bl-sm bg-white text-slate-900")}>
                  {showAuthor && !m.mine && <p className="text-xs font-semibold text-blue-700">{m.author}</p>}
                  <p className="whitespace-pre-wrap break-words">{m.body}</p>
                  <p className={cn("-mb-0.5 text-right text-[10px]", m.mine ? "text-blue-100" : "text-slate-400")}>{m.time}</p>
                </div>
              </div>
            </div>
          );
        })}
        <div ref={endRef} />
      </div>

      {canWrite ? (
        <form onSubmit={send} className="border-t border-slate-200 bg-white p-2.5">
          {error && <p role="alert" className="mb-1.5 px-2 text-sm font-medium text-red-700">{error}</p>}
          <div className="flex items-end gap-2">
            <Textarea
              value={text} onChange={(e) => { setText(e.target.value); setError(null); }} rows={1} maxLength={4000}
              placeholder={placeholder} aria-label="Xabar matni" className="max-h-32 min-h-10 flex-1 resize-none rounded-2xl"
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
            />
            <button
              type="submit" disabled={pending || !text.trim()} aria-label="Yuborish"
              className="flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-full bg-blue-700 text-white transition-colors hover:bg-blue-800 disabled:cursor-default disabled:opacity-40"
            >
              <Send className="h-4 w-4" />
            </button>
          </div>
        </form>
      ) : (
        <p className="border-t border-slate-200 bg-white p-3 text-center text-sm text-slate-500">Bu umumiy xabarlar — faqat vazirlik yozadi.</p>
      )}
    </div>
  );
}
