"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  Bell, ClipboardCheck, FileCheck2, MessageSquare, Table2, ClipboardList, FileText, History, LayoutDashboard, ListChecks, LogOut, Map, Menu,
  Mic2, PlusCircle, Settings, Users, UserSquare2, X, Building2, MapPinned,
} from "lucide-react";
import { signOut } from "@/app/actions/auth";
import { Emblem } from "@/components/brand/emblem";
import { DEPARTMENT_NAME } from "@/lib/brand";
import { ROLE_LABELS, type Role } from "@/lib/constants";
import { cn } from "@/components/ui/primitives";
import { PushToggle } from "@/components/push-toggle";

interface NavItem { href: string; label: string; icon: React.ComponentType<{ className?: string }>; roles: Role[] }

const ALL: Role[] = ["super_admin", "region_manager", "district_manager", "observer"];
const MINISTRY_REGION: Role[] = ["super_admin", "observer"];

const NAV: NavItem[] = [
  { href: "/boshqarma", label: "Boshqarma paneli", icon: LayoutDashboard, roles: ["region_manager"] },
  { href: "/", label: "Boshqaruv paneli", icon: LayoutDashboard, roles: ["super_admin", "observer"] },
  { href: "/", label: "Bosh sahifa", icon: LayoutDashboard, roles: ["district_manager"] },
  { href: "/malumotlar", label: "Kelgan ma’lumotlar", icon: Table2, roles: ["super_admin", "observer"] },
  { href: "/imzolangan", label: "Imzolangan PDF", icon: FileCheck2, roles: ["super_admin", "observer"] },
  { href: "/chat", label: "Chat", icon: MessageSquare, roles: ["super_admin", "region_manager"] },
  { href: "/collections", label: "Ma’lumot yig‘ish", icon: ClipboardList, roles: ["super_admin", "observer", "region_manager"] },
  { href: "/events", label: "Barcha tadbirlar", icon: ListChecks, roles: ["district_manager"] },
  { href: "/events/regional", label: "Viloyat asosiy tadbirlari", icon: Building2, roles: [] },
  { href: "/events/district", label: "Tuman/shahar tadbirlari", icon: MapPinned, roles: [] },
  { href: "/monitoring", label: "Hududlar monitoringi", icon: Map, roles: [] },
  { href: "/approvals", label: "Tasdiqlash markazi", icon: ClipboardCheck, roles: ["district_manager"] },
  { href: "/artists", label: "San’atkorlar va jamoalar", icon: Mic2, roles: [] },
  { href: "/responsibles", label: "Mas’ul ijrochilar", icon: UserSquare2, roles: [] },
  { href: "/reports", label: "Word hisobotlari", icon: FileText, roles: ["district_manager"] },
  { href: "/users", label: "Foydalanuvchilar", icon: Users, roles: ["super_admin"] },
  { href: "/audit", label: "Audit jurnali", icon: History, roles: ["super_admin"] },
  { href: "/settings", label: "Sozlamalar", icon: Settings, roles: ALL },
];

export function Sidebar({
  role, fullName, scopeLabel, unread, chatUnread = 0,
}: { role: Role; fullName: string; scopeLabel: string; unread: number; chatUnread?: number }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const items = NAV.filter((n) => n.roles.includes(role));
  const canCreate = role === "district_manager"; // vazirlik tadbirni o‘zi kiritmaydi — forma yaratib, hududlardan yig‘adi

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
          {n.href === "/chat" && chatUnread > 0 && (
            <span className="ml-auto rounded-full bg-red-600 px-1.5 text-[10px] font-bold text-white">{chatUnread > 99 ? "99+" : chatUnread}</span>
          )}
        </Link>
      ))}
    </nav>
  );

  const footer = (
    <div className="border-t border-white/10 p-4">
      <p className="truncate text-sm font-semibold text-white">{fullName}</p>
      <p className="truncate text-xs text-slate-400">{ROLE_LABELS[role]}</p>
      <p className="mb-3 truncate text-xs text-slate-400">{scopeLabel}</p>
      {(role === "super_admin" || role === "region_manager") && <PushToggle className="mb-2" />}
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
      <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-white">
        <Emblem size={56} />
      </div>
      <div className="leading-tight">
        <p className="text-sm font-bold text-white">Madaniyat vazirligi</p>
        <p className="text-[11px] text-slate-300">{DEPARTMENT_NAME}</p>
      </div>
    </div>
  );

  return (
    <>
      <header className="app-header sticky top-0 z-30 flex items-center justify-between bg-slate-900 px-4 py-3 text-white lg:hidden">
        <span className="flex items-center gap-2 text-sm font-bold"><span className="flex h-9 w-9 items-center justify-center overflow-hidden rounded bg-white"><Emblem size={36} /></span> Madaniyat vazirligi</span>
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
