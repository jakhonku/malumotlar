import { z } from "zod";
import { normalizePhone } from "./phone";

const optionalText = z.string().trim().max(2000).optional().or(z.literal(""));

export const artistSchema = z.object({
  artist_name: z.string().trim().min(2, "San’atkor yoki jamoa nomini kiriting"),
  artist_type: z.enum(["artist", "group"]),
  performance_type: optionalText,
  role_description: optionalText,
  notes: optionalText,
});

export const participantSchema = z.object({
  participant_name: z.string().trim().min(2, "Ishtirokchi yoki tashkilot nomini kiriting"),
  participant_category: optionalText,
  participant_count: z
    .union([z.literal(""), z.coerce.number().int("Butun son kiriting").min(0, "Manfiy bo‘lmasin")])
    .optional(),
  participation_role: optionalText,
  notes: optionalText,
});

export const responsibleSchema = z.object({
  full_name: z.string().trim().min(3, "F.I.Sh. ni to‘liq kiriting"),
  position: z.string().trim().min(2, "Lavozimni kiriting"),
  organization: optionalText,
  phone: z
    .string()
    .trim()
    .transform((v, ctx) => {
      const n = normalizePhone(v);
      if (!n) {
        ctx.addIssue({ code: "custom", message: "Telefon raqami noto‘g‘ri. Namuna: +998 90 123 45 67" });
        return z.NEVER;
      }
      return n;
    }),
  is_primary: z.boolean(),
  notes: optionalText,
});

const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Sanani tanlang");

const base = {
  scope: z.enum(["regional", "district"]),
  region_id: z.string().optional(),
  district_id: z.string().optional(),
  new_district_name: z.string().trim().max(120).optional(),
  new_district_type: z.enum(["tuman", "shahar"]).optional(),
  description: optionalText,
  organization_name: optionalText,
  notes: optionalText,
  location_note: optionalText,
  artists: z.array(artistSchema),
  participants: z.array(participantSchema),
};

/** Qoralama: faqat nom majburiy, qolgan asosiy maydonlar bo‘sh bo‘lishi mumkin. */
export const draftSchema = z
  .object({
    ...base,
    title: optionalText,
    event_type: optionalText,
    address: optionalText,
    start_date: z.string().optional(),
    end_date: z.string().optional(),
    responsibles: z.array(responsibleSchema),
  })
  .superRefine(checkDates);

/** To‘liq tekshiruv — yuborishdan oldin. */
export const submitSchema = z
  .object({
    ...base,
    title: optionalText,
    event_type: optionalText,
    address: z.string().trim().min(5, "Tadbir o‘tkaziladigan manzilni to‘liq kiriting"),
    start_date: dateStr,
    end_date: z.union([dateStr, z.literal('')]).optional(),
    responsibles: z.array(responsibleSchema).min(1, "Kamida bitta mas’ul ijrochi kiriting"),
  })
  .superRefine(checkDates)
  .superRefine((v, ctx) => {
    if (v.responsibles.filter((r) => r.is_primary).length !== 1) {
      ctx.addIssue({ code: "custom", path: ["responsibles"], message: "Aynan bitta asosiy mas’ul ijrochi belgilang" });
    }
  });

function checkDates(
  v: { scope?: string; district_id?: string; new_district_name?: string; start_date?: string; end_date?: string },
  ctx: z.RefinementCtx,
) {
  if (v.start_date && v.end_date && v.end_date < v.start_date) {
    ctx.addIssue({ code: "custom", path: ["end_date"], message: "Tugash sanasi boshlanish sanasidan oldin bo‘lmasin" });
  }
  if (v.scope === "district" && (!v.district_id || v.district_id === "__new__") && !(v.new_district_name && v.new_district_name.trim().length >= 3)) {
    ctx.addIssue({ code: "custom", path: ["district_id"], message: "Tuman/shaharni tanlang yoki nomini yozing" });
  }
}

/** Formadagi qiymatlar (kiritish holati, transformlardan oldin). */
export interface EventFormValues {
  scope: "regional" | "district";
  region_id?: string;
  district_id?: string;
  new_district_name?: string;
  new_district_type?: "tuman" | "shahar";
  title: string;
  event_type: string;
  description: string;
  organization_name: string;
  notes: string;
  address: string;
  location_note: string;
  start_date: string;
  /** bo‘sh bo‘lsa — bir kunlik tadbir */
  end_date: string;
  artists: {
    artist_name: string;
    artist_type: "artist" | "group";
    performance_type: string;
    role_description: string;
    notes: string;
  }[];
  participants: {
    participant_name: string;
    participant_category: string;
    participant_count: number | "";
    participation_role: string;
    notes: string;
  }[];
  responsibles: {
    full_name: string;
    position: string;
    organization: string;
    phone: string;
    is_primary: boolean;
    notes: string;
  }[];
}

export const returnReasonSchema = z.string().trim().min(3, "Sababni yozing (kamida 3 belgi)").max(1000);

export const userCreateSchema = z
  .object({
    username: z
      .string()
      .trim()
      .toLowerCase()
      .regex(/^[a-z0-9._-]{3,40}$/, "Login: 3–40 ta lotin harf, raqam, nuqta, tire yoki pastki chiziq"),
    password: z.string().min(8, "Parol kamida 8 belgi bo‘lsin"),
    full_name: z.string().trim().min(3, "F.I.Sh. ni kiriting"),
    role: z.enum(["super_admin", "region_manager", "district_manager", "observer"]),
    region_id: z.string().uuid().nullable().optional(),
    district_id: z.string().uuid().nullable().optional(),
    phone: z.string().trim().optional(),
    can_edit_districts: z.boolean().optional(),
  })
  .superRefine((v, ctx) => {
    if ((v.role === "region_manager" || v.role === "district_manager") && !v.region_id)
      ctx.addIssue({ code: "custom", path: ["region_id"], message: "Viloyatni tanlang" });
  });
