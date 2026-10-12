import "server-only";
import { createHash } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { TOKEN_RE } from "@/lib/public-event";
import type { CollectionRow, EntryRow } from "@/lib/collections";

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function getCollection(id: string): Promise<CollectionRow | null> {
  if (!UUID_RE.test(id)) return null;
  const { data } = await createAdminClient().from("collections").select("*").eq("id", id).maybeSingle();
  return (data as CollectionRow | null) ?? null;
}

export const isOpen = (c: CollectionRow) => c.is_active && (!c.deadline || c.deadline >= new Date().toISOString().slice(0, 10));

export interface EntryGroup {
  entries: EntryRow[];
  scope: "regional" | "district";
  regionId: string;
  districtId: string | null;
  regionName: string;
  districtName: string | null;
}

/** Hudud havolasi (token) bo'yicha shu yig'ishdagi barcha yozuvlar. */
export async function getEntryGroup(collectionId: string, token: string): Promise<EntryGroup | null> {
  if (!TOKEN_RE.test(token) || !UUID_RE.test(collectionId)) return null;
  const hash = createHash("sha256").update(token).digest("hex");
  const { data } = await createAdminClient()
    .from("collection_entries")
    .select("*, region:regions(name), district:districts(name)")
    .eq("collection_id", collectionId)
    .eq("edit_token_hash", hash)
    .is("deleted_at", null)
    .order("created_at");
  const entries = (data ?? []) as unknown as EntryRow[];
  if (!entries.length) return null;
  const f = entries[0];
  return {
    entries, scope: f.scope, regionId: f.region_id, districtId: f.district_id,
    regionName: f.region?.name ?? "", districtName: f.district?.name ?? null,
  };
}

export const unitLabel = (g: Pick<EntryGroup, "regionName" | "districtName" | "scope">) =>
  g.scope === "district" && g.districtName ? `${g.regionName} · ${g.districtName}` : `${g.regionName} (viloyatning o‘zi)`;
