"use client";

import { usePathname, useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";

// Asosiy (menyudagi) sahifalarda «Orqaga» kerak emas
const TOP = new Set(["/", "/boshqarma", "/collections", "/malumotlar", "/chat", "/users", "/audit", "/settings", "/notifications", "/events", "/reports", "/approvals", "/monitoring", "/artists", "/responsibles"]);

/** Sahifaning «ota» manzili (tarix bo‘lmasa, shu yerga qaytariladi). */
export function parentPath(path: string): string {
  if (/^\/kiritish\/c\/[^/]+\/t\/[^/]+$/.test(path) || /^\/kiritish\/c\/[^/]+\/yangi$/.test(path)) return "/boshqarma";
  if (/^\/kiritish\/c\/[^/]+\/t\/[^/]+\/.+$/.test(path)) return path.replace(/^(\/kiritish\/c\/[^/]+\/t\/[^/]+)\/.*$/, "$1");
  if (/^\/collections\/[^/]+\/hudud\/[^/]+$/.test(path)) return "/malumotlar";
  const m = /^(\/collections\/[^/]+)\/(entries|edit)(\/.*)?$/.exec(path);
  if (m) return m[1];
  const parts = path.split("/").filter(Boolean);
  parts.pop();
  return parts.length ? `/${parts.join("/")}` : "/";
}

export function BackButton() {
  const pathname = usePathname();
  const router = useRouter();
  if (TOP.has(pathname)) return null;

  function back() {
    const sameSite = typeof document !== "undefined" && document.referrer.startsWith(window.location.origin);
    if (sameSite && window.history.length > 1) router.back();
    else router.push(parentPath(pathname));
  }

  return (
    <button
      type="button"
      onClick={back}
      className="mb-4 inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-slate-300 bg-white px-3.5 py-1.5 text-sm font-medium text-slate-700 shadow-sm transition-colors hover:border-blue-700 hover:text-blue-800"
    >
      <ArrowLeft className="h-4 w-4" /> Orqaga
    </button>
  );
}
