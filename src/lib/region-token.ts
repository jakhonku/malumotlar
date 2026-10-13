import "server-only";
import { createHmac } from "node:crypto";

/**
 * Viloyat mas'uli akkaunti uchun barqaror «hudud havolasi» tokeni: server sirli kalit bilan hisoblaydi,
 * shuning uchun mas'ul qayta kirganda doim o'z yozuvlariga qaytadi. Boshqa viloyat uchun hisoblab bo'lmaydi.
 */
export function deriveToken(collectionId: string, regionId: string): string {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY sozlanmagan");
  return createHmac("sha256", key).update(`rm:${collectionId}:${regionId}`).digest("hex").slice(0, 48);
}
