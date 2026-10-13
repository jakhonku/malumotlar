import { describe, it, expect } from "vitest";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { normalizePhone, formatPhone } from "@/lib/phone";
import { draftSchema, submitSchema } from "@/lib/validators";
import { availableActions, canEditEvent, type WorkflowEvent } from "@/lib/workflow";
import { autoTitle } from "@/lib/event-payload";
import { buildEventsReport, buildPeopleReport } from "@/lib/report/docx";
import type { District, EventRow, Region } from "@/lib/types";

describe("telefon", () => {
  it("turli formatlarni +998 ga keltiradi", () => {
    expect(normalizePhone("90 123 45 67")).toBe("+998901234567");
    expect(normalizePhone("+998 (90) 123-45-67")).toBe("+998901234567");
    expect(normalizePhone("998901234567")).toBe("+998901234567");
  });
  it("noto‘g‘ri raqamni rad etadi", () => {
    expect(normalizePhone("12345")).toBeNull();
    expect(normalizePhone("+7 900 123 45 67")).toBeNull();
  });
  it("chiroyli formatlaydi", () => {
    expect(formatPhone("+998901234567")).toBe("+998 90 123 45 67");
  });
});

const valid = {
  scope: "district" as const,
  district_id: "11111111-1111-1111-1111-111111111111",
  title: "Yangi yil bayrami",
  event_type: "Bayram konserti",
  description: "", organization_name: "", notes: "", location_note: "",
  address: "Urgut shahri, 1-uy",
  start_date: "2026-12-30",
  end_date: "2026-12-30",
  artists: [{ artist_name: "Sherzod", artist_type: "artist" as const }],
  participants: [],
  responsibles: [{ full_name: "Aliyev Vali", position: "Boshliq", phone: "90 123 45 67", is_primary: true }],
};

describe("validatsiya", () => {
  it("to‘liq forma o‘tadi va telefon normallashadi", () => {
    const r = submitSchema.safeParse(valid);
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.responsibles[0].phone).toBe("+998901234567");
  });
  it("qoralamada majburiy maydonlar talab qilinmaydi", () => {
    expect(draftSchema.safeParse({ ...valid, event_type: "", address: "", start_date: "", end_date: "", artists: [], responsibles: [] }).success).toBe(true);
  });
  it("tuman tadbirida tuman tanlanishi yoki yangi nom yozilishi shart", () => {
    expect(submitSchema.safeParse({ ...valid, district_id: "" }).success).toBe(false);
    expect(submitSchema.safeParse({ ...valid, district_id: "__new__", new_district_name: "" }).success).toBe(false);
    expect(submitSchema.safeParse({ ...valid, district_id: "__new__", new_district_name: "Qo‘shrabot" }).success).toBe(true);
  });
  it("tadbir nomi so‘ralmaydi (bo‘sh bo‘lsa ham forma o‘tadi)", () => {
    expect(submitSchema.safeParse({ ...valid, title: "" }).success).toBe(true);
    expect(draftSchema.safeParse({ ...valid, title: "" }).success).toBe(true);
  });
  it("avtomatik nom: tur va manzildan hosil bo‘ladi", () => {
    expect(autoTitle({ event_type: "Bayram konserti", address: "Urgut shahri" })).toBe("Bayram konserti — Urgut shahri");
    expect(autoTitle({ address: "Urgut" })).toBe("Yangi yil tadbiri — Urgut");
    expect(autoTitle({})).toBe("Yangi yil tadbiri");
  });
  it("manzil va boshlanish sanasi majburiy; tugash sanasi boshlanishdan oldin bo‘lmasin", () => {
    expect(submitSchema.safeParse({ ...valid, address: "" }).success).toBe(false);
    expect(submitSchema.safeParse({ ...valid, start_date: "" }).success).toBe(false);
    expect(submitSchema.safeParse({ ...valid, end_date: "2026-12-29" }).success).toBe(false);
    expect(submitSchema.safeParse({ ...valid, end_date: "2027-01-02" }).success).toBe(true);
    expect(submitSchema.safeParse({ ...valid, end_date: "" }).success).toBe(true); // bir kunlik
  });
  it("aynan bitta asosiy mas’ul talab qilinadi", () => {
    const two = [...valid.responsibles, { ...valid.responsibles[0], full_name: "Karimov Anvar" }];
    expect(submitSchema.safeParse({ ...valid, responsibles: [{ ...valid.responsibles[0], is_primary: false }] }).success).toBe(false);
    expect(submitSchema.safeParse({ ...valid, responsibles: two }).success).toBe(false);
  });
  it("noto‘g‘ri telefon xabari o‘zbek tilida", () => {
    const r = submitSchema.safeParse({ ...valid, responsibles: [{ ...valid.responsibles[0], phone: "123" }] });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues[0].message).toContain("Telefon raqami noto‘g‘ri");
  });
  it("san’atkor va ishtirokchi majburiy emas; tadbir turi ham ixtiyoriy", () => {
    expect(submitSchema.safeParse({ ...valid, artists: [], participants: [], event_type: "" }).success).toBe(true);
  });
});

describe("holat o‘tishlari (interfeys ko‘zgusi)", () => {
  const base: WorkflowEvent = { region_id: "R", district_id: "D", event_scope: "district", status: "draft", stage: "district" };
  const district = { role: "district_manager" as const, region_id: "R", district_id: "D", can_edit_districts: false };
  const region = { role: "region_manager" as const, region_id: "R", district_id: null, can_edit_districts: false };
  const admin = { role: "super_admin" as const, region_id: null, district_id: null, can_edit_districts: false };
  const observer = { role: "observer" as const, region_id: null, district_id: null, can_edit_districts: false };

  it("tuman mas’uli qoralamani tahrirlaydi va yuboradi", () => {
    expect(canEditEvent(base, district)).toBe(true);
    expect(availableActions(base, district)).toEqual(["submit"]);
  });
  it("yuborilgandan keyin tuman mas’uli tahrirlay olmaydi", () => {
    const e = { ...base, status: "submitted" as const, stage: "region" as const };
    expect(canEditEvent(e, district)).toBe(false);
    expect(availableActions(e, district)).toEqual([]);
  });
  it("viloyat mas’uli tuman tadbirini yuboradi yoki qaytaradi, tasdiqlay olmaydi", () => {
    const e = { ...base, status: "submitted" as const, stage: "region" as const };
    expect(availableActions(e, region)).toEqual(["forward", "return"]);
  });
  it("viloyat mas’uli ruxsatsiz tuman tadbirini tahrirlay olmaydi", () => {
    const e = { ...base, status: "submitted" as const, stage: "region" as const };
    expect(canEditEvent(e, region)).toBe(false);
    expect(canEditEvent(e, { ...region, can_edit_districts: true })).toBe(true);
  });
  it("admin tasdiqlaydi, tasdiqlanganni qayta ochadi", () => {
    expect(availableActions({ ...base, status: "submitted", stage: "ministry" }, admin)).toEqual(["return", "approve"]);
    expect(availableActions({ ...base, status: "approved", stage: "ministry" }, admin)).toEqual(["reopen"]);
  });
  it("kuzatuvchida hech qanday amal yo‘q", () => {
    expect(availableActions({ ...base, status: "submitted", stage: "ministry" }, observer)).toEqual([]);
    expect(canEditEvent(base, observer)).toBe(false);
  });
});

describe("Word hisoboti", () => {
  const regions: Region[] = [
    { id: "r1", code: "samarqand", name: "Samarqand viloyati", region_type: "viloyat", sort_order: 8, is_active: true },
    { id: "r2", code: "buxoro", name: "Buxoro viloyati", region_type: "viloyat", sort_order: 3, is_active: true },
  ];
  const districts: District[] = [
    { id: "d1", region_id: "r1", name: "Samarqand shahri", district_type: "shahar", is_active: true },
    { id: "d2", region_id: "r1", name: "Urgut tumani", district_type: "tuman", is_active: true },
    { id: "d3", region_id: "r2", name: "Buxoro tumani", district_type: "tuman", is_active: true },
  ];
  const mk = (over: Partial<EventRow>): EventRow => ({
    id: Math.random().toString(), region_id: "r1", district_id: null, event_scope: "regional", title: "Tadbir",
    event_type: "Bayram konserti", description: null, venue_name: null, address: "Samarqand sh., Registon",
    location_note: null, start_date: "2026-12-31", end_date: "2026-12-31", start_time: null, end_time: null,
    organization_name: null, notes: null, status: "approved", stage: "ministry", created_by: "u", created_at: "", updated_at: "",
    submitted_at: null, approved_at: null,
    artists: [{ artist_name: "Sherzod Qurbonov", artist_type: "artist", performance_type: "Estrada" }, { artist_name: "Navbahor", artist_type: "group" }],
    participants: [{ participant_name: "Mahalla yoshlari", participant_category: "Yoshlar", participant_count: 150 }],
    responsibles: [{ full_name: "Aliyev Vali", position: "Boshliq", phone: "+998901234567", is_primary: true }, { full_name: "Karimova Zilola", position: "Mutaxassis", phone: "+998931112233", is_primary: false }],
    ...over,
  });
  const events = [
    mk({ address: "Samarqand sh., Registon maydoni", region: { name: "Samarqand viloyati" } }),
    mk({ address: "Urgut shahri, Markaziy maydon", event_scope: "district", district_id: "d2", region: { name: "Samarqand viloyati" }, district: { name: "Urgut tumani" } }),
  ];
  const opts = { subtitleLines: ["Respublika bo‘yicha barcha hududlar", "Holati: Tasdiqlangan"], emptyMode: "hide" as const, generatedOn: "15.12.2026", reportName: "Yangi yil tadbirlari to‘g‘risida ma’lumot" };

  async function xmlOf(buf: Buffer): Promise<string> {
    const { default: JSZip } = await import("jszip");
    const zip = await JSZip.loadAsync(buf);
    return await zip.file("word/document.xml")!.async("string");
  }

  it("haqiqiy .docx (ZIP) yaratadi va tuzilma to‘g‘ri", async () => {
    const buf = await buildEventsReport(events, regions, districts, opts);
    expect(buf.subarray(0, 2).toString()).toBe("PK"); // ZIP imzosi
    const xml = await xmlOf(buf);
    expect(xml).toContain("MADANIYAT VAZIRLIGI");
    expect(xml).toContain("Samarqand viloyati");
    expect(xml).toContain("Viloyatning o‘zi");
    expect(xml).toContain("Urgut tumani");
    expect(xml).toContain("Tuman/shahar");
    // barcha viloyat va tumanlar BITTA jadvalda
    expect(xml.match(/<w:tbl>/g)?.length).toBe(1);
    expect(xml).toContain("+998 90 123 45 67");
    expect(xml).toContain("w:tblHeader"); // jadval sarlavhasi takrorlanadi
    expect(xml).toContain("Times New Roman");
    expect(xml).toContain('w:orient="landscape"');
    // Buxoro (ma'lumotsiz) yashirilgan
    expect(xml).not.toContain("Buxoro");
    // viloyat asosiy tadbiri tuman bo'limidan oldin
    expect(xml.indexOf("Registon maydoni")).toBeLessThan(xml.indexOf("Markaziy maydon"));
    expect(xml).not.toContain("Tadbir nomi");
  });

  it("gerb va bo‘lim nomi eski hisobotda ham bor", async () => {
    const { default: JSZip } = await import("jszip");
    const zip = await JSZip.loadAsync(await buildEventsReport(events, regions, districts, opts));
    const xml = await zip.file("word/document.xml")!.async("string");
    expect(xml).toContain("Madaniy-ommaviy tadbirlar va festivallarni tashkil etish bo‘limi");
    expect(Object.keys(zip.files).some((f) => f.startsWith("word/media/"))).toBe(true);
  });

  it("‘alohida jadvallar’ ko‘rinishi: viloyat va tumanlar alohida jadvalda", async () => {
    const xml = await xmlOf(await buildEventsReport(events, regions, districts, { ...opts, layout: "grouped" }));
    expect((xml.match(/<w:tbl>/g) ?? []).length).toBe(2);
    for (const t of ["SAMARQAND VILOYATI", "Hududning asosiy tadbirlari", "Tuman va shaharlar tadbirlari", "Urgut tumani"]) expect(xml).toContain(t);
    expect(xml).not.toContain("Viloyat/hudud");
  });

  it("‘Ma’lumot kiritilmagan’ rejimi bo‘sh hududlarni ko‘rsatadi, hech narsa to‘qimaydi", async () => {
    const xml = await xmlOf(await buildEventsReport(events, regions, districts, { ...opts, emptyMode: "mark" }));
    expect(xml.match(/<w:tbl>/g)?.length).toBe(1);
    expect(xml).toContain("Buxoro viloyati");
    expect(xml).toContain("Ma’lumot kiritilmagan");
    expect(xml).toContain("Samarqand shahri"); // tadbiri yo'q tuman belgilanadi
  });

  it("tadbir yo‘q bo‘lsa xabar chiqadi", async () => {
    const xml = await xmlOf(await buildEventsReport([], regions, districts, opts));
    expect(xml).toContain("tadbirlar topilmadi");
  });

  it("san’atkorlar va mas’ullar ro‘yxati hujjatlari yaratiladi", async () => {
    const a = await xmlOf(await buildPeopleReport("artists", events, regions, opts));
    expect(a).toContain("Sherzod Qurbonov");
    const r = await xmlOf(await buildPeopleReport("responsibles", events, regions, opts));
    expect(r).toContain("Karimova Zilola");
  });

  it("namuna faylni diskka yozadi (qo‘lda ko‘rish uchun)", async () => {
    const dir = path.resolve(__dirname, "..", ".tmp");
    mkdirSync(dir, { recursive: true });
    const many: EventRow[] = Array.from({ length: 25 }, (_, i) =>
      mk({ title: `Tuman tadbiri ${i + 1}: Yangi yil bayram dasturi`, event_scope: "district", district_id: i % 2 ? "d2" : "d1" }),
    );
    const buf = await buildEventsReport([...events, ...many], regions, districts, opts);
    writeFileSync(path.join(dir, "namuna.docx"), buf);
    expect(buf.length).toBeGreaterThan(5000);
    void execFileSync;
  });
});
