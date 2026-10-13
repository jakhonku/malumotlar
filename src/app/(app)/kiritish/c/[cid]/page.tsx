import { redirect } from "next/navigation";
import { requireManager } from "@/lib/manager-guard";
import { getCollection, getEntryGroup, isOpen } from "@/lib/public-collection";
import { deriveToken } from "@/lib/region-token";

export const dynamic = "force-dynamic";

/** Ma'lumot yig'ish ochilganda: yozuvi bor bo'lsa jadvalga, bo'lmasa birinchi yozuvni kiritishga. */
export default async function CollectionEntry({ params }: { params: Promise<{ cid: string }> }) {
  const { cid } = await params;
  const me = await requireManager();
  const col = await getCollection(cid);
  if (!col || !isOpen(col)) redirect("/boshqarma");
  const token = deriveToken(col.id, me.region_id);
  if (await getEntryGroup(col.id, token)) redirect(`/kiritish/c/${col.id}/t/${token}`);
  redirect(
    col.audience === "regional"
      ? `/kiritish/c/${col.id}/yangi?region=${me.region_id}&scope=regional`
      : `/kiritish/c/${col.id}/yangi?region=${me.region_id}&mode=region`,
  );
}
