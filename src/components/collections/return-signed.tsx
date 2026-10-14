"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Undo2 } from "lucide-react";
import { toast } from "sonner";
import { returnSignedPdf } from "@/app/actions/signed";
import { Button } from "@/components/ui/primitives";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

/** Imzolangan PDF ni sabab bilan viloyat boshqarmasiga qaytarish (faqat vazirlik administratori). */
export function ReturnSigned({ collectionId, regionId, regionName }: { collectionId: string; regionId: string; regionName: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="destructive" size="sm" onClick={() => setOpen(true)}><Undo2 className="h-4 w-4" /> Qaytarish</Button>
      <ConfirmDialog
        open={open}
        title="Imzolangan PDF ni qaytarish"
        description={`${regionName} yuborgan PDF arxivga o‘tadi va hudud yangisini yuborishi kerak bo‘ladi. Qaytarish sababini yozing — hudud uni o‘z panelida ko‘radi.`}
        confirmLabel="Qaytarish"
        needsComment
        destructive
        onClose={() => setOpen(false)}
        onConfirm={async (comment) => {
          const res = await returnSignedPdf(collectionId, regionId, comment ?? "");
          if (!res.ok) return res.error ?? "Xatolik yuz berdi";
          toast.success("PDF qaytarildi");
          router.refresh();
        }}
      />
    </>
  );
}
