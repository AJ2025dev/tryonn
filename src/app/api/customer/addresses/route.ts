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

type CreateAddressBody = {
  merchant_id: number;
  address_type?: number;
  house_no?: string;
  address1: string;
  address2?: string;
  landmark?: string;
  city: string;
  state: string;
  country?: string;
  zip_code: string;
  alternate_no?: string | null;
  is_default?: boolean;
};

function validateCreate(
  body: unknown
):
  | { ok: true; data: CreateAddressBody }
  | { ok: false; errors: Record<string, string> } {
  const errors: Record<string, string> = {};
  if (!body || typeof body !== "object") {
    return { ok: false, errors: { _root: "Body must be a JSON object" } };
  }
  const b = body as Record<string, unknown>;

  if (typeof b.merchant_id !== "number" || !(b.merchant_id > 0)) {
    errors.merchant_id = "merchant_id must be a positive number";
  }

  for (const f of ["address1", "city", "state", "zip_code"] as const) {
    if (typeof b[f] !== "string" || !(b[f] as string).trim()) {
      errors[f] = "required";
    }
  }

  for (const f of [
    "house_no",
    "address2",
    "landmark",
    "country",
  ] as const) {
    if (b[f] != null && typeof b[f] !== "string") {
      errors[f] = "must be a string";
    }
  }

  if (b.alternate_no != null && typeof b.alternate_no !== "string") {
    errors.alternate_no = "must be a string or null";
  }

  if (b.address_type != null && typeof b.address_type !== "number") {
    errors.address_type = "must be a number";
  }

  if (b.is_default != null && typeof b.is_default !== "boolean") {
    errors.is_default = "must be a boolean";
  }

  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return { ok: true, data: body as CreateAddressBody };
}

export async function POST(request: NextRequest) {
  try {
    console.log("[customer:address:create] start");
    const raw = await request.json().catch(() => null);
    const v = validateCreate(raw);
    if (!v.ok) {
      console.log("[customer:address:create] validation failed", v.errors);
      return NextResponse.json(
        { error: "Validation failed", errors: v.errors },
        { status: 400 }
      );
    }
    const body = v.data;

    const auth = await verifyCustomerRequest(request, body.merchant_id);
    if (!auth.ok) {
      console.log("[customer:address:create] auth failed", {
        code: auth.code,
        merchant_id: body.merchant_id,
      });
      return NextResponse.json(
        { error: auth.error, code: auth.code },
        { status: auth.status }
      );
    }

    const supa = dbAdmin();

    // Defensive cap on stored addresses per customer.
    const { count, error: countErr } = await supa
      .from("addresses")
      .select("id", { count: "exact", head: true })
      .eq("link_type", "customer")
      .eq("link_id", auth.customerId)
      .eq("is_active", true);
    if (countErr) {
      console.error("[customer:address:create] count error", countErr.message);
      return NextResponse.json(
        { error: "Failed to verify address limit", code: "count_error" },
        { status: 500 }
      );
    }
    if ((count ?? 0) >= 20) {
      console.log("[customer:address:create] max addresses reached", {
        customer_id: auth.customerId,
        count,
      });
      return NextResponse.json(
        {
          error: "Maximum 20 addresses allowed. Delete one first.",
          code: "max_addresses_reached",
        },
        { status: 400 }
      );
    }

    const makeDefault = body.is_default === true;

    // Auth has been verified via verifyCustomerRequest, which confirms this
    // customerId belongs to this merchantId. We use dbAdmin() here to bypass
    // RLS — DO NOT remove the gating helper above.
    // TODO(v2): wrap the default-unset + new-address-insert in a Postgres RPC
    // for atomicity. Currently a crash between the two leaves the customer
    // with zero default addresses (recoverable: edit any address to be default).
    if (makeDefault) {
      console.log("[customer:address:create] unsetting prior defaults", {
        customer_id: auth.customerId,
      });
      const { error: clearErr } = await supa
        .from("addresses")
        .update({
          is_default: false,
          modified_on: new Date().toISOString(),
        })
        .eq("link_type", "customer")
        .eq("link_id", auth.customerId)
        .eq("is_default", true);
      if (clearErr) {
        console.error(
          "[customer:address:create] failed to clear prior default",
          clearErr.message
        );
        return NextResponse.json(
          {
            error: "Failed to update default address",
            code: "default_clear_error",
          },
          { status: 500 }
        );
      }
    }

    console.log("[customer:address:create] inserting", {
      customer_id: auth.customerId,
      is_default: makeDefault,
    });
    const { data: inserted, error: insErr } = await supa
      .from("addresses")
      .insert({
        link_type: "customer",
        link_id: auth.customerId,
        address_type: body.address_type ?? 0,
        house_no: body.house_no ?? "",
        address1: body.address1,
        address2: body.address2 ?? "",
        landmark: body.landmark ?? "",
        city: body.city,
        state: body.state,
        country: body.country ?? "India",
        zip_code: body.zip_code,
        alternate_no: body.alternate_no ?? null,
        is_default: makeDefault,
        is_active: true,
      })
      .select(
        "id, address_type, house_no, address1, address2, landmark, city, state, country, zip_code, alternate_no, is_default, is_active, created_on, modified_on"
      )
      .single();

    if (insErr || !inserted) {
      console.error(
        "[customer:address:create] insert error",
        insErr?.message
      );
      return NextResponse.json(
        { error: "Failed to create address", code: "address_insert_error" },
        { status: 500 }
      );
    }

    console.log("[customer:address:create] success", {
      customer_id: auth.customerId,
      address_id: (inserted as { id: number }).id,
    });
    return NextResponse.json({
      success: true,
      address: inserted,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const stack = err instanceof Error ? err.stack : undefined;
    console.error("[customer:address:create] unhandled error", msg, stack);
    return NextResponse.json(
      { error: msg || "Unknown error", code: "unhandled" },
      { status: 500 }
    );
  }
}
