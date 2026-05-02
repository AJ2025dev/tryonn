import { createClient } from "@supabase/supabase-js";
import { dbAdmin } from "./supabase-admin";
import type { NextRequest } from "next/server";

export type CustomerAuthResult =
  | { ok: true; customerId: number; authUserId: string; merchantId: number }
  | { ok: false; status: number; code: string; error: string };

/**
 * Verifies the request has a valid customer bearer token AND the customer
 * has a row at the specified merchant. Returns customer_id on success.
 *
 * Usage:
 *   const auth = await verifyCustomerRequest(request, merchantId);
 *   if (!auth.ok) return NextResponse.json({error: auth.error, code: auth.code}, {status: auth.status});
 *   // use auth.customerId, auth.authUserId
 */
export async function verifyCustomerRequest(
  request: NextRequest,
  merchantId: number
): Promise<CustomerAuthResult> {
  const authHeader = request.headers.get("authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return {
      ok: false,
      status: 401,
      code: "missing_auth",
      error: "Missing Authorization: Bearer header",
    };
  }
  const token = authHeader.slice("Bearer ".length).trim();
  if (!token) {
    return {
      ok: false,
      status: 401,
      code: "missing_auth",
      error: "Empty bearer token",
    };
  }

  // Verify token by getting the user from Supabase Auth.
  // Use a fresh anon client with the token in the auth header so getUser() reads it.
  const supaUser = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: `Bearer ${token}` } },
    }
  );
  const { data: userData, error: userErr } = await supaUser.auth.getUser();
  if (userErr || !userData?.user) {
    return {
      ok: false,
      status: 401,
      code: "invalid_token",
      error: "Invalid or expired token",
    };
  }
  const user = userData.user;

  const userType = (user.user_metadata as Record<string, unknown> | null)?.[
    "user_type"
  ];
  if (userType !== "customer") {
    return {
      ok: false,
      status: 403,
      code: "wrong_account_type",
      error: "Not a customer account",
    };
  }

  const supa = dbAdmin();
  const { data: customer, error: cErr } = await supa
    .from("customers")
    .select("id, is_active")
    .eq("auth_user_id", user.id)
    .eq("merchant_id", merchantId)
    .maybeSingle();
  if (cErr) {
    return {
      ok: false,
      status: 500,
      code: "customer_lookup_error",
      error: "Customer lookup failed",
    };
  }
  if (!customer) {
    return {
      ok: false,
      status: 403,
      code: "no_customer_at_merchant",
      error: "No customer at this merchant",
    };
  }
  const cRow = customer as { id: number; is_active: boolean | null };
  if (cRow.is_active === false) {
    return {
      ok: false,
      status: 403,
      code: "customer_disabled",
      error: "Account disabled",
    };
  }

  return {
    ok: true,
    customerId: cRow.id,
    authUserId: user.id,
    merchantId,
  };
}
