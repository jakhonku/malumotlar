import { redirect } from "next/navigation";

/** Eski manzil: endi har bir ma’lumot yig‘ish o‘z ish maydonida. */
export default async function Legacy({ searchParams }: { searchParams: Promise<{ c?: string }> }) {
  const { c } = await searchParams;
  redirect(c && /^[0-9a-f-]{36}$/i.test(c) ? `/collections/${c}/hududlar` : "/");
}
