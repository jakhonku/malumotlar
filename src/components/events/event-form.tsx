"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Controller, FormProvider, useFieldArray, useForm, useFormContext, type FieldPath, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { AlertTriangle, Check, ChevronLeft, ChevronRight, Loader2, Plus, Save, Send, ShieldCheck, Trash2 } from "lucide-react";
import { saveEvent } from "@/app/actions/events";
import { savePublicEvent } from "@/app/actions/public";
import { Button, Card, CardBody, Field, Input, Select, Textarea, cn } from "@/components/ui/primitives";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { submitSchema, type EventFormValues } from "@/lib/validators";
import { EVENT_TYPES, PARTICIPANT_CATEGORIES, SCOPE_LABELS, type Role } from "@/lib/constants";
import { formatPhone } from "@/lib/phone";
import type { FormContext } from "@/lib/event-defaults";

interface Opt { id: string; name: string }
interface Dist extends Opt { region_id: string }


const NEW_DISTRICT = "__new__";

type StepKey = "basic" | "place" | "artists" | "participants" | "resp" | "review" | "main" | "extra";

const FULL_STEPS: StepKey[] = ["basic", "place", "artists", "participants", "resp", "review"];
// Ochiq forma: qisqa yo‘l — tadbir/joy/vaqt, mas’ul, ixtiyoriy qo‘shimcha, yuborish
const SIMPLE_STEPS: StepKey[] = ["main", "resp", "extra", "review"];

const STEP_LABELS: Record<StepKey, string> = {
  basic: "Asosiy ma’lumotlar",
  place: "Manzil va sana",
  artists: "San’atkorlar va jamoalar",
  participants: "Ishtirokchilar",
  resp: "Mas’ul ijrochilar",
  review: "Tekshirish va yuborish",
  main: "Tadbir, manzil va sana",
  extra: "Qo‘shimcha (ixtiyoriy)",
};

const BASIC_FIELDS: FieldPath<EventFormValues>[] = ["scope", "region_id", "district_id", "new_district_name", "organization_name", "description", "notes"];
const PLACE_FIELDS: FieldPath<EventFormValues>[] = ["address", "location_note", "start_date", "end_date"];

const STEP_FIELDS: Record<StepKey, FieldPath<EventFormValues>[]> = {
  basic: BASIC_FIELDS,
  place: PLACE_FIELDS,
  artists: ["artists"],
  participants: ["participants"],
  resp: ["responsibles"],
  review: [],
  main: [...BASIC_FIELDS, ...PLACE_FIELDS],
  extra: ["artists", "participants"],
};

/** Butunlay bo‘sh qatorlarni olib tashlaydi. */
function cleanValues(v: EventFormValues): EventFormValues {
  const blank = (...xs: unknown[]) => xs.every((x) => x === "" || x === null || x === undefined);
  return {
    ...v,
    district_id: v.district_id === NEW_DISTRICT ? "" : v.district_id,
    artists: v.artists.filter((a) => !blank(a.artist_name, a.performance_type, a.role_description, a.notes)),
    participants: v.participants.filter((p) => !blank(p.participant_name, p.participant_category, p.participant_count, p.participation_role, p.notes)),
    responsibles: v.responsibles.filter((r) => !blank(r.full_name, r.position, r.organization, r.phone, r.notes)),
  };
}

function errMsg(e: unknown): string | undefined {
  const x = e as { message?: string; root?: { message?: string } } | undefined;
  return x?.message ?? x?.root?.message;
}

export function EventForm({
  eventId, initial, ctx, regions, districts, lockedGeo, lockedLabel, publicMode,
}: {
  eventId: string | null;
  initial: EventFormValues;
  ctx: FormContext;
  regions: Opt[];
  districts: Dist[];
  /** Tahrirlashda hudud va ko‘lam o‘zgarmaydi */
  lockedGeo?: boolean;
  lockedLabel?: string;
  /** Ochiq forma (login yo‘q): token — mavjud yozuvni tahrirlash uchun */
  publicMode?: { token: string | null; eventId?: string | null };
}) {
  const router = useRouter();
  const steps = publicMode ? SIMPLE_STEPS : FULL_STEPS;
  const [step, setStep] = useState(0);
  const key = steps[step];
  const hideGeo = !!publicMode && !!lockedGeo;
  const [pending, start] = useTransition();
  const [confirmSubmit, setConfirmSubmit] = useState(false);
  const [checked, setChecked] = useState<{ ok: boolean; duplicates?: { id: string; title: string; address: string | null; start_date: string | null }[] } | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);

  const form = useForm<EventFormValues>({
    resolver: zodResolver(submitSchema) as unknown as Resolver<EventFormValues>,
    defaultValues: initial,
    mode: "onTouched",
  });
  const { register, control, watch, setValue, trigger, getValues, setError, formState: { errors } } = form;

  const scope = watch("scope");
  const regionId = watch("region_id");
  const districtId = watch("district_id");

  const regionLocked = lockedGeo || ctx.role !== "super_admin";
  const scopeLocked = lockedGeo || ctx.role === "district_manager" || (ctx.role === "region_manager" && !ctx.canEditDistricts);
  const districtLocked = lockedGeo || ctx.role === "district_manager";
  const canAddDistrict = !districtLocked && scope === "district" && !!regionId;
  const distOptions = useMemo(() => districts.filter((d) => d.region_id === regionId), [districts, regionId]);

  function applyServerErrors(fe?: Record<string, string>) {
    if (!fe) return;
    let first: number | null = null;
    for (const [path, message] of Object.entries(fe)) {
      setError(path as FieldPath<EventFormValues>, { type: "server", message });
      const idx = steps.findIndex((k) => STEP_FIELDS[k].some((f) => path === f || path.startsWith(f + ".")));
      if (idx >= 0 && (first === null || idx < first)) first = idx;
    }
    if (first !== null) setStep(first);
  }

  async function goNext() {
    const fields = STEP_FIELDS[key];
    const ok = fields.length ? await trigger(fields) : true;
    if (!ok) {
      toast.error("Iltimos, belgilangan maydonlarni to‘g‘rilang");
      return;
    }
    setStep((s) => Math.min(s + 1, steps.length - 1));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function goTo(i: number) {
    setStep(i);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function persist(mode: "draft" | "validate" | "submit") {
    setServerError(null);
    start(async () => {
      const values = cleanValues(getValues());
      if (mode !== "draft") {
        const ok = await trigger();
        if (!ok) {
          toast.error("Ba’zi majburiy maydonlar to‘ldirilmagan");
          const bad = steps.findIndex((k) => STEP_FIELDS[k].some((f) => !!form.getFieldState(f).error));
          if (bad >= 0) setStep(bad);
          setConfirmSubmit(false);
          return;
        }
      }
      const res = publicMode ? await savePublicEvent(publicMode.token, publicMode.eventId ?? null, values, mode) : await saveEvent(eventId, values, mode);
      if (!res.ok) {
        applyServerErrors(res.fieldErrors);
        setServerError(res.error ?? "Xatolik yuz berdi");
        toast.error(res.error ?? "Xatolik yuz berdi");
        setConfirmSubmit(false);
        return;
      }
      if (mode === "validate") {
        setChecked({ ok: true, duplicates: "duplicates" in res ? res.duplicates : undefined });
        toast.success("Ma’lumotlar to‘liq va to‘g‘ri");
        return;
      }
      toast.success(mode === "draft" ? "Qoralama saqlandi" : "Ma’lumot muvaffaqiyatli yuborildi");
      if (publicMode) {
        router.push(`/kiritish/t/${(res as { token?: string }).token}`);
      } else {
        router.push(`/events/${(res as { id?: string }).id}`);
      }
      router.refresh();
    });
  }

  const submitLabel = ctx.role === "district_manager" ? "Hudud boshqarmasiga yuborish" : "Yuborish";
  const v = watch();

  return (
    <FormProvider {...form}>
      <form onSubmit={(e) => e.preventDefault()} noValidate className="space-y-5">
        {/* Bosqichlar */}
        <ol className={cn("grid grid-cols-2 gap-2 sm:grid-cols-3", steps.length > 4 ? "lg:grid-cols-6" : "lg:grid-cols-4")} aria-label="Bosqichlar">
          {steps.map((k, i) => (
            <li key={k}>
              <button
                type="button"
                onClick={() => goTo(i)}
                aria-current={i === step ? "step" : undefined}
                className={cn(
                  "flex h-full w-full cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-left text-xs font-medium transition-colors",
                  i === step ? "border-blue-800 bg-blue-800 text-white" : i < step ? "border-emerald-300 bg-emerald-50 text-emerald-900" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50",
                )}
              >
                <span className={cn("flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold", i === step ? "bg-white/20" : i < step ? "bg-emerald-600 text-white" : "bg-slate-200")}>
                  {i < step ? <Check className="h-3.5 w-3.5" /> : i + 1}
                </span>
                {STEP_LABELS[k]}
              </button>
            </li>
          ))}
        </ol>

        <Card>
          <CardBody className="space-y-5">
            {(key === "basic" || key === "main") && (
              <div className="grid gap-4 md:grid-cols-2">
                {hideGeo && <GeoBanner regions={regions} districts={districts} className="md:col-span-2" />}
                <div className={cn("grid gap-4 md:col-span-2 md:grid-cols-2", hideGeo && "hidden")}>
                <Field label="Tadbir ko‘lami" required className="md:col-span-2" hint="Hududning asosiy tadbiri tuman tadbirlaridan alohida hisoblanadi.">
                  <Controller
                    control={control}
                    name="scope"
                    render={({ field }) => (
                      <Select {...field} disabled={scopeLocked} onChange={(e) => { field.onChange(e); if (e.target.value === "regional") setValue("district_id", ""); }}>
                        <option value="regional">{SCOPE_LABELS.regional}</option>
                        <option value="district">{SCOPE_LABELS.district}</option>
                      </Select>
                    )}
                  />
                </Field>
                <Field label="Hudud" required error={errMsg(errors.region_id)}>
                  <Select {...register("region_id", { onChange: () => setValue("district_id", "") })} disabled={regionLocked}>
                    <option value="">Tanlang…</option>
                    {regions.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                  </Select>
                </Field>
                <Field label="Tuman/shahar" required={scope === "district"} error={districtId === NEW_DISTRICT ? undefined : errMsg(errors.district_id)}>
                  <Select {...register("district_id")} disabled={districtLocked || scope === "regional" || !regionId}>
                    <option value="">{scope === "regional" ? "Hudud tadbiri uchun tanlanmaydi" : "Tanlang…"}</option>
                    {distOptions.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                    {canAddDistrict && <option value={NEW_DISTRICT}>➕ Ro‘yxatda yo‘q — nomini o‘zim yozaman</option>}
                  </Select>
                </Field>
                {canAddDistrict && districtId === NEW_DISTRICT && (
                  <div className="grid gap-3 rounded-md border border-blue-200 bg-blue-50/50 p-3 md:col-span-2 md:grid-cols-3">
                    <Field label="Yangi tuman/shahar nomi" required error={errMsg(errors.district_id)} className="md:col-span-2" hint="Masalan: Qo‘shrabot. Nomi avtomatik «… tumani» / «… shahri» ko‘rinishiga keltiriladi va ro‘yxatga qo‘shiladi.">
                      <Input {...register("new_district_name")} aria-invalid={!!errors.district_id} />
                    </Field>
                    <Field label="Turi">
                      <Select {...register("new_district_type")}>
                        <option value="tuman">Tuman</option>
                        <option value="shahar">Shahar</option>
                      </Select>
                    </Field>
                  </div>
                )}
                {lockedLabel && <p className="text-xs text-slate-500 md:col-span-2">{lockedLabel}</p>}
                </div>
                <Field label="Tashkilot yoki muassasa nomi" error={errMsg(errors.organization_name)}>
                  <Input {...register("organization_name")} />
                </Field>
                {!publicMode && <DescriptionFields />}
              </div>
            )}

            {(key === "place" || key === "main") && (
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Tadbir o‘tkaziladigan manzil" required error={errMsg(errors.address)} className="md:col-span-2">
                  <Input {...register("address")} aria-invalid={!!errors.address} placeholder="Hudud, tuman, ko‘cha, uy yoki mo‘ljal" />
                </Field>
                <Field label="Qo‘shimcha lokatsiya tavsifi" className="md:col-span-2">
                  <Input {...register("location_note")} placeholder="Zarur bo‘lsa (masalan: bosh maydon, sahna oldi)" />
                </Field>
                <Field label="Tadbir boshlanish sanasi" required error={errMsg(errors.start_date)}>
                  <Input type="date" {...register("start_date")} aria-invalid={!!errors.start_date} />
                </Field>
                <Field label="Tadbir tugash sanasi" error={errMsg(errors.end_date)} hint="Bir kunlik tadbirda bo‘sh qoldiring.">
                  <Input type="date" {...register("end_date")} aria-invalid={!!errors.end_date} />
                </Field>
              </div>
            )}

            {key === "extra" && (
              <>
                <div className="grid gap-4"><DescriptionFields /></div>
                <h3 className="text-base font-semibold text-slate-900">San’atkorlar va ijodiy jamoalar</h3>
                <ArtistsStep />
                <h3 className="pt-2 text-base font-semibold text-slate-900">Ishtirokchilar</h3>
                <ParticipantsStep />
              </>
            )}
            {key === "artists" && <ArtistsStep />}
            {key === "participants" && <ParticipantsStep />}
            {key === "resp" && <ResponsiblesStep />}

            {key === "review" && (
              <div className="space-y-4">
                <ReviewSummary v={v} regions={regions} districts={districts} />
                {checked?.ok && (
                  <p className="flex items-center gap-2 rounded-md bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-800">
                    <ShieldCheck className="h-4 w-4" /> Barcha majburiy maydonlar to‘ldirilgan — yuborishga tayyor.
                  </p>
                )}
                {checked?.duplicates && checked.duplicates.length > 0 && (
                  <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
                    <p className="flex items-center gap-2 font-semibold"><AlertTriangle className="h-4 w-4" /> Takroriy tadbir ehtimoli</p>
                    <p className="mt-1">Shu joyda va shu kunlarda o‘xshash nomli tadbir allaqachon mavjud:</p>
                    <ul className="mt-1 list-disc pl-5">
                      {checked.duplicates.map((d) => <li key={d.id}>{d.address}</li>)}
                    </ul>
                    <p className="mt-1 text-xs">Agar bu boshqa tadbir bo‘lsa, yuborishda davom etishingiz mumkin.</p>
                  </div>
                )}
                {serverError && <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm font-medium text-red-800">{serverError}</p>}
              </div>
            )}
          </CardBody>
        </Card>

        {/* Boshqaruv tugmalari */}
        <div className="sticky bottom-0 z-10 -mx-4 flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 bg-white/95 px-4 py-3 backdrop-blur lg:mx-0 lg:rounded-lg lg:border">
          <Button variant="outline" disabled={pending} onClick={() => persist("draft")}>
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Qoralama sifatida saqlash
          </Button>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" disabled={step === 0 || pending} onClick={() => goTo(step - 1)}>
              <ChevronLeft className="h-4 w-4" /> Oldingi bosqich
            </Button>
            {step < steps.length - 1 ? (
              <Button disabled={pending} onClick={goNext}>
                Keyingi bosqich <ChevronRight className="h-4 w-4" />
              </Button>
            ) : (
              <>
                <Button variant="outline" disabled={pending} onClick={() => persist("validate")}>
                  <ShieldCheck className="h-4 w-4" /> Ma’lumotlarni tekshirish
                </Button>
                <Button variant="success" disabled={pending} onClick={() => setConfirmSubmit(true)}>
                  <Send className="h-4 w-4" /> Yuborish
                </Button>
              </>
            )}
          </div>
        </div>
      </form>

      <ConfirmDialog
        open={confirmSubmit}
        title={submitLabel}
        description="Yuborilgandan so‘ng ma’lumotni qaytarilmaguncha tahrirlab bo‘lmaydi. Davom etasizmi?"
        confirmLabel="Ha, yuborish"
        onClose={() => setConfirmSubmit(false)}
        onConfirm={async () => {
          persist("submit");
        }}
      />
    </FormProvider>
  );
}

/* ------------------------------------------------------------------ qadamlar */

function ArtistsStep() {
  const { register, control, formState: { errors } } = useFormContext<EventFormValues>();
  const { fields, append, remove } = useFieldArray({ control, name: "artists" });
  return (
    <div className="space-y-3">
      <p className="text-sm text-slate-600">Har bir san’atkor yoki jamoa uchun alohida qator qo‘shing: F.I.Sh. (yoki jamoa nomi) va unvoni.</p>
      {fields.length === 0 && <p className="rounded-md bg-slate-50 px-3 py-5 text-center text-sm text-slate-500">Hali san’atkor qo‘shilmagan</p>}
      {fields.map((f, i) => (
        <div key={f.id} className="grid items-end gap-3 rounded-lg border border-slate-200 p-3 md:grid-cols-[9rem_1fr_14rem_auto]">
          <Field label="Turi">
            <Select {...register(`artists.${i}.artist_type`)}>
              <option value="artist">San’atkor</option>
              <option value="group">Jamoa</option>
            </Select>
          </Field>
          <Field label="F.I.Sh. yoki jamoa nomi" required error={errMsg(errors.artists?.[i]?.artist_name)}>
            <Input {...register(`artists.${i}.artist_name`)} aria-invalid={!!errors.artists?.[i]?.artist_name} />
          </Field>
          <Field label="Unvoni">
            <Input {...register(`artists.${i}.performance_type`)} placeholder="Masalan: O‘zbekiston xalq artisti" />
          </Field>
          <Button variant="ghost" size="icon" onClick={() => remove(i)} aria-label="O‘chirish"><Trash2 className="h-4 w-4 text-red-700" /></Button>
        </div>
      ))}
      {errMsg(errors.artists) && <p role="alert" className="text-sm font-medium text-red-700">{errMsg(errors.artists)}</p>}
      <Button variant="outline" onClick={() => append({ artist_name: "", artist_type: "artist", performance_type: "", role_description: "", notes: "" })}>
        <Plus className="h-4 w-4" /> San’atkor / jamoa qo‘shish
      </Button>
    </div>
  );
}

function ParticipantsStep() {
  const { register, control, formState: { errors } } = useFormContext<EventFormValues>();
  const { fields, append, remove } = useFieldArray({ control, name: "participants" });
  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-600">Ishtirokchilar ro‘yxati san’atkorlardan alohida yuritiladi.</p>
      {fields.length === 0 && <p className="rounded-md bg-slate-50 px-3 py-6 text-center text-sm text-slate-500">Hali ishtirokchi qo‘shilmagan</p>}
      {fields.map((f, i) => (
        <div key={f.id} className="grid gap-3 rounded-lg border border-slate-200 p-4 md:grid-cols-6">
          <Field label="Ishtirokchi yoki tashkilot nomi" required error={errMsg(errors.participants?.[i]?.participant_name)} className="md:col-span-3">
            <Input {...register(`participants.${i}.participant_name`)} aria-invalid={!!errors.participants?.[i]?.participant_name} />
          </Field>
          <Field label="Toifasi" className="md:col-span-2">
            <Select {...register(`participants.${i}.participant_category`)}>
              <option value="">Tanlang…</option>
              {PARTICIPANT_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </Select>
          </Field>
          <Field label="Soni" error={errMsg(errors.participants?.[i]?.participant_count)}>
            <Input type="number" min={0} inputMode="numeric" {...register(`participants.${i}.participant_count`)} placeholder="Ma’lum bo‘lsa" />
          </Field>
          <Field label="Ishtirokdagi vazifasi" className="md:col-span-3">
            <Input {...register(`participants.${i}.participation_role`)} />
          </Field>
          <Field label="Izoh" className="md:col-span-2">
            <Input {...register(`participants.${i}.notes`)} />
          </Field>
          <div className="flex items-end justify-end">
            <Button variant="ghost" size="sm" onClick={() => remove(i)} aria-label="O‘chirish"><Trash2 className="h-4 w-4 text-red-700" /></Button>
          </div>
        </div>
      ))}
      <Button variant="outline" onClick={() => append({ participant_name: "", participant_category: "", participant_count: "", participation_role: "", notes: "" })}>
        <Plus className="h-4 w-4" /> Ishtirokchi qo‘shish
      </Button>
    </div>
  );
}

function ResponsiblesStep() {
  const { register, control, setValue, watch, formState: { errors } } = useFormContext<EventFormValues>();
  const { fields, append, remove } = useFieldArray({ control, name: "responsibles" });
  const rows = watch("responsibles");

  function makePrimary(idx: number) {
    rows.forEach((_, i) => setValue(`responsibles.${i}.is_primary`, i === idx, { shouldDirty: true }));
  }
  function removeRow(i: number) {
    const wasPrimary = rows[i]?.is_primary;
    remove(i);
    if (wasPrimary && rows.length > 1) setValue("responsibles.0.is_primary", true);
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-600">F.I.Sh., lavozim va telefon alohida kiritiladi. Bitta mas’ul «asosiy» deb belgilanadi.</p>
      {fields.map((f, i) => (
        <div key={f.id} className={cn("grid gap-3 rounded-lg border p-4 md:grid-cols-6", rows[i]?.is_primary ? "border-blue-300 bg-blue-50/40" : "border-slate-200")}>
          <Field label="F.I.Sh." required error={errMsg(errors.responsibles?.[i]?.full_name)} className="md:col-span-2">
            <Input {...register(`responsibles.${i}.full_name`)} aria-invalid={!!errors.responsibles?.[i]?.full_name} />
          </Field>
          <Field label="Lavozimi" required error={errMsg(errors.responsibles?.[i]?.position)} className="md:col-span-2">
            <Input {...register(`responsibles.${i}.position`)} aria-invalid={!!errors.responsibles?.[i]?.position} />
          </Field>
          <Field label="Telefon raqami" required error={errMsg(errors.responsibles?.[i]?.phone)} className="md:col-span-2">
            <Input type="tel" inputMode="tel" placeholder="+998 90 123 45 67" {...register(`responsibles.${i}.phone`)} aria-invalid={!!errors.responsibles?.[i]?.phone} />
          </Field>
          <Field label="Ish joyi / tashkiloti" className="md:col-span-2">
            <Input {...register(`responsibles.${i}.organization`)} />
          </Field>
          <Field label="Izoh" className="md:col-span-2">
            <Input {...register(`responsibles.${i}.notes`)} />
          </Field>
          <div className="flex items-end justify-between gap-2 md:col-span-2">
            <label className="flex cursor-pointer items-center gap-2 text-sm font-medium text-slate-700">
              <input type="radio" name="primary-responsible" checked={!!rows[i]?.is_primary} onChange={() => makePrimary(i)} className="h-4 w-4 accent-blue-800" />
              Asosiy mas’ul
            </label>
            {fields.length > 1 && (
              <Button variant="ghost" size="sm" onClick={() => removeRow(i)} aria-label="O‘chirish"><Trash2 className="h-4 w-4 text-red-700" /></Button>
            )}
          </div>
        </div>
      ))}
      {errMsg(errors.responsibles) && <p role="alert" className="text-sm font-medium text-red-700">{errMsg(errors.responsibles)}</p>}
      <Button variant="outline" onClick={() => append({ full_name: "", position: "", organization: "", phone: "", is_primary: fields.length === 0, notes: "" })}>
        <Plus className="h-4 w-4" /> Mas’ul ijrochi qo‘shish
      </Button>
    </div>
  );
}

function DescriptionFields() {
  const { register } = useFormContext<EventFormValues>();
  return (
    <>
      <Field label="Tadbirning qisqacha mazmuni" className="md:col-span-2">
        <Textarea {...register("description")} rows={3} />
      </Field>
      <Field label="Qo‘shimcha izoh" className="md:col-span-2">
        <Textarea {...register("notes")} rows={2} />
      </Field>
    </>
  );
}

function GeoBanner({ regions, districts, className }: { regions: Opt[]; districts: Dist[]; className?: string }) {
  const { watch } = useFormContext<EventFormValues>();
  const v = watch();
  const region = regions.find((r) => r.id === v.region_id)?.name;
  const district = districts.find((d) => d.id === v.district_id)?.name ?? (v.new_district_name ? `${v.new_district_name} (yangi)` : undefined);
  return (
    <div className={cn("rounded-md border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900", className)}>
      <p className="text-xs uppercase tracking-wide text-blue-700">Ma’lumot kiritilayotgan hudud</p>
      <p className="font-semibold">{region}{v.scope === "district" && district ? ` · ${district}` : ""}</p>
      <p>{v.scope === "regional" ? "Hududning asosiy tadbirlari" : "Tuman/shahar tadbirlari"}</p>
    </div>
  );
}

function Row({ k, children }: { k: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1 border-b border-slate-100 py-2 text-sm sm:grid-cols-3">
      <dt className="font-medium text-slate-500">{k}</dt>
      <dd className="sm:col-span-2">{children || <span className="text-slate-400">Kiritilmagan</span>}</dd>
    </div>
  );
}

function ReviewSummary({ v, regions, districts }: { v: EventFormValues; regions: Opt[]; districts: Dist[] }) {
  const region = regions.find((r) => r.id === v.region_id)?.name;
  const district = districts.find((d) => d.id === v.district_id)?.name ?? (v.district_id === NEW_DISTRICT ? v.new_district_name : undefined);
  return (
    <dl>
      <Row k="Ko‘lam">{SCOPE_LABELS[v.scope]}</Row>
      <Row k="Hudud">{[region, district].filter(Boolean).join(" · ")}</Row>
      <Row k="Turi">{v.event_type}</Row>
      <Row k="Manzil">{v.address}</Row>
      <Row k="Sana">{v.start_date && (v.end_date && v.end_date !== v.start_date ? `${v.start_date} — ${v.end_date}` : v.start_date)}</Row>
      <Row k={`San’atkorlar va jamoalar (${v.artists.length})`}>
        {v.artists.length > 0 && <ul className="list-disc pl-4">{v.artists.map((a, i) => <li key={i}>{a.artist_name}{a.performance_type && ` — ${a.performance_type}`}</li>)}</ul>}
      </Row>
      <Row k={`Ishtirokchilar (${v.participants.length})`}>
        {v.participants.length > 0 && <ul className="list-disc pl-4">{v.participants.map((p, i) => <li key={i}>{p.participant_name}{p.participant_count !== "" && p.participant_count != null && ` — ${p.participant_count} nafar`}</li>)}</ul>}
      </Row>
      <Row k={`Mas’ul ijrochilar (${v.responsibles.length})`}>
        {v.responsibles.length > 0 && (
          <ul className="list-disc pl-4">
            {v.responsibles.map((r, i) => (
              <li key={i}>{r.full_name}, {r.position}, {formatPhone(r.phone) || r.phone}{r.is_primary && " (asosiy)"}</li>
            ))}
          </ul>
        )}
      </Row>
    </dl>
  );
}
