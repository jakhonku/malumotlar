import { describe, it, expect } from "vitest";
import { collectionInputSchema, displayValue, newYearTemplate, slugKey, validateAnswers, type EntryRow, type FieldDef, type CollectionRow } from "@/lib/collections";
import { buildCollectionDocx, buildCollectionXlsx } from "@/lib/report/collection";
import type { District, Region } from "@/lib/types";

const fields: FieldDef[] = [
  { key: "nomi", label: "Nomi", type: "text", required: true },
  { key: "soni", label: "Soni", type: "number", required: false },
  { key: "sana", label: "Sana", type: "date", required: true },
  { key: "vaqt", label: "Vaqt", type: "time", required: false },
  { key: "tel", label: "Telefon", type: "phone", required: true },
  { key: "turi", label: "Turi", type: "select", required: false, options: ["A", "B"] },
  { key: "teglar", label: "Teglar", type: "multiselect", required: false, options: ["x", "y", "z"] },
  { key: "ha", label: "Tasdiq", type: "checkbox", required: false },
];

describe("slugKey", () => {
  it("o‘zbekcha belgilarni toza kalitga aylantiradi", () => {
    expect(slugKey("Mas’ul ijrochi F.I.Sh.")).toBe("masul_ijrochi_f_i_sh");
    expect(slugKey("O‘tkaziladigan joy")).toBe("otkaziladigan_joy");
    expect(slugKey("   ")).toBe("maydon");
  });
});

describe("validateAnswers", () => {
  const good = { nomi: " Bayram ", soni: "12,5", sana: "2026-12-31", vaqt: "20:00", tel: "90 123 45 67", turi: "A", teglar: ["x", "z"], ha: true };

  it("to‘g‘ri javoblarni normallashtiradi", () => {
    const r = validateAnswers(fields, good);
    expect(r.ok).toBe(true);
    expect(r.values).toMatchObject({ nomi: "Bayram", soni: 12.5, tel: "+998901234567", turi: "A", teglar: ["x", "z"], ha: true });
  });

  it("majburiy maydonlarni talab qiladi, qoralamada talab qilmaydi", () => {
    const r = validateAnswers(fields, {});
    expect(Object.keys(r.errors).sort()).toEqual(["nomi", "sana", "tel"]);
    expect(validateAnswers(fields, { nomi: "Faqat nom" }, true).ok).toBe(true);
  });

  it("noto‘g‘ri qiymatlar qoralamada ham rad etiladi", () => {
    const r = validateAnswers(fields, { ...good, tel: "123", soni: "abc", sana: "31.12.2026", turi: "Q", teglar: ["q"] }, true);
    expect(Object.keys(r.errors).sort()).toEqual(["sana", "soni", "teglar", "tel", "turi"]);
  });

  it("noma’lum kalitlar javobga o‘tmaydi", () => {
    const r = validateAnswers(fields, { ...good, hack: "<script>" });
    expect("hack" in r.values).toBe(false);
  });

  it("majburiy checkbox belgilanishi shart", () => {
    const f: FieldDef[] = [{ key: "rozi", label: "Roziman", type: "checkbox", required: true }];
    expect(validateAnswers(f, { rozi: false }).ok).toBe(false);
    expect(validateAnswers(f, { rozi: true }).ok).toBe(true);
  });
});

describe("qatorlar maydoni (rows)", () => {
  const artists: FieldDef[] = [
    {
      key: "sanatkorlar", label: "San’atkorlar", type: "rows", required: false,
      columns: [
        { key: "nomi", label: "F.I.Sh. yoki jamoa nomi", type: "text", required: true },
        { key: "janri", label: "Janri", type: "text" },
        { key: "soni", label: "Soni", type: "number" },
      ],
    },
  ];

  it("bir nechta qatorni saqlaydi, bo‘sh qatorni tashlaydi, sonni normallashtiradi", () => {
    const r = validateAnswers(artists, {
      sanatkorlar: [
        { nomi: " Sherzod Qurbonov ", janri: "Estrada", soni: "" },
        { nomi: "", janri: "", soni: "" },
        { nomi: "Navbahor", janri: "Xalq raqsi", soni: "12" },
      ],
    });
    expect(r.ok).toBe(true);
    expect(r.values.sanatkorlar).toEqual([
      { nomi: "Sherzod Qurbonov", janri: "Estrada", soni: null },
      { nomi: "Navbahor", janri: "Xalq raqsi", soni: 12 },
    ]);
  });

  it("majburiy katak to‘ldirilmasa — qator raqami bilan xato; qoralamada ruxsat", () => {
    const row = { sanatkorlar: [{ nomi: "", janri: "Estrada", soni: "" }] };
    expect(validateAnswers(artists, row).errors.sanatkorlar).toContain("1-qator");
    expect(validateAnswers(artists, row, true).ok).toBe(true);
  });

  it("majburiy ro‘yxat uchun kamida bitta qator kerak; noto‘g‘ri son rad etiladi", () => {
    const req: FieldDef[] = [{ ...artists[0], required: true }];
    expect(validateAnswers(req, { sanatkorlar: [{ nomi: "", janri: "", soni: "" }] }).ok).toBe(false);
    expect(validateAnswers(artists, { sanatkorlar: [{ nomi: "A", soni: "abc" }] }).ok).toBe(false);
  });

  it("eski matnli javob (har qator bir yozuv) qatorlarga aylanadi", () => {
    const r = validateAnswers(artists, { sanatkorlar: "Birinchi\nIkkinchi" });
    expect(r.values.sanatkorlar).toEqual([
      { nomi: "Birinchi", janri: null, soni: null },
      { nomi: "Ikkinchi", janri: null, soni: null },
    ]);
  });

  it("jadval va Word uchun chiroyli matn", () => {
    const rows = [{ nomi: "Sherzod", janri: "Estrada", soni: null }, { nomi: "Navbahor", janri: null, soni: 12 }];
    expect(displayValue(artists[0], rows)).toBe("1) Sherzod — Estrada\n2) Navbahor — 12 (soni)");
    expect(displayValue(artists[0], [{ nomi: "Yolg‘iz", janri: null, soni: null }])).toBe("Yolg‘iz");
  });

  it("sxema: qatorlar maydoni kataklarsiz yoki takroriy kalit bilan rad etiladi; shablonda san’atkorlar qatorlar", () => {
    const t = newYearTemplate();
    const art = t.fields.find((f) => f.type === "rows" && f.label.startsWith("San"));
    expect(art?.columns?.map((c) => c.label)).toEqual(["F.I.Sh. yoki jamoa nomi", "Unvoni"]);
    expect(collectionInputSchema.safeParse({ ...t, fields: [{ key: "x", label: "Ro‘yxat", type: "rows", required: false, columns: [] }] }).success).toBe(false);
    const dup = { key: "x", label: "Ro‘yxat", type: "rows", required: false, columns: [{ key: "a", label: "A", type: "text" }, { key: "a", label: "B", type: "text" }] };
    expect(collectionInputSchema.safeParse({ ...t, fields: [dup] }).success).toBe(false);
  });
});

describe("Yangi yil shabloni va sana tartibi", () => {
  const t = newYearTemplate();

  it("tadbir turi yo‘q; boshlanish va tugash sanasi bor; san’atkorda unvon", () => {
    const labels = t.fields.map((f) => f.label);
    expect(labels).not.toContain("Tadbir turi");
    expect(labels).not.toContain("Tadbir nomi");
    expect(labels).toEqual(expect.arrayContaining(["Tadbir boshlanish sanasi", "Tadbir tugash sanasi"]));
    expect(t.fields.find((f) => f.label === "Tadbir tugash sanasi")?.notBefore).toBe("tadbir_boshlanish_sanasi");
    expect(JSON.stringify(t.fields)).not.toContain("Janri");
  });

  it("tugash sanasi boshlanishdan oldin bo‘lsa — xato; teng yoki keyin bo‘lsa — o‘tadi", () => {
    const base = { tadbir_o_kaziladigan_manzil: "x", mas_ul_ijrochi_f_i_sh: "x" };
    void base;
    const dates = t.fields.filter((f) => f.type === "date");
    const check = (start: string, end: string) => validateAnswers(dates, { tadbir_boshlanish_sanasi: start, tadbir_tugash_sanasi: end });
    expect(check("2026-12-30", "2026-12-29").errors.tadbir_tugash_sanasi).toContain("dan oldin bo‘lmasin");
    expect(check("2026-12-30", "2026-12-30").ok).toBe(true);
    expect(check("2026-12-30", "2027-01-05").ok).toBe(true);
  });
});

describe("collectionInputSchema", () => {
  it("Yangi yil shabloni yaroqli", () => {
    const t = newYearTemplate();
    expect(collectionInputSchema.safeParse(t).success).toBe(true);
    expect(t.fields.some((f) => f.type === "phone" && f.required)).toBe(true);
  });
  it("takrorlangan kalit, bo‘sh maydonlar va variantsiz ro‘yxat rad etiladi", () => {
    const t = newYearTemplate();
    expect(collectionInputSchema.safeParse({ ...t, fields: [] }).success).toBe(false);
    expect(collectionInputSchema.safeParse({ ...t, fields: [t.fields[0], t.fields[0]] }).success).toBe(false);
    expect(collectionInputSchema.safeParse({ ...t, fields: [{ key: "x", label: "Tanlov", type: "select", required: false, options: ["bitta"] }] }).success).toBe(false);
  });
});

describe("displayValue", () => {
  it("turlarga qarab ko‘rsatadi", () => {
    expect(displayValue(fields[2], "2026-12-31")).toBe("31.12.2026");
    expect(displayValue(fields[4], "+998901234567")).toBe("+998 90 123 45 67");
    expect(displayValue(fields[6], ["x", "y"])).toBe("x, y");
    expect(displayValue(fields[7], true)).toBe("Ha");
    expect(displayValue(fields[0], null)).toBe("");
  });
});

describe("hisobotlar (Word / Excel)", () => {
  const col: CollectionRow = {
    id: "c1", title: "Bayram tadbirlari", description: null, entry_label: "Tadbir", audience: "both",
    fields: fields.slice(0, 5), allow_multiple: true, is_active: true, deadline: null, created_at: "",
  };
  const regions: Region[] = [
    { id: "r1", code: "a", name: "Samarqand viloyati", region_type: "viloyat", sort_order: 8, is_active: true },
    { id: "r2", code: "b", name: "Buxoro viloyati", region_type: "viloyat", sort_order: 3, is_active: true },
  ];
  const districts: District[] = [
    { id: "d1", region_id: "r1", name: "Urgut tumani", district_type: "tuman", is_active: true },
    { id: "d2", region_id: "r1", name: "Jomboy tumani", district_type: "tuman", is_active: true },
  ];
  const entry = (over: Partial<EntryRow>): EntryRow => ({
    id: Math.random().toString(), collection_id: "c1", region_id: "r1", district_id: null, scope: "regional",
    answers: { nomi: "Viloyat konserti", soni: 100, sana: "2026-12-31", vaqt: "20:00", tel: "+998901234567" },
    status: "approved", review_comment: null, submitted_at: null, approved_at: null, created_at: "2026-12-01T00:00:00Z", updated_at: "",
    region: { name: "Samarqand viloyati" }, district: null, ...over,
  });
  const entries = [
    entry({}),
    entry({ scope: "district", district_id: "d1", district: { name: "Urgut tumani" }, answers: { nomi: "Urgut dasturi", sana: "2026-12-30", tel: "+998931112233" } }),
  ];
  const opts = { subtitleLines: ["Respublika bo‘yicha barcha hududlar"], emptyMode: "hide" as const, generatedOn: "15.12.2026", showStatus: false };

  it("Word: haqiqiy .docx, maydonlar sarlavhada, viloyat va tuman bo‘limlari", async () => {
    const buf = await buildCollectionDocx(col, entries, regions, districts, opts);
    expect(buf.subarray(0, 2).toString()).toBe("PK");
    const { default: JSZip } = await import("jszip");
    const xml = await (await JSZip.loadAsync(buf)).file("word/document.xml")!.async("string");
    for (const t of ["BAYRAM TADBIRLARI", "Samarqand viloyati", "Viloyat (o‘zi)", "Urgut tumani", "Viloyat/hudud", "Tuman/shahar", "Nomi", "Telefon", "+998 90 123 45 67", "w:tblHeader"]) {
      expect(xml).toContain(t);
    }
    // hamma hududlar BITTA jadvalda
    expect(xml.match(/<w:tbl>/g)?.length).toBe(1);
    expect(xml).not.toContain("Buxoro");
  });

  it("Word: ‘belgilash’ rejimida ma’lumotsiz hududlar va tumanlar ko‘rsatiladi", async () => {
    const { default: JSZip } = await import("jszip");
    const buf = await buildCollectionDocx(col, entries, regions, districts, { ...opts, emptyMode: "mark" });
    const xml = await (await JSZip.loadAsync(buf)).file("word/document.xml")!.async("string");
    expect(xml.match(/<w:tbl>/g)?.length).toBe(1);
    expect(xml).toContain("Buxoro viloyati");
    expect(xml).toContain("Jomboy tumani");
    expect(xml).toContain("Ma’lumot kiritilmagan");
  });

  it("Word ‘alohida jadvallar’: viloyat va tuman o‘z jadvalida, hudud ustunlarisiz", async () => {
    const { default: JSZip } = await import("jszip");
    const buf = await buildCollectionDocx(col, entries, regions, districts, { ...opts, layout: "grouped" });
    const xml = await (await JSZip.loadAsync(buf)).file("word/document.xml")!.async("string");
    expect((xml.match(/<w:tbl>/g) ?? []).length).toBe(2); // viloyat jadvali + Urgut jadvali
    for (const t of ["SAMARQAND VILOYAT MADANIYAT BOSHQARMASI", "Viloyatning o‘z ma’lumotlari", "Tuman va shaharlar", "Urgut tumani"]) expect(xml).toContain(t);
    expect(xml).not.toContain("Viloyat/hudud");
  });

  it("Word: gerb rasmi va bo‘lim nomi hujjat boshida", async () => {
    const { default: JSZip } = await import("jszip");
    const zip = await JSZip.loadAsync(await buildCollectionDocx(col, entries, regions, districts, opts));
    const xml = await zip.file("word/document.xml")!.async("string");
    expect(xml).toContain("Madaniy-ommaviy tadbirlar va festivallarni tashkil etish bo‘limi");
    expect(xml).toContain("MADANIYAT VAZIRLIGI");
    const media = Object.keys(zip.files).filter((f) => f.startsWith("word/media/") && f.endsWith(".png"));
    expect(media.length).toBe(1);
    expect((await zip.file(media[0])!.async("uint8array")).length).toBeGreaterThan(2000);
  });

  it("Excel: sarlavha, qatorlar va hudud ustunlari", async () => {
    const buf = await buildCollectionXlsx(col, entries, regions, districts);
    const ExcelJS = (await import("exceljs")).default;
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buf as unknown as ArrayBuffer);
    const ws = wb.worksheets[0];
    const header = (ws.getRow(1).values as unknown[]).slice(1);
    expect(header).toEqual(["№", "Viloyat/hudud", "Daraja", "Tuman/shahar", "Nomi", "Soni", "Sana", "Vaqt", "Telefon", "Holati", "Qaytarish sababi"]);
    expect(ws.rowCount).toBe(3);
    expect(ws.getRow(2).getCell(5).value).toBe("Viloyat konserti");
    expect(ws.getRow(2).getCell(6).value).toBe(100);
    expect(ws.getRow(3).getCell(4).value).toBe("Urgut tumani");
  });
});

import { autoArrangeFields, eventTemplate, statsTemplate, type FieldType } from "../src/lib/collections";

describe("jadval ustunlarini avtomatik tartiblash", () => {
  const f = (key: string, type: FieldType, notBefore?: string) => ({ key, type, notBefore });
  it("qisqa maydonlar oldinda, qatorli va uzun matn oxirida; tartib barqaror", () => {
    const out = autoArrangeFields([f("a", "rows"), f("b", "text"), f("c", "textarea"), f("d", "number"), f("e", "text")]);
    expect(out.map((x) => x.key)).toEqual(["b", "d", "e", "c", "a"]);
  });
  it("tugash sanasi boshlanish sanasidan keyin keladi", () => {
    const out = autoArrangeFields([f("tugash", "date", "boshlanish"), f("manzil", "text"), f("boshlanish", "date")]);
    const keys = out.map((x) => x.key);
    expect(keys.indexOf("tugash")).toBeGreaterThan(keys.indexOf("boshlanish"));
    expect(keys).toHaveLength(3);
  });
  it("shablonlar yaroqli va tugash sanasi bog‘langan", () => {
    for (const t of [eventTemplate(), statsTemplate()]) {
      expect(t.fields.length).toBeGreaterThan(3);
      expect(t.allow_multiple).toBe(false);
      const arranged = autoArrangeFields(t.fields);
      expect(arranged.map((x) => x.key).sort()).toEqual(t.fields.map((x) => x.key).sort());
    }
    expect(validateAnswers(eventTemplate().fields, {}, false).ok).toBe(false);
  });
});

import { missingMessage, missingUnits } from "../src/lib/completeness";
describe("PDF yuborishdan oldin to‘liqlik tekshiruvi", () => {
  const ds = [{ id: "a", name: "A tumani" }, { id: "b", name: "B tumani" }, { id: "c", name: "C shahri" }];
  it("kiritilmagan hududlarni topadi", () => {
    const entries = [{ scope: "regional", district_id: null }, { scope: "district", district_id: "a" }];
    expect(missingUnits("both", "Viloyatning o‘zi", ds, entries)).toEqual(["B tumani", "C shahri"]);
    expect(missingUnits("both", "Viloyatning o‘zi", ds, [{ scope: "district", district_id: "a" }])[0]).toBe("Viloyatning o‘zi");
    expect(missingUnits("regional", "Viloyatning o‘zi", ds, [])).toEqual(["Viloyatning o‘zi"]);
    expect(missingUnits("district", "Viloyatning o‘zi", ds, [{ scope: "district", district_id: "a" }, { scope: "district", district_id: "b" }, { scope: "district", district_id: "c" }])).toEqual([]);
  });
  it("xabar ro‘yxatni qisqartiradi", () => {
    expect(missingMessage(["A", "B"])).toContain("A, B");
    expect(missingMessage(Array.from({ length: 9 }, (_, i) => `X${i}`))).toContain("va yana 3 ta");
  });
});
