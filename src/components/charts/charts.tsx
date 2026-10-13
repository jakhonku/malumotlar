// Yengil SVG/CSS diagrammalar (tashqi kutubxonasiz, serverda chiziladi).

export interface Slice { label: string; value: number; color: string }

/** Halqasimon diagramma: markazda jami son, yonida izoh. */
export function Donut({ slices, centerLabel }: { slices: Slice[]; centerLabel: string }) {
  const total = slices.reduce((a, s) => a + s.value, 0);
  const R = 52;
  const C = 2 * Math.PI * R;
  let offset = 0;
  return (
    <div className="flex flex-wrap items-center gap-6">
      <svg viewBox="0 0 140 140" className="h-40 w-40 shrink-0" role="img" aria-label={`${centerLabel}: ${total}`}>
        <circle cx="70" cy="70" r={R} fill="none" stroke="#e2e8f0" strokeWidth="18" />
        {total > 0 &&
          slices.filter((s) => s.value > 0).map((s) => {
            const len = (s.value / total) * C;
            const el = (
              <circle
                key={s.label} cx="70" cy="70" r={R} fill="none" stroke={s.color} strokeWidth="18"
                strokeDasharray={`${len} ${C - len}`} strokeDashoffset={-offset} transform="rotate(-90 70 70)"
              />
            );
            offset += len;
            return el;
          })}
        <text x="70" y="68" textAnchor="middle" className="fill-slate-900" fontSize="26" fontWeight="700">{total}</text>
        <text x="70" y="86" textAnchor="middle" className="fill-slate-500" fontSize="10">{centerLabel}</text>
      </svg>
      <ul className="space-y-1.5 text-sm">
        {slices.map((s) => (
          <li key={s.label} className="flex items-center gap-2">
            <span className="h-3 w-3 shrink-0 rounded-sm" style={{ background: s.color }} />
            <span className="text-slate-700">{s.label}</span>
            <b className="ml-auto pl-4 text-slate-900">{s.value}</b>
          </li>
        ))}
      </ul>
    </div>
  );
}

export interface BarRow { label: string; sub?: string; total: number; done: number; partial: number; extra?: React.ReactNode; href?: string }

/** Gorizontal progress-chiziqlar: to‘q qism — tasdiqlangan, och qism — tekshiruv kutayotgan. */
export function ProgressBars({ rows }: { rows: BarRow[] }) {
  return (
    <ul className="space-y-2.5">
      {rows.map((r) => {
        const pct = (n: number) => (r.total ? Math.min(100, (n / r.total) * 100) : 0);
        const body = (
          <div>
            <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
              <span className="truncate font-medium text-slate-800">{r.label}</span>
              <span className="flex shrink-0 items-center gap-2 text-xs text-slate-600">
                {r.sub}
                {r.extra}
              </span>
            </div>
            <div className="flex h-2.5 overflow-hidden rounded-full bg-slate-200" role="progressbar" aria-valuemin={0} aria-valuemax={r.total} aria-valuenow={r.done + r.partial} aria-label={r.label}>
              <div className="bg-emerald-600" style={{ width: `${pct(r.done)}%` }} />
              <div className="bg-sky-400" style={{ width: `${pct(r.partial)}%` }} />
            </div>
          </div>
        );
        return <li key={r.label}>{r.href ? <a href={r.href} className="block rounded hover:bg-slate-50">{body}</a> : body}</li>;
      })}
    </ul>
  );
}

/** Kunlar bo‘yicha ustunli diagramma. */
export function DayBars({ days }: { days: { label: string; value: number }[] }) {
  const max = Math.max(1, ...days.map((d) => d.value));
  return (
    <div className="flex h-36 items-end gap-1.5" role="img" aria-label="Kunlar bo‘yicha kelgan ma’lumotlar">
      {days.map((d) => (
        <div key={d.label} className="flex h-full flex-1 flex-col items-center justify-end gap-1">
          <span className="text-[10px] font-semibold text-slate-700">{d.value || ""}</span>
          <div className="w-full rounded-t bg-blue-700" style={{ height: `${(d.value / max) * 100}%`, minHeight: d.value ? 4 : 2, opacity: d.value ? 1 : 0.2 }} />
          <span className="text-[10px] text-slate-500">{d.label}</span>
        </div>
      ))}
    </div>
  );
}
