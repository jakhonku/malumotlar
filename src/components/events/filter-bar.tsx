"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { Search, X } from "lucide-react";
import { Button, Input, Select } from "@/components/ui/primitives";
import { EVENT_TYPES, SCOPE_LABELS, STATUS_LABELS } from "@/lib/constants";

interface Opt { id: string; name: string }
interface Dist extends Opt { region_id: string }

export function FilterBar({
  regions, districts, fixedScope, lockedRegion, showPeople = true, showStatus = true,
}: {
  regions: Opt[];
  districts: Dist[];
  fixedScope?: "regional" | "district";
  lockedRegion?: string | null;
  showPeople?: boolean;
  showStatus?: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const [region, setRegion] = useState(lockedRegion ?? sp.get("region") ?? "");
  const [district, setDistrict] = useState(sp.get("district") ?? "");

  const dOptions = useMemo(() => (region ? districts.filter((d) => d.region_id === region) : []), [districts, region]);

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const params = new URLSearchParams();
    for (const [k, v] of fd.entries()) {
      if (typeof v === "string" && v.trim()) params.set(k, v.trim());
    }
    if (sp.get("sort")) params.set("sort", sp.get("sort")!);
    if (sp.get("dir")) params.set("dir", sp.get("dir")!);
    router.push(`${pathname}?${params.toString()}`);
  }

  function reset() {
    setRegion(lockedRegion ?? "");
    setDistrict("");
    router.push(pathname);
  }

  return (
    <form onSubmit={submit} className="grid gap-3 rounded-lg border border-slate-200 bg-white p-4 sm:grid-cols-2 lg:grid-cols-4" aria-label="Qidiruv va filtrlar">
      <div className="sm:col-span-2">
        <Input name="q" defaultValue={sp.get("q") ?? ""} placeholder="Tadbir nomi, joy, manzil yoki tashkilot bo‘yicha qidirish" aria-label="Qidiruv" />
      </div>
      {!lockedRegion && (
        <Select name="region" value={region} onChange={(e) => { setRegion(e.target.value); setDistrict(""); }} aria-label="Viloyat">
          <option value="">Barcha viloyatlar</option>
          {regions.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
        </Select>
      )}
      {lockedRegion && <input type="hidden" name="region" value={lockedRegion} />}
      {fixedScope !== "regional" && (
        <Select name="district" value={district} onChange={(e) => setDistrict(e.target.value)} disabled={!region} aria-label="Tuman/shahar">
          <option value="">{region ? "Barcha tuman/shaharlar" : "Avval viloyatni tanlang"}</option>
          {dOptions.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
        </Select>
      )}
      <Select name="type" defaultValue={sp.get("type") ?? ""} aria-label="Tadbir turi">
        <option value="">Barcha turlar</option>
        {EVENT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
      </Select>
      {showStatus && (
        <Select name="status" defaultValue={sp.get("status") ?? ""} aria-label="Holati">
          <option value="">Barcha holatlar</option>
          {Object.entries(STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </Select>
      )}
      {!fixedScope && (
        <Select name="scope" defaultValue={sp.get("scope") ?? ""} aria-label="Tadbir darajasi">
          <option value="">Barcha darajalar</option>
          {Object.entries(SCOPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </Select>
      )}
      <div className="flex items-center gap-2">
        <label className="sr-only" htmlFor="f-from">Sanadan</label>
        <Input id="f-from" type="date" name="from" defaultValue={sp.get("from") ?? ""} title="Sanadan" />
        <span className="text-slate-400">–</span>
        <label className="sr-only" htmlFor="f-to">Sanagacha</label>
        <Input id="f-to" type="date" name="to" defaultValue={sp.get("to") ?? ""} title="Sanagacha" />
      </div>
      {showPeople && (
        <>
          <Input name="artist" defaultValue={sp.get("artist") ?? ""} placeholder="San’atkor yoki jamoa" aria-label="San’atkor yoki jamoa" />
          <Input name="responsible" defaultValue={sp.get("responsible") ?? ""} placeholder="Mas’ul F.I.Sh." aria-label="Mas’ul F.I.Sh." />
          <Input name="phone" defaultValue={sp.get("phone") ?? ""} placeholder="Telefon raqami" aria-label="Telefon raqami" inputMode="tel" />
        </>
      )}
      <div className="flex gap-2 sm:col-span-2 lg:col-span-1 lg:justify-end">
        <Button type="submit"><Search className="h-4 w-4" /> Qidirish</Button>
        <Button type="button" variant="outline" onClick={reset}><X className="h-4 w-4" /> Tozalash</Button>
      </div>
    </form>
  );
}
