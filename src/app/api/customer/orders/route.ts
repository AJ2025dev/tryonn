import { NextRequest, NextResponse } from "next/server";
import { verifyCustomerRequest } from "@/lib/customer-auth";
import { dbAdmin } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

const ORDER_SELECT = `
    id, order_no, order_date, order_placed_date, status, status_description,
    order_amount, discount_amount, tax_amount, delivery_cost, total_amount,
    payment_type, payment_status, razorpay_order_id, razorpay_payment_id,
    first_name, last_name,
    order_items (
      id, product_id, variant_id, product_description, size, quantity,
      unit_price, selling_price, image_url
    )
  `;

const ADDRESS_SELECT =
  "id, link_id, address_type, house_no, address1, address2, landmark, city, state, country, zip_code, alternate_no, is_default, is_active, created_on, modified_on";

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;

type ParsedQuery =
  | {
      ok: true;
      merchantId: number;
      limit: number;
      offset: number;
    }
  | {
      ok: false;
      status: number;
      code: string;
      error: string;
    };

function parseQuery(request: NextRequest): ParsedQuery {
  const sp = request.nextUrl.searchParams;

  const merchantIdRaw = sp.get("merchant_id");
  const merchantId = merchantIdRaw == null ? NaN : Number(merchantIdRaw);
  if (!Number.isInteger(merchantId) || merchantId <= 0) {
    return {
      ok: false,
      status: 400,
      code: "invalid_merchant_id",
      error: "merchant_id must be a positive integer",
    };
  }

  let limit = DEFAULT_LIMIT;
  const limitRaw = sp.get("limit");
  if (limitRaw != null) {
    const n = Number(limitRaw);
    if (!Number.isInteger(n) || n < 1 || n > MAX_LIMIT) {
      return {
        ok: false,
        status: 400,
        code: "invalid_limit",
        error: `limit must be an integer between 1 and ${MAX_LIMIT}`,
      };
    }
    limit = n;
  }

  let offset = 0;
  const offsetRaw = sp.get("offset");
  if (offsetRaw != null) {
    const n = Number(offsetRaw);
    if (!Number.isInteger(n) || n < 0) {
      return {
        ok: false,
        status: 400,
        code: "invalid_offset",
        error: "offset must be a non-negative integer",
      };
    }
    offset = n;
  }

  return { ok: true, merchantId, limit, offset };
}

export async function GET(request: NextRequest) {
  try {
    console.log("[customer:orders:list] start");

    const q = parseQuery(request);
    if (!q.ok) {
      console.log("[customer:orders:list] invalid query", {
        code: q.code,
      });
      return NextResponse.json(
        { error: q.error, code: q.code },
        { status: q.status }
      );
    }
    const { merchantId, limit, offset } = q;

    const auth = await verifyCustomerRequest(request, merchantId);
    if (!auth.ok) {
      console.log("[customer:orders:list] auth failed", {
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

    console.log("[customer:orders:list] fetching", {
      customer_id: auth.customerId,
      merchant_id: merchantId,
      limit,
      offset,
    });
    const {
      data: orders,
      error: ordersErr,
      count,
    } = await supa
      .from("orders")
      .select(ORDER_SELECT, { count: "exact" })
      .eq("merchant_id", merchantId)
      .eq("customer_id", auth.customerId)
      .order("order_date", { ascending: false })
      .range(offset, offset + limit - 1);

    if (ordersErr) {
      console.error("[customer:orders:list] query error", ordersErr.message);
      return NextResponse.json(
        { error: "Failed to fetch orders", code: "orders_fetch_error" },
        { status: 500 }
      );
    }

    const orderRows = (orders ?? []) as Array<
      Record<string, unknown> & { id: number }
    >;
    if (orderRows.length === 0) {
      console.log("[customer:orders:list] no orders", {
        customer_id: auth.customerId,
        count: count ?? 0,
      });
      return NextResponse.json({
        orders: [],
        count: count ?? 0,
        limit,
        offset,
      });
    }

    const orderIds = orderRows.map((o) => o.id);
    console.log("[customer:orders:list] fetching shipping addresses", {
      order_count: orderIds.length,
    });
    const { data: addresses, error: addrErr } = await supa
      .from("addresses")
      .select(ADDRESS_SELECT)
      .eq("link_type", "order")
      .in("link_id", orderIds);

    if (addrErr) {
      console.error(
        "[customer:orders:list] address fetch error",
        addrErr.message
      );
      return NextResponse.json(
        { error: "Failed to fetch addresses", code: "address_fetch_error" },
        { status: 500 }
      );
    }

    const addrByOrderId = new Map<number, Record<string, unknown>>();
    for (const a of (addresses ?? []) as Array<
      Record<string, unknown> & { link_id: number }
    >) {
      // If multiple address rows are linked to the same order, prefer the
      // most recently created one. In practice Route 1 inserts exactly one.
      const existing = addrByOrderId.get(a.link_id);
      if (!existing) {
        addrByOrderId.set(a.link_id, a);
      } else {
        const eCreated = String(existing.created_on ?? "");
        const aCreated = String(a.created_on ?? "");
        if (aCreated > eCreated) addrByOrderId.set(a.link_id, a);
      }
    }

    const result = orderRows.map((o) => {
      const addr = addrByOrderId.get(o.id);
      if (!addr) {
        console.warn("[customer:orders:list] order missing shipping address", {
          order_id: o.id,
        });
      }
      return {
        ...o,
        shipping_address: addr ?? null,
      };
    });

    console.log("[customer:orders:list] success", {
      customer_id: auth.customerId,
      page_count: result.length,
      total_count: count ?? 0,
    });
    return NextResponse.json({
      orders: result,
      count: count ?? 0,
      limit,
      offset,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const stack = err instanceof Error ? err.stack : undefined;
    console.error("[customer:orders:list] unhandled error", msg, stack);
    return NextResponse.json(
      { error: msg || "Unknown error", code: "unhandled" },
      { status: 500 }
    );
  }
}
