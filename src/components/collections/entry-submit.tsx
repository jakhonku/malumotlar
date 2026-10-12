"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Send } from "lucide-react";
import { submitPublicEntries } from "@/app/actions/public";
import { Button } from "@/components/ui/primitives";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

/** entryId bo‘lsa bitta yozuvni, bo‘lmasa havoladagi barcha tayyor yozuvlarni yuboradi. */
export function EntrySubmit({
  collectionId, token, entryId, label, count,
}: { collectionId: string; token: string; entryId: string | null; label: string; count?: number }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [, start] = useTransition();
  return (
    <>
      <Button variant="success" size={entryId ? "sm" : "default"} onClick={() => setOpen(true)}>
        <Send className="h-4 w-4" /> {label}
      </Button>
      <ConfirmDialog
        open={open}
        title={label}
        description={
          entryId
            ? "Yuborilgandan so‘ng ma’lumotni qaytarilmaguncha tahrirlab bo‘lmaydi. Davom etasizmi?"
            : `${count ?? ""} ta yozuv vazirlikka yuboriladi va qaytarilmaguncha tahrirlab bo‘lmaydi. Davom etasizmi?`
        }
        confirmLabel="Ha, yuborish"
        onClose={() => setOpen(false)}
        onConfirm={async () => {
          const res = await submitPublicEntries(collectionId, token, entryId);
          if (!res.ok) return res.error ?? "Xatolik yuz berdi";
          toast.success(res.sent && res.sent > 1 ? `${res.sent} ta yozuv yuborildi` : "Ma’lumot yuborildi");
          start(() => router.refresh());
        }}
      />
    </>
  );
}
