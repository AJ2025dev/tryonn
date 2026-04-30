import { NextRequest, NextResponse } from "next/server";
import { verifyCustomerRequest } from "@/lib/customer-auth";
import { dbAdmin } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    console.log("[customer:address:list] start");

    const merchantIdRaw = request.nextUrl.searchParams.get("merchant_id");
    const merchantId = merchantIdRaw == null ? NaN : Number(merchantIdRaw);
    if (!Number.isInteger(merchantId) || merchantId <= 0) {
      console.log("[customer:address:list] invalid merchant_id", {
        merchantIdRaw,
      });
      return NextResponse.json(
        {
          error: "merchant_id must be a positive integer",
          code: "invalid_merchant_id",
        },
        { status: 400 }
      );
    }

    const auth = await verifyCustomerRequest(request, merchantId);
    if (!auth.ok) {
      console.log("[customer:address:list] auth failed", {
        code: auth.code,
        merchant_id: merchantId,
      });
      return NextResponse.json(
        { error: auth.error, code: auth.code },
        { status: auth.status }
      );
    }

    console.log("[customer:address:list] fetching", {
      customer_id: auth.customerId,
      merchant_id: merchantId,
    });
    // Auth has been verified via verifyCustomerRequest, which confirms this
    // customerId belongs to this merchantId. We use dbAdmin() here to bypass
    // RLS — DO NOT remove the gating helper above.
    const { data: addresses, error } = await dbAdmin()
      .from("addresses")
      .select(
        "id, address_type, house_no, address1, address2, landmark, city, state, country, zip_code, alternate_no, is_default, is_active, created_on, modified_on"
      )
      .eq("link_type", "customer")
      .eq("link_id", auth.customerId)
      .eq("is_active", true)
      .order("is_default", { ascending: false })
      .order("created_on", { ascending: false })
      .limit(50); // hard cap; real customers will never have 50 addresses

    if (error) {
      console.error("[customer:address:list] query error", error.message);
      return NextResponse.json(
        { error: "Failed to fetch addresses", code: "address_fetch_error" },
        { status: 500 }
      );
    }

    const list = addresses ?? [];
    console.log("[customer:address:list] success", {
      customer_id: auth.customerId,
      count: list.length,
    });
    return NextResponse.json({
      addresses: list,
      count: list.length,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const stack = err instanceof Error ? err.stack : undefined;
    console.error("[customer:address:list] unhandled error", msg, stack);
    return NextResponse.json(
      { error: msg || "Unknown error", code: "unhandled" },
      { status: 500 }
    );
  }
}
