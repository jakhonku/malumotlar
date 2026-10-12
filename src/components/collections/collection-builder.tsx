"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowDown, ArrowUp, Plus, Save, Trash2 } from "lucide-react";
import { saveCollection } from "@/app/actions/collections";
import { Button, Card, CardBody, CardHeader, CardTitle, Field, Input, Select, Textarea } from "@/components/ui/primitives";
import {
  AUDIENCE_LABELS, COLUMN_TYPE_LABELS, COLUMN_TYPES, FIELD_TYPE_LABELS, FIELD_TYPES, slugKey,
  type CollectionInput, type ColumnDef, type ColumnType, type FieldDef, type FieldType,
} from "@/lib/collections";

interface DraftField {
  uid: number;
  key: string | null; // mavjud maydon kaliti o‘zgarmaydi (eski javoblar saqlansin)
  label: string;
  type: FieldType;
  required: boolean;
  help: string;
  optionsText: string;
  columns: DraftColumn[];
}

interface DraftColumn {
  uid: number;
  key: string | null;
  label: string;
  type: ColumnType;
  required: boolean;
  optionsText: string;
}

let uidCounter = 1;
const toDraftCol = (c: ColumnDef): DraftColumn => ({
  uid: uidCounter++, key: c.key, label: c.label, type: c.type, required: !!c.required, optionsText: (c.options ?? []).join("\n"),
});
const blankCol = (): DraftColumn => ({ uid: uidCounter++, key: null, label: "", type: "text", required: false, optionsText: "" });
const toDraft = (f: FieldDef): DraftField => ({
  uid: uidCounter++, key: f.key, label: f.label, type: f.type, required: f.required, help: f.help ?? "",
  optionsText: (f.options ?? []).join("\n"), columns: (f.columns ?? []).map(toDraftCol),
});
const blankField = (): DraftField => ({
  uid: uidCounter++, key: null, label: "", type: "text", required: false, help: "", optionsText: "", columns: [],
});

function uniqueKey(label: string, used: Set<string>): string {
  const base = slugKey(label);
  let key = base;
  for (let n = 2; used.has(key); n++) key = `${base}_${n}`.slice(0, 40);
  used.add(key);
  return key;
}

export function CollectionBuilder({ id, initial }: { id: string | null; initial: CollectionInput }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [title, setTitle] = useState(initial.title);
  const [description, setDescription] = useState(initial.description ?? "");
  const [entryLabel, setEntryLabel] = useState(initial.entry_label);
  const [audience, setAudience] = useState(initial.audience);
  const [allowMultiple, setAllowMultiple] = useState(initial.allow_multiple);
  const [isActive, setIsActive] = useState(initial.is_active);
  const [deadline, setDeadline] = useState(initial.deadline ?? "");
  const [fields, setFields] = useState<DraftField[]>(() => (initial.fields.length ? initial.fields.map(toDraft) : [blankField()]));

  const patch = (uid: number, p: Partial<DraftField>) => setFields((fs) => fs.map((f) => (f.uid === uid ? { ...f, ...p } : f)));
  const patchCol = (uid: number, cuid: number, p: Partial<DraftColumn>) =>
    setFields((fs) => fs.map((f) => (f.uid === uid ? { ...f, columns: f.columns.map((c) => (c.uid === cuid ? { ...c, ...p } : c)) } : f)));
  const move = (i: number, d: -1 | 1) =>
    setFields((fs) => {
      const j = i + d;
      if (j < 0 || j >= fs.length) return fs;
      const copy = fs.slice();
      [copy[i], copy[j]] = [copy[j], copy[i]];
      return copy;
    });

  function build(): CollectionInput {
    const used = new Set(fields.filter((f) => f.key).map((f) => f.key as string));
    const out: FieldDef[] = fields
      .filter((f) => f.label.trim() || f.key)
      .map((f) => {
        let key = f.key;
        if (!key) {
          const base = slugKey(f.label);
          key = base;
          for (let n = 2; used.has(key); n++) key = `${base}_${n}`.slice(0, 40);
          used.add(key);
        }
        const options = f.type === "select" || f.type === "multiselect"
          ? f.optionsText.split("\n").map((s) => s.trim()).filter(Boolean)
          : undefined;
        let columns: ColumnDef[] | undefined;
        if (f.type === "rows") {
          const usedCols = new Set(f.columns.filter((c) => c.key).map((c) => c.key as string));
          columns = f.columns
            .filter((c) => c.label.trim() || c.key)
            .map((c) => ({
              key: c.key ?? uniqueKey(c.label, usedCols),
              label: c.label.trim(),
              type: c.type,
              required: c.required,
              options: c.type === "select" ? c.optionsText.split("\n").map((s) => s.trim()).filter(Boolean) : undefined,
            }));
        }
        return { key, label: f.label.trim(), type: f.type, required: f.required, help: f.help.trim() || undefined, options, columns };
      });
    return {
      title, description: description || undefined, entry_label: entryLabel, audience,
      allow_multiple: allowMultiple, is_active: isActive, deadline: deadline || null, fields: out,
    };
  }

  function save() {
    start(async () => {
      const res = await saveCollection(id, build());
      if (!res.ok) return void toast.error(res.error ?? "Xatolik yuz berdi");
      toast.success(id ? "Saqlandi" : "Ma’lumot yig‘ish yaratildi");
      router.push(`/collections/${res.id}`);
      router.refresh();
    });
  }

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader><CardTitle>Asosiy sozlamalar</CardTitle></CardHeader>
        <CardBody className="grid gap-4 md:grid-cols-2">
          <Field label="Nomi" required className="md:col-span-2" hint="Masalan: Yangi yil tadbirlari, Bayram tadbirlari, Yoshlar festivali">
            <Input value={title} onChange={(e) => setTitle(e.target.value)} />
          </Field>
          <Field label="Izoh / ko‘rsatma" className="md:col-span-2" hint="Hududlar to‘ldirishdan oldin shu matnni ko‘radi">
            <Textarea rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
          </Field>
          <Field label="Bitta yozuv nomi" required hint="Masalan: Tadbir, Obyekt, Dastur">
            <Input value={entryLabel} onChange={(e) => setEntryLabel(e.target.value)} />
          </Field>
          <Field label="Kim to‘ldiradi?" required>
            <Select value={audience} onChange={(e) => setAudience(e.target.value as typeof audience)}>
              {Object.entries(AUDIENCE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </Select>
          </Field>
          <Field label="Oxirgi muddat" hint="Muddat o‘tgach forma yopiladi (ixtiyoriy)">
            <Input type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
          </Field>
          <div className="flex flex-col justify-end gap-2 text-sm">
            <label className="flex cursor-pointer items-center gap-2">
              <input type="checkbox" className="h-4 w-4 accent-blue-800" checked={allowMultiple} onChange={(e) => setAllowMultiple(e.target.checked)} />
              Har bir hudud bir nechta yozuv kirita oladi
            </label>
            <label className="flex cursor-pointer items-center gap-2">
              <input type="checkbox" className="h-4 w-4 accent-blue-800" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
              Faol (hududlar to‘ldira oladi)
            </label>
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Qanday ma’lumot yig‘iladi? ({fields.length} ta maydon)</CardTitle>
          <Button variant="outline" size="sm" onClick={() => setFields((fs) => [...fs, blankField()])}><Plus className="h-4 w-4" /> Maydon qo‘shish</Button>
        </CardHeader>
        <CardBody className="space-y-3">
          <p className="text-sm text-slate-600">
            Hudud (viloyat/tuman) har doim avtomatik olinadi — uni maydon sifatida qo‘shish shart emas.
            Mavjud maydonning nomini o‘zgartirsangiz ham, avval kiritilgan javoblar saqlanib qoladi.
          </p>
          {fields.map((f, i) => (
            <div key={f.uid} className="grid gap-3 rounded-lg border border-slate-200 p-4 md:grid-cols-6">
              <Field label={`${i + 1}. Maydon nomi`} required className="md:col-span-3">
                <Input value={f.label} onChange={(e) => patch(f.uid, { label: e.target.value })} placeholder="Masalan: O‘tkaziladigan joy" />
              </Field>
              <Field label="Turi" className="md:col-span-2">
                <Select value={f.type} onChange={(e) => patch(f.uid, { type: e.target.value as FieldType, columns: e.target.value === "rows" && !f.columns.length ? [blankCol()] : f.columns })}>
                  {FIELD_TYPES.map((t) => <option key={t} value={t}>{FIELD_TYPE_LABELS[t]}</option>)}
                </Select>
              </Field>
              <label className="flex cursor-pointer items-end gap-2 pb-2 text-sm md:col-span-1">
                <input type="checkbox" className="h-4 w-4 accent-blue-800" checked={f.required} onChange={(e) => patch(f.uid, { required: e.target.checked })} />
                Majburiy
              </label>
              <Field label="Yordamchi izoh" className="md:col-span-3">
                <Input value={f.help} onChange={(e) => patch(f.uid, { help: e.target.value })} placeholder="Maydon tagida ko‘rinadi (ixtiyoriy)" />
              </Field>
              {(f.type === "select" || f.type === "multiselect") && (
                <Field label="Variantlar (har biri yangi qatordan)" required className="md:col-span-3">
                  <Textarea rows={3} value={f.optionsText} onChange={(e) => patch(f.uid, { optionsText: e.target.value })} />
                </Field>
              )}
              {f.type === "rows" && (
                <div className="space-y-2 rounded-md border border-blue-200 bg-blue-50/40 p-3 md:col-span-6">
                  <p className="text-sm font-medium text-slate-800">Har bir qatordagi kataklar</p>
                  <p className="text-xs text-slate-600">Masalan, san’atkorlar uchun: «F.I.Sh. yoki jamoa nomi» va «Janri». Foydalanuvchi shu kataklarni qator-qator to‘ldiradi.</p>
                  {f.columns.map((c) => (
                    <div key={c.uid} className="grid gap-2 sm:grid-cols-[1fr_12rem_auto_auto] sm:items-end">
                      <Field label="Katak nomi"><Input value={c.label} onChange={(e) => patchCol(f.uid, c.uid, { label: e.target.value })} /></Field>
                      <Field label="Turi">
                        <Select value={c.type} onChange={(e) => patchCol(f.uid, c.uid, { type: e.target.value as ColumnType })}>
                          {COLUMN_TYPES.map((t) => <option key={t} value={t}>{COLUMN_TYPE_LABELS[t]}</option>)}
                        </Select>
                      </Field>
                      <label className="flex cursor-pointer items-center gap-2 pb-2 text-sm">
                        <input type="checkbox" className="h-4 w-4 accent-blue-800" checked={c.required} onChange={(e) => patchCol(f.uid, c.uid, { required: e.target.checked })} /> Majburiy
                      </label>
                      <Button variant="ghost" size="sm" aria-label="Katakni o‘chirish" onClick={() => patch(f.uid, { columns: f.columns.filter((x) => x.uid !== c.uid) })}>
                        <Trash2 className="h-4 w-4 text-red-700" />
                      </Button>
                      {c.type === "select" && (
                        <Field label="Variantlar (har biri yangi qatordan)" className="sm:col-span-4">
                          <Textarea rows={2} value={c.optionsText} onChange={(e) => patchCol(f.uid, c.uid, { optionsText: e.target.value })} />
                        </Field>
                      )}
                    </div>
                  ))}
                  <Button variant="outline" size="sm" disabled={f.columns.length >= 8} onClick={() => patch(f.uid, { columns: [...f.columns, blankCol()] })}>
                    <Plus className="h-4 w-4" /> Katak qo‘shish
                  </Button>
                </div>
              )}
              <div className="flex items-center justify-end gap-1 md:col-span-6">
                <Button variant="ghost" size="sm" onClick={() => move(i, -1)} disabled={i === 0} aria-label="Yuqoriga"><ArrowUp className="h-4 w-4" /></Button>
                <Button variant="ghost" size="sm" onClick={() => move(i, 1)} disabled={i === fields.length - 1} aria-label="Pastga"><ArrowDown className="h-4 w-4" /></Button>
                <Button variant="ghost" size="sm" onClick={() => setFields((fs) => fs.filter((x) => x.uid !== f.uid))} aria-label="O‘chirish">
                  <Trash2 className="h-4 w-4 text-red-700" />
                </Button>
              </div>
            </div>
          ))}
        </CardBody>
      </Card>

      <div className="sticky bottom-0 z-10 flex gap-2 border-t border-slate-200 bg-white/95 py-3 backdrop-blur">
        <Button size="lg" onClick={save} disabled={pending}><Save className="h-4 w-4" /> {pending ? "Saqlanmoqda…" : "Saqlash"}</Button>
        <Button size="lg" variant="outline" onClick={() => router.back()}>Bekor qilish</Button>
      </div>
    </div>
  );
}
