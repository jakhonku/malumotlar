import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

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
