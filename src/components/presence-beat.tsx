"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { touchPresence } from "@/app/actions/presence";

/** Sahifa ochiq va ko‘rinib turganda har 2 daqiqada, shuningdek sahifa almashganda «faolman» belgisini yuboradi. */
export function PresenceBeat() {
  const path = usePathname();
  useEffect(() => { void touchPresence().catch(() => {}); }, [path]);
  useEffect(() => {
    const tick = () => { if (document.visibilityState === "visible") void touchPresence().catch(() => {}); };
    const id = setInterval(tick, 120_000);
    document.addEventListener("visibilitychange", tick);
    return () => { clearInterval(id); document.removeEventListener("visibilitychange", tick); };
  }, []);
  return null;
}
