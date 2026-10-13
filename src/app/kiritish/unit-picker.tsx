"use client";
import { regionKind, regionSelf } from "@/lib/brand";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { Button, Field, Input, Select, cn } from "@/components/ui/primitives";

interface Opt { id: string; name: string }
interface Dist extends Opt { region_id: string }

const NEW = "__new__";

export function UnitPicker({
  regions, districts, target = "/kiritish/yangi", audience = "both",
}: { regions: Opt[]; districts: Dist[]; target?: string; audience?: "regional" | "district" | "both" }) {
  const router = useRouter();
  const [region, setRegion] = useState("");
  const [kind, setKind] = useState<"regional" | "district" | "region">(audience === "district" ? "district" : "regional");
  const [district, setDistrict] = useState("");
  const [name, setName] = useState("");
  const [type, setType] = useState<"tuman" | "shahar">("tuman");
  const [error, setError] = useState<string | null>(null);

  const regionName = regions.find((r) => r.id === region)?.name ?? "";
  const selfName = region ? regionSelf(regionName) : "Hududning o‘zi";
  const selfHint = !region ? "Hudud miqyosidagi asosiy tadbirlar." : regionKind(regionName) === "respublika" ? "Respublika miqyosidagi asosiy tadbirlar (masalan, Nukus shahridagi bayram konserti)." : regionKind(regionName) === "shahar" ? "Shahar miqyosidagi asosiy tadbirlar." : "Viloyat miqyosidagi asosiy tadbirlar (masalan, viloyat markazidagi bayram konserti).";

  const options = useMemo(() => districts.filter((d) => d.region_id === region), [districts, region]);

  function go() {
    if (!region) return setError("Hududni tanlang");
    const p = new URLSearchParams({ region });
    if (kind === "region") {
      p.set("mode", "region");
    } else if (kind === "regional") {
      p.set("scope", "regional");
    } else {
      p.set("scope", "district");
      if (!district) return setError("Tuman/shaharni tanlang");
      if (district === NEW) {
        if (name.trim().length < 3) return setError("Tuman/shahar nomini yozing");
        p.set("district", NEW);
        p.set("name", name.trim());
        p.set("type", type);
      } else {
        p.set("district", district);
      }
    }
    router.push(`${target}?${p.toString()}`);
  }

  const choice = (active: boolean) =>
    cn(
      "flex cursor-pointer items-start gap-3 rounded-lg border p-3 text-sm transition-colors",
      active ? "border-blue-800 bg-blue-50" : "border-slate-200 bg-white hover:bg-slate-50",
    );

  return (
    <div className="space-y-4">
      <Field label="1. Hudud (viloyat, Qoraqalpog‘iston Respublikasi yoki Toshkent shahri)" required>
        <Select value={region} onChange={(e) => { setRegion(e.target.value); setDistrict(""); setError(null); }}>
          <option value="">Tanlang…</option>
          {regions.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
        </Select>
      </Field>

      <fieldset className="space-y-2">
        <legend className="mb-1 text-sm font-medium text-slate-700">2. Kim to‘ldiryapti?</legend>
        {audience !== "district" && <label className={choice(kind === "regional")}>
          <input type="radio" name="kind" checked={kind === "regional"} onChange={() => setKind("regional")} className="mt-0.5 h-4 w-4 accent-blue-800" />
          <span>
            <b className="block text-slate-900">{selfName}</b>
            {selfHint}
          </span>
        </label>}
        {audience !== "regional" && <label className={choice(kind === "region")}>
          <input type="radio" name="kind" checked={kind === "region"} onChange={() => setKind("region")} className="mt-0.5 h-4 w-4 accent-blue-800" />
          <span>
            <b className="block text-slate-900">Madaniyat boshqarmasi (vazirlik) — hammasini men to‘ldiraman</b>
            Boshqarma boshlig‘i o‘z hududi va unga tegishli barcha tuman/shaharlar ma’lumotini bitta joydan kiritadi.
          </span>
        </label>}
        {audience !== "regional" && <label className={choice(kind === "district")}>
          <input type="radio" name="kind" checked={kind === "district"} onChange={() => setKind("district")} className="mt-0.5 h-4 w-4 accent-blue-800" />
          <span>
            <b className="block text-slate-900">Tuman yoki shahar</b>
            Har bir tuman/shahar o‘z ma’lumotini alohida to‘ldiradi.
          </span>
        </label>}
      </fieldset>

      {kind === "district" && (
        <div className="space-y-3">
          <Field label="3. Tuman/shahar" required>
            <Select value={district} onChange={(e) => { setDistrict(e.target.value); setError(null); }} disabled={!region}>
              <option value="">{region ? "Tanlang…" : "Avval hududni tanlang"}</option>
              {options.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              {region && <option value={NEW}>➕ Ro‘yxatda yo‘q — nomini o‘zim yozaman</option>}
            </Select>
          </Field>
          {district === NEW && (
            <div className="grid gap-3 rounded-md border border-blue-200 bg-blue-50/50 p-3 sm:grid-cols-3">
              <Field label="Tuman/shahar nomi" required className="sm:col-span-2" hint="Masalan: Qo‘shrabot. Ro‘yxatga avtomatik qo‘shiladi.">
                <Input value={name} onChange={(e) => setName(e.target.value)} />
              </Field>
              <Field label="Turi">
                <Select value={type} onChange={(e) => setType(e.target.value as "tuman" | "shahar")}>
                  <option value="tuman">Tuman</option>
                  <option value="shahar">Shahar</option>
                </Select>
              </Field>
            </div>
          )}
        </div>
      )}

      {error && <p role="alert" className="text-sm font-medium text-red-700">{error}</p>}
      <Button size="lg" onClick={go}>
        Davom etish <ArrowRight className="h-5 w-5" />
      </Button>
    </div>
  );
}
