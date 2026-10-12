/** O‘zbekiston telefon raqamini +998XXXXXXXXX ko‘rinishiga keltiradi. Yaroqsiz bo‘lsa null. */
export function normalizePhone(input: string): string | null {
  const digits = input.replace(/\D/g, "");
  let national: string;
  if (digits.length === 9) national = digits;
  else if (digits.length === 12 && digits.startsWith("998")) national = digits.slice(3);
  else return null;
  return `+998${national}`;
}

export function formatPhone(phone: string | null | undefined): string {
  if (!phone) return "";
  const m = /^\+998(\d{2})(\d{3})(\d{2})(\d{2})$/.exec(phone);
  return m ? `+998 ${m[1]} ${m[2]} ${m[3]} ${m[4]}` : phone;
}
