import Link from "next/link";
import { redirect } from "next/navigation";
import { CalendarClock, FileDown, ListChecks, PenLine } from "lucide-react";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { deriveToken } from "@/lib/region-token";
import { getEntryGroup, isOpen } from "@/lib/public-collection";
import { listSignedFiles } from "@/lib/signed-files";
import type { CollectionRow } from "@/lib/collections";
import { fmtDate } from "@/lib/format";
import { regionOrgName } from "@/lib/brand";
import { Badge, buttonClass, Card, CardBody, EmptyState, PageHeader } from "@/components/ui/primitives";

interface DistMon { district_id: string; entries_total: number; draft: number; submitted: number; revision: number; approved: number; sent: boolean }

export default async function RegionPanel() {
  const profile = await requireProfile();
  if (profile.role !== "region_manager" || !profile.region_id) redirect("/");
  const supabase = await createClient();
  const rid = profile.region_id;

  const [{ data: region }, { data: cols }] = await Promise.all([
    supabase.from("regions").select("name").eq("id", rid).single(),
    supabase.from("collections").select("*").eq("is_active", true).order("created_at", { ascending: false }),
  ]);
  const collections = ((cols ?? []) as CollectionRow[]).filter(isOpen);

  const cards = await Promise.all(
    collections.map(async (c) => {
      const token = deriveToken(c.id, rid);
      const [group, { data: mon }, files] = await Promise.all([
        getEntryGroup(c.id, token),
        supabase.rpc("col_monitoring_districts", { p_collection: c.id, p_region: rid }),
        listSignedFiles(c.id, { regionId: rid }).catch(() => []),
      ]);
      const d = (mon ?? []) as DistMon[];
      const ownEntries = group ? group.entries.filter((e) => e.scope === "regional") : [];
      return {
        c, token, hasGroup: !!group,
        districtsTotal: d.length,
        districtsSent: d.filter((x) => x.sent).length,
        districtsDraft: d.filter((x) => !x.sent && x.entries_total > 0).length,
        ownCount: ownEntries.length,
        ownSent: ownEntries.some((e) => e.status === "submitted" || e.status === "approved"),
        signed: files.length,
        returned: d.reduce((a, x) => a + x.revision, 0),
      };
    }),
  );

  return (
    <>
      <PageHeader
        title={region?.name ? regionOrgName(region.name) : "Boshqarma paneli"}
        description={`${profile.full_name}. Hududingiz va unga tegishli barcha tuman/shaharlar ma’lumotini shu yerdan kiritasiz.`}
      />
      {cards.length === 0 ? (
        <Card><EmptyState title="Hozircha ochiq ma’lumot yig‘ish yo‘q" text="Vazirlik yangi yig‘ishni ochganda shu yerda ko‘rinadi." /></Card>
      ) : (
        <div className="space-y-4">
          {cards.map(({ c, token, hasGroup, districtsTotal, districtsSent, districtsDraft, ownCount, ownSent, signed, returned }) => {
            const pct = districtsTotal ? Math.round((districtsSent / districtsTotal) * 100) : 0;
            const startHref =
              c.audience === "regional"
                ? `/kiritish/c/${c.id}/yangi?region=${rid}&scope=regional`
                : `/kiritish/c/${c.id}/yangi?region=${rid}&mode=region`;
            const workHref = hasGroup ? `/kiritish/c/${c.id}/t/${token}` : startHref;
            return (
              <Card key={c.id}>
                <CardBody className="space-y-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <h2 className="text-lg font-semibold text-slate-900">{c.title}</h2>
                      {c.description && <p className="mt-1 line-clamp-2 text-sm text-slate-600">{c.description}</p>}
                    </div>
                    {c.deadline && (
                      <Badge tone="amber"><CalendarClock className="mr-1 h-3 w-3" /> Muddat: {fmtDate(c.deadline)}</Badge>
                    )}
                  </div>

                  {c.audience !== "regional" && (
                    <div>
                      <div className="mb-1 flex justify-between text-sm">
                        <span className="text-slate-600">Yuborilgan tuman/shaharlar</span>
                        <b>{districtsSent} / {districtsTotal}</b>
                      </div>
                      <div className="h-2.5 overflow-hidden rounded-full bg-slate-200" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
                        <div className="h-full bg-emerald-600" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  )}

                  <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-slate-700">
                    {c.audience !== "district" && (
                      <span>Viloyatning o‘zi: <b>{ownCount ? (ownSent ? "yuborilgan" : "yuborilmagan") : "kiritilmagan"}</b></span>
                    )}
                    {c.audience !== "regional" && <span>Qoralamada: <b>{districtsDraft}</b></span>}
                    {returned > 0 && <span className="font-medium text-amber-700">Qaytarilgan: {returned} (tuzatish kerak)</span>}
                    <span>Imzolangan PDF: <b className={signed ? "text-emerald-700" : "text-red-700"}>{signed ? "yuborilgan" : "yuborilmagan"}</b></span>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Link href={workHref} className={buttonClass("default", "lg")}>
                      <PenLine className="h-5 w-5" /> {hasGroup ? "Ma’lumot kiritish / jadval" : "Ma’lumot kiritishni boshlash"}
                    </Link>
                    {hasGroup && (
                      <a href={`/kiritish/export?c=${c.id}&t=${token}&format=docx`} className={buttonClass("outline", "lg")}>
                        <FileDown className="h-5 w-5" /> Word yuklab olish
                      </a>
                    )}
                    <Link href={`/collections/${c.id}`} className={buttonClass("outline", "lg")}>
                      <ListChecks className="h-5 w-5" /> Natijalar va holat
                    </Link>
                  </div>
                </CardBody>
              </Card>
            );
          })}
        </div>
      )}
    </>
  );
}
