import { describe, expect, it } from "vitest";
import { fmtCountdown, rateRegion, timeLevel, type RateInput } from "../src/lib/performance";

const base: RateInput = {
  total: 10, sent: 0, entries: 0, returned: 0, lastSubmittedAt: null,
  startAt: "2026-12-01T00:00:00+05:00", deadline: "2026-12-21", now: new Date("2026-12-11T12:00:00+05:00"),
};

describe("muddat taymeri rangi", () => {
  it("4+ kun yashil, 1–3 kun sariq, <24 soat yoki o‘tgan qizil", () => {
    const d = 86_400_000;
    expect(timeLevel(10 * d)).toBe("green");
    expect(timeLevel(3.5 * d)).toBe("yellow");
    expect(timeLevel(2 * d)).toBe("yellow");
    expect(timeLevel(0.5 * d)).toBe("red");
    expect(timeLevel(-1)).toBe("red");
  });
  it("hisoblash formati", () => {
    expect(fmtCountdown(5 * 86400000 + 3 * 3600000 + 12 * 60000 + 45000)).toBe("5 kun 03:12:45");
    expect(fmtCountdown(61000)).toBe("00:01:01");
    expect(fmtCountdown(-5)).toBe("00:00:00");
  });
});

describe("hududni baholash", () => {
  it("o‘z vaqtida va xatosiz — yashil A’lo", () => {
    const r = rateRegion({ ...base, sent: 10, entries: 10, lastSubmittedAt: "2026-12-10T10:00:00+05:00" });
    expect(r).toMatchObject({ level: "green", label: "A’lo", progress: 100, accuracy: 100 });
  });
  it("to‘liq, lekin qaytarilgan — sariq va aniqlik pasayadi", () => {
    const r = rateRegion({ ...base, sent: 10, entries: 10, returned: 2, lastSubmittedAt: "2026-12-10T10:00:00+05:00" });
    expect(r).toMatchObject({ level: "yellow", accuracy: 80 });
  });
  it("muddatdan keyin to‘liq yuborgan — qizil", () => {
    expect(rateRegion({ ...base, sent: 10, entries: 10, lastSubmittedAt: "2026-12-22T09:00:00+05:00" }).level).toBe("red");
  });
  it("muddat kuni oxirigacha yuborilgan — kechikmagan", () => {
    expect(rateRegion({ ...base, sent: 10, entries: 10, lastSubmittedAt: "2026-12-21T23:00:00+05:00" }).level).toBe("green");
  });
  it("jarayonda: vaqtga nisbatan oldinda yashil, biroz orqada sariq, juda orqada qizil", () => {
    // 20 kunlikning 10 kuni o‘tgan = 50%
    expect(rateRegion({ ...base, sent: 6, entries: 6 }).level).toBe("green");
    expect(rateRegion({ ...base, sent: 4, entries: 4 }).level).toBe("yellow");
    expect(rateRegion({ ...base, sent: 1, entries: 1 }).level).toBe("red");
    expect(rateRegion({ ...base }).level).toBe("red");
  });
  it("muddat o‘tgan va tugamagan — qizil", () => {
    expect(rateRegion({ ...base, sent: 5, entries: 5, now: new Date("2026-12-25T00:00:00+05:00") })).toMatchObject({ level: "red", label: "Muddat o‘tdi" });
  });
  it("muddatsiz yig‘ish: boshlamagan kulrang, jarayonda yashil", () => {
    expect(rateRegion({ ...base, deadline: null }).level).toBe("gray");
    expect(rateRegion({ ...base, deadline: null, sent: 3, entries: 3 }).level).toBe("green");
  });
});
