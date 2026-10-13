"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCheck } from "lucide-react";
import { toast } from "sonner";
import { approveRegionEntries } from "@/app/actions/collections";
import { Button } from "@/components/ui/primitives";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

/** Hududning tekshiruv kutayotgan barcha yozuvlarini birdaniga tasdiqlash. */
export function ApproveRegion({ collectionId, regionId, count }: { collectionId: string; regionId: string; count: number }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  if (count === 0) return null;
  return (
    <>
      <Button variant="success" onClick={() => setOpen(true)}><CheckCheck className="h-4 w-4" /> Hammasini tasdiqlash ({count})</Button>
      <ConfirmDialog
        open={open}
        title="Hammasini tasdiqlash"
        description={`Tekshiruv kutayotgan ${count} ta yozuv tasdiqlanadi va hisobotga kiradi. Avval jadvalni ko‘zdan kechirganingizga ishonch hosil qiling.`}
        confirmLabel="Hammasini tasdiqlash"
        onClose={() => setOpen(false)}
        onConfirm={async () => {
          const res = await approveRegionEntries(collectionId, regionId);
          if (!res.ok) return res.error ?? "Xatolik yuz berdi";
          toast.success(`${res.count} ta yozuv tasdiqlandi`);
          router.refresh();
        }}
      />
    </>
  );
}
