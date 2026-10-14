"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Copy, FileDown, KeyRound, Link2, Pencil, Plus, X } from "lucide-react";
import { createUser, resetPassword, updateUser } from "@/app/actions/users";
import { makeAllLoginLinks, makeLoginLink } from "@/app/actions/login-links";
import { Badge, Button, Card, CardBody, CardHeader, CardTitle, Field, Input, Select, Table, Td, Th } from "@/components/ui/primitives";
import { ROLE_LABELS, type Role } from "@/lib/constants";
import { formatPhone } from "@/lib/phone";

interface Opt { id: string; name: string }
interface Dist extends Opt { region_id: string }
export interface UserRow {
  id: string; username: string; full_name: string; role: Role; region_id: string | null;
  district_id: string | null; phone: string | null; position?: string | null; avatar_url?: string | null; link?: { state: "faol" | "eskirgan" | "bekor"; until: string; uses: number } | null; can_edit_districts: boolean; is_active: boolean;
}

interface FormState {
  id?: string; username: string; password: string; full_name: string; role: Role;
  region_id: string; district_id: string; phone: string; can_edit_districts: boolean; is_active: boolean;
  new_district_name: string; new_district_type: "tuman" | "shahar";
}
const blank: FormState = {
  username: "", password: "", full_name: "", role: "district_manager", region_id: "", district_id: "",
  phone: "", can_edit_districts: false, is_active: true, new_district_name: "", new_district_type: "tuman",
};

export function UsersManager({ users, regions, districts }: { users: UserRow[]; regions: Opt[]; districts: Dist[] }) {
  const router = useRouter();
  const [form, setForm] = useState<FormState | null>(null);
  const [q, setQ] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [pending, start] = useTransition();
  const [link, setLink] = useState<{ who: string; url: string; until: string } | null>(null);

  function oneLink(u: UserRow) {
    start(async () => {
      const res = await makeLoginLink(u.id);
      if (!res.ok || !res.url) return void toast.error(res.error ?? "Xatolik yuz berdi");
      setLink({ who: regionName(u.region_id) || u.full_name, url: res.url, until: res.until ?? "" });
    });
  }
  function allLinks() {
    if (!window.confirm("Barcha viloyat boshqarmalari uchun YANGI tezkor kirish havolalari yaratiladi (2 kun amal qiladi). Avval yuborilgan havolalar (eski Word fayllar) ISHLAMAY QOLADI. Davom etasizmi?")) return;
    start(async () => {
      const res = await makeAllLoginLinks();
      if (!res.ok || !res.docx) return void toast.error(res.error ?? "Xatolik yuz berdi");
      const bytes = Uint8Array.from(atob(res.docx), (c) => c.charCodeAt(0));
      const a = document.createElement("a");
      a.href = URL.createObjectURL(new Blob([bytes], { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" }));
      a.download = "viloyat-tezkor-havolalar.docx";
      a.click();
      URL.revokeObjectURL(a.href);
      toast.success(`${res.count} ta havola yaratildi — Word yuklab olindi`);
    });
  }

  const regionName = (id: string | null) => regions.find((r) => r.id === id)?.name ?? "";
  const districtName = (id: string | null) => districts.find((d) => d.id === id)?.name ?? "";
  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    return users.filter(
      (u) => (!roleFilter || u.role === roleFilter) &&
        (!t || [u.full_name, u.username, regionName(u.region_id), districtName(u.district_id)].some((s) => s.toLowerCase().includes(t))),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [users, q, roleFilter]);

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setForm((f) => (f ? { ...f, [k]: v } : f));
  const dOptions = form ? districts.filter((d) => d.region_id === form.region_id) : [];

  function save() {
    if (!form) return;
    start(async () => {
      const payload = {
        ...form,
        region_id: form.region_id || null,
        district_id: form.district_id && form.district_id !== "__new__" ? form.district_id : null,
      };
      const res = form.id ? await updateUser(payload) : await createUser(payload);
      if (!res.ok) return void toast.error(res.error ?? "Xatolik yuz berdi");
      toast.success(form.id ? "Foydalanuvchi yangilandi" : "Foydalanuvchi yaratildi");
      setForm(null);
      router.refresh();
    });
  }

  function reset(u: UserRow) {
    const pw = window.prompt(`«${u.username}» uchun yangi parol (kamida 8 belgi):`);
    if (!pw) return;
    start(async () => {
      const res = await resetPassword(u.id, pw);
      if (res.ok) toast.success("Parol o‘zgartirildi");
      else toast.error(res.error ?? "Xatolik yuz berdi");
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Input className="max-w-xs" placeholder="F.I.Sh., login yoki hudud" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Qidiruv" />
        <Select className="max-w-52" value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)} aria-label="Rol">
          <option value="">Barcha rollar</option>
          {Object.entries(ROLE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </Select>
        <Button className="ml-auto" onClick={() => setForm({ ...blank })}><Plus className="h-4 w-4" /> Yangi foydalanuvchi</Button>
      </div>

      {form && (
        <Card className="border-blue-300">
          <CardHeader>
            <CardTitle>{form.id ? "Foydalanuvchini tahrirlash" : "Yangi foydalanuvchi"}</CardTitle>
            <Button variant="ghost" size="icon" onClick={() => setForm(null)} aria-label="Yopish"><X className="h-4 w-4" /></Button>
          </CardHeader>
          <CardBody className="grid gap-4 md:grid-cols-3">
            <Field label="F.I.Sh." required><Input value={form.full_name} onChange={(e) => set("full_name", e.target.value)} /></Field>
            <Field label="Login" required hint="Lotin harf, raqam, nuqta, tire. Masalan: samarqand.urgut">
              <Input value={form.username} disabled={!!form.id} onChange={(e) => set("username", e.target.value.toLowerCase())} autoComplete="off" />
            </Field>
            {!form.id && (
              <Field label="Parol" required hint="Kamida 8 belgi"><Input type="text" value={form.password} onChange={(e) => set("password", e.target.value)} autoComplete="new-password" /></Field>
            )}
            <Field label="Rol" required>
              <Select value={form.role} onChange={(e) => set("role", e.target.value as Role)}>
                {Object.entries(ROLE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </Select>
            </Field>
            {form.role !== "super_admin" && (
              <Field label="Hudud" required={form.role !== "observer"}>
                <Select value={form.region_id} onChange={(e) => { set("region_id", e.target.value); set("district_id", ""); }}>
                  <option value="">{form.role === "observer" ? "Respublika bo‘yicha (barchasi)" : "Tanlang…"}</option>
                  {regions.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                </Select>
              </Field>
            )}
            {form.role === "district_manager" && (
              <Field label="Tuman/shahar" required>
                <Select value={form.district_id} onChange={(e) => set("district_id", e.target.value)} disabled={!form.region_id}>
                  <option value="">Tanlang…</option>
                  {dOptions.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                  <option value="__new__">➕ Ro‘yxatda yo‘q — nomini yozaman</option>
                </Select>
              </Field>
            )}
            {form.role === "district_manager" && form.district_id === "__new__" && (
              <>
                <Field label="Yangi tuman/shahar nomi" required hint="Hudud ostida avtomatik yaratiladi">
                  <Input value={form.new_district_name} onChange={(e) => set("new_district_name", e.target.value)} />
                </Field>
                <Field label="Turi">
                  <Select value={form.new_district_type} onChange={(e) => set("new_district_type", e.target.value as "tuman" | "shahar")}>
                    <option value="tuman">Tuman</option>
                    <option value="shahar">Shahar</option>
                  </Select>
                </Field>
              </>
            )}
            <Field label="Telefon"><Input value={form.phone} onChange={(e) => set("phone", e.target.value)} placeholder="+998 90 123 45 67" /></Field>
            <div className="flex flex-col justify-end gap-2 md:col-span-3">
              {form.role === "region_manager" && (
                <label className="flex cursor-pointer items-center gap-2 text-sm">
                  <input type="checkbox" checked={form.can_edit_districts} onChange={(e) => set("can_edit_districts", e.target.checked)} className="h-4 w-4 accent-blue-800" />
                  Tuman nomidan tadbir kiritish va tuman ma’lumotlarini tahrirlashga ruxsat
                </label>
              )}
              {form.id && (
                <label className="flex cursor-pointer items-center gap-2 text-sm">
                  <input type="checkbox" checked={form.is_active} onChange={(e) => set("is_active", e.target.checked)} className="h-4 w-4 accent-blue-800" />
                  Hisob faol
                </label>
              )}
            </div>
            <div className="flex gap-2 md:col-span-3">
              <Button onClick={save} disabled={pending}>{pending ? "Saqlanmoqda…" : "Saqlash"}</Button>
              <Button variant="outline" onClick={() => setForm(null)}>Bekor qilish</Button>
            </div>
          </CardBody>
        </Card>
      )}

      {link && (
        <Card className="border-blue-300 bg-blue-50/60">
          <CardBody className="space-y-2">
            <p className="text-sm font-semibold text-slate-900">{link.who} — tezkor kirish havolasi (faqat hozir ko‘rinadi)</p>
            <div className="flex flex-wrap items-center gap-2">
              <code className="min-w-0 flex-1 break-all rounded bg-white p-2 text-xs">{link.url}</code>
              <Button size="sm" onClick={() => { void navigator.clipboard.writeText(link.url); toast.success("Nusxa olindi"); }}><Copy className="h-4 w-4" /> Nusxalash</Button>
              <Button size="sm" variant="ghost" onClick={() => setLink(null)}>Yopish</Button>
            </div>
            <p className="text-xs text-slate-600"><b>{link.until} gacha</b> amal qiladi (Toshkent vaqti). Havolaga ega har kim shu viloyat nomidan kira oladi — faqat mas’ul xodimga yuboring. Yangi havola yaratilsa, eskisi darhol ishlamay qoladi.</p>
          </CardBody>
        </Card>
      )}

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 px-4 py-3 text-sm text-slate-600">
          <span>Foydalanuvchilar: <b className="text-slate-900">{filtered.length}</b></span>
          <Button size="sm" variant="outline" onClick={allLinks} disabled={pending}><FileDown className="h-4 w-4" /> Viloyatlar uchun tezkor havolalar (Word)</Button>
        </div>
        <Table>
          <thead><tr><Th>F.I.Sh.</Th><Th>Login</Th><Th>Rol</Th><Th>Hudud</Th><Th>Telefon</Th><Th>Tezkor havola</Th><Th>Holati</Th><Th><span className="sr-only">Amallar</span></Th></tr></thead>
          <tbody>
            {filtered.map((u) => (
              <tr key={u.id} className="hover:bg-slate-50">
                <Td className="font-medium">
                  <div className="flex items-center gap-3">
                    {u.avatar_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={u.avatar_url} alt="" className="h-12 w-9 shrink-0 rounded object-cover ring-1 ring-slate-300" />
                    ) : (
                      <span className="flex h-12 w-9 shrink-0 items-center justify-center rounded bg-slate-100 text-slate-400">—</span>
                    )}
                    <span>{u.full_name}{u.position && <span className="block text-xs font-normal text-slate-500">{u.position}</span>}{regionName(u.region_id) && <span className="mt-0.5 inline-block rounded bg-blue-50 px-1.5 py-0.5 text-xs font-medium text-blue-800">{regionName(u.region_id)}</span>}</span>
                  </div>
                </Td>
                <Td>{u.username}</Td>
                <Td>{ROLE_LABELS[u.role]}{u.can_edit_districts && <div className="text-xs text-slate-500">tuman tahriri: ruxsat</div>}</Td>
                <Td>{[regionName(u.region_id), districtName(u.district_id)].filter(Boolean).join(" · ") || "—"}</Td>
                <Td className="whitespace-nowrap">{formatPhone(u.phone)}</Td>
                <Td className="whitespace-nowrap text-xs">
                  {u.role !== "region_manager" ? <span className="text-slate-300">—</span> : !u.link ? <span className="text-slate-400">yaratilmagan</span> : u.link.state === "faol"
                    ? <span><Badge tone="green">faol</Badge><span className="block text-slate-500">{u.link.until} gacha · {u.link.uses} marta kirgan</span></span>
                    : <span><Badge tone={u.link.state === "bekor" ? "amber" : "red"}>{u.link.state === "bekor" ? "bekor qilingan" : "muddati o‘tgan"}</Badge><span className="block text-slate-500">{u.link.uses} marta kirgan</span></span>}
                </Td>
                <Td>{u.is_active ? <Badge tone="green">Faol</Badge> : <Badge tone="red">Faolsiz</Badge>}</Td>
                <Td>
                  <div className="flex gap-1">
                    <Button size="sm" variant="outline" onClick={() => setForm({ ...blank, ...u, region_id: u.region_id ?? "", district_id: u.district_id ?? "", phone: u.phone ?? "", password: "" })}>
                      <Pencil className="h-3.5 w-3.5" /> Tahrirlash
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => reset(u)} aria-label="Parolni yangilash"><KeyRound className="h-3.5 w-3.5" /></Button>
                    {u.role === "region_manager" && <Button size="sm" variant="ghost" onClick={() => oneLink(u)} disabled={pending} aria-label="Tezkor kirish havolasi" title="Tezkor kirish havolasi (login-parolsiz)"><Link2 className="h-3.5 w-3.5" /></Button>}
                  </div>
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Card>
    </div>
  );
}
