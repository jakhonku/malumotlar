import { z } from "zod";
import { normalizePhone } from "./phone";

export const FIELD_TYPES = ["text", "textarea", "number", "date", "time", "phone", "select", "multiselect", "checkbox", "rows"] as const;
export const COLUMN_TYPES = ["text", "number", "phone", "select"] as const;
export type ColumnType = (typeof COLUMN_TYPES)[number];
export type FieldType = (typeof FIELD_TYPES)[number];

export const FIELD_TYPE_LABELS: Record<FieldType, string> = {
  text: "Qisqa matn",
  textarea: "Uzun matn",
  number: "Son",
  date: "Sana",
  time: "Vaqt",
  phone: "Telefon raqami",
  select: "Ro‘yxatdan bittasini tanlash",
  multiselect: "Ro‘yxatdan bir nechtasini tanlash",
  checkbox: "Ha / Yo‘q",
  rows: "Qatorlar ro‘yxati (har bir qatorda bir nechta katak)",
};

export const COLUMN_TYPE_LABELS: Record<ColumnType, string> = {
  text: "Matn",
  number: "Son",
  phone: "Telefon",
  select: "Ro‘yxatdan tanlash",
};

export interface ColumnDef {
  key: string;
  label: string;
  type: ColumnType;
  required?: boolean;
  options?: string[];
}

export interface FieldDef {
  key: string;
  label: string;
  type: FieldType;
  required: boolean;
  help?: string;
  options?: string[];
  /** type === "rows" bo‘lganda: har bir qatordagi kataklar */
  columns?: ColumnDef[];
  /** type === "date": shu kalitli sanadan oldin bo‘lmasin (masalan, tugash sanasi ≥ boshlanish sanasi) */
  notBefore?: string;
}

export type RowObj = Record<string, string | number | null>;
export type AnswerValue = string | number | boolean | string[] | RowObj[] | null;
export type Answers = Record<string, AnswerValue>;

export interface CollectionRow {
  id: string;
  title: string;
  description: string | null;
  entry_label: string;
  audience: "regional" | "district" | "both";
  fields: FieldDef[];
  allow_multiple: boolean;
  is_active: boolean;
  deadline: string | null;
  created_at: string;
}

export interface EntryRow {
  id: string;
  collection_id: string;
  region_id: string;
  district_id: string | null;
  scope: "regional" | "district";
  answers: Answers;
  status: "draft" | "submitted" | "revision" | "approved";
  review_comment: string | null;
  submitted_at: string | null;
  approved_at: string | null;
  created_at: string;
  updated_at: string;
  region?: { name: string } | null;
  district?: { name: string } | null;
}

export const AUDIENCE_LABELS = {
  both: "Viloyat boshqarmasi va uning tuman/shaharlari",
  regional: "Faqat viloyat boshqarmasi (tumanlarsiz)",
  district: "Faqat tuman/shaharlar",
} as const;

const CYR: Record<string, string> = { ʻ: "", "‘": "", "’": "", "'": "", "`": "" };

/** Maydon nomidan barqaror kalit yasaydi: «Mas’ul F.I.Sh.» → «masul_f_i_sh». */
export function slugKey(label: string): string {
  const s = label
    .toLowerCase()
    .replace(/[ʻ‘’'`]/g, (c) => CYR[c] ?? "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return (s || "maydon").slice(0, 40);
}

export const columnDefSchema = z
  .object({
    key: z.string().regex(/^[a-z0-9_]{1,40}$/, "Katak kaliti noto‘g‘ri"),
    label: z.string().trim().min(1, "Katak nomini yozing").max(120),
    type: z.enum(COLUMN_TYPES),
    required: z.boolean().optional(),
    options: z.array(z.string().trim().min(1).max(120)).max(100).optional(),
  })
  .superRefine((c, ctx) => {
    if (c.type === "select" && (c.options?.length ?? 0) < 2) {
      ctx.addIssue({ code: "custom", path: ["options"], message: `«${c.label}» katagi uchun kamida 2 ta variant kiriting` });
    }
  });

export const fieldDefSchema = z
  .object({
    key: z.string().regex(/^[a-z0-9_]{1,40}$/, "Maydon kaliti noto‘g‘ri"),
    label: z.string().trim().min(2, "Maydon nomini yozing").max(200),
    type: z.enum(FIELD_TYPES),
    required: z.boolean(),
    help: z.string().trim().max(300).optional(),
    options: z.array(z.string().trim().min(1).max(120)).max(100).optional(),
    columns: z.array(columnDefSchema).max(8).optional(),
    notBefore: z.string().regex(/^[a-z0-9_]{1,40}$/).optional(),
  })
  .superRefine((f, ctx) => {
    if ((f.type === "select" || f.type === "multiselect") && (f.options?.length ?? 0) < 2) {
      ctx.addIssue({ code: "custom", path: ["options"], message: `«${f.label}» uchun kamida 2 ta variant kiriting` });
    }
    if (f.type === "rows") {
      if (!f.columns?.length) ctx.addIssue({ code: "custom", path: ["columns"], message: `«${f.label}» uchun kamida bitta katak qo‘shing` });
      const seen = new Set<string>();
      for (const c of f.columns ?? []) {
        if (seen.has(c.key)) ctx.addIssue({ code: "custom", path: ["columns"], message: `«${f.label}»: katak nomi takrorlangan` });
        seen.add(c.key);
      }
    }
  });

export const collectionInputSchema = z
  .object({
    title: z.string().trim().min(3, "Nomini kiriting (kamida 3 belgi)").max(160),
    description: z.string().trim().max(2000).optional(),
    entry_label: z.string().trim().min(2, "Yozuv nomini kiriting (masalan: Tadbir)").max(40),
    audience: z.enum(["regional", "district", "both"]),
    allow_multiple: z.boolean(),
    is_active: z.boolean(),
    deadline: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
    fields: z.array(fieldDefSchema).min(1, "Kamida bitta maydon qo‘shing").max(60),
  })
  .superRefine((v, ctx) => {
    const seen = new Set<string>();
    v.fields.forEach((f, i) => {
      if (seen.has(f.key)) ctx.addIssue({ code: "custom", path: ["fields", i, "key"], message: `«${f.label}» nomi takrorlangan` });
      seen.add(f.key);
    });
  });

export type CollectionInput = z.infer<typeof collectionInputSchema>;

const TIME_RE = /^\d{2}:\d{2}(:\d{2})?$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export const isBlank = (v: unknown) =>
  v === undefined || v === null || v === "" || (Array.isArray(v) && v.length === 0) || v === false;

type Scalar = { type: FieldType | ColumnType; options?: string[] };

/** Bitta qiymatni turiga qarab tekshiradi va normallashtiradi. Xato bo‘lsa — matn qaytaradi. */
function checkScalar(def: Scalar, v: unknown): { value: string | number | boolean | string[] } | { error: string } {
  switch (def.type) {
    case "text":
    case "textarea": {
      const s = String(v).trim();
      if (s.length > (def.type === "text" ? 500 : 5000)) return { error: "Matn juda uzun" };
      return { value: s };
    }
    case "number": {
      const n = typeof v === "number" ? v : Number(String(v).replace(/\s/g, "").replace(",", "."));
      return Number.isFinite(n) ? { value: n } : { error: "Son kiriting" };
    }
    case "date":
      return DATE_RE.test(String(v)) && !Number.isNaN(Date.parse(String(v))) ? { value: String(v) } : { error: "Sanani tanlang" };
    case "time":
      return TIME_RE.test(String(v)) ? { value: String(v).slice(0, 5) } : { error: "Vaqtni tanlang" };
    case "phone": {
      const p = normalizePhone(String(v));
      return p ? { value: p } : { error: "Telefon raqami noto‘g‘ri. Namuna: +998 90 123 45 67" };
    }
    case "select":
      return def.options?.includes(String(v)) ? { value: String(v) } : { error: "Ro‘yxatdan tanlang" };
    case "multiselect": {
      const arr = Array.isArray(v) ? v.map(String) : [];
      return arr.some((x) => !def.options?.includes(x)) ? { error: "Ro‘yxatdan tanlang" } : { value: arr };
    }
    default:
      return { value: String(v) };
  }
}

/** Eski ma’lumot (matn) bo‘lsa, har bir qatorni birinchi katakka joylaydi. */
function coerceRows(v: unknown, columns: ColumnDef[]): Record<string, unknown>[] {
  if (Array.isArray(v)) return v.filter((x): x is Record<string, unknown> => !!x && typeof x === "object");
  if (typeof v === "string" && v.trim() && columns[0]) {
    return v.split(/\r?\n/).map((l) => l.trim()).filter(Boolean).map((l) => ({ [columns[0].key]: l }));
  }
  return [];
}

/**
 * Javoblarni maydon ta’riflariga muvofiq tekshiradi va normallashtiradi.
 * partial=true (qoralama) — majburiylik tekshirilmaydi, lekin kiritilgan qiymat to‘g‘ri bo‘lishi shart.
 */
export function validateAnswers(
  fields: FieldDef[],
  raw: Record<string, unknown>,
  partial = false,
): { ok: boolean; values: Answers; errors: Record<string, string> } {
  const values: Answers = {};
  const errors: Record<string, string> = {};

  for (const f of fields) {
    const v = raw?.[f.key];

    if (f.type === "rows") {
      const cols = f.columns ?? [];
      const out: RowObj[] = [];
      let err: string | null = null;
      coerceRows(v, cols).forEach((row, i) => {
        const cleaned: RowObj = {};
        let any = false;
        for (const c of cols) {
          const cv = row[c.key];
          if (isBlank(cv)) {
            cleaned[c.key] = null;
            continue;
          }
          const r = checkScalar(c, cv);
          if ("error" in r) err ??= `${i + 1}-qator, «${c.label}»: ${r.error}`;
          else {
            cleaned[c.key] = r.value as string | number;
            any = true;
          }
        }
        if (!any) return; // butunlay bo‘sh qator tashlab yuboriladi
        for (const c of cols) {
          if (c.required && !partial && cleaned[c.key] === null) err ??= `${i + 1}-qator, «${c.label}» to‘ldirilmagan`;
        }
        out.push(cleaned);
      });
      values[f.key] = out;
      if (err) errors[f.key] = err;
      else if (f.required && !partial && out.length === 0) errors[f.key] = "Kamida bitta qator to‘ldiring";
      continue;
    }

    const empty = f.type === "checkbox" ? v === undefined || v === null || v === "" : isBlank(v);
    if (empty) {
      values[f.key] = f.type === "checkbox" ? false : null;
      if (f.required && !partial && (f.type !== "checkbox" || v !== true)) {
        errors[f.key] = f.type === "checkbox" ? "Tasdiqlash (belgilash) shart" : "Bu maydonni to‘ldiring";
      }
      continue;
    }

    if (f.type === "checkbox") {
      values[f.key] = v === true || v === "true" || v === "on";
      if (f.required && !partial && values[f.key] !== true) errors[f.key] = "Tasdiqlash (belgilash) shart";
      continue;
    }
    const r = checkScalar(f, v);
    if ("error" in r) errors[f.key] = r.error;
    else values[f.key] = r.value;
  }
  // sanalar tartibi: «tugash sanasi boshlanishdan oldin bo‘lmasin»
  for (const f of fields) {
    if (f.type !== "date" || !f.notBefore || errors[f.key]) continue;
    const other = fields.find((x) => x.key === f.notBefore);
    const a = values[f.key];
    const b = values[f.notBefore];
    if (other && typeof a === "string" && typeof b === "string" && a < b) {
      errors[f.key] = `«${f.label}» «${other.label}» dan oldin bo‘lmasin`;
    }
  }
  return { ok: Object.keys(errors).length === 0, values, errors };
}

/** Javobni matn ko‘rinishiga aylantiradi (jadval, Word, Excel uchun). */
export function displayValue(f: FieldDef, v: AnswerValue | undefined): string {
  if (v === null || v === undefined || v === "") return "";
  if (f.type === "rows") {
    const cols = f.columns ?? [];
    const rows = coerceRows(v, cols);
    return rows
      .map((r, i) => {
        const parts = cols
          .map((c) => {
            const cv = r[c.key];
            if (cv === null || cv === undefined || cv === "") return "";
            const text = c.type === "phone" ? displayValue({ ...c, required: false, type: "phone" } as unknown as FieldDef, cv as string) : String(cv);
            return cols.length > 1 && c.type === "number" ? `${text} (${c.label.toLowerCase()})` : text;
          })
          .filter(Boolean);
        return parts.length ? (rows.length > 1 ? `${i + 1}) ${parts.join(" — ")}` : parts.join(" — ")) : "";
      })
      .filter(Boolean)
      .join("\n");
  }
  switch (f.type) {
    case "checkbox":
      return v ? "Ha" : "Yo‘q";
    case "multiselect":
      return Array.isArray(v) ? v.join(", ") : String(v);
    case "date": {
      const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(v));
      return m ? `${m[3]}.${m[2]}.${m[1]}` : String(v);
    }
    case "phone": {
      const m = /^\+998(\d{2})(\d{3})(\d{2})(\d{2})$/.exec(String(v));
      return m ? `+998 ${m[1]} ${m[2]} ${m[3]} ${m[4]}` : String(v);
    }
    default:
      return String(v);
  }
}

/** «Yangi yil tadbirlari» shabloni — administrator bir bosishda yaratib, keyin o‘zgartira oladi. */
export function newYearTemplate(): CollectionInput {
  const f = (label: string, type: FieldType, required: boolean, extra: Partial<FieldDef> = {}): FieldDef => ({
    key: slugKey(label), label, type, required, ...extra,
  });
  return {
    title: "Yangi yil tadbirlari",
    description: "Yangi yil bayrami munosabati bilan o‘tkaziladigan tadbirlar qayerda va qachon o‘tishi haqida ma’lumot.",
    entry_label: "Tadbir",
    audience: "both",
    allow_multiple: false,
    is_active: true,
    deadline: null,
    fields: [
      f("Tadbir o‘tkaziladigan manzil", "text", true, { help: "Viloyat, tuman, ko‘cha, uy yoki mo‘ljal" }),
      f("Tadbir boshlanish sanasi", "date", true),
      f("Tadbir tugash sanasi", "date", true, { help: "Bir kunlik tadbirda boshlanish sanasi bilan bir xil", notBefore: "tadbir_boshlanish_sanasi" }),
      f("San’atkorlar va ijodiy jamoalar", "rows", false, {
        help: "Har bir san’atkor yoki jamoa uchun alohida qator qo‘shing",
        columns: [
          { key: "nomi", label: "F.I.Sh. yoki jamoa nomi", type: "text", required: true },
          { key: "unvoni", label: "Unvoni", type: "text" },
        ],
      }),
      f("Ishtirokchilar", "rows", false, {
        help: "Ishtirokchi guruh yoki tashkilotlar",
        columns: [
          { key: "nomi", label: "Guruh yoki tashkilot nomi", type: "text", required: true },
          { key: "soni", label: "Soni", type: "number" },
        ],
      }),
      f("Mas’ul ijrochi F.I.Sh.", "text", true),
      f("Mas’ul ijrochi lavozimi", "text", true),
      f("Mas’ul ijrochi telefoni", "phone", true),
    ],
  };
}


/**
 * Jadval ustunlari tartibini avtomatik tartiblaydi (qisqa maydonlar oldinda, uzun/qatorli maydonlar oxirda;
 * tugash sanasi har doim boshlanish sanasidan keyin). Tartib barqaror: bir xil darajadagi maydonlar o‘z joyida qoladi.
 */
export function autoArrangeFields<T extends { key: string; type: FieldType; notBefore?: string }>(fields: T[]): T[] {
  const rank = (f: T) => (f.type === "rows" ? 3 : f.type === "textarea" || f.type === "multiselect" ? 2 : 1);
  const out = fields.map((f, i) => ({ f, i })).sort((a, b) => rank(a.f) - rank(b.f) || a.i - b.i).map((x) => x.f);
  // bog‘liq sana: «notBefore» ko‘rsatgan maydondan keyin tursin
  for (let guard = 0; guard < out.length; guard++) {
    let moved = false;
    for (let i = 0; i < out.length; i++) {
      const dep = out[i].notBefore;
      if (!dep) continue;
      const j = out.findIndex((x) => x.key === dep);
      if (j > i) {
        const [f] = out.splice(i, 1);
        out.splice(j, 0, f); // j endi bir oldinga surilgan: f aynan bog‘liq maydondan keyin tushadi
        moved = true;
        break;
      }
    }
    if (!moved) break;
  }
  return out;
}

/** «Tadbir (umumiy)» shabloni — istalgan bayram, festival yoki aksiya uchun. */
export function eventTemplate(): CollectionInput {
  const f = (label: string, type: FieldType, required: boolean, extra: Partial<FieldDef> = {}): FieldDef => ({ key: slugKey(label), label, type, required, ...extra });
  return {
    title: "", description: "", entry_label: "Tadbir", audience: "both", allow_multiple: false, is_active: true, deadline: null,
    fields: [
      f("Tadbir nomi", "text", true),
      f("O‘tkaziladigan manzil", "text", true),
      f("Boshlanish sanasi", "date", true),
      f("Tugash sanasi", "date", true, { notBefore: "boshlanish_sanasi" }),
      f("Ishtirokchilar soni", "number", false),
      f("Mas’ul ijrochi F.I.Sh.", "text", true),
      f("Mas’ul ijrochi telefoni", "phone", true),
    ],
  };
}

/** «Statistika (sonlar)» shabloni — hududdagi muassasalar yoki ko‘rsatkichlar sonini yig‘ish uchun. */
export function statsTemplate(): CollectionInput {
  const f = (label: string, type: FieldType, required: boolean, extra: Partial<FieldDef> = {}): FieldDef => ({ key: slugKey(label), label, type, required, ...extra });
  return {
    title: "", description: "", entry_label: "Ko‘rsatkich", audience: "both", allow_multiple: false, is_active: true, deadline: null,
    fields: [
      f("Madaniyat markazlari soni", "number", true),
      f("Kutubxonalar soni", "number", true),
      f("Teatr va muzeylar soni", "number", true),
      f("Izoh", "textarea", false),
      f("Mas’ul ijrochi F.I.Sh.", "text", true),
      f("Mas’ul ijrochi telefoni", "phone", true),
    ],
  };
}
