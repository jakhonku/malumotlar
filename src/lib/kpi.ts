/** Viloyat KPI: yig‘ish jarayonidagi ish sifati va tezligi (0–100 ball). Sof funksiyalar — testlanadi. */
import { deadlineEnd, type Level } from "./performance";

export type PdfState = "none" | "fresh" | "stale";

export interface KpiInput {
  total: number;            // rejadagi hududlar (viloyat o‘zi + tuman/shaharlar)
  sent: number;             // yuborilgan hududlar
  approved: number;         // tasdiqlangan hududlar
  entries: number;          // yuborilgan yozuvlar
  returned: number;         // kamida bir marta qaytarilgan yozuvlar
  lastSubmittedAt: string | null;
  startAt: string;
  deadline: string | null;
  pdf: PdfState;
  now: Date;
}

export interface Kpi {
  score: number;
  grade: string;
  level: Level;
  parts: { coverage: number; timeliness: number; accuracy: number; pdf: number | null };
}

const W = { coverage: 0.35, timeliness: 0.25, accuracy: 0.25, pdf: 0.15 };
const clamp = (n: number) => Math.max(0, Math.min(100, n));

export function kpiScore(i: KpiInput): Kpi {
  const coverage = i.total > 0 ? clamp((Math.min(i.sent, i.total) / i.total) * 100) : 0;
  const accuracy = i.entries > 0 ? clamp(((i.entries - Math.min(i.returned, i.entries)) / i.entries) * 100) : 0;
  const complete = i.total > 0 && i.sent >= i.total;
  const end = i.deadline ? deadlineEnd(i.deadline) : null;

  let timeliness: number;
  if (!end) timeliness = coverage;
  else if (complete) {
    const late = i.lastSubmittedAt ? new Date(i.lastSubmittedAt).getTime() - end.getTime() : 0;
    timeliness = late > 0 ? clamp(100 - Math.ceil(late / 86_400_000) * 10) : 100;
  } else if (i.now > end) timeliness = 0;
  else {
    const start = new Date(i.startAt).getTime();
    const elapsed = clamp(((i.now.getTime() - start) / Math.max(1, end.getTime() - start)) * 100);
    timeliness = elapsed <= 0 ? 100 : clamp((coverage / elapsed) * 100);
  }

  // PDF faqat hammasi tasdiqlangandan keyin mumkin — shuning uchun tasdiq kutilayotganda hududga ball kamaytirilmaydi
  const allApproved = i.total > 0 && i.approved >= i.total;
  const pdf = allApproved ? (i.pdf === "fresh" ? 100 : i.pdf === "stale" ? 40 : 0) : null;

  const parts = { coverage, timeliness, accuracy, pdf };
  const wSum = W.coverage + W.timeliness + W.accuracy + (pdf === null ? 0 : W.pdf);
  const raw = (coverage * W.coverage + timeliness * W.timeliness + accuracy * W.accuracy + (pdf === null ? 0 : pdf * W.pdf)) / wSum;
  const score = i.sent === 0 && i.entries === 0 ? 0 : Math.round(raw);
  const [grade, level]: [string, Level] =
    i.sent === 0 && i.entries === 0 ? ["Boshlamagan", "gray"]
    : score >= 85 ? ["A’lo", "green"] : score >= 70 ? ["Yaxshi", "green"] : score >= 50 ? ["Qoniqarli", "yellow"] : ["Past", "red"];
  return { score, grade, level, parts };
}

export type Stage = "not_started" | "entering" | "revision" | "review" | "pdf_wait" | "pdf_stale" | "done";

export interface StageInput { total: number; sent: number; approved: number; revision: number; submitted: number; pdf: PdfState }

/** Hudud jarayoni qaysi bosqichda va «to‘p» kimda: viloyat boshqarmasida yoki vazirlikda. */
export function stageOf(i: StageInput): { stage: Stage; label: string; owner: "region" | "ministry" | "none" } {
  if (i.sent === 0 && i.revision === 0) return { stage: "not_started", label: "Boshlamagan", owner: "region" };
  if (i.revision > 0) return { stage: "revision", label: "Tuzatishda", owner: "region" };
  if (i.sent < i.total) return { stage: "entering", label: "Kiritmoqda", owner: "region" };
  if (i.submitted > 0) return { stage: "review", label: "Vazirlik tekshiruvida", owner: "ministry" };
  if (i.approved >= i.total) {
    if (i.pdf === "fresh") return { stage: "done", label: "Yakunlangan", owner: "none" };
    if (i.pdf === "stale") return { stage: "pdf_stale", label: "PDF qayta kerak", owner: "region" };
    return { stage: "pdf_wait", label: "Imzolangan PDF kutilmoqda", owner: "region" };
  }
  return { stage: "review", label: "Vazirlik tekshiruvida", owner: "ministry" };
}
