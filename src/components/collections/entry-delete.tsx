"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { deletePublicEntry } from "@/app/actions/public";
import { Button } from "@/components/ui/primitives";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

export function EntryDelete({ collectionId, token, entryId }: { collectionId: string; token: string; entryId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [, start] = useTransition();
  return (
    <>
      <Button variant="ghost" size="sm" onClick={() => setOpen(true)} aria-label="O‘chirish">
        <Trash2 className="h-4 w-4 text-red-700" />
      </Button>
      <ConfirmDialog
        open={open}
        title="Qatorni o‘chirish"
        description="Bu yozuv jadvaldan olib tashlanadi. Davom etasizmi?"
        confirmLabel="O‘chirish"
        destructive
        onClose={() => setOpen(false)}
        onConfirm={async () => {
          const res = await deletePublicEntry(collectionId, token, entryId);
          if (!res.ok) return res.error ?? "Xatolik yuz berdi";
          toast.success("O‘chirildi");
          start(() => router.refresh());
        }}
      />
    </>
  );
}
