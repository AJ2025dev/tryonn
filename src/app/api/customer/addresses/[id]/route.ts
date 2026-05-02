import { NextRequest, NextResponse } from "next/server";
import { verifyCustomerRequest } from "@/lib/customer-auth";
import { dbAdmin } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

const ADDRESS_SELECT =
  "id, address_type, house_no, address1, address2, landmark, city, state, country, zip_code, alternate_no, is_default, is_active, created_on, modified_on";

type UpdateAddressBody = {
  merchant_id: number;
  address_type?: number;
  house_no?: string;
  address1?: string;
  address2?: string;
  landmark?: string;
  city?: string;
  state?: string;
  country?: string;
  zip_code?: string;
  alternate_no?: string | null;
  is_default?: boolean;
};

const STRING_FIELDS = [
  "house_no",
  "address1",
  "address2",
  "landmark",
  "city",
  "state",
  "country",
  "zip_code",
] as const;

function validateUpdate(
  body: unknown
):
  | { ok: true; data: UpdateAddressBody }
  | { ok: false; status: number; code: string; errors?: Record<string, string> } {
  if (!body || typeof body !== "object") {
    return {
      ok: false,
      status: 400,
      code: "invalid_body",
      errors: { _root: "Body must be a JSON object" },
    };
  }
  const b = body as Record<string, unknown>;
  const errors: Record<string, string> = {};

  if (typeof b.merchant_id !== "number" || !(b.merchant_id > 0)) {
    errors.merchant_id = "merchant_id must be a positive number";
  }

  for (const f of STRING_FIELDS) {
    if (b[f] !== undefined && typeof b[f] !== "string") {
      errors[f] = "must be a string";
    }
  }

  if (b.alternate_no !== undefined && b.alternate_no !== null && typeof b.alternate_no !== "string") {
    errors.alternate_no = "must be a string or null";
  }

  if (b.address_type !== undefined && typeof b.address_type !== "number") {
    errors.address_type = "must be a number";
  }

  if (b.is_default !== undefined && typeof b.is_default !== "boolean") {
    errors.is_default = "must be a boolean";
  }

  if (Object.keys(errors).length > 0) {
    return { ok: false, status: 400, code: "validation_failed", errors };
  }

  // At least one updatable field must be present.
  const updatableKeys = [
    ...STRING_FIELDS,
    "address_type",
    "alternate_no",
    "is_default",
  ];
  const hasAny = updatableKeys.some((k) => b[k] !== undefined);
  if (!hasAny) {
    return {
      ok: false,
      status: 400,
      code: "no_fields_to_update",
      errors: { _root: "At least one updatable field must be provided" },
    };
  }

  return { ok: true, data: body as UpdateAddressBody };
}

function parseAddressId(idStr: string | undefined): number | null {
  if (!idStr) return null;
  const n = Number(idStr);
  if (!Number.isInteger(n) || n <= 0) return null;
  return n;
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    console.log("[customer:address:update] start");

    const { id: idStr } = await params;
    const addressId = parseAddressId(idStr);
    if (addressId == null) {
      console.log("[customer:address:update] invalid address id", { idStr });
      return NextResponse.json(
        { error: "address id must be a positive integer", code: "invalid_address_id" },
        { status: 400 }
      );
    }

    const raw = await request.json().catch(() => null);
    const v = validateUpdate(raw);
    if (!v.ok) {
      console.log("[customer:address:update] validation failed", {
        code: v.code,
        errors: v.errors,
      });
      return NextResponse.json(
        { error: "Validation failed", code: v.code, errors: v.errors },
        { status: v.status }
      );
    }
    const body = v.data;

    const auth = await verifyCustomerRequest(request, body.merchant_id);
    if (!auth.ok) {
      console.log("[customer:address:update] auth failed", {
        code: auth.code,
        merchant_id: body.merchant_id,
      });
      return NextResponse.json(
        { error: auth.error, code: auth.code },
        { status: auth.status }
      );
    }

    // Auth has been verified via verifyCustomerRequest, which confirms this
    // customerId belongs to this merchantId. We use dbAdmin() here to bypass
    // RLS — DO NOT remove the gating helper above.
    const supa = dbAdmin();

    const { data: existing, error: lookupErr } = await supa
      .from("addresses")
      .select("id, link_type, link_id, is_default, is_active")
      .eq("id", addressId)
      .maybeSingle();
    if (lookupErr) {
      console.error("[customer:address:update] lookup error", lookupErr.message);
      return NextResponse.json(
        { error: "Failed to load address", code: "address_lookup_error" },
        { status: 500 }
      );
    }
    const existingRow = existing as
      | {
          id: number;
          link_type: string | null;
          link_id: number | null;
          is_default: boolean | null;
          is_active: boolean | null;
        }
      | null;
    // Same 404 for missing AND not-owned-by-this-customer to avoid leaking
    // existence of other customers' address ids.
    if (
      !existingRow ||
      existingRow.link_type !== "customer" ||
      existingRow.link_id !== auth.customerId
    ) {
      console.log("[customer:address:update] not found or not owned", {
        address_id: addressId,
        customer_id: auth.customerId,
      });
      return NextResponse.json(
        { error: "Address not found", code: "address_not_found" },
        { status: 404 }
      );
    }
    if (existingRow.is_active === false) {
      console.log("[customer:address:update] already deleted", {
        address_id: addressId,
      });
      return NextResponse.json(
        { error: "Address has been deleted", code: "address_already_deleted" },
        { status: 410 }
      );
    }

    const promotingDefault = body.is_default === true;

    // TODO(v2): wrap the default-unset + update in a Postgres RPC for
    // atomicity. Currently a crash between the two leaves the customer with
    // zero default addresses (recoverable: edit any address to be default).
    if (promotingDefault) {
      console.log("[customer:address:update] unsetting prior defaults", {
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
          "[customer:address:update] failed to clear prior default",
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

    const updatePayload: Record<string, unknown> = {
      modified_on: new Date().toISOString(),
    };
    const b = raw as Record<string, unknown>;
    for (const f of STRING_FIELDS) {
      if (b[f] !== undefined) updatePayload[f] = b[f];
    }
    if (b.address_type !== undefined) updatePayload.address_type = b.address_type;
    if (b.alternate_no !== undefined) updatePayload.alternate_no = b.alternate_no;
    if (b.is_default !== undefined) updatePayload.is_default = b.is_default;

    console.log("[customer:address:update] updating", {
      address_id: addressId,
      customer_id: auth.customerId,
      fields: Object.keys(updatePayload),
    });
    const { data: updated, error: updErr } = await supa
      .from("addresses")
      .update(updatePayload)
      .eq("id", addressId)
      .eq("link_type", "customer")
      .eq("link_id", auth.customerId)
      .select(ADDRESS_SELECT)
      .single();
    if (updErr || !updated) {
      console.error("[customer:address:update] update error", updErr?.message);
      return NextResponse.json(
        { error: "Failed to update address", code: "address_update_error" },
        { status: 500 }
      );
    }

    console.log("[customer:address:update] success", {
      address_id: addressId,
      customer_id: auth.customerId,
    });
    return NextResponse.json({
      success: true,
      address: updated,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const stack = err instanceof Error ? err.stack : undefined;
    console.error("[customer:address:update] unhandled error", msg, stack);
    return NextResponse.json(
      { error: msg || "Unknown error", code: "unhandled" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    console.log("[customer:address:delete] start");

    const { id: idStr } = await params;
    const addressId = parseAddressId(idStr);
    if (addressId == null) {
      console.log("[customer:address:delete] invalid address id", { idStr });
      return NextResponse.json(
        { error: "address id must be a positive integer", code: "invalid_address_id" },
        { status: 400 }
      );
    }

    const merchantIdRaw = request.nextUrl.searchParams.get("merchant_id");
    const merchantId = merchantIdRaw == null ? NaN : Number(merchantIdRaw);
    if (!Number.isInteger(merchantId) || merchantId <= 0) {
      console.log("[customer:address:delete] invalid merchant_id", {
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
      console.log("[customer:address:delete] auth failed", {
        code: auth.code,
        merchant_id: merchantId,
      });
      return NextResponse.json(
        { error: auth.error, code: auth.code },
        { status: auth.status }
      );
    }

    // Auth has been verified via verifyCustomerRequest, which confirms this
    // customerId belongs to this merchantId. We use dbAdmin() here to bypass
    // RLS — DO NOT remove the gating helper above.
    const supa = dbAdmin();

    const { data: existing, error: lookupErr } = await supa
      .from("addresses")
      .select("id, link_type, link_id, is_active")
      .eq("id", addressId)
      .maybeSingle();
    if (lookupErr) {
      console.error("[customer:address:delete] lookup error", lookupErr.message);
      return NextResponse.json(
        { error: "Failed to load address", code: "address_lookup_error" },
        { status: 500 }
      );
    }
    const existingRow = existing as
      | {
          id: number;
          link_type: string | null;
          link_id: number | null;
          is_active: boolean | null;
        }
      | null;
    if (
      !existingRow ||
      existingRow.link_type !== "customer" ||
      existingRow.link_id !== auth.customerId
    ) {
      console.log("[customer:address:delete] not found or not owned", {
        address_id: addressId,
        customer_id: auth.customerId,
      });
      return NextResponse.json(
        { error: "Address not found", code: "address_not_found" },
        { status: 404 }
      );
    }
    if (existingRow.is_active === false) {
      console.log("[customer:address:delete] already deleted", {
        address_id: addressId,
      });
      return NextResponse.json(
        { error: "Address has been deleted", code: "address_already_deleted" },
        { status: 410 }
      );
    }

    console.log("[customer:address:delete] soft-deleting", {
      address_id: addressId,
      customer_id: auth.customerId,
    });
    const { data: deleted, error: delErr } = await supa
      .from("addresses")
      .update({
        is_active: false,
        modified_on: new Date().toISOString(),
      })
      .eq("id", addressId)
      .eq("link_type", "customer")
      .eq("link_id", auth.customerId)
      .select("id")
      .single();
    if (delErr || !deleted) {
      console.error("[customer:address:delete] delete error", delErr?.message);
      return NextResponse.json(
        { error: "Failed to delete address", code: "delete_error" },
        { status: 500 }
      );
    }

    console.log("[customer:address:delete] success", {
      address_id: addressId,
      customer_id: auth.customerId,
    });
    return NextResponse.json({
      success: true,
      address_id: (deleted as { id: number }).id,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const stack = err instanceof Error ? err.stack : undefined;
    console.error("[customer:address:delete] unhandled error", msg, stack);
    return NextResponse.json(
      { error: msg || "Unknown error", code: "unhandled" },
      { status: 500 }
    );
  }
}
