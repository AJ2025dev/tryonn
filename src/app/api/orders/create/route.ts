import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import Razorpay from "razorpay";
import { dbAdmin } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

function rzp() {
  return new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID!,
    key_secret: process.env.RAZORPAY_KEY_SECRET!,
  });
}

type ItemInput = { product_id: number; variant_id: number; quantity: number };
type CustomerInput = {
  first_name: string;
  last_name?: string | null;
  email?: string | null;
  mobile_no: string;
};
type AddressInput = {
  house_no?: string;
  address1: string;
  address2?: string;
  landmark?: string;
  city: string;
  state: string;
  country?: string;
  zip_code: string;
};
type CreateOrderBody = {
  merchant_id: number;
  items: ItemInput[];
  customer: CustomerInput;
  shipping_address: AddressInput;
  customer_id?: number | null;
};

function generateOrderNo() {
  // Format: ORD-{6 alphanumeric chars from random bytes}-{6 chars from timestamp base36}
  // Example: ORD-A3F7K9-MQ8RTL
  // ~32 bits of randomness — collision-safe at high write rates.
  // orders.order_no has a UNIQUE constraint (orders_order_no_key).
  const rand = randomBytes(4)
    .toString("base64url")
    .slice(0, 6)
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "0");
  const ts = Date.now().toString(36).slice(-6).toUpperCase();
  return `ORD-${rand}-${ts}`;
}

function validate(
  body: unknown
):
  | { ok: true; data: CreateOrderBody }
  | { ok: false; errors: Record<string, string> } {
  const errors: Record<string, string> = {};
  if (!body || typeof body !== "object") {
    return { ok: false, errors: { _root: "Body must be a JSON object" } };
  }
  const b = body as Record<string, unknown>;

  if (typeof b.merchant_id !== "number" || !(b.merchant_id > 0)) {
    errors.merchant_id = "merchant_id must be a positive number";
  }

  if (!Array.isArray(b.items) || b.items.length === 0) {
    errors.items = "items must be a non-empty array";
  } else {
    b.items.forEach((it: unknown, i: number) => {
      const item = it as Record<string, unknown> | null;
      if (
        !item ||
        typeof item.product_id !== "number" ||
        typeof item.variant_id !== "number" ||
        typeof item.quantity !== "number" ||
        !(item.quantity > 0)
      ) {
        errors[`items[${i}]`] =
          "each item needs numeric product_id, variant_id, quantity (>0)";
      }
    });
  }

  const cust = b.customer as Record<string, unknown> | undefined;
  if (!cust || typeof cust !== "object") {
    errors.customer = "customer object required";
  } else {
    if (typeof cust.first_name !== "string" || !cust.first_name.trim()) {
      errors["customer.first_name"] = "required";
    }
    if (typeof cust.mobile_no !== "string" || !cust.mobile_no.trim()) {
      errors["customer.mobile_no"] = "required";
    }
  }

  const addr = b.shipping_address as Record<string, unknown> | undefined;
  if (!addr || typeof addr !== "object") {
    errors.shipping_address = "shipping_address object required";
  } else {
    for (const f of ["address1", "city", "state", "zip_code"] as const) {
      if (typeof addr[f] !== "string" || !(addr[f] as string).trim()) {
        errors[`shipping_address.${f}`] = "required";
      }
    }
  }

  if (
    b.customer_id != null &&
    (typeof b.customer_id !== "number" || !(b.customer_id > 0))
  ) {
    errors.customer_id = "must be a positive number or null";
  }

  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return { ok: true, data: body as CreateOrderBody };
}

export async function POST(request: NextRequest) {
  try {
    console.log("[checkout:create] start");
    const raw = await request.json().catch(() => null);
    const v = validate(raw);
    if (!v.ok) {
      console.log("[checkout:create] validation failed", v.errors);
      return NextResponse.json(
        { error: "Validation failed", errors: v.errors },
        { status: 400 }
      );
    }
    const body = v.data;
    const supa = dbAdmin();

    console.log("[checkout:create] revalidating items", {
      count: body.items.length,
      merchant_id: body.merchant_id,
    });

    let totalRupees = 0;
    const enriched: Array<{
      product_id: number;
      variant_id: number;
      quantity: number;
      price: number;
      product_description: string | null;
      size: string | null;
      image_url: string | null;
    }> = [];

    for (let i = 0; i < body.items.length; i++) {
      const it = body.items[i];
      const { data: variant, error: varErr } = await supa
        .from("product_variants")
        .select(
          "id, product_id, size, price, is_active, products!inner(id, merchant_id, name, description, is_active)"
        )
        .eq("id", it.variant_id)
        .eq("product_id", it.product_id)
        .eq("is_active", true)
        .eq("products.merchant_id", body.merchant_id)
        .eq("products.is_active", true)
        .maybeSingle();

      if (varErr) {
        console.error("[checkout:create] variant fetch error", {
          item_index: i,
          error: varErr.message,
        });
        return NextResponse.json(
          { error: "Failed to validate items", code: "variant_fetch_error" },
          { status: 500 }
        );
      }
      if (!variant) {
        console.log("[checkout:create] item invalid", { item_index: i, item: it });
        return NextResponse.json(
          {
            error: `Item at index ${i} is not available for this merchant`,
            code: "invalid_item",
            item_index: i,
          },
          { status: 400 }
        );
      }

      const v2 = variant as unknown as {
        size: string | null;
        price: number;
        products:
          | { name: string | null; description: string | null }
          | { name: string | null; description: string | null }[];
      };
      const product = Array.isArray(v2.products) ? v2.products[0] : v2.products;
      const price = Number(v2.price);
      if (!Number.isFinite(price) || price < 0) {
        console.error("[checkout:create] invalid variant price", {
          item_index: i,
          price: v2.price,
        });
        return NextResponse.json(
          { error: "Invalid variant price", code: "invalid_price", item_index: i },
          { status: 500 }
        );
      }

      const { data: images } = await supa
        .from("product_images")
        .select("image_url")
        .eq("product_id", it.product_id)
        .order("id", { ascending: true })
        .limit(1);
      const imageUrl =
        (images && images.length > 0
          ? (images[0] as { image_url: string | null }).image_url
          : null) ?? null;

      enriched.push({
        product_id: it.product_id,
        variant_id: it.variant_id,
        quantity: it.quantity,
        price,
        product_description: product?.description ?? product?.name ?? null,
        size: v2.size,
        image_url: imageUrl,
      });
      totalRupees += price * it.quantity;
    }

    console.log("[checkout:create] cart validated", { totalRupees });

    let customerId: number;
    if (body.customer_id != null) {
      console.log("[checkout:create] verifying provided customer_id", {
        customer_id: body.customer_id,
      });
      const { data: existing, error: cErr } = await supa
        .from("customers")
        .select("id, merchant_id")
        .eq("id", body.customer_id)
        .eq("merchant_id", body.merchant_id)
        .maybeSingle();
      if (cErr) {
        console.error("[checkout:create] customer lookup error", cErr.message);
        return NextResponse.json(
          { error: "Customer lookup failed", code: "customer_lookup_error" },
          { status: 500 }
        );
      }
      if (!existing) {
        console.log("[checkout:create] customer mismatch", {
          customer_id: body.customer_id,
          merchant_id: body.merchant_id,
        });
        return NextResponse.json(
          {
            error: "Customer not found for this merchant",
            code: "customer_mismatch",
          },
          { status: 403 }
        );
      }
      customerId = (existing as { id: number }).id;
    } else {
      console.log("[checkout:create] inserting guest customer");
      const { data: inserted, error: insErr } = await supa
        .from("customers")
        .insert({
          merchant_id: body.merchant_id,
          first_name: body.customer.first_name,
          last_name: body.customer.last_name ?? null,
          email: body.customer.email ?? null,
          mobile_no: body.customer.mobile_no,
          auth_user_id: null,
          is_active: true,
        })
        .select("id")
        .single();
      if (insErr || !inserted) {
        console.error(
          "[checkout:create] customer insert error",
          insErr?.message
        );
        return NextResponse.json(
          { error: "Failed to create customer", code: "customer_insert_error" },
          { status: 500 }
        );
      }
      customerId = (inserted as { id: number }).id;
    }

    const amountPaise = Math.round(totalRupees * 100);
    if (amountPaise <= 0) {
      console.log("[checkout:create] zero/negative total", { totalRupees });
      return NextResponse.json(
        { error: "Order total must be greater than zero", code: "invalid_total" },
        { status: 400 }
      );
    }

    console.log("[checkout:create] creating Razorpay order", {
      amountPaise,
      customer_id: customerId,
    });
    let rzpOrder: { id: string };
    try {
      const rzpParams = {
        amount: amountPaise,
        currency: "INR",
        notes: {
          merchant_id: String(body.merchant_id),
          customer_id: String(customerId),
        },
      };
      rzpOrder = (await rzp().orders.create(
        rzpParams as Parameters<ReturnType<typeof rzp>["orders"]["create"]>[0]
      )) as { id: string };
    } catch (rzpErr) {
      const msg = rzpErr instanceof Error ? rzpErr.message : String(rzpErr);
      console.error("[checkout:create] razorpay error", msg);
      return NextResponse.json(
        { error: "Failed to create payment order", code: "razorpay_error" },
        { status: 502 }
      );
    }

    // TODO(v2): if any of the inserts below fail after Razorpay succeeds,
    // we leave an orphaned Razorpay order. v1 accepts this — Razorpay
    // orders auto-expire if never paid. For atomicity, wrap the order +
    // order_items + addresses inserts in a single Postgres RPC.
    const orderNo = generateOrderNo();
    const nowIso = new Date().toISOString();
    console.log("[checkout:create] inserting order", {
      order_no: orderNo,
      razorpay_order_id: rzpOrder.id,
    });

    const { data: order, error: orderErr } = await supa
      .from("orders")
      .insert({
        merchant_id: body.merchant_id,
        customer_id: customerId,
        order_no: orderNo,
        order_date: nowIso,
        order_placed_date: nowIso,
        status: 1,
        status_description: "Placed",
        order_amount: totalRupees,
        discount_amount: 0,
        tax_amount: 0,
        delivery_cost: 0,
        total_amount: totalRupees,
        payment_type: 2,
        razorpay_order_id: rzpOrder.id,
        payment_status: "pending",
        first_name: body.customer.first_name,
        last_name: body.customer.last_name ?? null,
      })
      .select("id, order_no")
      .single();
    if (orderErr || !order) {
      console.error("[checkout:create] order insert error", orderErr?.message);
      return NextResponse.json(
        { error: "Failed to create order", code: "order_insert_error" },
        { status: 500 }
      );
    }
    const orderRow = order as { id: number; order_no: string };

    console.log("[checkout:create] inserting order_items", {
      order_id: orderRow.id,
      count: enriched.length,
    });
    const itemsRows = enriched.map((e) => ({
      order_id: orderRow.id,
      product_id: e.product_id,
      variant_id: e.variant_id,
      quantity: e.quantity,
      unit_price: e.price,
      selling_price: e.price,
      product_description: e.product_description,
      size: e.size,
      image_url: e.image_url,
    }));
    const { error: itemsErr } = await supa.from("order_items").insert(itemsRows);
    if (itemsErr) {
      console.error("[checkout:create] order_items insert error", itemsErr.message);
      return NextResponse.json(
        {
          error: "Failed to save order items",
          code: "order_items_insert_error",
          order_id: orderRow.id,
        },
        { status: 500 }
      );
    }

    console.log("[checkout:create] inserting shipping address", {
      order_id: orderRow.id,
    });
    const a = body.shipping_address;
    const { error: addrErr } = await supa.from("addresses").insert({
      link_type: "order",
      link_id: orderRow.id,
      house_no: a.house_no ?? "",
      address1: a.address1,
      address2: a.address2 ?? "",
      landmark: a.landmark ?? "",
      city: a.city,
      state: a.state,
      country: a.country ?? "India",
      zip_code: a.zip_code,
      is_default: false,
      is_active: true,
    });
    if (addrErr) {
      console.error("[checkout:create] address insert error", addrErr.message);
      return NextResponse.json(
        {
          error: "Failed to save shipping address",
          code: "address_insert_error",
          order_id: orderRow.id,
        },
        { status: 500 }
      );
    }

    console.log("[checkout:create] success", {
      order_id: orderRow.id,
      razorpay_order_id: rzpOrder.id,
    });
    return NextResponse.json({
      order_id: orderRow.id,
      order_no: orderRow.order_no,
      razorpay_order_id: rzpOrder.id,
      amount_paise: amountPaise,
      key_id: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
      customer_id: customerId,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const stack = err instanceof Error ? err.stack : undefined;
    console.error("[checkout:create] unhandled error", msg, stack);
    return NextResponse.json(
      { error: msg || "Unknown error", code: "unhandled" },
      { status: 500 }
    );
  }
}
