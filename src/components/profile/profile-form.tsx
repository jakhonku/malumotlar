"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Camera, Trash2, User } from "lucide-react";
import { toast } from "sonner";
import { removeMyPhoto, saveMyProfile } from "@/app/actions/profile";
import { Button, Input } from "@/components/ui/primitives";

const W = 600;
const H = 800; // 3x4

/** Tanlangan rasmni markazdan 3x4 nisbatda qirqib, 600x800 JPEG qiladi (hajmi kichik bo‘lishi uchun). */
async function toPortraitJpeg(file: File): Promise<Blob> {
  const bmp = await createImageBitmap(file, { imageOrientation: "from-image" });
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas");
  const scale = Math.max(W / bmp.width, H / bmp.height);
  const w = bmp.width * scale;
  const h = bmp.height * scale;
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, W, H);
  ctx.drawImage(bmp, (W - w) / 2, (H - h) / 2, w, h);
  return await new Promise<Blob>((res, rej) => canvas.toBlob((b) => (b ? res(b) : rej(new Error("blob"))), "image/jpeg", 0.85));
}

export function ProfileForm({ initial }: { initial: { full_name: string; position: string; phone: string; avatarUrl: string | null; hasPhoto: boolean } }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [fullName, setFullName] = useState(initial.full_name);
  const [position, setPosition] = useState(initial.position);
  const [phone, setPhone] = useState(initial.phone);
  const [photo, setPhoto] = useState<Blob | null>(null);
  const [preview, setPreview] = useState<string | null>(initial.avatarUrl);
  const [hasSaved, setHasSaved] = useState(initial.hasPhoto);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  async function pick(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!f.type.startsWith("image/")) return void toast.error("Faqat rasm fayli (JPG, PNG) tanlang");
    try {
      const blob = await toPortraitJpeg(f);
      setPhoto(blob);
      setPreview(URL.createObjectURL(blob));
    } catch {
      toast.error("Rasmni o‘qib bo‘lmadi. Boshqa rasm tanlang.");
    }
  }

  function save(e: React.FormEvent) {
    e.preventDefault();
    const fd = new FormData();
    fd.set("full_name", fullName);
    fd.set("position", position);
    fd.set("phone", phone);
    if (photo) fd.set("photo", new File([photo], "profil.jpg", { type: "image/jpeg" }));
    start(async () => {
      const res = await saveMyProfile(fd);
      if (!res.ok) return setError(res.error ?? "Xatolik");
      setError(null);
      setPhoto(null);
      if (photo) setHasSaved(true);
      toast.success("Profil saqlandi");
      router.refresh();
    });
  }

  return (
    <form onSubmit={save} className="grid gap-6 md:grid-cols-[15rem_1fr]">
      <div>
        <div className="relative mx-auto aspect-[3/4] w-48 overflow-hidden rounded-lg border-2 border-slate-300 bg-slate-100 md:w-full">
          {preview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={preview} alt="Profil rasmi (3x4)" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full flex-col items-center justify-center gap-2 text-slate-400"><User className="h-16 w-16" /><span className="text-xs">Rasm yo‘q</span></div>
          )}
        </div>
        <input ref={input} type="file" accept="image/*" onChange={pick} className="hidden" aria-label="3x4 rasm tanlash" />
        <div className="mt-3 flex flex-wrap justify-center gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => input.current?.click()}><Camera className="h-4 w-4" /> {preview ? "Rasmni almashtirish" : "3x4 rasm yuklash"}</Button>
          {photo && (
            <Button type="button" variant="ghost" size="sm" onClick={() => { setPhoto(null); setPreview(hasSaved ? initial.avatarUrl : null); if (input.current) input.current.value = ""; }}>Bekor qilish</Button>
          )}
          {hasSaved && !photo && (
            <Button
              type="button" variant="destructive" size="sm" disabled={pending}
              onClick={() => start(async () => {
                const res = await removeMyPhoto();
                if (!res.ok) return void toast.error(res.error ?? "Xatolik");
                setHasSaved(false); setPreview(null); setPhoto(null);
                if (input.current) input.current.value = "";
                toast.success("Rasm o‘chirildi");
                router.refresh();
              })}
            ><Trash2 className="h-4 w-4" /> Rasmni o‘chirish</Button>
          )}
        </div>
        <p className="mt-2 text-center text-xs text-slate-500">Rasm avtomatik 3x4 nisbatda qirqiladi. Majburiy emas.</p>
      </div>

      <div className="space-y-4">
        <label className="block text-sm">
          <span className="mb-1 block font-medium text-slate-700">F.I.Sh. *</span>
          <Input value={fullName} onChange={(e) => { setFullName(e.target.value); setError(null); }} placeholder="Familiya Ism Sharif" required minLength={3} maxLength={100} />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium text-slate-700">Lavozimi</span>
          <Input value={position} onChange={(e) => setPosition(e.target.value)} placeholder="Masalan: Viloyat madaniyat boshqarmasi boshlig‘i" maxLength={120} />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium text-slate-700">Telefon</span>
          <Input value={phone} onChange={(e) => { setPhone(e.target.value); setError(null); }} placeholder="+998 90 123 45 67" inputMode="tel" />
        </label>
        {error && <p role="alert" className="text-sm font-medium text-red-700">{error}</p>}
        <Button type="submit" disabled={pending || fullName.trim().length < 3}>{pending ? "Saqlanmoqda…" : "Saqlash"}</Button>
      </div>
    </form>
  );
}
