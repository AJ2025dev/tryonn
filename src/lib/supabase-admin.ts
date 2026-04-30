import { createClient } from "@supabase/supabase-js";

/**
 * Service-role Supabase client — bypasses RLS. Server-side only.
 * Lazy: do not instantiate at module load. Call dbAdmin() per request.
 *
 * NEVER expose SUPABASE_SERVICE_ROLE_KEY to the browser.
 */
export function dbAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
}
