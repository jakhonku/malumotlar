import { NextResponse, type NextRequest } from "next/server";
import { getProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getDistricts, getRegions, listAllEvents, type EventFilters } from "@/lib/queries";
import { buildEventsReport, buildPeopleReport, type EventsReportOptions } from "@/lib/report/docx";
import { STATUS_LABELS, type EventStatus } from "@/lib/constants";
import { fmtDate } from "@/lib/format";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

const TYPES = ["all", "region", "district", "regional", "districts", "period", "approved", "artists", "responsibles"] as const;
type ReportType = (typeof TYPES)[number];
const STATUSES: EventStatus[] = ["draft", "submitted", "revision", "approved"];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

function todayTashkent(): string {
  // en-CA → YYYY-MM-DD
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tashkent" }).format(new Date());
}

function slug(s: string): string {
  return s.replace(/[‘’ʻ'`]/g, "").replace(/[^A-Za-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}

function bad(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export async function GET(req: NextRequest) {
  const profile = await getProfile();
  if (!profile) return bad("Avval tizimga kiring", 401);

  const sp = req.nextUrl.searchParams;
  const type = (sp.get("type") ?? "all") as ReportType;
  if (!TYPES.includes(type)) return bad("Hisobot turi noto‘g‘ri");

  const regionParam = sp.get("region") ?? "";
  const districtParam = sp.get("district") ?? "";
  const from = sp.get("from") ?? "";
  const to = sp.get("to") ?? "";
  if (regionParam && !UUID.test(regionParam)) return bad("Hudud noto‘g‘ri");
  if (districtParam && !UUID.test(districtParam)) return bad("Tuman/shahar noto‘g‘ri");
  if ((from && !DATE.test(from)) || (to && !DATE.test(to))) return bad("Sana noto‘g‘ri");
  if (from && to && to < from) return bad("Tugash sanasi boshlanish sanasidan oldin bo‘lmasin");
  const emptyMode = sp.get("empty") === "mark" ? "mark" : "hide";
  const layout = sp.get("layout") === "grouped" ? "grouped" : "single";

  // Standart: faqat tasdiqlanganlar. Boshqa holatlarni faqat vazirlik admini va viloyat mas'uli tanlay oladi.
  let statuses: EventStatus[] = ["approved"];
  const statusParam = sp.get("status");
  if (statusParam && type !== "approved" && (profile.role === "super_admin" || profile.role === "region_manager")) {
    const picked = statusParam.split(",").filter((s): s is EventStatus => (STATUSES as string[]).includes(s));
    if (picked.length) statuses = picked;
  }

  const supabase = await createClient();
  const filters: EventFilters = { status: statuses };
  if (from) filters.from = from;
  if (to) filters.to = to;

  let region = regionParam;
  if (profile.role === "region_manager") region = profile.region_id ?? "";
  if (profile.role === "district_manager") {
    region = profile.region_id ?? "";
    filters.district = profile.district_id ?? undefined;
  }

  if (type === "region" && !region) return bad("Hududni tanlang");
  if (type === "district" && !districtParam && profile.role !== "district_manager") return bad("Tuman/shaharni tanlang");
  if (type === "period" && !from && !to) return bad("Sana oralig‘ini tanlang");

  if (region) filters.region = region;
  if (districtParam && profile.role !== "district_manager") filters.district = districtParam;
  if (type === "regional") filters.scope = "regional";
  if (type === "districts" || type === "district") filters.scope = "district";

  const [allRegions, allDistricts] = await Promise.all([getRegions(supabase), getDistricts(supabase)]);

  // district uchun viloyatni tumandan aniqlaymiz va moslikni tekshiramiz
  if (filters.district) {
    const d = allDistricts.find((x) => x.id === filters.district);
    if (!d) return bad("Tuman/shahar topilmadi", 404);
    if (region && d.region_id !== region) return bad("Tuman/shahar tanlangan hududga tegishli emas");
    filters.region = d.region_id;
  }

  let events;
  try {
    events = await listAllEvents(supabase, filters);
  } catch {
    return bad("Hisobot ma’lumotlarini yuklab bo‘lmadi", 500);
  }

  const regions = allRegions.filter((r) => (filters.region ? r.id === filters.region : true));
  const districts = allDistricts.filter((d) =>
    filters.district ? d.id === filters.district : filters.region ? d.region_id === filters.region : true,
  );
  const scopedDistricts = type === "regional" ? [] : districts;

  const regionName = filters.region ? regions[0]?.name : undefined;
  const districtName = filters.district ? districts[0]?.name : undefined;
  const today = todayTashkent();
  const generatedOn = fmtDate(today);

  const subtitleLines: string[] = [];
  if (districtName) subtitleLines.push(`${regionName}, ${districtName}`);
  else if (regionName) subtitleLines.push(regionName);
  else subtitleLines.push("Respublika bo‘yicha barcha hududlar");
  if (type === "regional") subtitleLines.push("Faqat hududlarning asosiy tadbirlari");
  if (type === "districts") subtitleLines.push("Faqat tuman va shaharlar tadbirlari");
  if (from || to) subtitleLines.push(`Davr: ${from ? fmtDate(from) : "…"} – ${to ? fmtDate(to) : "…"}`);
  subtitleLines.push(`Holati: ${statuses.map((s) => STATUS_LABELS[s]).join(", ")}`);

  const reportName =
    type === "artists" ? "San’atkorlar va ijodiy jamoalar ro‘yxati"
    : type === "responsibles" ? "Mas’ul ijrochilar ro‘yxati"
    : "Yangi yil tadbirlari to‘g‘risida ma’lumot";

  const opts: EventsReportOptions = {
    subtitleLines, emptyMode, generatedOn, reportName, layout,
    showStatus: statuses.length !== 1 || statuses[0] !== "approved",
  };

  let buffer: Buffer;
  try {
    buffer =
      type === "artists" || type === "responsibles"
        ? await buildPeopleReport(type, events, allRegions, opts)
        : await buildEventsReport(events, regions, scopedDistricts, opts);
  } catch {
    return bad("Word faylini yaratishda xatolik yuz berdi", 500);
  }

  await supabase.rpc("log_export", {
    p_details: { type, region: filters.region ?? null, district: filters.district ?? null, from, to, statuses, events: events.length },
  });

  const parts = ["Yangi_yil_tadbirlari"];
  if (type === "artists") parts[0] = "Sanatkorlar_royxati";
  if (type === "responsibles") parts[0] = "Masul_ijrochilar_royxati";
  if (regionName) parts.push(slug(regionName));
  if (districtName) parts.push(slug(districtName));
  parts.push(today);
  const filename = `${parts.join("_")}.docx`;

  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename="${filename}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
      "Cache-Control": "no-store",
    },
  });
}
