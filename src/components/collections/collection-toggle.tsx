"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { setCollectionActive } from "@/app/actions/collections";
import { Button } from "@/components/ui/primitives";

export function CollectionToggle({ id, active }: { id: string; active: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <Button
      variant={active ? "outline" : "success"}
      disabled={pending}
      onClick={() =>
        start(async () => {
          const res = await setCollectionActive(id, !active);
          if (!res.ok) return void toast.error(res.error ?? "Xatolik yuz berdi");
          toast.success(active ? "Yig‘ish yopildi" : "Yig‘ish qayta ochildi");
          router.refresh();
        })
      }
    >
      {active ? "Yopish" : "Qayta ochish"}
    </Button>
  );
}
