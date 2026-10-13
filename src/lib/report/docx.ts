import {
  AlignmentType, BorderStyle, Document, Footer, Header, Packer, PageNumber, PageOrientation, Paragraph,
  ShadingType, Table, TableCell, TableLayoutType, TableRow, TabStopType, TextRun, VerticalAlign, WidthType,
} from "docx";
import { ARTIST_TYPE_LABELS, STATUS_LABELS } from "../constants";
import { formatPhone } from "../phone";
import { fmtDate } from "../format";
import type { District, EventRow, Region } from "../types";

const FONT = "Times New Roman";
const BODY = 26; // 13 pt
const TABLE_TEXT = 20; // 10 pt
const EMPTY_TEXT = "Ma’lumot kiritilmagan";

// A4 albom: 29.7 sm = 16838 twip; chetlar: chap 2 sm, o‘ng 1 sm
const MARGIN = { top: 850, bottom: 850, left: 1134, right: 567 };
const PAGE_W = 16838 - MARGIN.left - MARGIN.right;

export interface EventsReportOptions {
  /** Sarlavhadan keyingi qo‘shimcha satrlar (filtr tavsifi) */
  subtitleLines: string[];
  emptyMode: "hide" | "mark";
  /** Tadbir nomi yonida holatni ko‘rsatish (tasdiqlanmagan holatlar eksporti uchun) */
  showStatus?: boolean;
  generatedOn: string; // dd.MM.yyyy
  reportName: string;
  /** single — hammasi bitta jadvalda; grouped — har bir viloyat va tuman alohida jadvalda */
  layout?: "single" | "grouped";
}

const border = { style: BorderStyle.SINGLE, size: 4, color: "000000" };
const borders = { top: border, bottom: border, left: border, right: border };

function run(text: string, o: { bold?: boolean; size?: number; italics?: boolean } = {}) {
  return new TextRun({ text, font: FONT, size: o.size ?? TABLE_TEXT, bold: o.bold, italics: o.italics });
}

function para(text: string, o: { bold?: boolean; size?: number; align?: (typeof AlignmentType)[keyof typeof AlignmentType]; before?: number; after?: number; italics?: boolean; keepNext?: boolean } = {}) {
  return new Paragraph({
    alignment: o.align,
    keepNext: o.keepNext,
    spacing: { before: o.before ?? 0, after: o.after ?? 0 },
    children: [run(text, o)],
  });
}

function cell(lines: string[] | string, width: number, o: { header?: boolean; center?: boolean } = {}) {
  const arr = (Array.isArray(lines) ? lines : [lines]).filter((l) => l !== undefined);
  const paragraphs = (arr.length ? arr : ["—"]).map(
    (l) =>
      new Paragraph({
        alignment: o.center || o.header ? AlignmentType.CENTER : AlignmentType.LEFT,
        spacing: { after: 40 },
        children: [run(l, { bold: o.header, size: TABLE_TEXT })],
      }),
  );
  return new TableCell({
    width: { size: width, type: WidthType.DXA },
    borders,
    verticalAlign: o.header ? VerticalAlign.CENTER : VerticalAlign.TOP,
    shading: o.header ? { type: ShadingType.CLEAR, fill: "D9D9D9", color: "auto" } : undefined,
    margins: { top: 50, bottom: 50, left: 80, right: 80 },
    children: paragraphs,
  });
}

function makeTable(widths: number[], headers: string[], rows: (string[] | string)[][]) {
  const total = widths.reduce((a, b) => a + b, 0);
  return new Table({
    width: { size: total, type: WidthType.DXA },
    columnWidths: widths,
    layout: TableLayoutType.FIXED,
    rows: [
      new TableRow({ tableHeader: true, cantSplit: true, children: headers.map((h, i) => cell(h, widths[i], { header: true })) }),
      ...rows.map(
        (r) => new TableRow({ cantSplit: true, children: r.map((c, i) => cell(c, widths[i], { center: i === 0 })) }),
      ),
    ],
  });
}

const numbered = (items: string[]) => (items.length > 1 ? items.map((t, i) => `${i + 1}) ${t}`) : items);

const sortEvents = (a: EventRow, b: EventRow) =>
  (a.start_date ?? "9999").localeCompare(b.start_date ?? "9999") ||
  (a.address ?? "").localeCompare(b.address ?? "", "uz");

function eventRow(e: EventRow, idx: number, showStatus: boolean, regionName: string, districtName: string): (string[] | string)[] {
  const date =
    e.start_date && e.end_date && e.end_date !== e.start_date
      ? `${fmtDate(e.start_date)} — ${fmtDate(e.end_date)}`
      : fmtDate(e.start_date);
  const artists = numbered(
    (e.artists ?? []).map((a) => {
      const extra = [ARTIST_TYPE_LABELS[a.artist_type], a.performance_type].filter(Boolean).join(", ");
      return `${a.artist_name} (${extra})`;
    }),
  );
  const participants = numbered(
    (e.participants ?? []).map((p) => {
      const parts = [p.participant_category, p.participant_count != null ? `${p.participant_count} nafar` : null].filter(Boolean);
      return parts.length ? `${p.participant_name} (${parts.join(", ")})` : p.participant_name;
    }),
  );
  const resp = (e.responsibles ?? [])
    .slice()
    .sort((a, b) => Number(b.is_primary) - Number(a.is_primary))
    .map((r) => `${r.full_name}, ${r.position}, tel: ${formatPhone(r.phone)}`);
  const addr = [e.address || "—"];
  if (e.event_type) addr.unshift(e.event_type);
  if (showStatus) addr.push(`[${STATUS_LABELS[e.status]}]`);
  return [
    String(idx),
    regionName,
    districtName,
    addr,
    date,
    artists.length ? artists : "—",
    participants.length ? participants : "—",
    resp.length ? numbered(resp) : "—",
  ];
}

const EVENT_COLS = [450, 1350, 1350, 3000, 1200, 2400, 2200, 3100];
const EVENT_HEADERS = [
  "№", "Viloyat/hudud", "Tuman/shahar", "O‘tkaziladigan manzil", "Boshlanish – tugash sanasi",
  "San’atkorlar va ijodiy jamoalar", "Ishtirokchilar haqida ma’lumot", "Mas’ul ijrochilar (F.I.Sh., lavozimi, telefon raqami)",
];

// Guruhlangan ko‘rinish: hudud ustunlarisiz (hudud sarlavha sifatida beriladi)
const GROUPED_COLS = [480, 3500, 1400, 3200, 2800, 3700];
const GROUPED_HEADERS = EVENT_HEADERS.filter((_, i) => i !== 1 && i !== 2);
const withoutGeo = (row: (string[] | string)[]) => row.filter((_, i) => i !== 1 && i !== 2);

function frame(reportName: string, generatedOn: string, children: (Paragraph | Table)[]) {
  return new Document({
    creator: "O‘zbekiston Respublikasi Madaniyat vazirligi",
    title: reportName,
    styles: { default: { document: { run: { font: FONT, size: BODY } } } },
    sections: [
      {
        properties: {
          page: {
            size: { width: 11906, height: 16838, orientation: PageOrientation.LANDSCAPE },
            margin: MARGIN,
          },
        },
        headers: {
          default: new Header({
            children: [
              new Paragraph({
                tabStops: [{ type: TabStopType.RIGHT, position: PAGE_W }],
                border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: "808080", space: 2 } },
                children: [run(reportName, { size: 20 }), new TextRun({ text: "\t", font: FONT }), run(`Yaratilgan sana: ${generatedOn}`, { size: 20 })],
              }),
            ],
          }),
        },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({ children: ["Sahifa ", PageNumber.CURRENT, " / ", PageNumber.TOTAL_PAGES], font: FONT, size: 20 }),
                ],
              }),
            ],
          }),
        },
        children,
      },
    ],
  });
}

function titleBlock(subtitleLines: string[]): Paragraph[] {
  return [
    para("O‘ZBEKISTON RESPUBLIKASI MADANIYAT VAZIRLIGI", { bold: true, size: 28, align: AlignmentType.CENTER, after: 120 }),
    para("YANGI YIL BAYRAMI MUNOSABATI BILAN O‘TKAZILADIGAN TADBIRLAR TO‘G‘RISIDA MA’LUMOT", {
      bold: true, size: 28, align: AlignmentType.CENTER, after: 120,
    }),
    ...subtitleLines.map((l) => para(l, { size: 24, align: AlignmentType.CENTER, italics: true, after: 40 })),
    para("", { after: 120 }),
  ];
}

/** Tadbirlar bo‘yicha asosiy rasmiy hisobot: viloyat → asosiy tadbirlar → tuman/shaharlar. */
export async function buildEventsReport(
  events: EventRow[],
  regions: Region[],
  districts: District[],
  opts: EventsReportOptions,
): Promise<Buffer> {
  const showStatus = !!opts.showStatus;
  const children: (Paragraph | Table)[] = [...titleBlock(opts.subtitleLines)];

  if (opts.layout === "grouped") {
    let rendered = 0;
    for (const region of regions.slice().sort((x, y) => x.sort_order - y.sort_order)) {
      const regionEvents = events.filter((e) => e.region_id === region.id);
      if (regionEvents.length === 0 && opts.emptyMode === "hide") continue;
      rendered++;
      children.push(para(region.name.toUpperCase(), { bold: true, size: 28, align: AlignmentType.CENTER, before: 240, after: 120, keepNext: true }));

      const regional = regionEvents.filter((e) => e.event_scope === "regional").sort(sortEvents);
      if (regional.length || opts.emptyMode === "mark") {
        children.push(para("Viloyatning asosiy tadbirlari", { bold: true, size: 26, before: 120, after: 80, keepNext: true }));
        children.push(
          regional.length
            ? makeTable(GROUPED_COLS, GROUPED_HEADERS, regional.map((e, i) => withoutGeo(eventRow(e, i + 1, showStatus, region.name, ""))))
            : para(EMPTY_TEXT, { italics: true, size: 24, after: 80 }),
        );
      }

      const districtEvents = regionEvents.filter((e) => e.event_scope === "district");
      const regionDistricts = districts.filter((d) => d.region_id === region.id);
      const list = opts.emptyMode === "mark" ? regionDistricts : regionDistricts.filter((d) => districtEvents.some((e) => e.district_id === d.id));
      if (list.length) {
        children.push(para("Tuman va shaharlar tadbirlari", { bold: true, size: 26, before: 200, after: 80, keepNext: true }));
        for (const d of list) {
          const de = districtEvents.filter((e) => e.district_id === d.id).sort(sortEvents);
          children.push(para(d.name, { bold: true, size: 24, before: 120, after: 60, keepNext: true }));
          children.push(
            de.length
              ? makeTable(GROUPED_COLS, GROUPED_HEADERS, de.map((e, i) => withoutGeo(eventRow(e, i + 1, showStatus, region.name, d.name))))
              : para(EMPTY_TEXT, { italics: true, size: 24, after: 60 }),
          );
        }
      }
    }
    if (rendered === 0) {
      children.push(para("Tanlangan shartlar bo‘yicha tadbirlar topilmadi.", { size: 26, align: AlignmentType.CENTER, before: 400 }));
    }
  } else {
    // Barcha hududlar BITTA jadvalda: viloyat → viloyatning o‘z tadbirlari → tuman/shaharlar
    const rows: (string[] | string)[][] = [];
    const emptyRow = (region: string, district: string): (string[] | string)[] => [
      String(rows.length + 1), region, district, EMPTY_TEXT, "", "", "", "",
    ];
    for (const region of regions.slice().sort((a, b) => a.sort_order - b.sort_order)) {
      const regionEvents = events.filter((e) => e.region_id === region.id);
      const regional = regionEvents.filter((e) => e.event_scope === "regional").sort(sortEvents);
      for (const e of regional) rows.push(eventRow(e, rows.length + 1, showStatus, region.name, "Viloyat (o‘zi)"));
      if (!regional.length && opts.emptyMode === "mark") rows.push(emptyRow(region.name, "Viloyat (o‘zi)"));

      const districtEvents = regionEvents.filter((e) => e.event_scope === "district");
      for (const d of districts.filter((x) => x.region_id === region.id)) {
        const de = districtEvents.filter((e) => e.district_id === d.id).sort(sortEvents);
        for (const e of de) rows.push(eventRow(e, rows.length + 1, showStatus, region.name, d.name));
        if (!de.length && opts.emptyMode === "mark") rows.push(emptyRow(region.name, d.name));
      }
    }
    children.push(
      rows.length
        ? makeTable(EVENT_COLS, EVENT_HEADERS, rows)
        : para("Tanlangan shartlar bo‘yicha tadbirlar topilmadi.", { size: 26, align: AlignmentType.CENTER, before: 400 }),
    );
  }

  const doc = frame(opts.reportName, opts.generatedOn, children);
  return Packer.toBuffer(doc);
}

/** San’atkorlar yoki mas’ul ijrochilar ro‘yxati. */
export async function buildPeopleReport(
  kind: "artists" | "responsibles",
  events: EventRow[],
  regions: Region[],
  opts: EventsReportOptions,
): Promise<Buffer> {
  const regionOrder = new Map(regions.map((r) => [r.id, r.sort_order]));
  const sorted = events
    .slice()
    .sort((a, b) => (regionOrder.get(a.region_id) ?? 0) - (regionOrder.get(b.region_id) ?? 0) || sortEvents(a, b));

  const rows: (string[] | string)[][] = [];
  let n = 0;
  for (const e of sorted) {
    const where = [e.region?.name, e.district?.name].filter(Boolean) as string[];
    const when = e.start_date ? fmtDate(e.start_date) : "—";
    if (kind === "artists") {
      for (const a of e.artists ?? []) {
        rows.push([String(++n), where, a.artist_name, ARTIST_TYPE_LABELS[a.artist_type], a.performance_type || "—", e.address || "—", when]);
      }
    } else {
      for (const r of (e.responsibles ?? []).slice().sort((x, y) => Number(y.is_primary) - Number(x.is_primary))) {
        rows.push([String(++n), where, r.full_name, r.position, formatPhone(r.phone), e.address || "—", when]);
      }
    }
  }

  const widths = kind === "artists" ? [480, 2700, 3000, 1500, 2300, 3300, 1850] : [480, 2700, 3000, 2600, 1800, 2900, 1650];
  const headers =
    kind === "artists"
      ? ["№", "Hudud", "San’atkor / ijodiy jamoa", "Turi", "Ijro yo‘nalishi", "Tadbir manzili", "Sana"]
      : ["№", "Hudud", "F.I.Sh.", "Lavozimi", "Telefon raqami", "Tadbir manzili", "Sana"];

  const children: (Paragraph | Table)[] = [
    ...titleBlock(opts.subtitleLines),
    para(kind === "artists" ? "San’atkorlar va ijodiy jamoalar ro‘yxati" : "Mas’ul ijrochilar ro‘yxati", {
      bold: true, size: 26, align: AlignmentType.CENTER, after: 120, keepNext: true,
    }),
    rows.length ? makeTable(widths, headers, rows) : para(EMPTY_TEXT, { italics: true, size: 24, align: AlignmentType.CENTER }),
  ];
  return Packer.toBuffer(frame(opts.reportName, opts.generatedOn, children));
}
