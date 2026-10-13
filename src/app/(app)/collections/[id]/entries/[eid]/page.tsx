import { notFound, redirect } from "next/navigation";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

/** Yozuvlar endi hududning jadvali ichida tekshiriladi — eski havolalar shu yerga yo‘naltiriladi. */
export default async function EntryRedirect({ params }: { params: Promise<{ id: string; eid: string }> }) {
  const profile = await requireProfile();
  if (profile.role === "district_manager") redirect("/");
  const { id, eid } = await params;
  const supabase = await createClient();
  const { data: e } = await supabase.from("collection_entries").select("region_id,status").eq("id", eid).eq("collection_id", id).maybeSingle();
  if (!e) notFound();
  if (e.status === "draft") redirect(profile.role === "region_manager" ? "/boshqarma" : `/collections/${id}`);
  redirect(`/collections/${id}/hudud/${e.region_id}#e-${eid}`);
}
