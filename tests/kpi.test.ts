import { describe, expect, it } from "vitest";
import { kpiScore, stageOf, type KpiInput } from "../src/lib/kpi";

const base: KpiInput = {
  total: 10, sent: 10, approved: 10, entries: 10, returned: 0, lastSubmittedAt: "2026-12-10T10:00:00+05:00",
  startAt: "2026-12-01T00:00:00+05:00", deadline: "2026-12-20", pdf: "fresh", now: new Date("2026-12-15T00:00:00+05:00"),
};

describe("kpiScore", () => {
  it("mukammal hudud 100 ball oladi", () => {
    const k = kpiScore(base);
    expect(k.score).toBe(100);
    expect(k.grade).toBe("A’lo");
  });
  it("boshlamagan hudud — 0 ball, kulrang", () => {
    const k = kpiScore({ ...base, sent: 0, approved: 0, entries: 0, pdf: "none" });
    expect(k.score).toBe(0);
    expect(k.level).toBe("gray");
  });
  it("tasdiq kutilayotganda PDF ball kamaytirmaydi", () => {
    const k = kpiScore({ ...base, approved: 4, pdf: "none" });
    expect(k.parts.pdf).toBeNull();
    expect(k.score).toBe(100);
  });
  it("hammasi tasdiqlangan, PDF yo‘q — ball tushadi", () => {
    expect(kpiScore({ ...base, pdf: "none" }).score).toBeLessThan(100);
    expect(kpiScore({ ...base, pdf: "stale" }).score).toBeGreaterThan(kpiScore({ ...base, pdf: "none" }).score);
  });
  it("qaytarilgan yozuvlar aniqlikni tushiradi", () => {
    expect(kpiScore({ ...base, returned: 5 }).parts.accuracy).toBe(50);
  });
  it("muddatdan keyin to‘liq yuborish — har kun uchun 10 ball", () => {
    const k = kpiScore({ ...base, lastSubmittedAt: "2026-12-22T10:00:00+05:00", now: new Date("2026-12-25T00:00:00+05:00") });
    expect(k.parts.timeliness).toBe(80);
  });
  it("muddat o‘tdi va to‘liq emas — o‘z vaqtida 0", () => {
    const k = kpiScore({ ...base, sent: 5, approved: 0, now: new Date("2026-12-25T00:00:00+05:00"), pdf: "none" });
    expect(k.parts.timeliness).toBe(0);
  });
});

describe("stageOf", () => {
  const s = { total: 5, sent: 5, approved: 5, revision: 0, submitted: 0, pdf: "none" as const };
  it("bosqichlar va javobgar", () => {
    expect(stageOf({ ...s, sent: 0, approved: 0 }).stage).toBe("not_started");
    expect(stageOf({ ...s, sent: 3, approved: 0 })).toMatchObject({ stage: "entering", owner: "region" });
    expect(stageOf({ ...s, approved: 2, revision: 1 })).toMatchObject({ stage: "revision", owner: "region" });
    expect(stageOf({ ...s, approved: 2, submitted: 3 })).toMatchObject({ stage: "review", owner: "ministry" });
    expect(stageOf(s)).toMatchObject({ stage: "pdf_wait", owner: "region" });
    expect(stageOf({ ...s, pdf: "stale" }).stage).toBe("pdf_stale");
    expect(stageOf({ ...s, pdf: "fresh" })).toMatchObject({ stage: "done", owner: "none" });
  });
});
