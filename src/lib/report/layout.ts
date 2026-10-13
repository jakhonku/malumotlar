/**
 * Word jadval ustunlari kengligini mazmunga qarab hisoblaydi.
 * Maqsad: qisqa ma'lumotli ustunlar (sana, telefon, №) tor, uzun matnli ustunlar keng bo'lsin;
 * hech bir so'z o'rtasidan uzilmasin; jami kenglik sahifaga aynan sig'sin.
 */

export type CellText = string | string[];

const flat = (c: CellText): string[] => (Array.isArray(c) ? c : [c]).flatMap((s) => String(s ?? "").split(/\r?\n/));

/** Shrift o'lchamini (yarim punkt) ustunlar soni va umumiy matn hajmiga qarab tanlaydi. */
export function pickFontSize(columns: number, rows: CellText[][]): number {
  const avgLen = rows.length ? rows.reduce((a, r) => a + r.reduce((b, c) => b + flat(c).join(" ").length, 0), 0) / rows.length : 0;
  let size = columns > 11 ? 16 : columns > 9 ? 17 : columns > 7 ? 18 : 20;
  if (avgLen / Math.max(columns, 1) > 70) size -= 1; // juda uzun matnlarda biroz kichraytiriladi
  return Math.max(size, 16);
}

export function autoWidths(
  headers: string[],
  rows: CellText[][],
  total: number,
  size: number,
  fixed: (number | null)[] = [],
): number[] {
  const n = headers.length;
  const charW = size * 5.4; // bir belgi o'rtacha kengligi (twip), Times New Roman
  const pad = 170; // katak ichki chetlari
  const widths = new Array<number>(n).fill(0);
  const min = new Array<number>(n).fill(0);
  const want = new Array<number>(n).fill(0);

  for (let c = 0; c < n; c++) {
    if (fixed[c] != null) {
      widths[c] = fixed[c] as number;
      continue;
    }
    const headLines = flat(headers[c]);
    let longestWord = Math.max(...headLines.flatMap((l) => l.split(/\s+/)).map((w) => w.length), 3);
    let maxLine = 0;
    let sum = 0;
    for (const r of rows) {
      for (const line of flat(r[c] ?? "")) {
        sum += line.length;
        maxLine = Math.max(maxLine, line.length);
        for (const w of line.split(/\s+/)) longestWord = Math.max(longestWord, Math.min(w.length, 22));
      }
    }
    const avg = rows.length ? sum / rows.length : 0;
    min[c] = Math.round(Math.min(longestWord, 22) * charW * 1.05 + pad);
    // ideal: bir-ikki qatorga sig'adigan kenglik — o'rtacha va eng uzun orasidagi qiymat
    const ideal = Math.min(maxLine, Math.max(avg * 1.25, headLines.join(" ").length * 0.6), 70);
    want[c] = Math.max(min[c], Math.round(ideal * charW + pad));
  }

  const fixedSum = widths.reduce((a, b) => a + b, 0);
  const free = total - fixedSum;
  const idx = [...Array(n).keys()].filter((c) => fixed[c] == null);
  const minSum = idx.reduce((a, c) => a + min[c], 0);

  if (minSum >= free) {
    // juda ko'p ustun: minimumlarni nisbatan qisqartiramiz
    for (const c of idx) widths[c] = Math.floor((min[c] / minSum) * free);
  } else {
    const wantSum = idx.reduce((a, c) => a + want[c], 0);
    if (wantSum <= free) {
      // bo'sh joy bor: ustunlarni "ideal"ga mutanosib cho'zamiz
      for (const c of idx) widths[c] = Math.floor((want[c] / wantSum) * free);
    } else {
      // joy yetmaydi: minimumdan boshlab, "ideal"ga yetmagan ulushni mutanosib taqsimlaymiz
      const extra = free - minSum;
      const need = idx.reduce((a, c) => a + (want[c] - min[c]), 0) || 1;
      for (const c of idx) widths[c] = Math.floor(min[c] + ((want[c] - min[c]) / need) * extra);
    }
  }

  // yig'indini aynan total ga tenglash (oxirgi o'zgaruvchan ustun hisobiga)
  const diff = total - widths.reduce((a, b) => a + b, 0);
  const last = idx[idx.length - 1];
  if (last !== undefined) widths[last] += diff;
  return widths;
}

/** Juda uzun katakli qator sahifalar orasida bo'linishiga ruxsat beriladi (aks holda bo'sh joy qoladi). */
export const rowCanSplit = (cells: CellText[]): boolean => cells.some((c) => flat(c).join(" ").length > 450);
