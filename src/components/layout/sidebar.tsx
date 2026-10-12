"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  BarChart3, Bell, ClipboardCheck, ClipboardList, FileText, History, LayoutDashboard, ListChecks, LogOut, Map, Menu,
  Mic2, PlusCircle, Settings, Users, UserSquare2, X, Building2, MapPinned,
} from "lucide-react";
import { signOut } from "@/app/actions/auth";
import { ROLE_LABELS, type Role } from "@/lib/constants";
import { cn } from "@/components/ui/primitives";

interface NavItem { href: string; label: string; icon: React.ComponentType<{ className?: string }>; roles: Role[] }

const ALL: Role[] = ["super_admin", "region_manager", "district_manager", "observer"];
const MINISTRY_REGION: Role[] = ["super_admin", "region_manager", "observer"];

const NAV: NavItem[] = [
  { href: "/", label: "Bosh sahifa", icon: LayoutDashboard, roles: ALL },
  { href: "/collections", label: "Ma’lumot yig‘ish", icon: ClipboardList, roles: MINISTRY_REGION },
  { href: "/events", label: "Barcha tadbirlar", icon: ListChecks, roles: ALL },
  { href: "/events/regional", label: "Viloyat asosiy tadbirlari", icon: Building2, roles: MINISTRY_REGION },
  { href: "/events/district", label: "Tuman/shahar tadbirlari", icon: MapPinned, roles: MINISTRY_REGION },
  { href: "/monitoring", label: "Hududlar monitoringi", icon: Map, roles: MINISTRY_REGION },
  { href: "/approvals", label: "Tasdiqlash markazi", icon: ClipboardCheck, roles: ["super_admin", "region_manager", "district_manager"] },
  { href: "/artists", label: "San’atkorlar va jamoalar", icon: Mic2, roles: MINISTRY_REGION },
  { href: "/responsibles", label: "Mas’ul ijrochilar", icon: UserSquare2, roles: MINISTRY_REGION },
  { href: "/reports", label: "Word hisobotlari", icon: FileText, roles: ALL },
  { href: "/users", label: "Foydalanuvchilar", icon: Users, roles: ["super_admin"] },
  { href: "/audit", label: "Audit jurnali", icon: History, roles: ["super_admin"] },
  { href: "/settings", label: "Sozlamalar", icon: Settings, roles: ALL },
];

export function Sidebar({
  role, fullName, scopeLabel, unread,
}: { role: Role; fullName: string; scopeLabel: string; unread: number }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const items = NAV.filter((n) => n.roles.includes(role));
  const canCreate = role !== "observer";

  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname === href || (href !== "/events" && pathname.startsWith(href + "/")));

  const nav = (
    <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4" aria-label="Asosiy menyu">
      {canCreate && (
        <Link
          href="/events/new"
          onClick={() => setOpen(false)}
          className="mb-3 flex items-center gap-2 rounded-md bg-blue-600 px-3 py-2.5 text-sm font-semibold text-white hover:bg-blue-500"
        >
          <PlusCircle className="h-4 w-4" /> Yangi tadbir kiritish
        </Link>
      )}
      {items.map((n) => (
        <Link
          key={n.href}
          href={n.href}
          onClick={() => setOpen(false)}
          aria-current={isActive(n.href) ? "page" : undefined}
          className={cn(
            "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
            isActive(n.href) ? "bg-white/15 font-semibold text-white" : "text-slate-300 hover:bg-white/10 hover:text-white",
          )}
        >
          <n.icon className="h-4 w-4 shrink-0" />
          {n.label}
        </Link>
      ))}
    </nav>
  );

  const footer = (
    <div className="border-t border-white/10 p-4">
      <p className="truncate text-sm font-semibold text-white">{fullName}</p>
      <p className="truncate text-xs text-slate-400">{ROLE_LABELS[role]}</p>
      <p className="mb-3 truncate text-xs text-slate-400">{scopeLabel}</p>
      <div className="flex gap-2">
        <Link href="/notifications" className="relative flex flex-1 items-center justify-center gap-1 rounded-md bg-white/10 px-2 py-2 text-xs text-white hover:bg-white/20">
          <Bell className="h-4 w-4" /> Xabarlar
          {unread > 0 && (
            <span className="ml-1 rounded-full bg-red-600 px-1.5 text-[10px] font-bold">{unread > 99 ? "99+" : unread}</span>
          )}
        </Link>
        <form action={signOut} className="flex-1">
          <button type="submit" className="flex w-full cursor-pointer items-center justify-center gap-1 rounded-md bg-white/10 px-2 py-2 text-xs text-white hover:bg-white/20">
            <LogOut className="h-4 w-4" /> Chiqish
          </button>
        </form>
      </div>
    </div>
  );

  const brand = (
    <div className="flex items-center gap-3 border-b border-white/10 px-4 py-4">
      <BarChart3 className="h-7 w-7 text-blue-300" />
      <div className="leading-tight">
        <p className="text-sm font-bold text-white">Madaniyat vazirligi</p>
        <p className="text-xs text-slate-400">Yangi yil tadbirlari</p>
      </div>
    </div>
  );

  return (
    <>
      <header className="app-header sticky top-0 z-30 flex items-center justify-between bg-slate-900 px-4 py-3 text-white lg:hidden">
        <span className="text-sm font-bold">Madaniyat vazirligi</span>
        <button aria-label={open ? "Menyuni yopish" : "Menyuni ochish"} onClick={() => setOpen((v) => !v)} className="cursor-pointer rounded p-1 hover:bg-white/10">
          {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </header>
      {open && <div className="fixed inset-0 z-30 bg-black/40 lg:hidden" onClick={() => setOpen(false)} />}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex w-72 flex-col bg-slate-900 transition-transform lg:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
        {brand}
        {nav}
        {footer}
      </aside>
    </>
  );
}
