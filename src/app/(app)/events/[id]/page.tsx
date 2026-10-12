import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getEvent } from "@/lib/queries";
import { availableActions, canEditEvent } from "@/lib/workflow";
import { ACTION_LABELS, ARTIST_TYPE_LABELS, STAGE_LABELS } from "@/lib/constants";
import { fmtDate, fmtDateTime } from "@/lib/format";
import { formatPhone } from "@/lib/phone";
import type { HistoryRow } from "@/lib/types";
import { Badge, Card, CardBody, CardHeader, CardTitle, PageHeader, Table, Td, Th } from "@/components/ui/primitives";
import { ScopeBadge, StatusBadge } from "@/components/ui/status-badge";
import { EventActions } from "@/components/events/event-actions";

function Info({ k, children }: { k: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1 border-b border-slate-100 py-2.5 text-sm sm:grid-cols-3">
      <dt className="font-medium text-slate-500">{k}</dt>
      <dd className="whitespace-pre-line text-slate-900 sm:col-span-2">{children || <span className="text-slate-400">Kiritilmagan</span>}</dd>
    </div>
  );
}

export default async function EventDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const profile = await requireProfile();
  const supabase = await createClient();
  const e = await getEvent(supabase, id);
  if (!e) notFound();

  const { data: hist } = await supabase
    .from("event_status_history")
    .select("id,action,old_status,new_status,comment,created_at,changed_by,actor:profiles!changed_by(full_name)")
    .eq("event_id", id)
    .order("created_at", { ascending: false });
  const history = (hist ?? []) as unknown as HistoryRow[];

  const actions = availableActions(e, profile);
  const canEdit = canEditEvent(e, profile);
  const canDelete = e.status === "draft" && canEdit;
  const lastReturn = e.status === "revision" ? history.find((h) => h.action === "return" || h.action === "reopen") : null;

  return (
    <>
      <Link href="/events" className="mb-3 inline-flex items-center gap-1 text-sm text-slate-600 hover:text-blue-800">
        <ArrowLeft className="h-4 w-4" /> Tadbirlar ro‘yxati
      </Link>
      <PageHeader title={e.title} description={`${e.region?.name}${e.district?.name ? " · " + e.district.name : ""}`}>
        {(e as { source?: string }).source === "public" && <Badge tone="amber">Ochiq forma orqali kiritilgan</Badge>}
        <ScopeBadge scope={e.event_scope} />
        <StatusBadge status={e.status} />
      </PageHeader>

      {lastReturn && (
        <div role="alert" className="mb-4 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
          <p className="font-semibold">Tadbir qayta ishlashga qaytarilgan</p>
          <p className="mt-1">Sabab: {lastReturn.comment}</p>
        </div>
      )}

      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-600">
          Hozir ko‘rib chiqayotgan: <b>{STAGE_LABELS[e.stage]}</b>
          {e.status === "approved" && " (jarayon yakunlangan)"}
        </p>
        <EventActions eventId={e.id} actions={actions} canEdit={canEdit} canDelete={canDelete} />
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          <Card>
            <CardHeader><CardTitle>Asosiy ma’lumotlar</CardTitle></CardHeader>
            <CardBody>
              <dl>
                <Info k="Tadbir turi">{e.event_type}</Info>
                <Info k="Tashkilot / muassasa">{e.organization_name}</Info>
                <Info k="Qisqacha mazmuni">{e.description}</Info>
                <Info k="Manzil">{e.address}</Info>
                <Info k="Lokatsiya tavsifi">{e.location_note}</Info>
                <Info k="Tadbir sanasi">{e.start_date ? fmtDate(e.start_date) : ""}</Info>
                <Info k="Qo‘shimcha izoh">{e.notes}</Info>
              </dl>
            </CardBody>
          </Card>

          <Card>
            <CardHeader><CardTitle>San’atkorlar va ijodiy jamoalar ({e.artists?.length ?? 0})</CardTitle></CardHeader>
            {e.artists?.length ? (
              <Table>
                <thead><tr><Th>№</Th><Th>F.I.Sh. / jamoa</Th><Th>Turi</Th><Th>Ijro yo‘nalishi</Th><Th>Vazifasi</Th><Th>Izoh</Th></tr></thead>
                <tbody>
                  {e.artists.map((a, i) => (
                    <tr key={a.id}>
                      <Td>{i + 1}</Td><Td className="font-medium">{a.artist_name}</Td>
                      <Td>{ARTIST_TYPE_LABELS[a.artist_type]}</Td><Td>{a.performance_type}</Td><Td>{a.role_description}</Td><Td>{a.notes}</Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            ) : <CardBody className="text-sm text-slate-500">Ma’lumot kiritilmagan</CardBody>}
          </Card>

          <Card>
            <CardHeader><CardTitle>Ishtirokchilar ({e.participants?.length ?? 0})</CardTitle></CardHeader>
            {e.participants?.length ? (
              <Table>
                <thead><tr><Th>№</Th><Th>Nomi</Th><Th>Toifasi</Th><Th>Soni</Th><Th>Vazifasi</Th><Th>Izoh</Th></tr></thead>
                <tbody>
                  {e.participants.map((p, i) => (
                    <tr key={p.id}>
                      <Td>{i + 1}</Td><Td className="font-medium">{p.participant_name}</Td><Td>{p.participant_category}</Td>
                      <Td>{p.participant_count ?? "—"}</Td><Td>{p.participation_role}</Td><Td>{p.notes}</Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            ) : <CardBody className="text-sm text-slate-500">Ma’lumot kiritilmagan</CardBody>}
          </Card>

          <Card>
            <CardHeader><CardTitle>Mas’ul ijrochilar ({e.responsibles?.length ?? 0})</CardTitle></CardHeader>
            {e.responsibles?.length ? (
              <Table>
                <thead><tr><Th>№</Th><Th>F.I.Sh.</Th><Th>Lavozimi</Th><Th>Ish joyi</Th><Th>Telefon</Th><Th>Izoh</Th></tr></thead>
                <tbody>
                  {e.responsibles.map((r, i) => (
                    <tr key={r.id}>
                      <Td>{i + 1}</Td>
                      <Td className="font-medium">{r.full_name} {r.is_primary && <Badge tone="blue">asosiy</Badge>}</Td>
                      <Td>{r.position}</Td><Td>{r.organization}</Td>
                      <Td className="whitespace-nowrap">{formatPhone(r.phone)}</Td><Td>{r.notes}</Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            ) : <CardBody className="text-sm text-slate-500">Ma’lumot kiritilmagan</CardBody>}
          </Card>
        </div>

        <Card className="h-fit">
          <CardHeader><CardTitle>Holatlar tarixi</CardTitle></CardHeader>
          <CardBody>
            {history.length === 0 ? (
              <p className="text-sm text-slate-500">Hali yuborilmagan</p>
            ) : (
              <ol className="space-y-4 border-l-2 border-slate-200 pl-4">
                {history.map((h) => (
                  <li key={h.id} className="relative text-sm">
                    <span className="absolute -left-[1.4rem] top-1.5 h-2.5 w-2.5 rounded-full bg-blue-700" />
                    <p className="font-semibold text-slate-900">{ACTION_LABELS[h.action] ?? h.action}</p>
                    <p className="text-xs text-slate-500">{fmtDateTime(h.created_at)}{h.actor?.full_name ? ` · ${h.actor.full_name}` : ""}</p>
                    {h.comment && <p className="mt-1 rounded bg-slate-50 p-2 text-slate-700">{h.comment}</p>}
                  </li>
                ))}
              </ol>
            )}
            <p className="mt-4 text-xs text-slate-500">Yaratilgan: {fmtDateTime(e.created_at)}<br />Yangilangan: {fmtDateTime(e.updated_at)}</p>
          </CardBody>
        </Card>
      </div>
    </>
  );
}
