import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { FileCheck2 } from "lucide-react";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getRegions } from "@/lib/queries";
import { listSignedFiles } from "@/lib/signed-files";
import type { CollectionRow } from "@/lib/collections";
import { fmtDateTime } from "@/lib/format";
import { ReturnSigned } from "@/components/collections/return-signed";
import { Badge, buttonClass, Card, Table, Td, Th } from "@/components/ui/primitives";

export const dynamic = "force-dynamic";

/** Imzolangan PDF hujjatlar: qaysi viloyat boshqarmasi, kim, qachon yuborgan. */
export default async function SignedDocsPage({ params }: { params: Promise<{ id: string }> }) {
  const profile = await requireProfile();
  if (profile.role !== "super_admin" && profile.role !== "observer") redirect("/");
  const supabase = await createClient();
  const { id } = await params;
  const { data: colRaw } = await supabase.from("collections").select("*").eq("id", id).maybeSingle();
  if (!colRaw) notFound();
  const col = colRaw as CollectionRow;

  const [regions, files] = await Promise.all([getRegions(supabase), listSignedFiles(col.id).catch(() => [])]);

  // yuboruvchilar: faylga yozilgan profil, bo‘lmasa shu viloyatning mas’uli
  const admin = createAdminClient();
  const ids = [...new Set(files.map((f) => f.by).filter((x): x is string => !!x))];
  const [{ data: byRows }, { data: mgrRows }] = await Promise.all([
    ids.length ? admin.from("profiles").select("id,full_name").in("id", ids) : Promise.resolve({ data: [] as { id: string; full_name: string }[] }),
    admin.from("profiles").select("full_name,region_id").eq("role", "region_manager").eq("is_active", true),
  ]);
  const nameBy = new Map((byRows ?? []).map((p) => [p.id, p.full_name]));
  const mgrOf = new Map((mgrRows ?? []).map((p) => [p.region_id as string, p.full_name]));

  const rows = regions.map((r) => {
    const mine = files.filter((f) => f.regionId === r.id).sort((a, b) => b.uploadedAt.getTime() - a.uploadedAt.getTime());
    const last = mine[0];
    return { r, last, count: mine.length, who: last ? (last.by ? nameBy.get(last.by) : undefined) ?? mgrOf.get(r.id) ?? "—" : null };
  });
  const got = rows.filter((x) => x.last).length;

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <p className="max-w-3xl text-sm text-slate-600">Viloyat boshqarmalari barcha tuman ma’lumotini to‘liq kiritib, tasdiqlangandan keyin Word’ni imzolab, skanerlab yuborgan PDF hujjatlar. Noto‘g‘ri bo‘lsa, sabab yozib qaytaring.</p>
        <Badge tone={got === regions.length ? "green" : "amber"}>{got} / {regions.length} ta hudud yuborgan</Badge>
      </div>

      <Card>
        <Table>
          <thead><tr><Th>Hudud</Th><Th>Holati</Th><Th>Kim yuborgan</Th><Th>Qachon</Th><Th>Hajmi</Th><Th><span className="sr-only">Amal</span></Th></tr></thead>
          <tbody>
            {rows.map(({ r, last, who, count }) => (
              <tr key={r.id} className={last ? "" : "bg-red-50/40"}>
                <Td className="font-medium"><Link href={`/collections/${col.id}/hudud/${r.id}`} className="text-blue-800 hover:underline">{r.name}</Link></Td>
                <Td>{last ? <Badge tone="green"><FileCheck2 className="mr-1 inline h-3 w-3" />Yuborilgan{count > 1 ? ` (${count} ta)` : ""}</Badge> : <Badge tone="red">Yuborilmagan</Badge>}</Td>
                <Td>{who ?? <span className="text-slate-400">—</span>}{last && <p className="text-xs text-slate-500">{r.name}</p>}</Td>
                <Td className="whitespace-nowrap">{last ? fmtDateTime(last.uploadedAt.toISOString()) : "—"}</Td>
                <Td className="whitespace-nowrap text-xs">{last?.size ? `${(last.size / 1024 / 1024).toFixed(1)} MB` : "—"}</Td>
                <Td>{last && (
                  <div className="flex flex-wrap gap-2">
                    <a href={last.url} target="_blank" rel="noreferrer" className={buttonClass("default", "sm")}>PDF ni ochish</a>
                    {profile.role === "super_admin" && <ReturnSigned collectionId={col.id} regionId={r.id} regionName={r.name} />}
                  </div>
                )}</Td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Card>
    </>
  );
}
