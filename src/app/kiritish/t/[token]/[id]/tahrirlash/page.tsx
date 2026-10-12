import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { eventToFormValues, getGroupByToken } from "@/lib/public-event";
import { EventForm } from "@/components/events/event-form";

export const dynamic = "force-dynamic";

export default async function PublicEditEvent({ params }: { params: Promise<{ token: string; id: string }> }) {
  const { token, id } = await params;
  const group = await getGroupByToken(token);
  const e = group?.events.find((x) => x.id === id);
  if (!group || !e) notFound();
  if (e.status !== "draft" && e.status !== "revision") redirect(`/kiritish/t/${token}`);

  const reason = group.reasons[e.id];
  return (
    <>
      <Link href={`/kiritish/t/${token}`} className="mb-3 inline-block text-sm text-slate-600 hover:text-blue-800">← Hudud sahifasiga qaytish</Link>
      <h1 className="mb-1 text-2xl font-bold text-slate-900">Tadbirni tahrirlash</h1>
      <p className="mb-4 text-sm text-slate-600">{e.title}</p>
      {reason && e.status === "revision" && (
        <div role="alert" className="mb-4 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
          <p className="font-semibold">Vazirlik ma’lumotni qayta ishlashga qaytardi</p>
          <p className="mt-1">Sabab: {reason}</p>
        </div>
      )}
      <EventForm
        eventId={e.id}
        initial={eventToFormValues(e)}
        ctx={{ role: "super_admin", regionId: null, districtId: null, canEditDistricts: true }}
        regions={[{ id: group.regionId, name: group.regionName }]}
        districts={group.districtId ? [{ id: group.districtId, name: group.districtName ?? "", region_id: group.regionId }] : []}
        lockedGeo
        publicMode={{ token, eventId: e.id }}
      />
    </>
  );
}
