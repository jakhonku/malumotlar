/** JWT (access token) ichidagi sessiya identifikatori. */
export function sessionIdOf(accessToken: string | undefined | null): string | null {
  try {
    const payload = JSON.parse(Buffer.from((accessToken ?? "").split(".")[1] ?? "", "base64url").toString("utf8")) as { session_id?: string };
    return payload.session_id ?? null;
  } catch {
    return null;
  }
}

/** Joriy sessiya boshqasi bilan almashtirilganmi (shu profilga keyinroq boshqa joydan kirilgan)? */
export const isKicked = (currentSessionId: string | null | undefined, activeSessionId: string | null | undefined) =>
  !!activeSessionId && !!currentSessionId && currentSessionId !== activeSessionId;

