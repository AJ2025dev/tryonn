import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

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
    // Allow platform pages through without merchant context
    if (
      path.startsWith("/onboard") ||
      path.startsWith("/dashboard") ||
      path.startsWith("/api") ||
      path.startsWith("/store-not-found") ||
      path === "/landing"
    ) {
      return NextResponse.next();
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
  const res = NextResponse.next();
  res.headers.set("x-merchant-id", merchantId);
  res.cookies.set("merchant-id", merchantId, { path: "/" });
  return res;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api/).*)"],
};
