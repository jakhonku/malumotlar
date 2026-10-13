import { NextResponse, type NextRequest } from "next/server";
import { getProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getDistricts, getRegions } from "@/lib/queries";
import { buildCollectionDocx, buildCollectionXlsx } from "@/lib/report/collection";
import { AUDIENCE_LABELS, type CollectionRow, type EntryRow } from "@/lib/collections";
import { STATUS_LABELS, type EventStatus } from "@/lib/constants";
import { fmtDate } from "@/lib/format";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const STATUSES: EventStatus[] = ["draft", "submitted", "revision", "approved"];

const bad = (message: string, status = 400) => NextResponse.json({ error: message }, { status });
const slug = (s: string) => s.replace(/[‘’ʻ'`]/g, "").replace(/[^A-Za-z0-9]+/g, "_").replace(/^_+|_+$/g, "");

export async function GET(req: NextRequest) {
  const profile = await getProfile();
  if (!profile) return bad("Avval tizimga kiring", 401);
  if (profile.role === "district_manager") return bad("Ruxsat yo‘q", 403);

  const sp = req.nextUrl.searchParams;
  const id = sp.get("id") ?? "";
  const format = sp.get("format") === "xlsx" ? "xlsx" : "docx";
  if (!UUID.test(id)) return bad("Yig‘ish noto‘g‘ri");
  const emptyMode = sp.get("empty") === "mark" ? "mark" : "hide";
  const layout = sp.get("layout") === "grouped" ? "grouped" : "single";

  let statuses: EventStatus[] = ["approved"];
  if (profile.role === "super_admin" || profile.role === "region_manager") {
    const picked = (sp.get("status") ?? "").split(",").filter((s): s is EventStatus => (STATUSES as string[]).includes(s));
    if (picked.length) statuses = picked;
  }

  let region = sp.get("region") ?? "";
  if (profile.role === "region_manager") region = profile.region_id ?? "";
  if (region && !UUID.test(region)) return bad("Hudud noto‘g‘ri");

  const supabase = await createClient();
  const { data: colRaw } = await supabase.from("collections").select("*").eq("id", id).maybeSingle();
  if (!colRaw) return bad("Yig‘ish topilmadi", 404);
  const col = colRaw as CollectionRow;

  const entries: EntryRow[] = [];
  for (let from = 0; ; from += 1000) {
    let q = supabase
      .from("collection_entries")
      .select("*, region:regions(name), district:districts(name)")
      .eq("collection_id", id)
      .in("status", statuses);
    if (region) q = q.eq("region_id", region);
    const { data, error } = await q.order("created_at").range(from, from + 999);
    if (error) return bad("Ma’lumotlarni yuklab bo‘lmadi", 500);
    entries.push(...((data ?? []) as EntryRow[]));
    if (!data || data.length < 1000) break;
  }

  const [allRegions, allDistricts] = await Promise.all([getRegions(supabase), getDistricts(supabase)]);
  const regions = allRegions.filter((r) => (region ? r.id === region : true));
  const districts = allDistricts.filter((d) => (region ? d.region_id === region : true));

  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tashkent" }).format(new Date());
  const regionName = region ? regions[0]?.name : undefined;
  const subtitleLines = [
    regionName ?? "Respublika bo‘yicha barcha hududlar",
    `Kim to‘ldirgan: ${AUDIENCE_LABELS[col.audience]}`,
    `Holati: ${statuses.map((s) => STATUS_LABELS[s]).join(", ")}`,
  ];

  let buffer: Buffer;
  try {
    buffer =
      format === "xlsx"
        ? await buildCollectionXlsx(col, entries, allRegions, allDistricts)
        : await buildCollectionDocx(col, entries, regions, districts, {
            subtitleLines, emptyMode, layout, generatedOn: fmtDate(today), showStatus: !(statuses.length === 1 && statuses[0] === "approved"),
          });
  } catch {
    return bad("Faylni yaratishda xatolik yuz berdi", 500);
  }

  await supabase.rpc("log_export", { p_details: { kind: "collection", collection: id, format, region: region || null, statuses, entries: entries.length } });

  const filename = `${slug(col.title) || "hisobot"}${regionName ? "_" + slug(regionName) : ""}_${today}.${format}`;
  const type =
    format === "xlsx"
      ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      : "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": type,
      "Content-Disposition": `attachment; filename="${filename}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
      "Cache-Control": "no-store",
    },
  });
}
