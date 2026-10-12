import Link from "next/link";
import { notFound } from "next/navigation";
import { getGroupByToken } from "@/lib/public-event";
import { EventForm } from "@/components/events/event-form";
import { emptyValues } from "@/lib/event-defaults";

export const dynamic = "force-dynamic";

export default async function PublicAddEvent({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const group = await getGroupByToken(token);
  if (!group) notFound();

  const ctx = { role: "super_admin" as const, regionId: null, districtId: null, canEditDistricts: true };
  const initial = emptyValues(ctx);
  initial.scope = group.scope;
  initial.region_id = group.regionId;
  initial.district_id = group.districtId ?? "";

  return (
    <>
      <Link href={`/kiritish/t/${token}`} className="mb-3 inline-block text-sm text-slate-600 hover:text-blue-800">← Hudud sahifasiga qaytish</Link>
      <h1 className="mb-4 text-2xl font-bold text-slate-900">Yana bir tadbir qo‘shish</h1>
      <EventForm
        eventId={null}
        initial={initial}
        ctx={ctx}
        regions={[{ id: group.regionId, name: group.regionName }]}
        districts={group.districtId ? [{ id: group.districtId, name: group.districtName ?? "", region_id: group.regionId }] : []}
        lockedGeo
        publicMode={{ token, eventId: null }}
      />
    </>
  );
}
