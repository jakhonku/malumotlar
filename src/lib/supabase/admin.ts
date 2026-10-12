import "server-only";
import { createClient } from "@supabase/supabase-js";

/** Service role klienti. FAQAT serverda va faqat super_admin tekshiruvidan keyin ishlating. */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY sozlanmagan (.env.local).");
  }
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}
