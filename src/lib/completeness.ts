/** Hududda ma’lumoti hali kiritilmagan birliklar (viloyatning o‘zi va tuman/shaharlar) nomlari. */
export function missingUnits(
  audience: "both" | "regional" | "district",
  ownLabel: string,
  districts: { id: string; name: string }[],
  entries: { scope: string; district_id: string | null }[],
): string[] {
  const out: string[] = [];
  if (audience !== "district" && !entries.some((e) => e.scope === "regional")) out.push(ownLabel);
  if (audience !== "regional") {
    const have = new Set(entries.filter((e) => e.district_id).map((e) => e.district_id));
    for (const d of districts) if (!have.has(d.id)) out.push(d.name);
  }
  return out;
}

export function missingMessage(missing: string[]): string {
  const shown = missing.slice(0, 6).join(", ");
  return `Hali ma’lumoti kiritilmagan hududlar: ${shown}${missing.length > 6 ? ` va yana ${missing.length - 6} ta` : ""}. Barcha hududni kiritib, yuborganingizdan keyingina imzolangan PDF yuborish mumkin.`;
}
