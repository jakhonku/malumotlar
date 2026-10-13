import Image from "next/image";
import { cn } from "@/components/ui/primitives";

/** Madaniyat vazirligi gerbi (oq fonda ko‘rinishi uchun oq doira/kvadrat ichida ishlatiladi). */
export function Emblem({ className, size = 48 }: { className?: string; size?: number }) {
  return (
    <Image
      src="/logo-emblem.png"
      alt="Madaniyat vazirligi gerbi"
      width={Math.round(size * 1.24)}
      height={size}
      className={cn("object-contain", className)}
      priority
    />
  );
}
