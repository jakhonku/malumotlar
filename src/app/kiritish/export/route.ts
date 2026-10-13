import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCollection, getEntryGroup, UUID_RE } from "@/lib/public-collection";
import { buildCollectionDocx, buildCollectionXlsx } from "@/lib/report/collection";
import { STATUS_LABELS } from "@/lib/constants";
import { fmtDate } from "@/lib/format";
import type { District, Region } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

const slug = (s: string) => s.replace(/[‘’ʻ'`]/g, "").replace(/[^A-Za-z0-9]+/g, "_").replace(/^_+|_+$/g, "");

/** Hudud o'zi kiritgan jadvalni yuklab olish (hudud havolasi bilan; faqat o'z yozuvlari). */
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const cid = sp.get("c") ?? "";
  const token = sp.get("t") ?? "";
  const format = sp.get("format") === "xlsx" ? "xlsx" : "docx";
  if (!UUID_RE.test(cid)) return NextResponse.json({ error: "Noto‘g‘ri so‘rov" }, { status: 400 });
  const col = await getCollection(cid);
  const group = col ? await getEntryGroup(cid, token) : null;
  if (!col || !group) return NextResponse.json({ error: "Havola noto‘g‘ri" }, { status: 404 });

  const admin = createAdminClient();
  const [{ data: reg }, { data: ds }] = await Promise.all([
    admin.from("regions").select("*").eq("id", group.regionId).single(),
    admin.from("districts").select("*").eq("region_id", group.regionId).order("district_type", { ascending: false }).order("name").limit(500),
  ]);
  const regions = (reg ? [reg] : []) as Region[];
  const districts = (ds ?? []) as District[];
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tashkent" }).format(new Date());
  const entries = group.entries;
  const statuses = [...new Set(entries.map((e) => e.status))];
  const unitName = group.groupMode === "region" ? "" : group.districtName ?? "";

  const buffer =
    format === "xlsx"
      ? await buildCollectionXlsx(col, entries, regions, districts)
      : await buildCollectionDocx(col, entries, regions, districts, {
          subtitleLines: [[group.regionName, unitName].filter(Boolean).join(", "), `Holati: ${statuses.map((s) => STATUS_LABELS[s]).join(", ")}`],
          emptyMode: "hide", generatedOn: fmtDate(today), showStatus: false, layout: "single",
        });

  const filename = `${slug(col.title) || "hisobot"}_${slug(group.regionName)}${unitName ? "_" + slug(unitName) : ""}_${today}.${format}`;
  const type = format === "xlsx" ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" : "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": type,
      "Content-Disposition": `attachment; filename="${filename}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
      "Cache-Control": "no-store",
    },
  });
}
