import { AlignmentType, Document, PageBreak, Packer, Paragraph, TextRun } from "docx";

const FONT = "Times New Roman";
const t = (text: string, o: { size?: number; bold?: boolean; italics?: boolean } = {}) => new TextRun({ text, font: FONT, size: o.size ?? 24, bold: o.bold, italics: o.italics });
const p = (text: string, o: { size?: number; bold?: boolean; italics?: boolean; align?: (typeof AlignmentType)[keyof typeof AlignmentType]; after?: number } = {}) =>
  new Paragraph({ alignment: o.align, spacing: { after: o.after ?? 140 }, children: [t(text, o)] });

export interface LinkItem { org: string; url: string; until: string }

/** Har bir viloyat uchun alohida varaq: tezkor kirish havolasi (login-parolsiz). */
export async function buildLoginLinksDocx(items: LinkItem[], days: number): Promise<Buffer> {
  const sheets = items.flatMap((it, i) => [
    ...(i ? [new Paragraph({ children: [new PageBreak()] })] : []),
    p("O‘ZBEKISTON RESPUBLIKASI MADANIYAT VAZIRLIGI", { bold: true, align: AlignmentType.CENTER, size: 28 }),
    p("Madaniy-ommaviy tadbirlar va festivallarni tashkil etish bo‘limi", { italics: true, align: AlignmentType.CENTER, after: 360 }),
    p(it.org, { bold: true, align: AlignmentType.CENTER, size: 30, after: 360 }),
    p("Tadbirlar ma’lumotlarini yig‘ish tizimiga TEZKOR KIRISH HAVOLASI", { align: AlignmentType.CENTER, after: 300 }),
    p("Havolani brauzerda oching — login va parol so‘ralmasdan tizimga kirasiz:", { size: 26 }),
    p(it.url, { size: 24, bold: true, after: 300 }),
    p(`Havola ${days} kun amal qiladi: ${it.until} gacha (Toshkent vaqti). Muddat o‘tgach yoki vazirlik yangi havola yaratgach, bu havola ishlamaydi — shunda yangi havolani so‘rang.`, { bold: true, size: 24 }),
    p("Havolani faqat o‘z hududingiz mas’ul xodimiga yuboring: havolaga ega har kim tizimga sizning nomingizdan kira oladi. Havola boshqa odamga tushsa, vazirlikka xabar bering — u bekor qilinadi. Tizimga kirgach ishlayverasiz; havola faqat kirish uchun kerak.", { italics: true, size: 22 }),
  ]);
  const doc = new Document({
    styles: { default: { document: { run: { font: FONT, size: 24 } } } },
    sections: [{
      properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 1134, bottom: 1134, left: 1417, right: 850 } } },
      children: [
        p("VILOYATLAR UCHUN TEZKOR KIRISH HAVOLALARI", { bold: true, align: AlignmentType.CENTER, size: 30, after: 200 }),
        p("Maxfiy hujjat: har bir viloyatga faqat o‘z varag‘i yuboriladi (keyingi sahifalarda har biri alohida).", { italics: true, align: AlignmentType.CENTER, size: 22 }),
        ...items.map((it, i) => p(`${i + 1}. ${it.org} — ${it.until} gacha`, { size: 24 })),
        new Paragraph({ children: [new PageBreak()] }),
        ...sheets,
      ],
    }],
  });
  return Packer.toBuffer(doc);
}
