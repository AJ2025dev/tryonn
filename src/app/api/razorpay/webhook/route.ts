import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { dbAdmin } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

function verifyWebhookSignature(
  rawBody: string,
  signatureHex: string,
  secret: string
): boolean {
  try {
    const expectedHex = crypto
      .createHmac("sha256", secret)
      .update(rawBody)
      .digest("hex");
    const expectedBuf = Buffer.from(expectedHex, "hex");
    const providedBuf = Buffer.from(signatureHex, "hex");
    if (expectedBuf.length !== providedBuf.length) return false;
    return crypto.timingSafeEqual(expectedBuf, providedBuf);
  } catch {
    return false;
  }
}

type RazorpayPaymentEntity = {
  id?: string;
  order_id?: string;
};
type RazorpayOrderEntity = {
  id?: string;
};
type RazorpayEvent = {
  event?: string;
  payload?: {
    payment?: { entity?: RazorpayPaymentEntity };
    order?: { entity?: RazorpayOrderEntity };
  };
};

function extractIds(event: RazorpayEvent): {
  razorpayOrderId: string | null;
  razorpayPaymentId: string | null;
} {
  const payment = event.payload?.payment?.entity;
  const order = event.payload?.order?.entity;
  return {
    razorpayOrderId: payment?.order_id ?? order?.id ?? null,
    razorpayPaymentId: payment?.id ?? null,
  };
}

export async function POST(request: NextRequest) {
  try {
    console.log("[webhook] received");

    // CRITICAL: read raw body before any JSON parsing — signature is
    // computed over the exact byte sequence Razorpay sent.
    const rawBody = await request.text();

    const signature = request.headers.get("x-razorpay-signature");
    if (!signature) {
      console.warn("[webhook] missing x-razorpay-signature header");
      return NextResponse.json(
        { error: "Missing signature header", code: "missing_signature" },
        { status: 400 }
      );
    }

    const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
    if (!secret) {
      console.error("[webhook] missing RAZORPAY_WEBHOOK_SECRET env");
      return NextResponse.json(
        { error: "Server misconfigured", code: "missing_secret" },
        { status: 500 }
      );
    }

    const sigValid = verifyWebhookSignature(rawBody, signature, secret);
    if (!sigValid) {
      console.warn("[webhook] signature mismatch");
      return NextResponse.json(
        { error: "Invalid signature", code: "invalid_signature" },
        { status: 400 }
      );
    }

    let event: RazorpayEvent;
    try {
      event = JSON.parse(rawBody) as RazorpayEvent;
    } catch (parseErr) {
      const msg =
        parseErr instanceof Error ? parseErr.message : String(parseErr);
      console.warn("[webhook] body is not valid JSON", msg);
      // Return 200 — body was authentic (signature checked), just unparseable.
      // We don't want Razorpay to retry on a malformed event we can't fix.
      return NextResponse.json({ received: true, processed: false });
    }

    const eventType = event.event ?? "unknown";
    console.log(`[webhook] received event=${eventType}`);

    const { razorpayOrderId, razorpayPaymentId } = extractIds(event);

    // Events we handle. Anything else: log and 200.
    const isPaid = eventType === "payment.captured" || eventType === "order.paid";
    const isFailed = eventType === "payment.failed";

    if (!isPaid && !isFailed) {
      console.log(`[webhook] unknown event type=${eventType} (skipping)`);
      return NextResponse.json({ received: true, processed: false });
    }

    if (!razorpayOrderId) {
      console.warn(`[webhook] event=${eventType} missing razorpay order_id in payload`);
      return NextResponse.json({ received: true, processed: false });
    }

    const supa = dbAdmin();
    const nowIso = new Date().toISOString();

    if (isPaid) {
      const updatePayload: Record<string, string> = {
        payment_status: "paid",
        modified_on: nowIso,
      };
      if (razorpayPaymentId) {
        updatePayload.razorpay_payment_id = razorpayPaymentId;
      }
      const { data: updated, error: updErr } = await supa
        .from("orders")
        .update(updatePayload)
        .eq("razorpay_order_id", razorpayOrderId)
        .eq("payment_status", "pending")
        .select("id");
      if (updErr) {
        console.error(`[webhook] update-to-paid error razorpay_order_id=${razorpayOrderId}`, updErr.message);
        // Still 200 — Razorpay retry would just re-hit the same DB error.
        return NextResponse.json({ received: true, processed: false });
      }
      const rows = (updated as Array<{ id: number }> | null) ?? [];
      if (rows.length === 0) {
        // Either order doesn't exist in our DB, or it's already past pending.
        // Disambiguate with a follow-up read for clearer logging.
        const { data: existing } = await supa
          .from("orders")
          .select("id, payment_status")
          .eq("razorpay_order_id", razorpayOrderId)
          .maybeSingle();
        const existingRow = existing as
          | { id: number; payment_status: string | null }
          | null;
        if (!existingRow) {
          console.warn(`[webhook] order not found razorpay_order_id=${razorpayOrderId}`);
        } else {
          console.log(`[webhook] order already in terminal state order_id=${existingRow.id} payment_status=${existingRow.payment_status} (idempotent skip)`);
        }
      } else {
        console.log(`[webhook] order updated to paid order_id=${rows[0].id} razorpay_order_id=${razorpayOrderId}`);
      }
      return NextResponse.json({ received: true, processed: true });
    }

    // isFailed
    {
      const { data: updated, error: updErr } = await supa
        .from("orders")
        .update({
          payment_status: "failed",
          modified_on: nowIso,
        })
        .eq("razorpay_order_id", razorpayOrderId)
        .eq("payment_status", "pending")
        .select("id");
      if (updErr) {
        console.error(`[webhook] update-to-failed error razorpay_order_id=${razorpayOrderId}`, updErr.message);
        return NextResponse.json({ received: true, processed: false });
      }
      const rows = (updated as Array<{ id: number }> | null) ?? [];
      if (rows.length === 0) {
        const { data: existing } = await supa
          .from("orders")
          .select("id, payment_status")
          .eq("razorpay_order_id", razorpayOrderId)
          .maybeSingle();
        const existingRow = existing as
          | { id: number; payment_status: string | null }
          | null;
        if (!existingRow) {
          console.warn(`[webhook] order not found razorpay_order_id=${razorpayOrderId}`);
        } else {
          console.log(`[webhook] order already in terminal state order_id=${existingRow.id} payment_status=${existingRow.payment_status} (idempotent skip)`);
        }
      } else {
        console.log(`[webhook] order updated to failed order_id=${rows[0].id} razorpay_order_id=${razorpayOrderId}`);
      }
      return NextResponse.json({ received: true, processed: true });
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const stack = err instanceof Error ? err.stack : undefined;
    console.error("[webhook] unhandled error", msg, stack);
    // Return 500 here — unhandled means we don't know if state is consistent;
    // letting Razorpay retry is safer than swallowing an unknown failure.
    return NextResponse.json(
      { error: msg || "Unknown error", code: "unhandled" },
      { status: 500 }
    );
  }
}
