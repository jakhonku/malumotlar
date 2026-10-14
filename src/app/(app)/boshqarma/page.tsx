import Link from "next/link";
import { redirect } from "next/navigation";
import { CalendarClock, Check, FileDown, FileSpreadsheet, MessageSquare, Plus } from "lucide-react";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { deriveToken } from "@/lib/region-token";
import { getEntryGroup, isLate, isOpen } from "@/lib/public-collection";
import { getSignedReturn, listSignedFiles } from "@/lib/signed-files";
import type { CollectionRow } from "@/lib/collections";
import { fmtDate } from "@/lib/format";
import { DEPARTMENT_NAME, MINISTRY_FULL, regionOrgName, regionSelf } from "@/lib/brand";
import { Emblem } from "@/components/brand/emblem";
import { DeadlineTimer } from "@/components/deadline-timer";
import { AddDistrict } from "@/components/add-district";
import { EditDistricts } from "@/components/edit-districts";
import { buttonClass, Card, CardBody, EmptyState, cn } from "@/components/ui/primitives";

export const dynamic = "force-dynamic";

type Tile = "empty" | "draft" | "revision" | "submitted" | "approved";
const TILE: Record<Tile, { label: string; box: string; dot: string }> = {
  empty: { label: "Kiritilmagan", box: "border-slate-300 bg-white hover:border-blue-700", dot: "bg-slate-300" },
  draft: { label: "Qoralama", box: "border-amber-300 bg-amber-50 hover:border-amber-500", dot: "bg-amber-500" },
  revision: { label: "Tuzatish kerak", box: "border-red-300 bg-red-50 hover:border-red-500", dot: "bg-red-600" },
  submitted: { label: "Yuborilgan", box: "border-sky-300 bg-sky-50 hover:border-sky-500", dot: "bg-sky-500" },
  approved: { label: "Tasdiqlangan", box: "border-emerald-300 bg-emerald-50 hover:border-emerald-500", dot: "bg-emerald-600" },
};

function tileOf(statuses: string[]): Tile {
  if (!statuses.length) return "empty";
  if (statuses.includes("revision")) return "revision";
  if (statuses.includes("draft")) return "draft";
  if (statuses.includes("submitted")) return "submitted";
  return "approved";
}

export default async function RegionPanel() {
  const profile = await requireProfile();
  if (profile.role !== "region_manager" || !profile.region_id) redirect("/");
  const supabase = await createClient();
  const rid = profile.region_id;

  const [{ data: region }, { data: cols }, { data: dists }] = await Promise.all([
    supabase.from("regions").select("name").eq("id", rid).single(),
    supabase.from("collections").select("*").eq("is_active", true).order("created_at", { ascending: false }),
    supabase.from("districts").select("id,name,district_type").eq("region_id", rid).eq("is_active", true)
      .order("district_type", { ascending: false }).order("name").limit(500),
  ]);
  const collections = ((cols ?? []) as CollectionRow[]).filter(isOpen);
  const districts = dists ?? [];
  const regionName = region?.name ?? "";

  const cards = await Promise.all(
    collections.map(async (c) => {
      const token = deriveToken(c.id, rid);
      const [group, files] = await Promise.all([getEntryGroup(c.id, token), listSignedFiles(c.id, { regionId: rid }).catch(() => [])]);
      const entries = group?.entries ?? [];
      const base = `/kiritish/c/${c.id}`;
      const startHref = c.audience === "regional" ? `${base}/yangi?region=${rid}&scope=regional` : `${base}/yangi?region=${rid}&mode=region`;

      const unit = (key: string, name: string, list: typeof entries) => {
        const tile = tileOf(list.map((e) => e.status));
        const editable = list.filter((e) => e.status !== "approved");
        const href = !group
          ? startHref
          : !list.length
            ? `${base}/t/${token}/yangi?unit=${key}`
            : editable.length === 1 && list.length === 1
              ? `${base}/t/${token}/${editable[0].id}`
              : `${base}/t/${token}`;
        return { key, name, tile, href, count: list.length };
      };
      const units = [
        ...(c.audience !== "district" ? [unit("regional", regionSelf(regionName), entries.filter((e) => e.scope === "regional"))] : []),
        ...(c.audience !== "regional" ? districts.map((d) => unit(d.id, d.name, entries.filter((e) => e.district_id === d.id))) : []),
      ];

      const total = units.length;
      const filled = units.filter((u) => u.tile !== "empty").length;
      const pending = units.filter((u) => u.tile === "draft" || u.tile === "revision").length;
      const returned = units.filter((u) => u.tile === "revision").length;
      const entered = filled === total && total > 0;
      const sentAll = entered && pending === 0;
      const signed = files.length > 0;
      const signedReturn = signed ? null : await getSignedReturn(c.id, rid).catch(() => null);
      const steps = [
        { title: "Ma’lumot kiritish", note: `${filled} / ${total} hudud`, done: entered },
        { title: "Yuborish", note: pending ? `${pending} tasi yuborilmagan` : sentAll ? "hammasi yuborilgan" : "kutilmoqda", done: sentAll },
        { title: "Word → imzo → skaner", note: "yuklab olib imzolang", done: signed },
        { title: "Imzolangan PDF", note: signed ? "yuborilgan" : signedReturn ? "qaytarilgan — qayta yuboring" : "yuboring", done: signed },
      ];
      const current = steps.findIndex((s) => !s.done);
      return { c, token, hasGroup: !!group, signedReturn, units, steps, current, returned, entries: entries.length, workHref: group ? `${base}/t/${token}` : startHref };
    }),
  );

  return (
    <div className="space-y-6">
      <header className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center gap-4 border-b-4 border-blue-800 bg-slate-900 px-5 py-4 text-white">
          <span className="flex h-24 w-24 shrink-0 items-center justify-center rounded-full bg-white p-1 ring-4 ring-amber-500/50"><Emblem size={88} className="rounded-full" /></span>
          <div className="leading-snug">
            <p className="text-xs font-semibold tracking-wide text-slate-300">{MINISTRY_FULL}</p>
            <p className="text-[11px] text-slate-400">{DEPARTMENT_NAME}</p>
          </div>
        </div>
        <div className="flex flex-wrap items-end justify-between gap-3 px-5 py-4">
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-500">Hududiy boshqaruv paneli</p>
            <h1 className="text-2xl font-bold text-slate-900">{regionName ? regionOrgName(regionName) : "Boshqarma paneli"}</h1>
            <p className="text-sm text-slate-600">{profile.full_name}</p>
          </div>
          <Link href="/chat" className={buttonClass("outline")}><MessageSquare className="h-4 w-4" /> Vazirlik bilan chat</Link>
        </div>
      </header>

      {cards.filter(({ c }) => c.deadline).map(({ c }) => (
        <DeadlineTimer key={c.id} deadline={c.deadline!} title={`«${c.title}» — ma’lumot kiritish muddati`} />
      ))}

      {cards.length === 0 ? (
        <Card><EmptyState title="Hozircha ochiq ma’lumot yig‘ish yo‘q" text="Vazirlik yangi yig‘ishni ochganda shu yerda ko‘rinadi." /></Card>
      ) : (
        cards.map(({ c, token, hasGroup, signedReturn, units, steps, current, returned, entries, workHref }) => (
          <Card key={c.id}>
            <CardBody className="space-y-5">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h2 className="text-xl font-semibold text-slate-900">{c.title}</h2>
                  {c.description && <p className="mt-1 max-w-3xl whitespace-pre-line text-sm text-slate-600">{c.description}</p>}
                </div>
                {c.deadline && (
                  <span className="flex items-center gap-1 rounded-full bg-amber-100 px-3 py-1 text-sm font-medium text-amber-900">
                    <CalendarClock className="h-4 w-4" /> Muddat: {fmtDate(c.deadline)}{isLate(c) && " — o‘tgan, tezroq topshiring"}
                  </span>
                )}
              </div>

              <ol className="grid gap-2 sm:grid-cols-4" aria-label="Jarayon qadamlari">
                {steps.map((s, i) => (
                  <li key={s.title} className={cn("flex items-start gap-3 rounded-lg border p-3", s.done ? "border-emerald-300 bg-emerald-50" : i === current ? "border-blue-700 bg-blue-50" : "border-slate-200 bg-slate-50")}>
                    <span className={cn("flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-bold", s.done ? "bg-emerald-600 text-white" : i === current ? "bg-blue-800 text-white" : "bg-slate-300 text-slate-700")}>
                      {s.done ? <Check className="h-4 w-4" /> : i + 1}
                    </span>
                    <span className="text-sm leading-tight">
                      <b className="block text-slate-900">{s.title}</b>
                      <span className="text-xs text-slate-600">{s.note}</span>
                    </span>
                  </li>
                ))}
              </ol>

              {signedReturn && (
                <p role="alert" className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm font-medium text-red-900">
                  Vazirlik imzolangan PDF ni qaytardi. Sabab: {signedReturn.reason} — tuzatib, imzolangan PDF ni qayta yuboring.
                </p>
              )}

              {returned > 0 && (
                <p role="alert" className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm font-medium text-red-900">
                  Vazirlik {returned} ta hududni tuzatishga qaytargan — qizil katakchalarni oching, sababini o‘qing va qayta yuboring.
                </p>
              )}

              <div>
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold text-slate-800">Hududlar — bosib ma’lumot kiriting yoki tahrirlang</h3>
                  {c.audience !== "regional" && districts.length > 0 && <AddDistrict />}
                </div>
                {c.audience !== "regional" && districts.length === 0 && <div className="mb-3"><AddDistrict empty /></div>}
                <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {units.map((u) => (
                    <li key={u.key}>
                      <Link href={u.href} className={cn("flex h-full items-center justify-between gap-2 rounded-lg border-2 px-3 py-2.5 text-sm transition-colors", TILE[u.tile].box)}>
                        <span className="min-w-0">
                          <span className="block truncate font-medium text-slate-900">{u.name}</span>
                          <span className="flex items-center gap-1.5 text-xs text-slate-600">
                            <i className={cn("inline-block h-2 w-2 rounded-full", TILE[u.tile].dot)} />
                            {TILE[u.tile].label}{u.count > 1 ? ` · ${u.count} ta` : ""}
                          </span>
                        </span>
                        {u.tile === "empty" && <Plus className="h-4 w-4 shrink-0 text-blue-800" aria-hidden />}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="flex flex-wrap gap-2 border-t border-slate-200 pt-4">
                <Link href={workHref} className={buttonClass("default", "lg")}>
                  {hasGroup ? "Jadval, yuborish va PDF" : "Ma’lumot kiritishni boshlash"}
                </Link>
                {hasGroup && entries > 0 && (
                  <>
                    <a href={`/kiritish/export?c=${c.id}&t=${token}&format=docx`} className={buttonClass("outline", "lg")}><FileDown className="h-5 w-5" /> Word</a>
                    <a href={`/kiritish/export?c=${c.id}&t=${token}&format=xlsx`} className={buttonClass("outline", "lg")}><FileSpreadsheet className="h-5 w-5" /> Excel</a>
                  </>
                )}
              </div>
            </CardBody>
          </Card>
        ))
      )}

      {districts.length > 0 && (
        <Card>
          <CardBody className="space-y-3">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Tuman va shaharlar ro‘yxati</h2>
              <p className="text-sm text-slate-600">Nomi noto‘g‘ri yoki eskirgan bo‘lsa, qalamcha belgisini bosib tuzating — kiritilgan ma’lumotlar saqlanib qoladi.</p>
            </div>
            <EditDistricts items={districts.map((d) => ({ id: d.id, name: d.name, type: d.district_type === "shahar" ? "shahar" : "tuman" }))} />
          </CardBody>
        </Card>
      )}
    </div>
  );
}
