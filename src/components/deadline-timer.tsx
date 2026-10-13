"use client";

import { useEffect, useState } from "react";
import { AlarmClock } from "lucide-react";
import { deadlineEnd, fmtCountdown, timeLevel, type Level } from "@/lib/performance";
import { cn } from "@/components/ui/primitives";

const STYLE: Record<Level, { box: string; text: string; msg: string }> = {
  green: { box: "border-emerald-300 bg-emerald-50", text: "text-emerald-800", msg: "Vaqt yetarli — rejali davom eting" },
  yellow: { box: "border-amber-400 bg-amber-50", text: "text-amber-800", msg: "Muddat yaqin — shoshiling" },
  red: { box: "border-red-400 bg-red-50", text: "text-red-800", msg: "Oxirgi soatlar!" },
  gray: { box: "border-slate-300 bg-slate-50", text: "text-slate-700", msg: "" },
};

/** Muddatgacha jonli taymer: ≥4 kun yashil, 1–3 kun sariq, 24 soatdan kam yoki o‘tgan — qizil. */
export function DeadlineTimer({ deadline, title }: { deadline: string; title: string }) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    const tick = () => setNow(Date.now());
    const first = setTimeout(tick, 0);
    const t = setInterval(tick, 1000);
    return () => { clearTimeout(first); clearInterval(t); };
  }, []);

  const end = deadlineEnd(deadline).getTime();
  const left = now === null ? null : end - now;
  const level: Level = left === null ? "gray" : timeLevel(left);
  const s = STYLE[level];
  const [y, m, d] = deadline.split("-");

  return (
    <div role="timer" aria-live="off" className={cn("flex flex-wrap items-center justify-between gap-3 rounded-xl border-2 px-5 py-3", s.box)}>
      <div className="flex items-center gap-3">
        <AlarmClock className={cn("h-8 w-8 shrink-0", s.text)} aria-hidden />
        <div className="leading-tight">
          <p className="text-sm font-semibold text-slate-900">{title}</p>
          <p className="text-xs text-slate-600">Oxirgi muddat: {d}.{m}.{y}, 23:59 gacha</p>
        </div>
      </div>
      <div className="text-right">
        <p className={cn("font-mono text-2xl font-bold tabular-nums", s.text)}>
          {left === null ? "—" : left <= 0 ? "Muddat tugadi" : fmtCountdown(left)}
        </p>
        <p className={cn("text-xs font-medium", s.text)}>{left !== null && left <= 0 ? "Yangi ma’lumot qabul qilinmaydi" : s.msg}</p>
      </div>
    </div>
  );
}
