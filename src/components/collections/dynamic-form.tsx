"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Plus, Save, Send, Trash2 } from "lucide-react";
import { savePublicEntry, type EntryGeo } from "@/app/actions/public";
import { Button, Card, CardBody, Field, Input, Select, Textarea } from "@/components/ui/primitives";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
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

export function DynamicForm({
  collection, token, entryId, geo, geoLabel, initial,
}: {
  collection: { id: string; title: string; entry_label: string; fields: FieldDef[] };
  token: string | null;
  entryId: string | null;
  geo: EntryGeo;
  geoLabel: string;
  initial: Answers;
}) {
  const router = useRouter();
  const [values, setValues] = useState<Values>(initial as Values);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState(false);
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

  function persist(mode: "draft" | "submit") {
    setServerError(null);
    const check = validateAnswers(collection.fields, values as Record<string, unknown>, mode === "draft");
    if (!check.ok) {
      setErrors(check.errors);
      setConfirm(false);
      toast.error("Ba’zi maydonlar to‘ldirilmagan yoki noto‘g‘ri");
      return;
    }
    start(async () => {
      const res = await savePublicEntry(collection.id, token, entryId, geo, values as Record<string, unknown>, mode);
      if (!res.ok) {
        if (res.fieldErrors) setErrors(res.fieldErrors);
        setServerError(res.error ?? "Xatolik yuz berdi");
        toast.error(res.error ?? "Xatolik yuz berdi");
        setConfirm(false);
        if (res.token && !token) router.push(`/kiritish/c/${collection.id}/t/${res.token}`);
        return;
      }
      toast.success(mode === "draft" ? "Qoralama saqlandi" : "Ma’lumot yuborildi");
      router.push(`/kiritish/c/${collection.id}/t/${res.token}`);
      router.refresh();
    });
  }

  return (
    <form onSubmit={(e) => e.preventDefault()} noValidate className="space-y-5">
      <div className="rounded-md border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">
        <p className="text-xs uppercase tracking-wide text-blue-700">Ma’lumot kiritilayotgan hudud</p>
        <p className="font-semibold">{geoLabel}</p>
      </div>

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
        <Button variant="outline" disabled={pending} onClick={() => persist("draft")}>
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Qoralama sifatida saqlash
        </Button>
        <Button variant="success" disabled={pending} onClick={() => {
          const check = validateAnswers(collection.fields, values as Record<string, unknown>, false);
          if (!check.ok) {
            setErrors(check.errors);
            toast.error("Ba’zi majburiy maydonlar to‘ldirilmagan");
            return;
          }
          setConfirm(true);
        }}>
          <Send className="h-4 w-4" /> Saqlash va yuborish
        </Button>
      </div>

      <ConfirmDialog
        open={confirm}
        title="Vazirlikka yuborish"
        description={`Yuborilgandan so‘ng ${collection.entry_label.toLowerCase()}ni qaytarilmaguncha tahrirlab bo‘lmaydi. Davom etasizmi?`}
        confirmLabel="Ha, yuborish"
        onClose={() => setConfirm(false)}
        onConfirm={async () => {
          persist("submit");
        }}
      />
    </form>
  );
}
