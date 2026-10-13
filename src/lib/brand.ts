export const MINISTRY_NAME = "Madaniyat vazirligi";
export const MINISTRY_FULL = "O‘ZBEKISTON RESPUBLIKASI MADANIYAT VAZIRLIGI";
export const DEPARTMENT_NAME = "Madaniy-ommaviy tadbirlar va festivallarni tashkil etish bo‘limi";

/**
 * Hududning rasmiy boshqaruv organi nomi:
 *  - Qoraqalpog‘iston Respublikasi → «Qoraqalpog‘iston Respublikasi Madaniyat vazirligi»
 *  - Toshkent shahri → «Toshkent shahar madaniyat boshqarmasi»
 *  - viloyatlar → «Andijon viloyat madaniyat boshqarmasi»
 */
export function regionOrgName(regionName: string): string {
  const n = regionName.trim();
  if (/^Qoraqalpog/i.test(n)) return "Qoraqalpog‘iston Respublikasi Madaniyat vazirligi";
  if (/shahri$/i.test(n)) return `${n.replace(/\s*shahri$/i, "")} shahar madaniyat boshqarmasi`;
  if (/viloyati$/i.test(n)) return `${n.replace(/\s*viloyati$/i, "")} viloyat madaniyat boshqarmasi`;
  return `${n} madaniyat boshqarmasi`;
}

export type RegionKind = "respublika" | "shahar" | "viloyat";
export function regionKind(regionName: string): RegionKind {
  const n = regionName.trim();
  if (/^Qoraqalpog/i.test(n)) return "respublika";
  if (/shahri$/i.test(n)) return "shahar";
  return "viloyat";
}

/** «Viloyatning o‘zi» — hudud turiga qarab: Respublikaning o‘zi / Shaharning o‘zi / Viloyatning o‘zi */
export function regionSelf(regionName: string): string {
  const k = regionKind(regionName);
  return k === "respublika" ? "Respublikaning o‘zi" : k === "shahar" ? "Shaharning o‘zi" : "Viloyatning o‘zi";
}

/** Hudud nomi + (turi bo‘yicha o‘zi): «Qoraqalpog‘iston Respublikasi (respublikaning o‘zi)» */
export function regionSelfLabel(regionName: string): string {
  return `${regionName} (${regionSelf(regionName).toLowerCase()})`;
}
