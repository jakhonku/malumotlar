"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Plus, Save, Trash2 } from "lucide-react";
import { savePublicEntry, type EntryGeo } from "@/app/actions/public";
import { Button, Card, CardBody, Field, Input, Select, Textarea } from "@/components/ui/primitives";
import { validateAnswers, type Answers, type AnswerValue, type ColumnDef, type FieldDef, type RowObj } from "@/lib/collections";

type Values = Record<string, AnswerValue | undefined>;

const emptyRow = (cols: ColumnDef[]): RowObj => Object.fromEntries(cols.map((c) => [c.key, null]));

/** «Qatorlar ro‘yxati»: har bir qator — alohida san’atkor/guruh; qator qo‘shish va o‘chirish tugmalari bilan. */
function RowsInput({ f, value, onChange }: { f: FieldDef; value: Values[string]; onChange: (v: RowObj[]) => void }) {
  const cols = f.columns ?? [];
  const rows: RowObj[] = Array.isArray(value) && value.length && typeof value[0] === "object" ? (value as RowObj[]) : [emptyRow(cols)];
  const setCell = (i: number, key: string, v: string) => onChange(rows.map((r, idx) => (idx === i ? { ...r, [key]: v } : r)));
  const remove = (i: number) => onChange(rows.length > 1 ? rows.filter((_, idx) => idx !== i) : [emptyRow(cols)]);

  return (
    <div className="space-y-2 rounded-md border border-slate-300 bg-slate-50 p-3">
      {rows.map((row, i) => (
        <div key={i} className="grid items-end gap-2 sm:grid-cols-[2rem_1fr_2.25rem]">
          <span className="hidden pb-2 text-center text-sm font-semibold text-slate-500 sm:block">{i + 1}.</span>
          <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${Math.min(cols.length, 3)}, minmax(0, 1fr))` }}>
            {cols.map((c) => (
              <label key={c.key} className="block text-xs font-medium text-slate-600">
                {c.label}
                {c.required && <span className="text-red-600">*</span>}
                {c.type === "select" ? (
                  <Select className="mt-1" value={String(row[c.key] ?? "")} onChange={(e) => setCell(i, c.key, e.target.value)}>
                    <option value="">Tanlang…</option>
                    {c.options?.map((o) => <option key={o} value={o}>{o}</option>)}
                  </Select>
                ) : (
                  <Input
                    className="mt-1"
                    type={c.type === "number" ? "number" : c.type === "phone" ? "tel" : "text"}
                    inputMode={c.type === "number" ? "numeric" : c.type === "phone" ? "tel" : undefined}
                    value={row[c.key] === null || row[c.key] === undefined ? "" : String(row[c.key])}
                    onChange={(e) => setCell(i, c.key, e.target.value)}
                  />
                )}
              </label>
            ))}
          </div>
          <Button variant="ghost" size="icon" onClick={() => remove(i)} aria-label="Qatorni o‘chirish"><Trash2 className="h-4 w-4 text-red-700" /></Button>
        </div>
      ))}
      <Button variant="outline" size="sm" onClick={() => onChange([...rows, emptyRow(cols)])}>
        <Plus className="h-4 w-4" /> Qator qo‘shish
      </Button>
    </div>
  );
}

function FieldInput({
  f, value, error, onChange,
}: { f: FieldDef; value: Values[string]; error?: string; onChange: (v: Values[string]) => void }) {
  const common = { "aria-invalid": !!error } as const;
  const str = value === null || value === undefined || typeof value === "object" ? "" : String(value);
  switch (f.type) {
    case "rows":
      return <RowsInput f={f} value={value} onChange={onChange} />;
    case "textarea":
      return <Textarea rows={3} value={str} onChange={(e) => onChange(e.target.value)} {...common} />;
    case "number":
      return <Input type="number" inputMode="decimal" value={str} onChange={(e) => onChange(e.target.value)} {...common} />;
    case "date":
      return <Input type="date" value={str} onChange={(e) => onChange(e.target.value)} {...common} />;
    case "time":
      return <Input type="time" value={str.slice(0, 5)} onChange={(e) => onChange(e.target.value)} {...common} />;
    case "phone":
      return <Input type="tel" inputMode="tel" placeholder="+998 90 123 45 67" value={str} onChange={(e) => onChange(e.target.value)} {...common} />;
    case "select":
      return (
        <Select value={str} onChange={(e) => onChange(e.target.value)} {...common}>
          <option value="">Tanlang…</option>
          {f.options?.map((o) => <option key={o} value={o}>{o}</option>)}
        </Select>
      );
    case "multiselect": {
      const arr: string[] = Array.isArray(value) ? (value as unknown[]).filter((x): x is string => typeof x === "string") : [];
      return (
        <div className="flex flex-wrap gap-x-5 gap-y-2 rounded-md border border-slate-300 bg-white p-3">
          {f.options?.map((o) => (
            <label key={o} className="flex cursor-pointer items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="h-4 w-4 accent-blue-800"
                checked={arr.includes(o)}
                onChange={(e) => onChange(e.target.checked ? [...arr, o] : arr.filter((x) => x !== o))}
              />
              {o}
            </label>
          ))}
        </div>
      );
    }
    case "checkbox":
      return (
        <label className="flex h-10 cursor-pointer items-center gap-2 text-sm">
          <input type="checkbox" className="h-4 w-4 accent-blue-800" checked={value === true} onChange={(e) => onChange(e.target.checked)} />
          Ha
        </label>
      );
    default:
      return <Input value={str} onChange={(e) => onChange(e.target.value)} {...common} />;
  }
}

export interface GeoChooser {
  districts: { id: string; name: string }[];
  allowRegional: boolean;
  /** «Viloyatning o‘zi» yozuvi (hudud turiga qarab) */
  selfLabel?: string;
  /** allaqachon yozuv kiritilgan hududlar ("regional" yoki tuman id) — ro‘yxatda ✓ bilan belgilanadi */
  filled?: string[];
  /** boshlang‘ich tanlov: "regional" | tuman id | "" */
  initial: string;
}

export function DynamicForm({
  collection, token, entryId, entryStatus, geo, geoLabel, initial, chooser, adminSave,
}: {
  collection: { id: string; title: string; entry_label: string; fields: FieldDef[]; allow_multiple?: boolean };
  /** tahrirlanayotgan yozuvning holati (yuborilgan bo‘lsa, tahrir qayta yuborishni talab qilmaydi) */
  entryStatus?: string;
  token: string | null;
  entryId: string | null;
  geo: EntryGeo;
  geoLabel: string;
  initial: Answers;
  /** Viloyat boshqarmasi rejimi: har bir yozuvda hududni tanlash */
  chooser?: GeoChooser;
  /** Administrator tahriri: saqlash amali va qaytish manzili */
  adminSave?: { save: (values: Record<string, unknown>) => Promise<{ ok: boolean; error?: string; fieldErrors?: Record<string, string> }>; redirectTo: string };
}) {
  const router = useRouter();
  const lockFilled = collection.allow_multiple === false; // bir hududga bitta yozuv
  const [values, setValues] = useState<Values>(initial as Values);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [sel, setSel] = useState(chooser?.initial ?? "");
  const [newName, setNewName] = useState("");
  const [newType, setNewType] = useState<"tuman" | "shahar">("tuman");
  const [geoError, setGeoError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const set = (key: string, v: Values[string]) => {
    setValues((cur) => ({ ...cur, [key]: v }));
    setErrors((cur) => {
      if (!(key in cur)) return cur;
      const { [key]: _drop, ...rest } = cur;
      void _drop;
      return rest;
    });
  };

  function persist(mode: "draft" | "submit", next = false) {
    setServerError(null);
    let useGeo: EntryGeo = geo;
    if (chooser) {
      if (!sel) return void (setGeoError("Qaysi hudud uchun ma’lumot kiritilayotganini tanlang"), toast.error("Hududni tanlang"));
      if (sel === "__new__" && newName.trim().length < 3) return void (setGeoError("Tuman/shahar nomini yozing"), toast.error("Tuman/shahar nomini yozing"));
      useGeo =
        sel === "regional"
          ? { ...geo, scope: "regional", district_id: "" }
          : sel === "__new__"
            ? { ...geo, scope: "district", district_id: "__new__", new_district_name: newName.trim(), new_district_type: newType }
            : { ...geo, scope: "district", district_id: sel };
      setGeoError(null);
    }
    const check = validateAnswers(collection.fields, values as Record<string, unknown>, false);
    if (!check.ok) {
      setErrors(check.errors);
      toast.error("Ba’zi maydonlar to‘ldirilmagan yoki noto‘g‘ri");
      return;
    }
    if (adminSave) {
      start(async () => {
        const r = await adminSave.save(values as Record<string, unknown>);
        if (!r.ok) {
          if (r.fieldErrors) setErrors(r.fieldErrors);
          setServerError(r.error ?? "Xatolik yuz berdi");
          return void toast.error(r.error ?? "Xatolik yuz berdi");
        }
        toast.success("Ma’lumot yangilandi");
        router.push(adminSave.redirectTo);
        router.refresh();
      });
      return;
    }
    start(async () => {
      const res = await savePublicEntry(collection.id, token, entryId, useGeo, values as Record<string, unknown>, mode);
      if (!res.ok) {
        if (res.fieldErrors) setErrors(res.fieldErrors);
        setServerError(res.error ?? "Xatolik yuz berdi");
        toast.error(res.error ?? "Xatolik yuz berdi");
        if (res.token && !token) router.push(`/kiritish/c/${collection.id}/t/${res.token}`);
        return;
      }
      toast.success(entryStatus === "submitted" ? "Yangilandi — vazirlikda yangilangan ma’lumot ko‘rinadi." : "Saqlandi. Endi jadvalni tekshirib, yuboring.");
      router.push(`/kiritish/c/${collection.id}/t/${res.token}${next ? "/yangi" : ""}`);
      router.refresh();
    });
  }

  return (
    <form onSubmit={(e) => e.preventDefault()} noValidate className="space-y-5">
      <div className="rounded-md border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">
        <p className="text-xs uppercase tracking-wide text-blue-700">Ma’lumot kiritilayotgan hudud</p>
        <p className="font-semibold">{geoLabel}</p>
      </div>

      {chooser && (
        <Card>
          <CardBody className="grid gap-4 md:grid-cols-3">
            <Field label="Qaysi hudud uchun kiritilmoqda?" required error={geoError ?? undefined} className="md:col-span-2" hint="Har bir tuman/shahar uchun alohida yozuv kiritiladi.">
              <Select value={sel} onChange={(e) => { setSel(e.target.value); setGeoError(null); }} disabled={!!entryId}>
                <option value="">Tanlang…</option>
                {chooser.allowRegional && <option value="regional" disabled={lockFilled && !!chooser.filled?.includes("regional")}>{chooser.filled?.includes("regional") ? "✓ " : ""}{chooser.selfLabel ?? "Viloyatning o‘zi"}</option>}
                {chooser.districts.map((d) => <option key={d.id} value={d.id} disabled={lockFilled && !!chooser.filled?.includes(d.id)}>{chooser.filled?.includes(d.id) ? "✓ " : ""}{d.name}{lockFilled && chooser.filled?.includes(d.id) ? " — kiritilgan (tahrirlash mumkin)" : ""}</option>)}
                <option value="__new__">➕ Ro‘yxatda yo‘q — nomini o‘zim yozaman</option>
              </Select>
            </Field>
            {sel === "__new__" && (
              <>
                <Field label="Tuman/shahar nomi" required className="md:col-span-2"><Input value={newName} onChange={(e) => setNewName(e.target.value)} /></Field>
                <Field label="Turi">
                  <Select value={newType} onChange={(e) => setNewType(e.target.value as "tuman" | "shahar")}>
                    <option value="tuman">Tuman</option>
                    <option value="shahar">Shahar</option>
                  </Select>
                </Field>
              </>
            )}
          </CardBody>
        </Card>
      )}

      <Card>
        <CardBody className="grid gap-4 md:grid-cols-2">
          {collection.fields.map((f) => (
            <Field
              key={f.key}
              label={f.label}
              required={f.required}
              error={errors[f.key]}
              hint={f.help}
              className={f.type === "textarea" || f.type === "multiselect" || f.type === "rows" ? "md:col-span-2" : undefined}
            >
              <FieldInput f={f} value={values[f.key]} error={errors[f.key]} onChange={(v) => set(f.key, v)} />
            </Field>
          ))}
        </CardBody>
      </Card>

      {serverError && <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm font-medium text-red-800">{serverError}</p>}

      <div className="sticky bottom-0 z-10 -mx-4 flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 bg-white/95 px-4 py-3 backdrop-blur">
        <p className="text-sm text-slate-600">{adminSave ? "Administrator tahriri: saqlagach yozuv holati o‘zgarmaydi." : entryStatus === "submitted" ? "Bu ma’lumot yuborilgan. O‘zgartirib saqlasangiz, qayta yuborish shart emas — vazirlikda yangilangan holda ko‘rinadi." : "Saqlagach, kiritgan ma’lumotingiz jadval ko‘rinishida chiqadi — tekshirib, keyin yuborasiz."}</p>
        {chooser && !entryId && (
          <Button variant="outline" size="lg" disabled={pending} onClick={() => persist("draft", true)}>
            <Plus className="h-4 w-4" /> Saqlash va keyingi hududni kiritish
          </Button>
        )}
        <Button variant="success" size="lg" disabled={pending} onClick={() => persist("draft")}>
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} {adminSave ? "Saqlash" : "Saqlash va jadvalni ko‘rish"}
        </Button>
      </div>
    </form>
  );
}
