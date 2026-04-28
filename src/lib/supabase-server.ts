import { createServerClient as createSupabaseServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

/**
 * Creates an SSR-aware Supabase client for use in server components,
 * server actions, and route handlers. Uses @supabase/ssr with Next.js
 * App Router cookie handling.
 *
 * Always call this per-request — never cache or share across requests.
 */
export async function getServerSupabase() {
  const cookieStore = await cookies();

  return createSupabaseServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // setAll can fail in server components (read-only context).
            // This is expected — middleware handles the cookie refresh.
          }
        },
      },
    }
  );
}

/**
 * Returns the current merchant for the authenticated user, or null
 * if there is no session or no linked merchant.
 *
 * Uses getUser() (server-verified) not getSession() (unverified JWT).
 */
export async function getCurrentMerchant() {
  const supabase = await getServerSupabase();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  // Primary lookup: auth_user_id linkage
  const { data: merchant } = await supabase
    .from("merchants")
    .select("id, email, first_name, is_active")
    .eq("auth_user_id", user.id)
    .single();

  if (merchant) {
    return {
      merchantId: merchant.id as number,
      authUserId: user.id,
      merchant,
    };
  }

  // Defensive fallback: match by email for legacy data where
  // auth_user_id was never written (pre-Apr 2026 merchants).
  // Backfills auth_user_id so this path runs at most once per merchant.
  const { data: merchantByEmail } = await supabase
    .from("merchants")
    .select("id, email, first_name, is_active")
    .eq("email", user.email!)
    .single();

  if (merchantByEmail) {
    await supabase
      .from("merchants")
      .update({ auth_user_id: user.id })
      .eq("id", merchantByEmail.id);

    return {
      merchantId: merchantByEmail.id as number,
      authUserId: user.id,
      merchant: merchantByEmail,
    };
  }

  return null;
}

/**
 * Requires an authenticated merchant. Redirects to /dashboard/login
 * if no session or no linked merchant. Use in server components and
 * layouts that must be protected.
 */
export async function requireMerchant() {
  const result = await getCurrentMerchant();
  if (!result) {
    redirect("/dashboard/login");
  }
  return result;
}
