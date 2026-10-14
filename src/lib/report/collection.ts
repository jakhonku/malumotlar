import {
  AlignmentType, BorderStyle, Document, Footer, Header, Packer, PageNumber, PageOrientation, Paragraph,
  ShadingType, Table, TableCell, TableLayoutType, TableRow, TabStopType, TextRun, VerticalAlign, WidthType,
} from "docx";
import ExcelJS from "exceljs";
import { STATUS_LABELS } from "../constants";
import { brandBlock } from "./brand";
import { regionOrgName, regionKind } from "../brand";
import { autoWidths, pickFontSize, rowCanSplit } from "./layout";
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
  /** single — barcha viloyatlar bitta jadvalda; grouped — har bir viloyat o‘z jadvalida (avval viloyatning o‘zi, ostida tumanlari) */
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

interface Grid {
  headers: string[];
  rows: string[][];
  widths: number[];
  size: number;
}

/** Tayyor kengliklar bilan jadval chizadi. */
function gridTable(g: Grid) {
  return new Table({
    width: { size: g.widths.reduce((a, b) => a + b, 0), type: WidthType.DXA },
    columnWidths: g.widths,
    layout: TableLayoutType.FIXED,
    rows: [
      new TableRow({ tableHeader: true, cantSplit: true, children: g.headers.map((h, i) => cell(h, g.widths[i], g.size, { header: true })) }),
      ...g.rows.map(
        (r) =>
          new TableRow({
            cantSplit: !rowCanSplit(r),
            children: r.map((v, i) => cell(v, g.widths[i], g.size, { center: i === 0 })),
          }),
      ),
    ],
  });
}

const fieldValues = (col: CollectionRow, e: EntryRow | null) =>
  e ? col.fields.map((f) => displayValue(f, e.answers[f.key])) : col.fields.map((_, i) => (i === 0 ? EMPTY_TEXT : ""));

/** Jadval tuzilmasi: ustunlar kengligi barcha qatorlar mazmunidan bir marta hisoblanadi (hamma jadvalda bir xil). */
type Geo = boolean | "district";

function makeGrid(col: CollectionRow, geo: Geo, all: { region: string; district: string; entry: EntryRow | null }[], showStatus: boolean) {
  const geoHeaders = geo === "district" ? ["Tuman/shahar"] : geo ? ["Viloyat/hudud", "Tuman/shahar"] : [];
  const geoCells = (r: { region: string; district: string }) => (geo === "district" ? [r.district] : geo ? [r.region, r.district] : []);
  const headers = ["№", ...geoHeaders, ...col.fields.map((f) => f.label), ...(showStatus ? ["Holati"] : [])];
  const body = all.map((r) => [
    "",
    ...geoCells(r),
    ...fieldValues(col, r.entry),
    ...(showStatus ? [r.entry ? STATUS_LABELS[r.entry.status] : ""] : []),
  ]);
  const size = pickFontSize(headers.length, body);
  const fixed: (number | null)[] = headers.map((_, i) => (i === 0 ? 480 : null));
  const widths = autoWidths(headers, body, PAGE_W, size, fixed);
  return {
    headers, widths, size,
    /** Berilgan qatorlar uchun tayyor jadval (№ avtomatik 1, 2, 3…) */
    render: (rows: { region: string; district: string; entry: EntryRow | null }[]) =>
      gridTable({
        headers, widths, size,
        rows: rows.map((r, i) => [
          String(i + 1),
          ...geoCells(r),
          ...fieldValues(col, r.entry),
          ...(showStatus ? [r.entry ? STATUS_LABELS[r.entry.status] : ""] : []),
        ]),
      }),
  };
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
    ...brandBlock(),
    para(col.title.toUpperCase(), { bold: true, size: 28, align: AlignmentType.CENTER, after: 120 }),
    ...opts.subtitleLines.map((l) => para(l, { size: 24, align: AlignmentType.CENTER, italics: true, after: 40 })),
    para("", { after: 120 }),
  ];

  if (opts.layout === "grouped") {
    // har bir viloyat — bitta jadval: birinchi qator(lar) viloyatning o‘zi, ostida tuman/shaharlar
    const perRegion: { region: Region; rows: TableRowData[] }[] = [];
    for (const region of regions.slice().sort((x, y) => x.sort_order - y.sort_order)) {
      const inRegion = entries.filter((e) => e.region_id === region.id);
      if (!inRegion.length && opts.emptyMode === "hide") continue;
      const own = regionKind(region.name) === "respublika" ? "Respublikaning o‘zi" : regionKind(region.name) === "shahar" ? "Shaharning o‘zi" : "Viloyatning o‘zi";
      const rows: TableRowData[] = [];
      if (col.audience !== "district") {
        const mine = inRegion.filter((e) => e.scope === "regional").sort(byCreated);
        for (const e of mine) rows.push({ region: region.name, district: own, entry: e });
        if (!mine.length && opts.emptyMode === "mark") rows.push({ region: region.name, district: own, entry: null });
      }
      if (col.audience !== "regional") {
        const dEntries = inRegion.filter((e) => e.scope === "district");
        for (const d of districts.filter((x) => x.region_id === region.id)) {
          const de = dEntries.filter((e) => e.district_id === d.id).sort(byCreated);
          for (const e of de) rows.push({ region: region.name, district: d.name, entry: e });
          if (!de.length && opts.emptyMode === "mark") rows.push({ region: region.name, district: d.name, entry: null });
        }
      }
      if (rows.length) perRegion.push({ region, rows });
    }
    if (perRegion.length === 0) {
      children.push(para("Tanlangan shartlar bo‘yicha ma’lumot topilmadi.", { size: 26, align: AlignmentType.CENTER, before: 400 }));
    } else {
      const grid = makeGrid(col, "district", perRegion.flatMap((x) => x.rows), opts.showStatus);
      for (const { region, rows } of perRegion) {
        children.push(para(regionOrgName(region.name).toUpperCase(), { bold: true, size: 28, align: AlignmentType.CENTER, before: 240, after: 120, keepNext: true }));
        children.push(grid.render(rows));
      }
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
        ? makeGrid(col, true, rows, opts.showStatus).render(rows)
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
