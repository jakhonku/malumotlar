"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pencil } from "lucide-react";
import { toast } from "sonner";
import { hideMyDistrict, renameMyDistrict } from "@/app/actions/districts";
import { Button, Input, Select } from "@/components/ui/primitives";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

interface Item { id: string; name: string; type: "tuman" | "shahar" }

/** Viloyat boshqarmasi tuman/shahar nomi noto‘g‘ri bo‘lsa, uni shu yerda tuzatadi. */
export function EditDistricts({ items }: { items: Item[] }) {
  const router = useRouter();
  const [editId, setEditId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [type, setType] = useState<"tuman" | "shahar">("tuman");
  const [error, setError] = useState<string | null>(null);
  const [hideId, setHideId] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function open(it: Item) { setEditId(it.id); setName(it.name); setType(it.type); setError(null); }

  function save(e: React.FormEvent) {
    e.preventDefault();
    if (!editId) return;
    start(async () => {
      const res = await renameMyDistrict(editId, name, type);
      if (!res.ok) return setError(res.error ?? "Xatolik");
      toast.success("Saqlandi");
      setEditId(null);
      router.refresh();
    });
  }

  return (
    <>
    <ConfirmDialog
      open={!!hideId}
      title="Ro‘yxatdan chiqarish"
      description="Bu tuman/shahar ro‘yxatdan olib tashlanadi (unga ma’lumot kiritilmagan bo‘lsa). Faqat bunday hudud mavjud bo‘lmasa yoki xato qo‘shilgan bo‘lsa foydalaning."
      confirmLabel="Chiqarish"
      destructive
      onClose={() => setHideId(null)}
      onConfirm={async () => {
        if (!hideId) return;
        const res = await hideMyDistrict(hideId);
        if (!res.ok) return res.error ?? "Xatolik yuz berdi";
        toast.success("Ro‘yxatdan chiqarildi");
        setHideId(null);
        setEditId(null);
        router.refresh();
      }}
    />
    <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {items.map((it) => editId === it.id ? (
        <li key={it.id} className="sm:col-span-2">
          <form onSubmit={save} className="space-y-2 rounded-lg border border-blue-300 bg-blue-50/60 p-3">
            <div className="flex flex-wrap items-end gap-2">
              <label className="min-w-48 flex-1 text-sm">
                <span className="mb-1 block font-medium text-slate-700">To‘g‘ri nomi</span>
                <Input value={name} onChange={(e) => { setName(e.target.value); setError(null); }} aria-invalid={!!error} autoFocus />
              </label>
              <label className="text-sm">
                <span className="mb-1 block font-medium text-slate-700">Turi</span>
                <Select value={type} onChange={(e) => setType(e.target.value as "tuman" | "shahar")}>
                  <option value="tuman">Tuman</option>
                  <option value="shahar">Shahar</option>
                </Select>
              </label>
              <Button type="submit" disabled={pending || name.trim().length < 3}>{pending ? "Saqlanmoqda…" : "Saqlash"}</Button>
              <Button type="button" variant="ghost" onClick={() => setEditId(null)}>Bekor qilish</Button>
              <Button type="button" variant="outline" disabled={pending} onClick={() => setHideId(editId)} title="Bunday tuman/shahar mavjud emas (faqat ma’lumot kiritilmagan bo‘lsa)">Ro‘yxatdan chiqarish</Button>
            </div>
            {error && <p role="alert" className="text-sm font-medium text-red-700">{error}</p>}
          </form>
        </li>
      ) : (
        <li key={it.id} className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm">
          <span className="min-w-0 truncate font-medium text-slate-900">{it.name}</span>
          <button type="button" onClick={() => open(it)} aria-label={`${it.name} nomini tahrirlash`} className="cursor-pointer rounded p-1.5 text-slate-500 hover:bg-slate-100 hover:text-blue-800">
            <Pencil className="h-4 w-4" />
          </button>
        </li>
      ))}
    </ul>
    </>
  );
}
