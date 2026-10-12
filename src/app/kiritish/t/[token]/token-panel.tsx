"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, Copy, Send } from "lucide-react";
import { submitPublicEvents } from "@/app/actions/public";
import { Button, Card, CardBody, Input } from "@/components/ui/primitives";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

export function LinkPanel({ token, base = "/kiritish" }: { token: string; base?: string }) {
  const [copied, setCopied] = useState(false);
  const url = typeof window === "undefined" ? `${base}/t/${token}` : `${window.location.origin}${base}/t/${token}`;

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Nusxalab bo‘lmadi. Havolani qo‘lda belgilab nusxalang.");
    }
  }

  return (
    <Card className="border-amber-300">
      <CardBody className="space-y-3">
        <p className="text-sm font-semibold text-slate-900">Hududingiz havolasi — uni saqlab qo‘ying</p>
        <p className="text-sm text-slate-600">
          Shu havola orqali o‘z hududingiz tadbirlarini keyinroq qo‘shasiz, tuzatasiz yoki qaytarilgan bo‘lsa qayta yuborasiz.
          Havolani faqat hududingiz mas’ullariga bering.
        </p>
        <div className="flex flex-wrap gap-2">
          <Input readOnly value={url} onFocus={(e) => e.currentTarget.select()} className="max-w-2xl flex-1 font-mono text-xs" aria-label="Hudud havolasi" />
          <Button variant="outline" onClick={copy}>
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />} {copied ? "Nusxalandi" : "Nusxalash"}
          </Button>
        </div>
      </CardBody>
    </Card>
  );
}

/** eventId bo‘lsa — bitta tadbirni, bo‘lmasa havoladagi barcha tayyor tadbirlarni yuboradi. */
export function SubmitButton({
  token, eventId, label, count, variant = "success",
}: { token: string; eventId: string | null; label: string; count?: number; variant?: "success" | "outline" }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [, start] = useTransition();
  return (
    <>
      <Button variant={variant} size={eventId ? "sm" : "default"} onClick={() => setOpen(true)}>
        <Send className="h-4 w-4" /> {label}
      </Button>
      <ConfirmDialog
        open={open}
        title={label}
        description={
          eventId
            ? "Yuborilgandan so‘ng tadbirni qaytarilmaguncha tahrirlab bo‘lmaydi. Davom etasizmi?"
            : `${count ?? ""} ta tadbir vazirlikka yuboriladi va qaytarilmaguncha tahrirlab bo‘lmaydi. Davom etasizmi?`
        }
        confirmLabel="Ha, yuborish"
        onClose={() => setOpen(false)}
        onConfirm={async () => {
          const res = await submitPublicEvents(token, eventId);
          if (!res.ok) return res.error ?? "Xatolik yuz berdi";
          toast.success(res.sent && res.sent > 1 ? `${res.sent} ta tadbir yuborildi` : "Ma’lumot yuborildi");
          start(() => router.refresh());
        }}
      />
    </>
  );
}
