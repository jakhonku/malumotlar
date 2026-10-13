"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { addMyDistrict } from "@/app/actions/districts";
import { Button, Input, Select } from "@/components/ui/primitives";

/** Ro‘yxatda yo‘q tuman/shaharni qo‘lda qo‘shish. */
export function AddDistrict({ empty }: { empty?: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(!!empty);
  const [name, setName] = useState("");
  const [type, setType] = useState<"tuman" | "shahar">("tuman");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function add(e: React.FormEvent) {
    e.preventDefault();
    start(async () => {
      const res = await addMyDistrict(name, type);
      if (!res.ok) return setError(res.error ?? "Xatolik");
      toast.success("Qo‘shildi — hududlar ro‘yxatida paydo bo‘ldi");
      setName("");
      setError(null);
      setOpen(!!empty);
      router.refresh();
    });
  }

  if (!open)
    return (
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <Plus className="h-4 w-4" /> Tuman/shahar qo‘shish
      </Button>
    );

  return (
    <form onSubmit={add} className="space-y-2 rounded-lg border border-blue-200 bg-blue-50/50 p-3">
      {empty && <p className="text-sm text-slate-700">Hududingiz uchun tuman/shaharlar ro‘yxati bo‘sh. Ularni o‘zingiz qo‘shing:</p>}
      <div className="flex flex-wrap items-end gap-2">
        <label className="min-w-48 flex-1 text-sm">
          <span className="mb-1 block font-medium text-slate-700">Nomi</span>
          <Input value={name} onChange={(e) => { setName(e.target.value); setError(null); }} placeholder="Masalan: Qo‘shrabot" aria-invalid={!!error} />
        </label>
        <label className="text-sm">
          <span className="mb-1 block font-medium text-slate-700">Turi</span>
          <Select value={type} onChange={(e) => setType(e.target.value as "tuman" | "shahar")}>
            <option value="tuman">Tuman</option>
            <option value="shahar">Shahar</option>
          </Select>
        </label>
        <Button type="submit" disabled={pending || name.trim().length < 3}>{pending ? "Qo‘shilmoqda…" : "Qo‘shish"}</Button>
        {!empty && <Button type="button" variant="ghost" onClick={() => { setOpen(false); setError(null); }}>Bekor qilish</Button>}
      </div>
      {error && <p role="alert" className="text-sm font-medium text-red-700">{error}</p>}
    </form>
  );
}
