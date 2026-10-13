import { AlignmentType, ImageRun, Paragraph, TextRun } from "docx";
import { DEPARTMENT_NAME, MINISTRY_FULL } from "../brand";
import { LOGO_ASPECT, LOGO_PNG_BASE64 } from "./logo";

const FONT = "Times New Roman";

/** Hisobot boshidagi rasmiy blok: gerb, vazirlik nomi va bo‘lim nomi. */
export function brandBlock(): Paragraph[] {
  const h = 62; // piksel balandligi (Word'da ~1.6 sm)
  return [
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 80 },
      children: [
        new ImageRun({
          type: "png",
          data: Buffer.from(LOGO_PNG_BASE64, "base64"),
          transformation: { width: Math.round(h * LOGO_ASPECT), height: h },
          altText: { title: "Madaniyat vazirligi gerbi", description: "O‘zbekiston Respublikasi Madaniyat vazirligi gerbi", name: "gerb" },
        }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 40 },
      children: [new TextRun({ text: MINISTRY_FULL, font: FONT, size: 28, bold: true })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 120 },
      children: [new TextRun({ text: DEPARTMENT_NAME, font: FONT, size: 24, italics: true })],
    }),
  ];
}
