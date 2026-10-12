"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { markNotificationsRead } from "@/app/actions/events";
import { Button } from "@/components/ui/primitives";

export function MarkReadButton() {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <Button
      variant="outline"
      disabled={pending}
      onClick={() => start(async () => { await markNotificationsRead(); router.refresh(); })}
    >
      Hammasini o‘qilgan deb belgilash
    </Button>
  );
}
