"use client";

import { useEffect, useState } from "react";
import { BellRing, BellOff } from "lucide-react";
import { toast } from "sonner";
import { removePushSubscription, savePushSubscription, sendTestPush } from "@/app/actions/push";

const KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";

function toKey(b64: string): Uint8Array<ArrayBuffer> {
  const pad = "=".repeat((4 - (b64.length % 4)) % 4);
  const raw = atob((b64 + pad).replace(/-/g, "+").replace(/_/g, "/"));
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

/** Brauzer push-xabarnomasini yoqish/o‘chirish tugmasi. */
export function PushToggle({ className = "" }: { className?: string }) {
  const [state, setState] = useState<"loading" | "unsupported" | "off" | "on" | "denied">("loading");

  useEffect(() => {
    (async () => {
      if (!KEY || !("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) return setState("unsupported");
      if (Notification.permission === "denied") return setState("denied");
      const reg = await navigator.serviceWorker.getRegistration("/sw.js");
      const sub = await reg?.pushManager.getSubscription();
      if (sub && Notification.permission === "granted") {
        // obuna serverda ham borligini ta’minlaymiz (baza yangilangach o‘zi tiklanadi)
        const res = await savePushSubscription(sub.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string } });
        setState(res.ok ? "on" : "off");
      } else setState("off");
    })().catch(() => setState("unsupported"));
  }, []);

  async function enable() {
    try {
      const perm = await Notification.requestPermission();
      if (perm !== "granted") return setState(perm === "denied" ? "denied" : "off");
      const reg = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;
      const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: toKey(KEY) }));
      const json = sub.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string } };
      const res = await savePushSubscription(json);
      if (!res.ok) return void toast.error(res.error ?? "Yoqib bo‘lmadi");
      setState("on");
      toast.success("Xabarnomalar yoqildi");
    } catch {
      toast.error("Xabarnomani yoqib bo‘lmadi");
    }
  }

  async function disable() {
    const reg = await navigator.serviceWorker.getRegistration("/sw.js");
    const sub = await reg?.pushManager.getSubscription();
    if (sub) {
      await removePushSubscription(sub.endpoint);
      await sub.unsubscribe();
    }
    setState("off");
  }

  if (state === "loading" || state === "unsupported") return null;
  if (state === "denied") return <p className={`text-xs text-slate-400 ${className}`}>Xabarnoma brauzer sozlamalarida bloklangan.</p>;
  return state === "on" ? (
    <div className={`flex gap-1 ${className}`}>
      <button type="button" onClick={disable} className="flex flex-1 cursor-pointer items-center justify-center gap-1 rounded-md bg-emerald-600/30 px-2 py-2 text-xs text-white hover:bg-emerald-600/50">
        <BellRing className="h-4 w-4" /> Push: yoqilgan
      </button>
      <button
        type="button"
        onClick={async () => { const r = await sendTestPush(); (r.ok ? toast.success : toast.error)(r.message); }}
        className="cursor-pointer rounded-md bg-white/10 px-2 py-2 text-xs text-white hover:bg-white/20"
      >
        Sinash
      </button>
    </div>
  ) : (
    <button type="button" onClick={enable} className={`flex w-full cursor-pointer items-center justify-center gap-1 rounded-md bg-amber-500 px-2 py-2 text-xs font-semibold text-slate-900 hover:bg-amber-400 ${className}`}>
      <BellOff className="h-4 w-4" /> Push xabarnomani yoqish
    </button>
  );
}
