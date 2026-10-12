import { format, parseISO } from "date-fns";

export function fmtDate(d: string | null | undefined): string {
  if (!d) return "—";
  return format(parseISO(d), "dd.MM.yyyy");
}

export function fmtTime(t: string | null | undefined): string {
  return t ? t.slice(0, 5) : "—";
}

export function fmtDateTime(d: string | null | undefined): string {
  return d ? format(new Date(d), "dd.MM.yyyy HH:mm") : "—";
}
