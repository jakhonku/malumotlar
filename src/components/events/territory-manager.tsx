"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Save } from "lucide-react";
import { saveDistrict, saveRegion } from "@/app/actions/settings";
import { Badge, Button, Card, CardBody, CardHeader, CardTitle, Input, Select, Table, Td, Th } from "@/components/ui/primitives";
import type { District, Region } from "@/lib/types";

type DistrictEdit = { name?: string; district_type?: "tuman" | "shahar"; is_active?: boolean };
type RegionEdit = { name?: string; is_active?: boolean };

export function TerritoryManager({ regions, districts }: { regions: Region[]; districts: District[] }) {
  const router = useRouter();
  const [regionId, setRegionId] = useState(regions[0]?.id ?? "");
  const [pending, start] = useTransition();
  const [newRegion, setNewRegion] = useState("");
  const [newDistrict, setNewDistrict] = useState<{ name: string; district_type: "tuman" | "shahar" }>({ name: "", district_type: "tuman" });
  const [dEdits, setDEdits] = useState<Record<string, DistrictEdit>>({});
  const [rEdits, setREdits] = useState<Record<string, RegionEdit>>({});

  const region = regions.find((r) => r.id === regionId);
  const list = districts.filter((d) => d.region_id === regionId);

  function run(fn: () => Promise<{ ok: boolean; error?: string }>, okMsg: string, after?: () => void) {
    start(async () => {
      const res = await fn();
      if (!res.ok) return void toast.error(res.error ?? "Xatolik yuz berdi");
      toast.success(okMsg);
      after?.();
      router.refresh();
    });
  }

  const re = region ? rEdits[region.id] ?? {} : {};

  return (
    <div className="grid gap-5 lg:grid-cols-3">
      <Card className="h-fit">
        <CardHeader><CardTitle>Hududlar</CardTitle></CardHeader>
        <CardBody className="space-y-3">
          <Select value={regionId} onChange={(e) => setRegionId(e.target.value)} aria-label="Hudud">
            {regions.map((r) => <option key={r.id} value={r.id}>{r.name}{r.is_active ? "" : " (faolsiz)"}</option>)}
          </Select>
          {region && (
            <div className="space-y-2 rounded-md bg-slate-50 p-3">
              <Input value={re.name ?? region.name} onChange={(e) => setREdits((x) => ({ ...x, [region.id]: { ...re, name: e.target.value } }))} aria-label="Hudud nomi" />
              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <input type="checkbox" className="h-4 w-4 accent-blue-800" checked={re.is_active ?? region.is_active}
                  onChange={(e) => setREdits((x) => ({ ...x, [region.id]: { ...re, is_active: e.target.checked } }))} />
                Faol
              </label>
              <Button size="sm" disabled={pending}
                onClick={() => run(() => saveRegion({ id: region.id, name: re.name ?? region.name, region_type: region.region_type, is_active: re.is_active ?? region.is_active }), "Hudud saqlandi")}>
                <Save className="h-3.5 w-3.5" /> Saqlash
              </Button>
            </div>
          )}
          <div className="flex gap-2">
            <Input value={newRegion} onChange={(e) => setNewRegion(e.target.value)} placeholder="Yangi hudud nomi" aria-label="Yangi hudud" />
            <Button disabled={pending} variant="outline" aria-label="Hudud qo‘shish"
              onClick={() => run(() => saveRegion({ name: newRegion, region_type: "viloyat", is_active: true }), "Hudud qo‘shildi", () => setNewRegion(""))}>
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </CardBody>
      </Card>

      <Card className="lg:col-span-2">
        <CardHeader><CardTitle>{region?.name}: tuman va shaharlar ({list.length})</CardTitle></CardHeader>
        <Table>
          <thead><tr><Th>Nomi</Th><Th>Turi</Th><Th>Holati</Th><Th><span className="sr-only">Saqlash</span></Th></tr></thead>
          <tbody>
            {list.map((d) => {
              const e = dEdits[d.id] ?? {};
              const dirty = Object.keys(e).length > 0;
              const active = e.is_active ?? d.is_active;
              return (
                <tr key={d.id}>
                  <Td><Input className="h-9" value={e.name ?? d.name} onChange={(ev) => setDEdits((x) => ({ ...x, [d.id]: { ...e, name: ev.target.value } }))} aria-label="Nomi" /></Td>
                  <Td>
                    <Select className="h-9" value={e.district_type ?? d.district_type} aria-label="Turi"
                      onChange={(ev) => setDEdits((x) => ({ ...x, [d.id]: { ...e, district_type: ev.target.value as "tuman" | "shahar" } }))}>
                      <option value="tuman">Tuman</option><option value="shahar">Shahar</option>
                    </Select>
                  </Td>
                  <Td>
                    <label className="flex cursor-pointer items-center gap-2 text-sm">
                      <input type="checkbox" className="h-4 w-4 accent-blue-800" checked={active}
                        onChange={(ev) => setDEdits((x) => ({ ...x, [d.id]: { ...e, is_active: ev.target.checked } }))} />
                      {active ? <Badge tone="green">Faol</Badge> : <Badge tone="red">Faolsiz</Badge>}
                    </label>
                  </Td>
                  <Td>
                    <Button size="sm" variant={dirty ? "default" : "ghost"} disabled={!dirty || pending}
                      onClick={() =>
                        run(
                          () => saveDistrict({ id: d.id, region_id: d.region_id, name: e.name ?? d.name, district_type: e.district_type ?? d.district_type, is_active: active }),
                          "Saqlandi",
                          () => setDEdits((x) => Object.fromEntries(Object.entries(x).filter(([k]) => k !== d.id))),
                        )
                      }>
                      Saqlash
                    </Button>
                  </Td>
                </tr>
              );
            })}
          </tbody>
        </Table>
        <CardBody className="flex flex-wrap gap-2 border-t border-slate-200">
          <Input className="max-w-xs" value={newDistrict.name} onChange={(e) => setNewDistrict((n) => ({ ...n, name: e.target.value }))} placeholder="Yangi tuman/shahar nomi" aria-label="Yangi tuman" />
          <Select className="max-w-32" value={newDistrict.district_type} aria-label="Turi"
            onChange={(e) => setNewDistrict((n) => ({ ...n, district_type: e.target.value as "tuman" | "shahar" }))}>
            <option value="tuman">Tuman</option><option value="shahar">Shahar</option>
          </Select>
          <Button disabled={pending || !regionId} variant="outline"
            onClick={() => run(() => saveDistrict({ region_id: regionId, name: newDistrict.name, district_type: newDistrict.district_type, is_active: true }), "Qo‘shildi", () => setNewDistrict({ name: "", district_type: "tuman" }))}>
            <Plus className="h-4 w-4" /> Qo‘shish
          </Button>
        </CardBody>
      </Card>
    </div>
  );
}
