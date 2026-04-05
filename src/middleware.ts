import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function db() { return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!); }

export async function middleware(req: NextRequest) {
  const hostname = req.headers.get("host") || "";

  let subdomain = "";

  if (hostname.includes("appi-fy.ai")) {
    subdomain = hostname.split(".appi-fy.ai")[0];
  } else if (hostname.includes("vercel.app")) {
    subdomain = "";
  } else {
    // Local dev: test with localhost:3000?store=stylevault
    subdomain = req.nextUrl.searchParams.get("store") || "";
  }

  let merchantId = process.env.NEXT_PUBLIC_DEFAULT_MERCHANT_ID || "1";

  if (subdomain && subdomain !== "www" && subdomain !== "appi-fy") {
    const { data } = await db()
      .from("merchant_settings")
      .select("merchant_id")
      .eq("store_url", subdomain)
      .single();

    if (!data) {
      return NextResponse.rewrite(new URL("/store-not-found", req.url));
    }
    merchantId = String(data.merchant_id);
  }

  const res = NextResponse.next();
  res.headers.set("x-merchant-id", merchantId);
  res.cookies.set("merchant-id", merchantId, { path: "/" });
  return res;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api/).*)"],
};
