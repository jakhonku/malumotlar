"use client";

import { useState } from "react";
import { toast } from "sonner";
import { FileDown, FileSpreadsheet, Loader2 } from "lucide-react";
import { Button, Card, CardBody, CardHeader, CardTitle } from "@/components/ui/primitives";
import { STATUS_LABELS, type EventStatus } from "@/lib/constants";

export function ExportBar({ collectionId, regionId }: { collectionId: string; regionId?: string }) {
  const [statuses, setStatuses] = useState<EventStatus[]>(["approved"]);
  const [empty, setEmpty] = useState<"hide" | "mark">("hide");
  const [layout, setLayout] = useState<"single" | "grouped">("grouped");
  const [busy, setBusy] = useState<string | null>(null);

  const toggle = (s: EventStatus) => setStatuses((cur) => (cur.includes(s) ? cur.filter((x) => x !== s) : [...cur, s]));

  async function download(format: "docx" | "xlsx") {
    if (!statuses.length) return toast.error("Kamida bitta holatni tanlang");
    const p = new URLSearchParams({ id: collectionId, format, status: statuses.join(","), empty, layout });
    if (regionId) p.set("region", regionId);
    setBusy(format);
    try {
      const res = await fetch(`/api/collections/export?${p.toString()}`);
      if (!res.ok) {
        const j = await res.json().catch(() => null);
        return void toast.error(j?.error ?? "Hisobotni yaratib bo‘lmadi");
      }
      const blob = await res.blob();
      const cd = res.headers.get("Content-Disposition") ?? "";
      const name = /filename\*=UTF-8''([^;]+)/.exec(cd)?.[1];
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = name ? decodeURIComponent(name) : `hisobot.${format}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success("Fayl yuklab olindi");
    } catch {
      toast.error("Tarmoq xatosi. Qayta urinib ko‘ring.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <Card>
      <CardHeader><CardTitle>Hisobot yuklab olish</CardTitle></CardHeader>
      <CardBody className="space-y-3">
        <div className="flex flex-wrap gap-4 text-sm">
          {(Object.keys(STATUS_LABELS) as EventStatus[]).map((s) => (
            <label key={s} className="flex cursor-pointer items-center gap-2">
              <input type="checkbox" checked={statuses.includes(s)} onChange={() => toggle(s)} className="h-4 w-4 accent-blue-800" />
              {STATUS_LABELS[s]}
            </label>
          ))}
        </div>
        <div className="flex flex-wrap gap-4 text-sm">
          <label className="flex cursor-pointer items-center gap-2"><input type="radio" name="emp" checked={empty === "hide"} onChange={() => setEmpty("hide")} className="h-4 w-4 accent-blue-800" /> Ma’lumoti yo‘q hududlarni yashirish</label>
          <label className="flex cursor-pointer items-center gap-2"><input type="radio" name="emp" checked={empty === "mark"} onChange={() => setEmpty("mark")} className="h-4 w-4 accent-blue-800" /> «Ma’lumot kiritilmagan» deb ko‘rsatish</label>
        </div>
        <fieldset className="space-y-1 text-sm">
          <legend className="mb-1 font-medium text-slate-700">Jadval ko‘rinishi</legend>
          <label className="flex cursor-pointer items-center gap-2"><input type="radio" name="layout" checked={layout === "single"} onChange={() => setLayout("single")} className="h-4 w-4 accent-blue-800" /> Umumiy jadval — barcha viloyatlar bitta jadvalda (viloyat va tuman ustunlari bilan)</label>
          <label className="flex cursor-pointer items-center gap-2"><input type="radio" name="layout" checked={layout === "grouped"} onChange={() => setLayout("grouped")} className="h-4 w-4 accent-blue-800" /> Viloyat bo‘yicha — har bir viloyat bitta jadvalda: avval viloyatning o‘zi, ostida tumanlari</label>
        </fieldset>
        <div className="flex flex-wrap gap-2">
          <Button variant="success" size="lg" onClick={() => download("docx")} disabled={!!busy}>
            {busy === "docx" ? <Loader2 className="h-5 w-5 animate-spin" /> : <FileDown className="h-5 w-5" />} WORD HISOBOTI
          </Button>
          <Button variant="outline" size="lg" onClick={() => download("xlsx")} disabled={!!busy}>
            {busy === "xlsx" ? <Loader2 className="h-5 w-5 animate-spin" /> : <FileSpreadsheet className="h-5 w-5" />} Excel (.xlsx)
          </Button>
        </div>
        <p className="text-xs text-slate-500">Rasmiy hisobot uchun faqat «Tasdiqlangan» holatini qoldiring.</p>
      </CardBody>
    </Card>
  );
}
