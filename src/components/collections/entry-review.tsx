"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { reviewEntry } from "@/app/actions/collections";
import { Button } from "@/components/ui/primitives";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

type Action = "approve" | "return" | "reopen";

const CFG: Record<Action, { label: string; confirm: string; comment: boolean; variant: "success" | "destructive" | "outline" }> = {
  approve: { label: "Tasdiqlash", confirm: "Ma’lumot tasdiqlanadi va hisobotga kiradi.", comment: false, variant: "success" },
  return: { label: "Qayta ishlashga qaytarish", confirm: "Qaytarish sababini yozing — hudud uni havolasida ko‘radi.", comment: true, variant: "destructive" },
  reopen: { label: "Qayta ochish", confirm: "Tasdiqlangan ma’lumotni qayta ochish sababini yozing.", comment: true, variant: "outline" },
};

export function EntryReview({ entryId, actions }: { entryId: string; actions: Action[] }) {
  const router = useRouter();
  const [active, setActive] = useState<Action | null>(null);
  const cfg = active ? CFG[active] : null;
  if (!actions.length) return null;
  return (
    <div className="flex flex-wrap gap-2">
      {actions.map((a) => (
        <Button key={a} variant={CFG[a].variant} onClick={() => setActive(a)}>{CFG[a].label}</Button>
      ))}
      <ConfirmDialog
        open={!!active}
        title={cfg?.label ?? ""}
        description={cfg?.confirm}
        confirmLabel={cfg?.label ?? "Tasdiqlash"}
        needsComment={cfg?.comment}
        destructive={active === "return"}
        onClose={() => setActive(null)}
        onConfirm={async (comment) => {
          if (!active) return;
          const res = await reviewEntry(entryId, active, comment);
          if (!res.ok) return res.error ?? "Xatolik yuz berdi";
          toast.success("Amal bajarildi");
          router.refresh();
        }}
      />
    </div>
  );
}
