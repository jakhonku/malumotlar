import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { regionSelf } from "@/lib/brand";

import { SIGNED_BUCKET } from "@/lib/constants";
export const BUCKET = SIGNED_BUCKET;
export const MAX_PDF_BYTES = 20 * 1024 * 1024;
const SEP = "__";

let ready = false;
/** Maxfiy (private) saqlash joyini bir marta yaratadi: faqat PDF, 20 MB gacha. */
export async function ensureBucket() {
  if (ready) return;
  const admin = createAdminClient();
  const { data } = await admin.storage.getBucket(BUCKET);
  if (!data) {
    const { error } = await admin.storage.createBucket(BUCKET, { public: false, fileSizeLimit: MAX_PDF_BYTES, allowedMimeTypes: ["application/pdf"] });
    if (error && !/already exists/i.test(error.message)) throw new Error("Saqlash joyini yaratib bo‘lmadi");
  }
  ready = true;
}

/** unit: tuman id | "viloyat" | "boshqarma" */
export const signedPath = (collectionId: string, regionId: string, unit: string, byUserId?: string) =>
  `${collectionId}/${regionId}${SEP}${unit}${SEP}${Date.now()}${byUserId ? `${SEP}${byUserId}` : ""}.pdf`;

export interface SignedFile { path: string; regionId: string; unit: string; uploadedAt: Date; size: number; url: string; by: string | null }

export async function listSignedFiles(collectionId: string, filter?: { regionId?: string; unit?: string }): Promise<SignedFile[]> {
  await ensureBucket();
  const admin = createAdminClient();
  const { data } = await admin.storage.from(BUCKET).list(collectionId, { limit: 1000, sortBy: { column: "created_at", order: "desc" } });
  const items = (data ?? [])
    .map((f) => {
      const [regionId, unit, ts, by] = f.name.replace(/\.pdf$/, "").split(SEP);
      return { path: `${collectionId}/${f.name}`, regionId, unit, ts: Number(ts), by: /^[0-9a-f-]{36}$/i.test(by ?? "") ? by : null, size: (f.metadata as { size?: number } | null)?.size ?? 0 };
    })
    .filter((f) => f.regionId && f.unit && (!filter?.regionId || f.regionId === filter.regionId) && (!filter?.unit || f.unit === filter.unit));
  if (!items.length) return [];
  const { data: urls } = await admin.storage.from(BUCKET).createSignedUrls(items.map((i) => i.path), 3600);
  return items.map((i, idx) => ({
    path: i.path, regionId: i.regionId, unit: i.unit, size: i.size, by: i.by,
    uploadedAt: new Date(Number.isFinite(i.ts) ? i.ts : Date.now()), url: urls?.[idx]?.signedUrl ?? "",
  }));
}

const RETURNED = "returned";

/** Hududning joriy imzolangan PDF larini arxiv papkasiga ko‘chiradi (o‘chirilmaydi) — hudud qayta yuklashi kerak bo‘ladi. */
export async function archiveSignedFiles(collectionId: string, regionId: string): Promise<number> {
  const files = await listSignedFiles(collectionId, { regionId });
  const admin = createAdminClient();
  let n = 0;
  for (const f of files) {
    const { error } = await admin.storage.from(BUCKET).move(f.path, `${collectionId}/${RETURNED}/${f.path.split("/").pop()}`);
    if (!error) n++;
  }
  return n;
}

/** Vazirlik oxirgi marta qaytargan PDF haqida ma’lumot (sabab, vaqt). */
export async function getSignedReturn(collectionId: string, regionId: string): Promise<{ reason: string; at: Date } | null> {
  const admin = createAdminClient();
  const { data } = await admin.from("audit_logs").select("details,created_at")
    .eq("action", "signed.return").eq("entity_id", regionId).filter("details->>collection_id", "eq", collectionId)
    .order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (!data) return null;
  return { reason: String((data.details as { reason?: string }).reason ?? ""), at: new Date(data.created_at as string) };
}

export interface SignedReadiness {
  total: number;
  approved: number;
  missing: string[];
  waiting: number;
  ready: boolean;
  message: string | null;
  /** yozuvlardagi eng oxirgi o‘zgarish vaqti (PDF eskirganini aniqlash uchun) */
  lastChangeAt: Date | null;
}

/** Imzolangan PDF yuborish sharti: barcha hudud (viloyat + tuman/shaharlar) kiritilgan va vazirlik tomonidan TASDIQLANGAN bo‘lishi. */
export async function signedReadiness(collectionId: string, regionId: string): Promise<SignedReadiness> {
  const admin = createAdminClient();
  const [{ data: col }, { data: reg }, { data: ds }, { data: ents }] = await Promise.all([
    admin.from("collections").select("audience").eq("id", collectionId).maybeSingle(),
    admin.from("regions").select("name").eq("id", regionId).maybeSingle(),
    admin.from("districts").select("id,name").eq("region_id", regionId).eq("is_active", true).limit(500),
    admin.from("collection_entries").select("scope,district_id,status,updated_at").eq("collection_id", collectionId).eq("region_id", regionId).is("deleted_at", null).limit(2000),
  ]);
  const audience = (col?.audience ?? "both") as "both" | "regional" | "district";
  const entries = ents ?? [];
  const units = [
    ...(audience !== "district" ? [{ key: "regional", name: regionSelf(reg?.name ?? ""), has: (e: (typeof entries)[number]) => e.scope === "regional" }] : []),
    ...(audience !== "regional" ? (ds ?? []).map((d) => ({ key: d.id, name: d.name, has: (e: (typeof entries)[number]) => e.district_id === d.id })) : []),
  ];
  const missing = units.filter((u) => !entries.some(u.has)).map((u) => u.name);
  const approved = units.filter((u) => { const l = entries.filter(u.has); return l.length > 0 && l.every((e) => e.status === "approved"); }).length;
  const waiting = units.length - missing.length - approved;
  const ready = units.length > 0 && missing.length === 0 && waiting === 0;
  let message: string | null = null;
  if (!ready) {
    message = missing.length
      ? `Hali ma’lumoti kiritilmagan hududlar: ${missing.slice(0, 6).join(", ")}${missing.length > 6 ? ` va yana ${missing.length - 6} ta` : ""}.`
      : `${waiting} ta hudud ma’lumoti hali vazirlik tomonidan tasdiqlanmagan.`;
    message += " Imzolangan PDF ni barcha hudud ma’lumoti kiritilib, vazirlik tasdiqlagandan keyin yuborish mumkin.";
  }
  const lastChange = entries.reduce<number>((m, e) => Math.max(m, new Date(e.updated_at as string).getTime()), 0);
  return { total: units.length, approved, missing, waiting, ready, message, lastChangeAt: lastChange ? new Date(lastChange) : null };
}
