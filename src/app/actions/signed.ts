"use server";

import { revalidatePath } from "next/cache";
import { getProfile } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { archiveSignedFiles } from "@/lib/signed-files";
import { returnReasonSchema } from "@/lib/validators";

/** Vazirlik administratori imzolangan PDF ni sabab bilan qaytaradi: hudud yangisini yuborishi kerak. */
export async function returnSignedPdf(collectionId: string, regionId: string, reason: string): Promise<{ ok: boolean; error?: string }> {
  const me = await getProfile();
  if (!me || me.role !== "super_admin") return { ok: false, error: "Bu amal faqat vazirlik administratori uchun" };
  const uuid = /^[0-9a-f-]{36}$/i;
  if (!uuid.test(collectionId) || !uuid.test(regionId)) return { ok: false, error: "So‘rov noto‘g‘ri" };
  const r = returnReasonSchema.safeParse(reason);
  if (!r.success) return { ok: false, error: r.error.issues[0].message };

  const moved = await archiveSignedFiles(collectionId, regionId);
  if (moved === 0) return { ok: false, error: "Qaytariladigan imzolangan PDF topilmadi" };
  await createAdminClient().from("audit_logs").insert({
    user_id: me.id, action: "signed.return", entity_type: "signed_pdf", entity_id: regionId,
    details: { collection_id: collectionId, reason: r.data, files: moved },
  });
  revalidatePath("/imzolangan");
  revalidatePath("/boshqarma");
  revalidatePath(`/collections/${collectionId}`);
  revalidatePath(`/collections/${collectionId}/hudud/${regionId}`);
  return { ok: true };
}
