import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveLoginLink } from "@/lib/login-links";
import { takeOverSession } from "@/lib/single-session";

export const dynamic = "force-dynamic";

/** Tezkor kirish: yaroqli havola → login-parolsiz sessiya ochiladi va boshqarma paneliga yo‘naltiriladi. */
export async function GET(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const fail = () => {
    const r = NextResponse.redirect(new URL("/login?havola=yaroqsiz", req.url), 303);
    r.headers.set("Cache-Control", "no-store");
    return r;
  };
  const who = await resolveLoginLink(token);
  if (!who) return fail();

  const { data, error } = await createAdminClient().auth.admin.generateLink({ type: "magiclink", email: who.email });
  const hashed = data?.properties?.hashed_token;
  if (error || !hashed) return fail();

  const supabase = await createClient();
  const { data: ver, error: vErr } = await supabase.auth.verifyOtp({ type: "magiclink", token_hash: hashed });
  if (vErr || !ver.session) return fail();
  await takeOverSession(who.userId, ver.session.access_token);

  const r = NextResponse.redirect(new URL("/boshqarma", req.url), 303);
  r.headers.set("Cache-Control", "no-store");
  r.headers.set("Referrer-Policy", "no-referrer");
  return r;
}
