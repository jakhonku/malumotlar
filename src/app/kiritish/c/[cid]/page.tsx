import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCollection, isOpen } from "@/lib/public-collection";
import { fmtDate } from "@/lib/format";
import { Card, CardBody } from "@/components/ui/primitives";
import { OpenByLink } from "../../open-by-link";
import { UnitPicker } from "../../unit-picker";

export const dynamic = "force-dynamic";

export default async function CollectionLanding({ params }: { params: Promise<{ cid: string }> }) {
  const { cid } = await params;
  const col = await getCollection(cid);
  if (!col) notFound();

  const admin = createAdminClient();
  const [{ data: regions }, { data: districts }] = await Promise.all([
    admin.from("regions").select("id,name").eq("is_active", true).order("sort_order"),
    admin.from("districts").select("id,name,region_id").eq("is_active", true).order("district_type", { ascending: false }).order("name").limit(2000),
  ]);
  const open = isOpen(col);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">{col.title}</h1>
        {col.description && <p className="mt-2 max-w-3xl whitespace-pre-line text-slate-600">{col.description}</p>}
        {col.deadline && <p className="mt-2 text-sm font-medium text-slate-700">Oxirgi muddat: {fmtDate(col.deadline)}</p>}
      </div>

      {open ? (
        <Card>
          <CardBody>
            <UnitPicker regions={regions ?? []} districts={districts ?? []} target={`/kiritish/c/${col.id}/yangi`} audience={col.audience} />
          </CardBody>
        </Card>
      ) : (
        <div role="alert" className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
          Bu ma’lumot yig‘ish hozir yopiq. Avval kiritgan ma’lumotingizni quyidagi havola orqali ko‘rishingiz mumkin.
        </div>
      )}

      <Card>
        <CardBody>
          <h2 className="font-semibold text-slate-900">Avval kiritgan ma’lumotni ochish</h2>
          <p className="mb-3 text-sm text-slate-600">Hududingiz havolasini (yoki undagi kodni) kiriting.</p>
          <OpenByLink base={`/kiritish/c/${col.id}`} />
        </CardBody>
      </Card>
    </div>
  );
}
