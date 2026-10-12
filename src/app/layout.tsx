import type { Metadata } from "next";
import { Toaster } from "sonner";
import "./globals.css";

export const metadata: Metadata = {
  title: "Yangi yil tadbirlari monitoringi — Madaniyat vazirligi",
  description: "O‘zbekiston Respublikasi Madaniyat vazirligi: Yangi yil tadbirlarini yig‘ish, monitoring va hisobot platformasi",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="uz">
      <body className="min-h-screen antialiased">
        {children}
        <Toaster position="top-right" richColors closeButton />
      </body>
    </html>
  );
}
