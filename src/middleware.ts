import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createServerClient as createSupabaseServerClient } from "@supabase/ssr";

function db() { return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!); }

export async function middleware(req: NextRequest) {
  const hostname = req.headers.get("host") || "";
  const path = req.nextUrl.pathname;

  let subdomain = "";

  if (hostname.includes("appi-fy.ai")) {
    subdomain = hostname.split(".appi-fy.ai")[0];
  } else if (hostname.includes("vercel.app")) {
    subdomain = "";
  } else {
    // Local dev: test with localhost:3000?store=stylevault
    subdomain = req.nextUrl.searchParams.get("store") || "";
  }

  // Root domain (no subdomain) — handle platform pages
  if (!subdomain || subdomain === "www" || subdomain === "appi-fy") {
    if (
      path.startsWith("/onboard") || path.startsWith("/admin") ||
      path.startsWith("/dashboard") || path.startsWith("/login") ||
      path.startsWith("/api") ||
      path.startsWith("/store-not-found") ||
      path === "/landing"
    ) {
      // Refresh Supabase auth cookies on every platform page request.
      // This ensures the session stays alive and tokens get rotated.
      return await refreshAuthCookies(req);
    }
    // Root homepage -> redirect to onboard (until landing page exists)
    return NextResponse.redirect(new URL("/onboard", req.url));
  }

  // Subdomain detected — look up merchant
  const { data } = await db()
    .from("merchant_settings")
    .select("merchant_id")
    .eq("store_url", subdomain)
    .single();

  if (!data) {
    return NextResponse.rewrite(new URL("/store-not-found", req.url));
  }

  const merchantId = String(data.merchant_id);
  const requestHeaders = new Headers(req.headers);
  requestHeaders.set("x-merchant-id", merchantId);
  const res = NextResponse.next({ request: { headers: requestHeaders } });
  res.cookies.set("merchant-id", merchantId, { path: "/" });
  return res;
}

/**
 * Creates a Supabase SSR client in middleware context to refresh auth
 * cookies. This is the standard @supabase/ssr pattern for Next.js —
 * it reads auth tokens from the request cookies and writes refreshed
 * tokens back to the response cookies.
 */
async function refreshAuthCookies(req: NextRequest) {
  let res = NextResponse.next({ request: req });

  const supabase = createSupabaseServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return req.cookies.getAll();
        },
        setAll(cookiesToSet) {
          // Write refreshed cookies to both the request (for downstream
          // server components) and the response (for the browser).
          cookiesToSet.forEach(({ name, value }) =>
            req.cookies.set(name, value)
          );
          res = NextResponse.next({ request: req });
          cookiesToSet.forEach(({ name, value, options }) =>
            res.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Trigger token refresh by reading the user. The SSR client will
  // call setAll if the token was refreshed.
  await supabase.auth.getUser();

  return res;
}

export const config = {
  // NOTE: API routes are excluded from middleware. Authenticated API routes
  // must call getCurrentMerchant() themselves to read the session from
  // request cookies.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api/).*)"],
};
