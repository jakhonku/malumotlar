"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Megaphone, Search } from "lucide-react";
import { cn } from "@/components/ui/primitives";

export interface ThreadItem {
  key: string; // "all" yoki profil id
  name: string;
  sub?: string;
  preview: string;
  time: string;
  unread: number;
  pinned?: boolean;
}

const COLORS = ["bg-blue-600", "bg-emerald-600", "bg-violet-600", "bg-amber-600", "bg-rose-600", "bg-cyan-600", "bg-fuchsia-600", "bg-teal-600"];
export function colorOf(s: string) {
  let h = 0;
  for (const c of s) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return COLORS[h % COLORS.length];
}
export function initials(name: string) {
  const w = name.replace(/[‘’ʻ'`]/g, "").split(/\s+/).filter(Boolean);
  return ((w[0]?.[0] ?? "?") + (w[0]?.[1] ?? "")).toUpperCase();
}

export function Avatar({ name, all, size = 44 }: { name: string; all?: boolean; size?: number }) {
  return (
    <span
      className={cn("flex shrink-0 items-center justify-center rounded-full font-semibold text-white", all ? "bg-blue-800" : colorOf(name))}
      style={{ width: size, height: size, fontSize: size * 0.36 }}
      aria-hidden
    >
      {all ? <Megaphone style={{ width: size * 0.45, height: size * 0.45 }} /> : initials(name)}
    </span>
  );
}

/** Suhbatlar ro‘yxati (Telegram uslubida): avatar, nom, oxirgi xabar, vaqt, o‘qilmagan soni + qidiruv. */
export function ChatList({ threads, activeKey, searchable }: { threads: ThreadItem[]; activeKey: string | null; searchable: boolean }) {
  const [q, setQ] = useState("");
  const list = useMemo(() => {
    const t = q.trim().toLowerCase();
    return t ? threads.filter((x) => (x.name + " " + (x.sub ?? "")).toLowerCase().includes(t)) : threads;
  }, [q, threads]);

  return (
    <div className="flex h-full flex-col">
      {searchable && (
        <div className="border-b border-slate-200 p-3">
          <label className="relative block">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden />
            <input
              value={q} onChange={(e) => setQ(e.target.value)} placeholder="Viloyat yoki xodimni qidirish…" aria-label="Qidirish"
              className="h-10 w-full rounded-full bg-slate-100 pl-9 pr-3 text-sm outline-none focus:bg-white focus:ring-2 focus:ring-blue-700"
            />
          </label>
        </div>
      )}
      <ul className="flex-1 overflow-y-auto">
        {list.length === 0 && <li className="px-4 py-8 text-center text-sm text-slate-500">Hech narsa topilmadi</li>}
        {list.map((t) => (
          <li key={t.key}>
            <Link
              href={`/chat?u=${t.key}`}
              aria-current={t.key === activeKey ? "page" : undefined}
              className={cn("flex items-center gap-3 px-3 py-2.5 transition-colors", t.key === activeKey ? "bg-blue-800 text-white" : "hover:bg-slate-50")}
            >
              <Avatar name={t.name} all={t.key === "all"} />
              <span className="min-w-0 flex-1">
                <span className="flex items-baseline justify-between gap-2">
                  <b className={cn("truncate text-sm", t.key === activeKey ? "text-white" : "text-slate-900")}>{t.name}</b>
                  <span className={cn("shrink-0 text-[11px]", t.key === activeKey ? "text-blue-100" : t.unread ? "font-semibold text-blue-700" : "text-slate-400")}>{t.time}</span>
                </span>
                <span className="flex items-center justify-between gap-2">
                  <span className={cn("truncate text-[13px]", t.key === activeKey ? "text-blue-100" : "text-slate-500")}>
                    {t.preview || t.sub || "Xabar yo‘q"}
                  </span>
                  {t.unread > 0 && (
                    <span className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-blue-600 px-1.5 text-[11px] font-bold text-white">{t.unread}</span>
                  )}
                </span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
