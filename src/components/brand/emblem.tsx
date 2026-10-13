import Image from "next/image";
import { cn } from "@/components/ui/primitives";

/** Madaniy-ommaviy tadbirlar va festivallarni tashkil etish bo‘limi logotipi (oq fonda ko‘rinishi uchun oq doira/kvadrat ichida ishlatiladi). */
export function Emblem({ className, size = 48 }: { className?: string; size?: number }) {
  return (
    <Image
      src="/logo-emblem.png"
      alt="Madaniy-ommaviy tadbirlar va festivallarni tashkil etish bo‘limi logotipi"
      width={size}
      height={size}
      className={cn("object-contain", className)}
      priority
    />
  );
}
