"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { FileDown, Loader2 } from "lucide-react";
import { Button, Card, CardBody, CardHeader, CardTitle, Field, Input, Select } from "@/components/ui/primitives";
import { STATUS_LABELS, type EventStatus, type Role } from "@/lib/constants";

interface Opt { id: string; name: string }
interface Dist extends Opt { region_id: string }

const TYPES: { value: string; label: string; needs?: ("region" | "district" | "dates")[] }[] = [
  { value: "all", label: "Butun respublika bo‘yicha barcha hududlar" },
  { value: "region", label: "Bitta viloyat bo‘yicha", needs: ["region"] },
  { value: "district", label: "Bitta tuman/shahar bo‘yicha", needs: ["region", "district"] },
  { value: "regional", label: "Faqat viloyat asosiy tadbirlari" },
  { value: "districts", label: "Faqat tuman/shahar tadbirlari" },
  { value: "period", label: "Tanlangan sana oralig‘i", needs: ["dates"] },
  { value: "approved", label: "Faqat tasdiqlangan tadbirlar" },
  { value: "artists", label: "San’atkorlar va ijodiy jamoalar ro‘yxati" },
  { value: "responsibles", label: "Mas’ul ijrochilar ro‘yxati" },
];

export function ReportForm({
  role, regions, districts, lockedRegion, lockedDistrict,
}: { role: Role; regions: Opt[]; districts: Dist[]; lockedRegion: string | null; lockedDistrict: string | null }) {
  const [type, setType] = useState("all");
  const [region, setRegion] = useState(lockedRegion ?? "");
  const [district, setDistrict] = useState(lockedDistrict ?? "");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [empty, setEmpty] = useState<"hide" | "mark">("hide");
  const [layout, setLayout] = useState<"single" | "grouped">("single");
  const [statuses, setStatuses] = useState<EventStatus[]>(["approved"]);
  const [busy, setBusy] = useState(false);

  const canPickStatus = (role === "super_admin" || role === "region_manager") && type !== "approved";
  const needs = TYPES.find((t) => t.value === type)?.needs ?? [];
  const dOptions = useMemo(() => districts.filter((d) => d.region_id === region), [districts, region]);
  const regionLocked = role !== "super_admin";
  const districtLocked = role === "district_manager";
  const visibleTypes = TYPES.filter((t) => {
    if (role === "district_manager") return ["all", "period", "approved", "artists", "responsibles"].includes(t.value);
    return true;
  });

  function toggle(s: EventStatus) {
    setStatuses((cur) => (cur.includes(s) ? cur.filter((x) => x !== s) : [...cur, s]));
  }

  async function generate() {
    if (needs.includes("region") && !region) return toast.error("Viloyatni tanlang");
    if (needs.includes("district") && !district) return toast.error("Tuman/shaharni tanlang");
    if (needs.includes("dates") && !from && !to) return toast.error("Sana oralig‘ini kiriting");
    if (canPickStatus && statuses.length === 0) return toast.error("Kamida bitta holatni tanlang");

    const p = new URLSearchParams({ type, empty, layout });
    if (region) p.set("region", region);
    if (district && (type === "district" || type === "period" || type === "all")) p.set("district", district);
    if (from) p.set("from", from);
    if (to) p.set("to", to);
    if (canPickStatus) p.set("status", statuses.join(","));

    setBusy(true);
    try {
      const res = await fetch(`/api/reports/word?${p.toString()}`);
      if (!res.ok) {
        const j = await res.json().catch(() => null);
        toast.error(j?.error ?? "Hisobotni yaratib bo‘lmadi");
        return;
      }
      const blob = await res.blob();
      const cd = res.headers.get("Content-Disposition") ?? "";
      const name = /filename\*=UTF-8''([^;]+)/.exec(cd)?.[1];
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = name ? decodeURIComponent(name) : "Yangi_yil_tadbirlari.docx";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success("Word hisoboti yuklab olindi");
    } catch {
      toast.error("Tarmoq xatosi. Qayta urinib ko‘ring.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader><CardTitle>Hisobot parametrlari</CardTitle></CardHeader>
      <CardBody className="space-y-5">
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Hisobot turi" className="md:col-span-2">
            <Select value={type} onChange={(e) => setType(e.target.value)}>
              {visibleTypes.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </Select>
          </Field>
          <Field label="Viloyat/hudud" required={needs.includes("region")}>
            <Select value={region} disabled={regionLocked} onChange={(e) => { setRegion(e.target.value); setDistrict(""); }}>
              <option value="">{type === "all" || type === "regional" || type === "districts" || type === "approved" || type === "period" || type === "artists" || type === "responsibles" ? "Barcha viloyatlar" : "Tanlang…"}</option>
              {regions.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
            </Select>
          </Field>
          {(type === "district" || type === "districts" || type === "period" || type === "all") && (
            <Field label="Tuman/shahar" required={needs.includes("district")}>
              <Select value={district} disabled={districtLocked || !region} onChange={(e) => setDistrict(e.target.value)}>
                <option value="">{region ? "Barcha tuman/shaharlar" : "Avval viloyatni tanlang"}</option>
                {dOptions.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </Select>
            </Field>
          )}
          <Field label="Sanadan" required={needs.includes("dates")}>
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </Field>
          <Field label="Sanagacha">
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </Field>
        </div>

        {canPickStatus ? (
          <fieldset>
            <legend className="mb-1 text-sm font-medium text-slate-700">Hisobotga kiritiladigan holatlar</legend>
            <div className="flex flex-wrap gap-4">
              {(Object.keys(STATUS_LABELS) as EventStatus[]).map((s) => (
                <label key={s} className="flex cursor-pointer items-center gap-2 text-sm">
                  <input type="checkbox" checked={statuses.includes(s)} onChange={() => toggle(s)} className="h-4 w-4 accent-blue-800" />
                  {STATUS_LABELS[s]}
                </label>
              ))}
            </div>
            <p className="mt-1 text-xs text-slate-500">Rasmiy hisobot uchun faqat «Tasdiqlangan» holatini qoldiring.</p>
          </fieldset>
        ) : (
          <p className="text-sm text-slate-600">Hisobotga faqat <b>tasdiqlangan</b> tadbirlar kiritiladi.</p>
        )}

        {type !== "artists" && type !== "responsibles" && (
          <fieldset>
            <legend className="mb-1 text-sm font-medium text-slate-700">Ma’lumoti yo‘q hududlar</legend>
            <div className="flex flex-wrap gap-4 text-sm">
              <label className="flex cursor-pointer items-center gap-2">
                <input type="radio" name="empty" checked={empty === "hide"} onChange={() => setEmpty("hide")} className="h-4 w-4 accent-blue-800" /> Yashirish
              </label>
              <label className="flex cursor-pointer items-center gap-2">
                <input type="radio" name="empty" checked={empty === "mark"} onChange={() => setEmpty("mark")} className="h-4 w-4 accent-blue-800" /> «Ma’lumot kiritilmagan» deb belgilash
              </label>
            </div>
          </fieldset>
        )}

        {type !== "artists" && type !== "responsibles" && (
          <fieldset className="space-y-1 text-sm">
            <legend className="mb-1 font-medium text-slate-700">Jadval ko‘rinishi</legend>
            <label className="flex cursor-pointer items-center gap-2"><input type="radio" name="layout" checked={layout === "single"} onChange={() => setLayout("single")} className="h-4 w-4 accent-blue-800" /> Umumiy jadval — barcha viloyat va tumanlar bitta jadvalda</label>
            <label className="flex cursor-pointer items-center gap-2"><input type="radio" name="layout" checked={layout === "grouped"} onChange={() => setLayout("grouped")} className="h-4 w-4 accent-blue-800" /> Alohida jadvallar — har bir viloyat va tuman o‘z jadvalida</label>
          </fieldset>
        )}

        <Button size="lg" variant="success" className="w-full sm:w-auto" onClick={generate} disabled={busy}>
          {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <FileDown className="h-5 w-5" />}
          {busy ? "Hujjat tayyorlanmoqda…" : "WORD HISOBOTINI YARATISH"}
        </Button>
      </CardBody>
    </Card>
  );
}
