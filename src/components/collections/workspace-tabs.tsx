"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/components/ui/primitives";

/** Bitta ma’lumot yig‘ish ichidagi bo‘limlar (boshqa yig‘ishlar bilan aralashmaydi). */
export function WorkspaceTabs({ id, canEdit }: { id: string; canEdit: boolean }) {
  const path = usePathname();
  const base = `/collections/${id}`;
  const tabs = [
    { href: base, label: "Umumiy ko‘rinish va KPI", on: path === base },
    { href: `${base}/hududlar`, label: "Kelgan ma’lumotlar va tekshirish", on: path.startsWith(`${base}/hududlar`) || path.startsWith(`${base}/hudud/`) || path.startsWith(`${base}/entries`) },
    { href: `${base}/pdf`, label: "Imzolangan PDF", on: path.startsWith(`${base}/pdf`) },
    { href: `${base}/hisobot`, label: "Hisobot va eksport", on: path.startsWith(`${base}/hisobot`) },
    ...(canEdit ? [{ href: `${base}/edit`, label: "Sozlash", on: path.startsWith(`${base}/edit`) }] : []),
  ];
  return (
    <nav aria-label="Yig‘ish bo‘limlari" className="mb-6 flex gap-1 overflow-x-auto border-b border-slate-200">
      {tabs.map((t) => (
        <Link
          key={t.href} href={t.href} aria-current={t.on ? "page" : undefined}
          className={cn(
            "-mb-px whitespace-nowrap border-b-2 px-4 py-2.5 text-sm transition-colors",
            t.on ? "border-blue-800 font-semibold text-blue-900" : "border-transparent text-slate-600 hover:border-slate-300 hover:text-slate-900",
          )}
        >
          {t.label}
        </Link>
      ))}
    </nav>
  );
}
