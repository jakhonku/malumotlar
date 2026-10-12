import {
  AlignmentType, BorderStyle, Document, Footer, Header, Packer, PageNumber, PageOrientation, Paragraph,
  ShadingType, Table, TableCell, TableLayoutType, TableRow, TabStopType, TextRun, VerticalAlign, WidthType,
} from "docx";
import ExcelJS from "exceljs";
import { STATUS_LABELS } from "../constants";
import { displayValue, type CollectionRow, type EntryRow } from "../collections";
import type { District, Region } from "../types";

const FONT = "Times New Roman";
const EMPTY_TEXT = "Ma’lumot kiritilmagan";
const MARGIN = { top: 850, bottom: 850, left: 1134, right: 567 };
const PAGE_W = 16838 - MARGIN.left - MARGIN.right;

export interface CollectionReportOptions {
  subtitleLines: string[];
  emptyMode: "hide" | "mark";
  generatedOn: string; // dd.MM.yyyy
  showStatus: boolean;
  /** single — hammasi bitta jadvalda; grouped — har bir viloyat va tuman alohida jadvalda */
  layout?: "single" | "grouped";
}

const border = { style: BorderStyle.SINGLE, size: 4, color: "000000" };
const borders = { top: border, bottom: border, left: border, right: border };

const run = (text: string, o: { bold?: boolean; size?: number; italics?: boolean } = {}) =>
  new TextRun({ text, font: FONT, size: o.size ?? 20, bold: o.bold, italics: o.italics });

function para(
  text: string,
  o: { bold?: boolean; size?: number; align?: (typeof AlignmentType)[keyof typeof AlignmentType]; before?: number; after?: number; italics?: boolean; keepNext?: boolean } = {},
) {
  return new Paragraph({ alignment: o.align, keepNext: o.keepNext, spacing: { before: o.before ?? 0, after: o.after ?? 0 }, children: [run(text, o)] });
}

function cell(text: string, width: number, size: number, o: { header?: boolean; center?: boolean } = {}) {
  const lines = text.split(/\r?\n/);
  return new TableCell({
    width: { size: width, type: WidthType.DXA },
    borders,
    verticalAlign: o.header ? VerticalAlign.CENTER : VerticalAlign.TOP,
    shading: o.header ? { type: ShadingType.CLEAR, fill: "D9D9D9", color: "auto" } : undefined,
    margins: { top: 50, bottom: 50, left: 80, right: 80 },
    children: lines.map(
      (l) => new Paragraph({ alignment: o.center || o.header ? AlignmentType.CENTER : AlignmentType.LEFT, spacing: { after: 30 }, children: [run(l || (o.header ? "" : "—"), { bold: o.header, size })] }),
    ),
  });
}

interface TableRowData {
  region: string;
  district: string;
  /** javoblar yo‘q bo‘lsa — «Ma’lumot kiritilmagan» qatori */
  entry: EntryRow | null;
}

/** Barcha hududlar uchun BITTA jadval: № | Viloyat | Tuman/shahar | maydonlar... | (Holati) */
function singleTable(col: CollectionRow, rows: TableRowData[], showStatus: boolean) {
  const n = col.fields.length + (showStatus ? 1 : 0);
  const size = n > 9 ? 17 : n > 6 ? 18 : 20;
  const numW = 480;
  const geoW = n > 9 ? 1300 : 1600;
  const each = Math.floor((PAGE_W - numW - geoW * 2) / n);
  const widths = [numW, geoW, geoW, ...Array.from({ length: n }, () => each)];
  const headers = ["№", "Viloyat/hudud", "Tuman/shahar", ...col.fields.map((f) => f.label), ...(showStatus ? ["Holati"] : [])];
  return new Table({
    width: { size: widths.reduce((a, b) => a + b, 0), type: WidthType.DXA },
    columnWidths: widths,
    layout: TableLayoutType.FIXED,
    rows: [
      new TableRow({ tableHeader: true, cantSplit: true, children: headers.map((h, i) => cell(h, widths[i], size, { header: true })) }),
      ...rows.map((r, idx) => {
        const e = r.entry;
        const values = e
          ? col.fields.map((f) => displayValue(f, e.answers[f.key]))
          : col.fields.map((_, i) => (i === 0 ? EMPTY_TEXT : ""));
        return new TableRow({
          cantSplit: true,
          children: [
            cell(String(idx + 1), widths[0], size, { center: true }),
            cell(r.region, widths[1], size),
            cell(r.district, widths[2], size),
            ...values.map((v, i) => cell(v, widths[i + 3], size)),
            ...(showStatus ? [cell(e ? STATUS_LABELS[e.status] : "", widths[widths.length - 1], size)] : []),
          ],
        });
      }),
    ],
  });
}

/** Guruhlangan ko‘rinish uchun jadval (hudud sarlavha sifatida alohida beriladi). */
function groupedTable(col: CollectionRow, rows: EntryRow[], showStatus: boolean) {
  const n = col.fields.length + (showStatus ? 1 : 0);
  const size = n > 9 ? 17 : n > 6 ? 18 : 20;
  const first = 480;
  const each = Math.floor((PAGE_W - first) / n);
  const widths = [first, ...Array.from({ length: n }, () => each)];
  const headers = ["№", ...col.fields.map((f) => f.label), ...(showStatus ? ["Holati"] : [])];
  return new Table({
    width: { size: widths.reduce((a, b) => a + b, 0), type: WidthType.DXA },
    columnWidths: widths,
    layout: TableLayoutType.FIXED,
    rows: [
      new TableRow({ tableHeader: true, cantSplit: true, children: headers.map((h, i) => cell(h, widths[i], size, { header: true })) }),
      ...rows.map(
        (r, idx) =>
          new TableRow({
            cantSplit: true,
            children: [
              cell(String(idx + 1), widths[0], size, { center: true }),
              ...col.fields.map((f, i) => cell(displayValue(f, r.answers[f.key]), widths[i + 1], size)),
              ...(showStatus ? [cell(STATUS_LABELS[r.status], widths[widths.length - 1], size)] : []),
            ],
          }),
      ),
    ],
  });
}

const byCreated = (a: EntryRow, b: EntryRow) => a.created_at.localeCompare(b.created_at);

export async function buildCollectionDocx(
  col: CollectionRow,
  entries: EntryRow[],
  regions: Region[],
  districts: District[],
  opts: CollectionReportOptions,
): Promise<Buffer> {
  const children: (Paragraph | Table)[] = [
    para("O‘ZBEKISTON RESPUBLIKASI MADANIYAT VAZIRLIGI", { bold: true, size: 28, align: AlignmentType.CENTER, after: 120 }),
    para(col.title.toUpperCase(), { bold: true, size: 28, align: AlignmentType.CENTER, after: 120 }),
    ...opts.subtitleLines.map((l) => para(l, { size: 24, align: AlignmentType.CENTER, italics: true, after: 40 })),
    para("", { after: 120 }),
  ];

  if (opts.layout === "grouped") {
    let rendered = 0;
    for (const region of regions.slice().sort((x, y) => x.sort_order - y.sort_order)) {
      const inRegion = entries.filter((e) => e.region_id === region.id);
      if (!inRegion.length && opts.emptyMode === "hide") continue;
      rendered++;
      children.push(para(region.name.toUpperCase(), { bold: true, size: 28, align: AlignmentType.CENTER, before: 240, after: 120, keepNext: true }));

      if (col.audience !== "district") {
        const own = inRegion.filter((e) => e.scope === "regional").sort(byCreated);
        if (own.length || opts.emptyMode === "mark") {
          children.push(para("Viloyatning o‘z ma’lumotlari", { bold: true, size: 26, before: 120, after: 80, keepNext: true }));
          children.push(own.length ? groupedTable(col, own, opts.showStatus) : para(EMPTY_TEXT, { italics: true, size: 24, after: 80 }));
        }
      }
      if (col.audience !== "regional") {
        const dEntries = inRegion.filter((e) => e.scope === "district");
        const regionDistricts = districts.filter((d) => d.region_id === region.id);
        const list = opts.emptyMode === "mark" ? regionDistricts : regionDistricts.filter((d) => dEntries.some((e) => e.district_id === d.id));
        if (list.length) {
          children.push(para("Tuman va shaharlar", { bold: true, size: 26, before: 200, after: 80, keepNext: true }));
          for (const d of list) {
            const de = dEntries.filter((e) => e.district_id === d.id).sort(byCreated);
            children.push(para(d.name, { bold: true, size: 24, before: 120, after: 60, keepNext: true }));
            children.push(de.length ? groupedTable(col, de, opts.showStatus) : para(EMPTY_TEXT, { italics: true, size: 24, after: 60 }));
          }
        }
      }
    }
    if (rendered === 0) {
      children.push(para("Tanlangan shartlar bo‘yicha ma’lumot topilmadi.", { size: 26, align: AlignmentType.CENTER, before: 400 }));
    }
  } else {
    const rows: TableRowData[] = [];
    for (const region of regions.slice().sort((x, y) => x.sort_order - y.sort_order)) {
      const inRegion = entries.filter((e) => e.region_id === region.id);

      if (col.audience !== "district") {
        const own = inRegion.filter((e) => e.scope === "regional").sort(byCreated);
        for (const e of own) rows.push({ region: region.name, district: "Viloyat (o‘zi)", entry: e });
        if (!own.length && opts.emptyMode === "mark") rows.push({ region: region.name, district: "Viloyat (o‘zi)", entry: null });
      }

      if (col.audience !== "regional") {
        const dEntries = inRegion.filter((e) => e.scope === "district");
        for (const d of districts.filter((x) => x.region_id === region.id)) {
          const de = dEntries.filter((e) => e.district_id === d.id).sort(byCreated);
          for (const e of de) rows.push({ region: region.name, district: d.name, entry: e });
          if (!de.length && opts.emptyMode === "mark") rows.push({ region: region.name, district: d.name, entry: null });
        }
      }
    }
    children.push(
      rows.length
        ? singleTable(col, rows, opts.showStatus)
        : para("Tanlangan shartlar bo‘yicha ma’lumot topilmadi.", { size: 26, align: AlignmentType.CENTER, before: 400 }),
    );
  }

  const doc = new Document({
    creator: "O‘zbekiston Respublikasi Madaniyat vazirligi",
    title: col.title,
    styles: { default: { document: { run: { font: FONT, size: 26 } } } },
    sections: [
      {
        properties: { page: { size: { width: 11906, height: 16838, orientation: PageOrientation.LANDSCAPE }, margin: MARGIN } },
        headers: {
          default: new Header({
            children: [
              new Paragraph({
                tabStops: [{ type: TabStopType.RIGHT, position: PAGE_W }],
                border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: "808080", space: 2 } },
                children: [run(col.title, { size: 20 }), new TextRun({ text: "\t", font: FONT }), run(`Yaratilgan sana: ${opts.generatedOn}`, { size: 20 })],
              }),
            ],
          }),
        },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [new TextRun({ children: ["Sahifa ", PageNumber.CURRENT, " / ", PageNumber.TOTAL_PAGES], font: FONT, size: 20 })],
              }),
            ],
          }),
        },
        children,
      },
    ],
  });
  return Packer.toBuffer(doc);
}

export async function buildCollectionXlsx(
  col: CollectionRow,
  entries: EntryRow[],
  regions: Region[],
  districts: District[],
): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Madaniyat vazirligi";
  const ws = wb.addWorksheet("Ma’lumotlar");

  const regionOrder = new Map(regions.map((r) => [r.id, r.sort_order]));
  const districtOrder = new Map(districts.map((d, i) => [d.id, i]));

  ws.columns = [
    { header: "№", key: "_n", width: 6 },
    { header: "Viloyat/hudud", key: "_region", width: 28 },
    { header: "Daraja", key: "_scope", width: 18 },
    { header: "Tuman/shahar", key: "_district", width: 26 },
    ...col.fields.map((f) => ({ header: f.label, key: f.key, width: f.type === "textarea" ? 48 : f.type === "text" ? 32 : 20 })),
    { header: "Holati", key: "_status", width: 26 },
    { header: "Qaytarish sababi", key: "_comment", width: 32 },
  ];

  const sorted = entries
    .slice()
    .sort(
      (a, b) =>
        (regionOrder.get(a.region_id) ?? 0) - (regionOrder.get(b.region_id) ?? 0) ||
        Number(a.scope === "district") - Number(b.scope === "district") ||
        (districtOrder.get(a.district_id ?? "") ?? 0) - (districtOrder.get(b.district_id ?? "") ?? 0) ||
        a.created_at.localeCompare(b.created_at),
    );

  sorted.forEach((e, i) => {
    const row: Record<string, string | number> = {
      _n: i + 1,
      _region: e.region?.name ?? "",
      _scope: e.scope === "regional" ? "Viloyat" : "Tuman/shahar",
      _district: e.district?.name ?? "",
      _status: STATUS_LABELS[e.status],
      _comment: e.review_comment ?? "",
    };
    for (const f of col.fields) {
      const v = e.answers[f.key];
      row[f.key] = f.type === "number" && typeof v === "number" ? v : displayValue(f, v);
    }
    ws.addRow(row);
  });

  const header = ws.getRow(1);
  header.font = { bold: true };
  header.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
  header.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFD9D9D9" } };
  ws.eachRow((r) => {
    r.eachCell((c) => {
      c.border = { top: { style: "thin" }, left: { style: "thin" }, bottom: { style: "thin" }, right: { style: "thin" } };
      if (r.number > 1) c.alignment = { vertical: "top", wrapText: true };
    });
  });
  ws.views = [{ state: "frozen", ySplit: 1 }];
  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: ws.columnCount } };

  return Buffer.from(await wb.xlsx.writeBuffer());
}
