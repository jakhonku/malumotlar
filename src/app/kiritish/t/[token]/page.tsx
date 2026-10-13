import Link from "next/link";
import { notFound } from "next/navigation";
import { CalendarDays, MapPin, Phone, Plus } from "lucide-react";
import { getGroupByToken } from "@/lib/public-event";
import { fmtDate } from "@/lib/format";
import { formatPhone } from "@/lib/phone";
import { buttonClass, Card, CardBody } from "@/components/ui/primitives";
import { StatusBadge } from "@/components/ui/status-badge";
import { LinkPanel, SubmitButton } from "./token-panel";

export const dynamic = "force-dynamic";

export default async function PublicUnitPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const group = await getGroupByToken(token);
  if (!group) notFound();

  const pending = group.events.filter((e) => e.status === "draft" || e.status === "revision");
  const sent = group.events.length - pending.length;

  return (
    <div className="space-y-5">
      <div>
        <p className="text-xs uppercase tracking-wide text-slate-500">Ma’lumot kiritilayotgan hudud</p>
        <h1 className="text-2xl font-bold text-slate-900">
          {group.regionName}
          {group.districtName ? ` · ${group.districtName}` : ""}
        </h1>
        <p className="text-sm text-slate-600">{group.scope === "regional" ? "Viloyatning o‘z tadbirlari" : "Tuman/shahar tadbirlari"}</p>
      </div>

      <LinkPanel token={token} />

      <div className="flex flex-wrap items-center gap-2">
        <Link href={`/kiritish/t/${token}/yangi`} className={buttonClass("default")}>
          <Plus className="h-4 w-4" /> Yana tadbir qo‘shish
        </Link>
        {pending.length > 1 && <SubmitButton token={token} eventId={null} count={pending.length} label={`Hammasini yuborish (${pending.length})`} />}
        <span className="text-sm text-slate-600">
          Jami: <b>{group.events.length}</b> ta · yuborilgan: <b>{sent}</b> · yuborilmagan: <b>{pending.length}</b>
        </span>
      </div>

      <div className="space-y-3">
        {group.events.map((e) => {
          const editable = e.status === "draft" || e.status === "revision";
          const primary = e.responsibles?.find((r) => r.is_primary) ?? e.responsibles?.[0];
          return (
            <Card key={e.id}>
              <CardBody className="space-y-2">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <h2 className="text-base font-semibold text-slate-900">{e.title}</h2>
                  <StatusBadge status={e.status} />
                </div>
                <div className="grid gap-1 text-sm text-slate-700 sm:grid-cols-3">
                  <p className="flex items-start gap-2"><MapPin className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />{e.address || "Manzil kiritilmagan"}</p>
                  <p className="flex items-start gap-2">
                    <CalendarDays className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
                    {e.start_date ? (e.end_date && e.end_date !== e.start_date ? `${fmtDate(e.start_date)} — ${fmtDate(e.end_date)}` : fmtDate(e.start_date)) : "Sana kiritilmagan"}
                  </p>
                  <p className="flex items-start gap-2"><Phone className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />{primary ? `${primary.full_name}, ${formatPhone(primary.phone)}` : "Mas’ul kiritilmagan"}</p>
                </div>
                {group.reasons[e.id] && e.status === "revision" && (
                  <div role="alert" className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
                    <b>Qaytarish sababi:</b> {group.reasons[e.id]}
                  </div>
                )}
                {e.status === "submitted" && <p className="text-xs text-slate-500">Vazirlik ko‘rib chiqmoqda.</p>}
                {e.status === "approved" && <p className="text-xs text-emerald-700">Tasdiqlangan. Rahmat!</p>}
                {editable && (
                  <div className="flex flex-wrap gap-2 pt-1">
                    <Link href={`/kiritish/t/${token}/${e.id}/tahrirlash`} className={buttonClass("outline", "sm")}>Tahrirlash</Link>
                    <SubmitButton token={token} eventId={e.id} label="Yuborish" />
                  </div>
                )}
              </CardBody>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
