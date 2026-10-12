"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Input } from "@/components/ui/primitives";

export function OpenByLink({ base = "/kiritish" }: { base?: string }) {
  const router = useRouter();
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);

  function open(e: React.FormEvent) {
    e.preventDefault();
    const m = /[0-9a-f]{48}/i.exec(value);
    if (!m) return setError("Havola yoki kod noto‘g‘ri");
    router.push(`${base}/t/${m[0].toLowerCase()}`);
  }

  return (
    <form onSubmit={open} className="flex flex-wrap gap-2">
      <Input className="max-w-xl flex-1" value={value} onChange={(e) => { setValue(e.target.value); setError(null); }} placeholder="https://…/kiritish/t/… yoki kod" aria-label="Havola yoki kod" />
      <Button type="submit" variant="outline">Ochish</Button>
      {error && <p role="alert" className="w-full text-sm font-medium text-red-700">{error}</p>}
    </form>
  );
}
