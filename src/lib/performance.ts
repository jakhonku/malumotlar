/** Muddat va hudud ishini baholash (yashil / sariq / qizil). Sof funksiyalar — testlanadi. */

export type Level = "green" | "yellow" | "red" | "gray";

/** Muddat oxiri: ko‘rsatilgan kunning 23:59:59 i (Toshkent vaqti, UTC+5). */
export const deadlineEnd = (deadline: string) => new Date(`${deadline}T23:59:59+05:00`);

/** Qolgan vaqt bo‘yicha rang: 4+ kun — yashil, 1–3 kun — sariq, 24 soatdan kam yoki o‘tib ketgan — qizil. */
export function timeLevel(msLeft: number): Level {
  if (msLeft <= 0) return "red";
  const day = 86_400_000;
  if (msLeft < day) return "red";
  if (msLeft < 4 * day) return "yellow";
  return "green";
}

export interface RateInput {
  /** rejadagi hududlar soni (tuman/shaharlar + viloyatning o‘zi) */
  total: number;
  /** yuborilgan hududlar soni */
  sent: number;
  /** nechta yozuv bor / ulardan nechtasi kamida bir marta qaytarilgan */
  entries: number;
  returned: number;
  /** barcha hududlar yuborilgan paytdagi eng oxirgi yuborish vaqti */
  lastSubmittedAt: string | null;
  /** yig‘ish ochilgan vaqt */
  startAt: string;
  deadline: string | null;
  now: Date;
}

export interface Rating {
  level: Level;
  label: string;
  detail: string;
  progress: number; // 0..100
  accuracy: number | null; // 0..100, yozuvlar bo‘lmasa null
}

export function rateRegion(i: RateInput): Rating {
  const progress = i.total > 0 ? Math.round((Math.min(i.sent, i.total) / i.total) * 100) : 0;
  const accuracy = i.entries > 0 ? Math.round(((i.entries - Math.min(i.returned, i.entries)) / i.entries) * 100) : null;
  const complete = i.total > 0 && i.sent >= i.total;
  const end = i.deadline ? deadlineEnd(i.deadline) : null;
  const R = (level: Level, label: string, detail: string): Rating => ({ level, label, detail, progress, accuracy });

  if (complete) {
    const late = end && i.lastSubmittedAt && new Date(i.lastSubmittedAt) > end;
    if (late) return R("red", "Kechikib yuborgan", "Muddatdan keyin to‘liq yuborilgan");
    if (i.returned > 0) return R("yellow", "Xatolar bilan", `${i.returned} ta yozuv tuzatishga qaytarilgan`);
    return R("green", "A’lo", end ? "O‘z vaqtida va xatosiz yuborgan" : "To‘liq va xatosiz yuborgan");
  }

  if (end) {
    if (i.now > end) return R("red", "Muddat o‘tdi", `${i.total - i.sent} ta hudud yuborilmagan`);
    const start = new Date(i.startAt).getTime();
    const span = Math.max(1, end.getTime() - start);
    const elapsed = Math.min(1, Math.max(0, (i.now.getTime() - start) / span)) * 100;
    if (progress >= elapsed) return R(i.returned > 0 ? "yellow" : "green", "Jadval bo‘yicha", i.returned > 0 ? `${i.returned} ta yozuv qaytarilgan` : "Reja bo‘yicha ketmoqda");
    if (progress >= elapsed * 0.6) return R("yellow", "Orqada", `Bajarilish ${progress}%, vaqt ${Math.round(elapsed)}% o‘tdi`);
    return R("red", "Juda orqada", `Bajarilish ${progress}%, vaqt ${Math.round(elapsed)}% o‘tdi`);
  }

  if (i.sent === 0 && i.entries === 0) return R("gray", "Boshlamagan", "Hali ma’lumot yubormagan");
  return R(i.returned > 0 ? "yellow" : "green", "Jarayonda", `${i.sent} / ${i.total} hudud yuborilgan`);
}

export const LEVEL_ORDER: Record<Level, number> = { red: 0, yellow: 1, gray: 2, green: 3 };

/** «5 kun 03:12:45» ko‘rinishi */
export function fmtCountdown(msLeft: number): string {
  const s = Math.max(0, Math.floor(msLeft / 1000));
  const d = Math.floor(s / 86400);
  const hh = String(Math.floor((s % 86400) / 3600)).padStart(2, "0");
  const mm = String(Math.floor((s % 3600) / 60)).padStart(2, "0");
  const ss = String(s % 60).padStart(2, "0");
  return `${d > 0 ? `${d} kun ` : ""}${hh}:${mm}:${ss}`;
}
