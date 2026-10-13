import { describe, it, expect } from "vitest";
import { autoWidths, pickFontSize, rowCanSplit } from "@/lib/report/layout";
import { buildCollectionDocx } from "@/lib/report/collection";
import type { CollectionRow, EntryRow } from "@/lib/collections";
import type { District, Region } from "@/lib/types";

const TOTAL = 15137;

describe("jadval kengliklarini hisoblash", () => {
  const headers = ["№", "Viloyat", "Sana", "Telefon", "Manzil", "San’atkorlar"];
  const long = "Samarqand viloyati, Urgut tumani, Mustaqillik ko‘chasi, 15-uy, markaziy madaniyat saroyi yonidagi maydon";
  const rows = [
    ["1", "Samarqand viloyati", "31.12.2026", "+998 90 123 45 67", long, "1) Sherzod Qurbonov — Xalq artisti\n2) Navbahor — Xalq ansambli"],
    ["2", "Buxoro viloyati", "30.12.2026", "+998 93 111 22 33", "Buxoro sh.", "Dilnoza"],
  ];
  const w = autoWidths(headers, rows, TOTAL, 20, [450, null, null, null, null, null]);

  it("yig‘indi sahifa kengligiga aynan teng; hech bir ustun manfiy emas", () => {
    expect(w.reduce((a, b) => a + b, 0)).toBe(TOTAL);
    expect(w.every((x) => x > 400)).toBe(true);
    expect(w[0]).toBe(450);
  });

  it("uzun matnli ustunlar keng, qisqa (sana) ustun tor", () => {
    expect(w[4]).toBeGreaterThan(w[2] * 1.5); // manzil >> sana
    expect(w[5]).toBeGreaterThan(w[2]);
  });

  it("eng uzun so‘z ustundan sig‘adi (so‘z o‘rtasidan uzilmaydi)", () => {
    const h = ["№", "Qisqa", "Belgi"];
    const r = [["1", "x", "Ko‘p-qirrali-qo‘shimchalar"], ["2", "y", "z"]];
    const ww = autoWidths(h, r, 6000, 20, [450, null, null]);
    expect(ww[2]).toBeGreaterThan(24 * 20 * 5);
  });

  it("juda ko‘p ustunda ham yig‘indi to‘g‘ri", () => {
    const hs = Array.from({ length: 14 }, (_, i) => `Maydon ${i}`);
    const rs = [hs.map((_, i) => (i === 0 ? "1" : "matn ".repeat(12)))];
    const ww = autoWidths(hs, rs, TOTAL, 16, [450, ...hs.slice(1).map(() => null)]);
    expect(ww.reduce((a, b) => a + b, 0)).toBe(TOTAL);
  });

  it("shrift o‘lchami va qatorni bo‘lish qoidalari", () => {
    expect(pickFontSize(5, rows)).toBe(20);
    expect(pickFontSize(13, rows)).toBeLessThan(20);
    expect(rowCanSplit(["qisqa"])).toBe(false);
    expect(rowCanSplit(["x".repeat(600)])).toBe(true);
  });
});

describe("Word: uzun ma’lumotli jadval", () => {
  const col: CollectionRow = {
    id: "c", title: "Sinov", description: null, entry_label: "Tadbir", audience: "both", allow_multiple: true, is_active: true, deadline: null, created_at: "",
    fields: [
      { key: "manzil", label: "Tadbir o‘tkaziladigan manzil", type: "text", required: true },
      { key: "sana", label: "Tadbir boshlanish sanasi", type: "date", required: true },
      { key: "san", label: "San’atkorlar va ijodiy jamoalar", type: "rows", required: false, columns: [{ key: "n", label: "Nomi", type: "text" }, { key: "u", label: "Unvoni", type: "text" }] },
      { key: "tel", label: "Mas’ul telefoni", type: "phone", required: true },
    ],
  };
  const regions: Region[] = [{ id: "r", code: "a", name: "Samarqand viloyati", region_type: "viloyat", sort_order: 1, is_active: true }];
  const districts: District[] = [{ id: "d", region_id: "r", name: "Urgut tumani", district_type: "tuman", is_active: true }];
  const e = (n: number): EntryRow => ({
    id: String(n), collection_id: "c", region_id: "r", district_id: "d", scope: "district", status: "approved", review_comment: null,
    submitted_at: null, approved_at: null, created_at: `2026-12-0${n}T00:00:00Z`, updated_at: "", region: { name: "Samarqand viloyati" }, district: { name: "Urgut tumani" },
    answers: {
      manzil: "Urgut tumani, Mustaqillik ko‘chasi, 15-uy, markaziy madaniyat saroyi yonidagi katta maydon ".repeat(n),
      sana: "2026-12-30",
      san: Array.from({ length: 6 * n }, (_, i) => ({ n: `San’atkor Familiyasi ${i}`, u: "O‘zbekiston xalq artisti" })),
      tel: "+998901234567",
    },
  });

  it("jadval ustunlari yig‘indisi sahifaga teng; juda uzun qator bo‘linishi mumkin", async () => {
    const { default: JSZip } = await import("jszip");
    for (const layout of ["single", "grouped"] as const) {
      const buf = await buildCollectionDocx(col, [e(1), e(3)], regions, districts, { subtitleLines: [], emptyMode: "hide", generatedOn: "15.12.2026", showStatus: false, layout });
      const xml = await (await JSZip.loadAsync(buf)).file("word/document.xml")!.async("string");
      const grids = [...xml.matchAll(/<w:tblGrid>(.*?)<\/w:tblGrid>/g)].map((m) => [...m[1].matchAll(/w:w="(\d+)"/g)].map((x) => Number(x[1])));
      expect(grids.length).toBeGreaterThan(0);
      for (const g of grids) expect(g.reduce((a, b) => a + b, 0)).toBe(TOTAL);
      expect(xml).toContain("w:tblHeader");
    }
  });
});

import { regionOrgName } from "@/lib/brand";
describe("hududning rasmiy tashkilot nomi", () => {
  it("viloyat, shahar va Qoraqalpog‘iston uchun to‘g‘ri nomlar", () => {
    expect(regionOrgName("Andijon viloyati")).toBe("Andijon viloyat madaniyat boshqarmasi");
    expect(regionOrgName("Farg‘ona viloyati")).toBe("Farg‘ona viloyat madaniyat boshqarmasi");
    expect(regionOrgName("Toshkent shahri")).toBe("Toshkent shahar madaniyat boshqarmasi");
    expect(regionOrgName("Qoraqalpog‘iston Respublikasi")).toBe("Qoraqalpog‘iston Respublikasi Madaniyat vazirligi");
  });
});
