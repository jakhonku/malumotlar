"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Send } from "lucide-react";
import { sendChatMessage, markChatRead } from "@/app/actions/chat";
import { Button, Textarea, cn } from "@/components/ui/primitives";

export interface ChatMsg { id: string; mine: boolean; author: string; body: string; at: string }

export function ChatView({
  threadKey, thread, messages, canWrite, unread, placeholder,
}: {
  threadKey: string; thread: string | null; messages: ChatMsg[]; canWrite: boolean; unread: number; placeholder: string;
}) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const endRef = useRef<HTMLDivElement>(null);

  // yangi xabarlarni olish va o‘qilgan deb belgilash
  useEffect(() => {
    const t = setInterval(() => router.refresh(), 10000);
    return () => clearInterval(t);
  }, [router]);
  useEffect(() => {
    if (unread > 0) markChatRead(threadKey).then(() => router.refresh());
  }, [unread, threadKey, router]);
  useEffect(() => { endRef.current?.scrollIntoView({ block: "end" }); }, [messages.length, threadKey]);

  function send(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;
    start(async () => {
      const res = await sendChatMessage(thread, text);
      if (!res.ok) return setError(res.error ?? "Xabar yuborilmadi");
      setText("");
      setError(null);
      router.refresh();
    });
  }

  return (
    <div className="flex h-[70vh] min-h-96 flex-col rounded-lg border border-slate-200 bg-white">
      <div className="flex-1 space-y-3 overflow-y-auto p-4" aria-live="polite">
        {messages.length === 0 && <p className="py-10 text-center text-sm text-slate-500">Hozircha xabar yo‘q.</p>}
        {messages.map((m) => (
          <div key={m.id} className={cn("flex", m.mine ? "justify-end" : "justify-start")}>
            <div className={cn("max-w-[85%] rounded-lg px-3 py-2 text-sm", m.mine ? "bg-blue-800 text-white" : "bg-slate-100 text-slate-900")}>
              <p className={cn("mb-0.5 text-xs font-semibold", m.mine ? "text-blue-100" : "text-slate-600")}>{m.author}</p>
              <p className="whitespace-pre-wrap break-words">{m.body}</p>
              <p className={cn("mt-1 text-right text-[11px]", m.mine ? "text-blue-200" : "text-slate-500")}>{m.at}</p>
            </div>
          </div>
        ))}
        <div ref={endRef} />
      </div>
      {canWrite ? (
        <form onSubmit={send} className="border-t border-slate-200 p-3">
          {error && <p role="alert" className="mb-2 text-sm font-medium text-red-700">{error}</p>}
          <div className="flex items-end gap-2">
            <Textarea
              value={text} onChange={(e) => { setText(e.target.value); setError(null); }} rows={2} maxLength={4000}
              placeholder={placeholder} aria-label="Xabar matni" className="flex-1"
              onKeyDown={(e) => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) e.currentTarget.form?.requestSubmit(); }}
            />
            <Button type="submit" disabled={pending || !text.trim()}><Send className="h-4 w-4" /> Yuborish</Button>
          </div>
          <p className="mt-1 text-xs text-slate-500">Ctrl+Enter — yuborish</p>
        </form>
      ) : (
        <p className="border-t border-slate-200 p-3 text-sm text-slate-500">Bu umumiy xabarlar — faqat vazirlik yozadi.</p>
      )}
    </div>
  );
}
