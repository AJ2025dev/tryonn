import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { dbAdmin } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

type VerifyBody = {
  order_id: number;
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
};

function validate(
  body: unknown
):
  | { ok: true; data: VerifyBody }
  | { ok: false; errors: Record<string, string> } {
  const errors: Record<string, string> = {};
  if (!body || typeof body !== "object") {
    return { ok: false, errors: { _root: "Body must be a JSON object" } };
  }
  const b = body as Record<string, unknown>;

  if (typeof b.order_id !== "number" || !(b.order_id > 0)) {
    errors.order_id = "order_id must be a positive number";
  }
  for (const f of [
    "razorpay_order_id",
    "razorpay_payment_id",
    "razorpay_signature",
  ] as const) {
    if (typeof b[f] !== "string" || !(b[f] as string).trim()) {
      errors[f] = "required string";
    }
  }
  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return { ok: true, data: body as VerifyBody };
}

function verifySignature(
  rOrderId: string,
  rPaymentId: string,
  signatureHex: string,
  secret: string
): boolean {
  try {
    const expectedHex = crypto
      .createHmac("sha256", secret)
      .update(`${rOrderId}|${rPaymentId}`)
      .digest("hex");
    const expectedBuf = Buffer.from(expectedHex, "hex");
    const providedBuf = Buffer.from(signatureHex, "hex");
    if (expectedBuf.length !== providedBuf.length) return false;
    return crypto.timingSafeEqual(expectedBuf, providedBuf);
  } catch {
    return false;
  }
}

export async function POST(request: NextRequest) {
  try {
    console.log("[checkout:verify] start");
    const raw = await request.json().catch(() => null);
    const v = validate(raw);
    if (!v.ok) {
      console.log("[checkout:verify] validation failed", v.errors);
      return NextResponse.json(
        { error: "Validation failed", errors: v.errors },
        { status: 400 }
      );
    }
    const body = v.data;
    const supa = dbAdmin();

    const secret = process.env.RAZORPAY_KEY_SECRET;
    if (!secret) {
      console.error("[checkout:verify] missing RAZORPAY_KEY_SECRET");
      return NextResponse.json(
        { error: "Server misconfigured", code: "missing_secret" },
        { status: 500 }
      );
    }

    console.log("[checkout:verify] checking signature", {
      order_id: body.order_id,
      razorpay_order_id: body.razorpay_order_id,
    });
    // TODO(v2): defense-in-depth — fetch payment from Razorpay and verify
    // captured amount matches orders.total_amount. Currently we trust
    // the amount was locked when we created the Razorpay order server-side.
    const sigValid = verifySignature(
      body.razorpay_order_id,
      body.razorpay_payment_id,
      body.razorpay_signature,
      secret
    );
    if (!sigValid) {
      console.warn(`[checkout:verify] signature mismatch for order_id=${body.order_id}, razorpay_order_id=${body.razorpay_order_id}`);
      // Mark this order as payment_failed (only if still pending — defensive).
      const { error: failErr } = await supa
        .from("orders")
        .update({
          payment_status: "failed",
          modified_on: new Date().toISOString(),
        })
        .eq("id", body.order_id)
        .eq("razorpay_order_id", body.razorpay_order_id)
        .eq("payment_status", "pending");
      if (failErr) {
        console.error(
          "[checkout:verify] failed to mark order as failed",
          failErr.message
        );
      }
      return NextResponse.json(
        { error: "Invalid payment signature", code: "invalid_signature" },
        { status: 400 }
      );
    }

    console.log("[checkout:verify] signature valid, fetching order", {
      order_id: body.order_id,
    });
    const { data: order, error: fetchErr } = await supa
      .from("orders")
      .select("id, order_no, payment_status, razorpay_order_id")
      .eq("id", body.order_id)
      .eq("razorpay_order_id", body.razorpay_order_id)
      .maybeSingle();

    if (fetchErr) {
      console.error("[checkout:verify] order fetch error", fetchErr.message);
      return NextResponse.json(
        { error: "Order lookup failed", code: "order_fetch_error" },
        { status: 500 }
      );
    }
    if (!order) {
      console.log("[checkout:verify] order not found or mismatch", {
        order_id: body.order_id,
        razorpay_order_id: body.razorpay_order_id,
      });
      return NextResponse.json(
        {
          error: "Order not found or razorpay_order_id mismatch",
          code: "order_not_found_or_mismatch",
        },
        { status: 404 }
      );
    }

    const orderRow = order as {
      id: number;
      order_no: string;
      payment_status: string | null;
      razorpay_order_id: string | null;
    };

    if (orderRow.payment_status === "paid") {
      console.log("[checkout:verify] already paid (idempotent)", {
        order_id: orderRow.id,
      });
      return NextResponse.json({
        success: true,
        already_paid: true,
        order_id: orderRow.id,
        order_no: orderRow.order_no,
        payment_status: "paid",
      });
    }

    if (orderRow.payment_status === "failed") {
      console.log("[checkout:verify] order already marked failed", {
        order_id: orderRow.id,
      });
      return NextResponse.json(
        {
          error: "Order already marked as failed",
          code: "order_already_failed",
        },
        { status: 400 }
      );
    }

    console.log("[checkout:verify] updating order to paid", {
      order_id: orderRow.id,
    });
    const { data: updated, error: updErr } = await supa
      .from("orders")
      .update({
        payment_status: "paid",
        razorpay_payment_id: body.razorpay_payment_id,
        razorpay_signature: body.razorpay_signature,
        modified_on: new Date().toISOString(),
      })
      .eq("id", orderRow.id)
      .eq("payment_status", "pending")
      .select("id, order_no, payment_status")
      .maybeSingle();

    if (updErr) {
      console.error("[checkout:verify] order update error", updErr.message);
      return NextResponse.json(
        { error: "Failed to update order", code: "order_update_error" },
        { status: 500 }
      );
    }
    if (!updated) {
      // Race: webhook (or another verify call) flipped the row between
      // our SELECT and UPDATE. Re-read to return the now-current state.
      console.log("[checkout:verify] update affected 0 rows, re-reading", {
        order_id: orderRow.id,
      });
      const { data: fresh } = await supa
        .from("orders")
        .select("id, order_no, payment_status")
        .eq("id", orderRow.id)
        .maybeSingle();
      const freshRow = fresh as
        | { id: number; order_no: string; payment_status: string | null }
        | null;
      if (freshRow?.payment_status === "paid") {
        return NextResponse.json({
          success: true,
          already_paid: true,
          order_id: freshRow.id,
          order_no: freshRow.order_no,
          payment_status: "paid",
        });
      }
      return NextResponse.json(
        {
          error: "Order state changed during verification",
          code: "order_state_changed",
        },
        { status: 409 }
      );
    }

    const updatedRow = updated as {
      id: number;
      order_no: string;
      payment_status: string;
    };
    console.log("[checkout:verify] success", { order_id: updatedRow.id });
    return NextResponse.json({
      success: true,
      order_id: updatedRow.id,
      order_no: updatedRow.order_no,
      payment_status: updatedRow.payment_status,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const stack = err instanceof Error ? err.stack : undefined;
    console.error("[checkout:verify] unhandled error", msg, stack);
    return NextResponse.json(
      { error: msg || "Unknown error", code: "unhandled" },
      { status: 500 }
    );
  }
}
