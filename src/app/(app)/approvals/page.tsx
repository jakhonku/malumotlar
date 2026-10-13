import { requireProfile } from "@/lib/auth";
import { EventsView } from "@/components/events/events-view";
import { PageHeader } from "@/components/ui/primitives";
import type { EventStatus } from "@/lib/constants";

export default async function ApprovalsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const profile = await requireProfile();
  const sp = await searchParams;
  // Rolga qarab: o‘zi ko‘rib chiqishi kerak bo‘lgan yoki o‘zi tuzatishi kerak bo‘lgan tadbirlar
  let status: EventStatus[] = ["submitted"];
  let title = "Tasdiqlash markazi";
  let desc = "Tekshiruv va tasdiqlashni kutayotgan tadbirlar.";
  let stage: string | undefined;
  if (profile.role === "region_manager") { stage = "region"; desc = "Tuman va shaharlardan kelgan, boshqarma tekshiruvini kutayotgan ma’lumotlar."; }
  if (profile.role === "super_admin") { stage = "ministry"; desc = "Vazirlik tasdig‘ini kutayotgan tadbirlar."; }
  if (profile.role === "district_manager") { status = ["revision"]; title = "Qaytarilgan ma’lumotlar"; desc = "Qayta ishlab yuborishingiz kerak bo‘lgan tadbirlar."; }
  return (
    <>
      <PageHeader title={title} description={desc} />
      <EventsView profile={profile} searchParams={sp} basePath="/approvals" extra={{ status, stage }} />
    </>
  );
}
