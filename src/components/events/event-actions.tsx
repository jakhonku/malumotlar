"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Pencil, Trash2 } from "lucide-react";
import { deleteEvent, transitionEvent } from "@/app/actions/events";
import { Button, buttonClass } from "@/components/ui/primitives";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { ACTION_BUTTONS, type WorkflowAction } from "@/lib/workflow";

const VARIANT: Record<WorkflowAction, "default" | "success" | "destructive" | "outline"> = {
  submit: "success",
  forward: "default",
  return: "destructive",
  approve: "success",
  reopen: "outline",
};

export function EventActions({
  eventId, actions, canEdit, canDelete,
}: { eventId: string; actions: WorkflowAction[]; canEdit: boolean; canDelete: boolean }) {
  const router = useRouter();
  const [active, setActive] = useState<WorkflowAction | "delete" | null>(null);
  const cfg = active && active !== "delete" ? ACTION_BUTTONS[active] : null;

  return (
    <div className="flex flex-wrap gap-2">
      {canEdit && (
        <Link href={`/events/${eventId}/edit`} className={buttonClass("outline")}>
          <Pencil className="h-4 w-4" /> Tahrirlash
        </Link>
      )}
      {actions.map((a) => (
        <Button key={a} variant={VARIANT[a]} onClick={() => setActive(a)}>
          {ACTION_BUTTONS[a].label}
        </Button>
      ))}
      {canDelete && (
        <Button variant="ghost" onClick={() => setActive("delete")}>
          <Trash2 className="h-4 w-4 text-red-700" /> Qoralamani o‘chirish
        </Button>
      )}

      <ConfirmDialog
        open={active !== null && active !== "delete"}
        title={cfg?.label ?? ""}
        description={cfg?.confirm}
        confirmLabel={cfg?.label ?? "Tasdiqlash"}
        needsComment={cfg?.needsComment}
        destructive={active === "return"}
        onClose={() => setActive(null)}
        onConfirm={async (comment) => {
          if (!active || active === "delete") return;
          const res = await transitionEvent(eventId, active, comment);
          if (!res.ok) return res.error ?? "Xatolik yuz berdi";
          toast.success("Amal bajarildi");
          router.refresh();
        }}
      />
      <ConfirmDialog
        open={active === "delete"}
        title="Qoralamani o‘chirish"
        description="Qoralama ro‘yxatdan olib tashlanadi. Bu amal audit jurnalida saqlanadi."
        confirmLabel="O‘chirish"
        destructive
        onClose={() => setActive(null)}
        onConfirm={async () => {
          const res = await deleteEvent(eventId);
          if (!res.ok) return res.error ?? "Xatolik yuz berdi";
          toast.success("Qoralama o‘chirildi");
          router.push("/events");
          router.refresh();
        }}
      />
    </div>
  );
}
