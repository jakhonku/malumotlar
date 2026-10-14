"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Upload } from "lucide-react";
import { createSignedUpload } from "@/app/actions/public";
import { createClient } from "@/lib/supabase/client";
import { SIGNED_BUCKET } from "@/lib/constants";
import { Button } from "@/components/ui/primitives";

const MAX = 20 * 1024 * 1024;

export function SignedUpload({ collectionId }: { collectionId: string }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState("");

  async function upload() {
    const file = input.current?.files?.[0];
    if (!file) return void toast.error("Avval PDF faylni tanlang");
    if (file.size > MAX) return void toast.error("Fayl 20 MB dan oshmasin");
    const head = new TextDecoder().decode(new Uint8Array(await file.slice(0, 5).arrayBuffer()));
    if (!head.startsWith("%PDF")) return void toast.error("Faqat PDF fayl yuklash mumkin");

    setBusy(true);
    try {
      const res = await createSignedUpload(collectionId);
      if (!res.ok || !res.path || !res.uploadToken) return void toast.error(res.error ?? "Xatolik yuz berdi");
      const { error } = await createClient().storage.from(SIGNED_BUCKET).uploadToSignedUrl(res.path, res.uploadToken, file, { contentType: "application/pdf" });
      if (error) return void toast.error("Faylni yuklab bo‘lmadi. Qayta urinib ko‘ring.");
      toast.success("Imzolangan hujjat yuborildi");
      if (input.current) input.current.value = "";
      setName("");
      router.refresh();
    } catch {
      toast.error("Tarmoq xatosi. Qayta urinib ko‘ring.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <input
        ref={input}
        type="file"
        accept="application/pdf,.pdf"
        onChange={(e) => setName(e.target.files?.[0]?.name ?? "")}
        className="max-w-full text-sm file:mr-3 file:cursor-pointer file:rounded-md file:border file:border-slate-300 file:bg-white file:px-3 file:py-2 file:text-sm"
        aria-label="Imzolangan PDF"
      />
      <Button variant="success" onClick={upload} disabled={busy || !name}>
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />} Imzolangan PDF ni yuborish
      </Button>
    </div>
  );
}
