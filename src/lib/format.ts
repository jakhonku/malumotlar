import { format, parseISO } from "date-fns";

export function fmtDate(d: string | null | undefined): string {
  if (!d) return "—";
  return format(parseISO(d), "dd.MM.yyyy");
}

export function fmtTime(t: string | null | undefined): string {
  return t ? t.slice(0, 5) : "—";
}

const TZ = "Asia/Tashkent";
const partsOf = (d: Date) => {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", { timeZone: TZ, day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
      .formatToParts(d).map((x) => [x.type, x.value]),
  ) as Record<string, string>;
  return p;
};

/** Sana va vaqt — server qaysi mintaqada bo‘lishidan qat’i nazar O‘zbekiston (Toshkent) vaqtida. */
export function fmtDateTime(d: string | null | undefined): string {
  if (!d) return "—";
  const p = partsOf(new Date(d));
  return `${p.day}.${p.month}.${p.year} ${p.hour}:${p.minute}`;
}

/** Toshkent vaqti bo‘yicha: soat:daqiqa */
export const tzTime = (d: string | Date) => {
  const p = partsOf(new Date(d));
  return `${p.hour}:${p.minute}`;
};

/** Toshkent vaqti bo‘yicha kun kaliti: yyyy-MM-dd */
export const tzDay = (d: string | Date) => {
  const p = partsOf(new Date(d));
  return `${p.year}-${p.month}-${p.day}`;
};

/** «Bugun» / «Kecha» / dd.MM.yyyy */
export function dayLabel(d: string | Date, now: Date = new Date()): string {
  const k = tzDay(d);
  if (k === tzDay(now)) return "Bugun";
  if (k === tzDay(new Date(now.getTime() - 86_400_000))) return "Kecha";
  return `${k.slice(8, 10)}.${k.slice(5, 7)}.${k.slice(0, 4)}`;
}
