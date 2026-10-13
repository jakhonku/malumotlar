// viloyat-loginlar.csv dan Word hujjat (viloyat-loginlar.docx) yaratadi: jadval + har viloyat uchun alohida varaq.
import { readFileSync, writeFileSync } from "node:fs";
import {
  AlignmentType, BorderStyle, Document, Packer, PageBreak, Paragraph, ShadingType, Table, TableCell, TableRow, TextRun, WidthType,
} from "docx";

const SITE = "https://yangi-yil-monitoring.vercel.app/login";
const FONT = "Times New Roman";
const rows = readFileSync("viloyat-loginlar.csv", "utf8")
  .replace(/^﻿/, "").split(/\r?\n/).filter(Boolean).slice(1)
  .map((l) => l.split(";").map((c) => c.replace(/^"|"$/g, "")));

const org = (n) => /^Qoraqalpog/i.test(n) ? "Qoraqalpog‘iston Respublikasi Madaniyat vazirligi" : /shahri$/i.test(n) ? n.replace(/\s*shahri$/i, "") + " shahar madaniyat boshqarmasi" : /viloyati$/i.test(n) ? n.replace(/\s*viloyati$/i, "") + " viloyat madaniyat boshqarmasi" : n;
rows.forEach((r) => { r[0] = org(r[0]); });

const t = (text, o = {}) => new TextRun({ text, font: FONT, size: o.size ?? 24, bold: o.bold, italics: o.italics });
const p = (text, o = {}) => new Paragraph({ alignment: o.align, spacing: { after: o.after ?? 120, before: o.before ?? 0 }, children: [t(text, o)] });
const b = { style: BorderStyle.SINGLE, size: 4, color: "000000" };
const borders = { top: b, bottom: b, left: b, right: b };
const cell = (text, w, o = {}) =>
  new TableCell({
    width: { size: w, type: WidthType.DXA }, borders, margins: { top: 90, bottom: 90, left: 120, right: 120 },
    shading: o.head ? { type: ShadingType.CLEAR, fill: "D9D9D9", color: "auto" } : undefined,
    children: [new Paragraph({ alignment: o.center ? AlignmentType.CENTER : AlignmentType.LEFT, children: [t(text, { bold: o.head, size: o.size ?? 24 })] })],
  });

const W = [500, 4300, 1900, 2100]; // jami 8800 (A4 portret)
const table = new Table({
  width: { size: W.reduce((a, c) => a + c, 0), type: WidthType.DXA },
  columnWidths: W,
  rows: [
    new TableRow({ tableHeader: true, children: ["№", "Tashkilot", "Login", "Parol"].map((h, i) => cell(h, W[i], { head: true, center: true })) }),
    ...rows.map((r, i) => new TableRow({ cantSplit: true, children: [cell(String(i + 1), W[0], { center: true }), cell(r[0], W[1]), cell(r[1], W[2], { size: 26 }), cell(r[2], W[3], { size: 26 })] })),
  ],
});

const sheets = rows.flatMap((r) => [
  new Paragraph({ children: [new PageBreak()] }),
  p("O‘ZBEKISTON RESPUBLIKASI MADANIYAT VAZIRLIGI", { bold: true, align: AlignmentType.CENTER, size: 28 }),
  p("Madaniy-ommaviy tadbirlar va festivallarni tashkil etish bo‘limi", { italics: true, align: AlignmentType.CENTER, after: 360 }),
  p(r[0], { bold: true, align: AlignmentType.CENTER, size: 30, after: 360 }),
  p("Tadbirlar ma’lumotlarini yig‘ish tizimiga kirish ma’lumotlari", { align: AlignmentType.CENTER, after: 360 }),
  p(`Sayt:     ${SITE}`, { size: 26 }),
  p(`Login:    ${r[1]}`, { size: 30, bold: true }),
  p(`Parol:    ${r[2]}`, { size: 30, bold: true, after: 360 }),
  p("Kirgach «Sozlamalar → Parolni o‘zgartirish» bo‘limidan parolni o‘zgartirishingizni tavsiya etamiz. Login va parolni boshqalarga bermang.", { italics: true, size: 22 }),
]);

const doc = new Document({
  styles: { default: { document: { run: { font: FONT, size: 24 } } } },
  sections: [{
    properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 1134, bottom: 1134, left: 1417, right: 850 } } },
    children: [
      p("VILOYATLAR UCHUN LOGIN VA PAROLLAR", { bold: true, align: AlignmentType.CENTER, size: 30 }),
      p(`Kirish manzili: ${SITE}`, { align: AlignmentType.CENTER, after: 200 }),
      table,
      p("Diqqat: hujjat maxfiy. Har bir viloyatga faqat o‘z logini va paroli yuboriladi (keyingi varaqlarda har biri alohida).", { italics: true, size: 22, before: 200 }),
      ...sheets,
    ],
  }],
});
writeFileSync("viloyat-loginlar.docx", await Packer.toBuffer(doc));
console.log("viloyat-loginlar.docx yozildi:", rows.length, "ta viloyat");
