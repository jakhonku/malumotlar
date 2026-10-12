import Link from "next/link";
import { ArrowRight, ClipboardList } from "lucide-react";
import { createAdminClient } from "@/lib/supabase/admin";
import { isOpen } from "@/lib/public-collection";
import type { CollectionRow } from "@/lib/collections";
import { fmtDate } from "@/lib/format";
import { Card, CardBody } from "@/components/ui/primitives";

export const dynamic = "force-dynamic";

export default async function PublicLanding() {
  const { data } = await createAdminClient().from("collections").select("*").eq("is_active", true).order("created_at", { ascending: false });
  const open = ((data ?? []) as CollectionRow[]).filter(isOpen);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Qaysi ma’lumotni kiritmoqchisiz?</h1>
        <p className="mt-2 max-w-3xl text-slate-600">
          Har bir viloyat va har bir tuman/shahar o‘z hududi ma’lumotini <b>alohida</b> to‘ldiradi. Login va parol kerak emas.
        </p>
      </div>

      {open.length === 0 ? (
        <Card><CardBody className="text-sm text-slate-600">Hozircha ochiq ma’lumot yig‘ish yo‘q. Keyinroq qayta urinib ko‘ring.</CardBody></Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {open.map((c) => (
            <Link key={c.id} href={`/kiritish/c/${c.id}`}>
              <Card className="h-full transition-shadow hover:shadow-md">
                <CardBody className="space-y-2">
                  <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900"><ClipboardList className="h-5 w-5 text-blue-800" /> {c.title}</h2>
                  {c.description && <p className="line-clamp-3 text-sm text-slate-600">{c.description}</p>}
                  <p className="text-xs text-slate-500">{c.deadline ? `Oxirgi muddat: ${fmtDate(c.deadline)}` : "Muddat belgilanmagan"}</p>
                  <p className="flex items-center gap-1 text-sm font-medium text-blue-800">To‘ldirishni boshlash <ArrowRight className="h-4 w-4" /></p>
                </CardBody>
              </Card>
            </Link>
          ))}
        </div>
      )}

      <p className="text-xs text-slate-500">
        Eski «Yangi yil tadbirlari» standart formasi: <Link href="/kiritish/standart" className="underline">shu yerda</Link>.
      </p>
    </div>
  );
}
