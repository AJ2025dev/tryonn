import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { dbAdmin } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

// Anon client for signInWithOtp. Lazy factory.
function dbAnon() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
}

type OtpSendBody = {
  merchant_id: number;
  phone: string;
};

// E.164: + followed by 10–15 digits, no leading zero after +.
const E164_RE = /^\+[1-9]\d{9,14}$/;

function validate(
  body: unknown
):
  | { ok: true; data: OtpSendBody }
  | { ok: false; errors: Record<string, string> } {
  const errors: Record<string, string> = {};
  if (!body || typeof body !== "object") {
    return { ok: false, errors: { _root: "Body must be a JSON object" } };
  }
  const b = body as Record<string, unknown>;

  if (typeof b.merchant_id !== "number" || !(b.merchant_id > 0)) {
    errors.merchant_id = "merchant_id must be a positive number";
  }
  if (typeof b.phone !== "string" || !E164_RE.test(b.phone)) {
    errors.phone = "phone must be E.164 format (e.g., +919876543210)";
  }

  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return { ok: true, data: body as OtpSendBody };
}

function isRateLimited(msg: string): boolean {
  const m = msg.toLowerCase();
  return (
    m.includes("rate limit") ||
    m.includes("too many requests") ||
    m.includes("rate_limit") ||
    m.includes("over_request_rate_limit") ||
    m.includes("over_email_send_rate_limit") ||
    m.includes("over_sms_send_rate_limit")
  );
}

export async function POST(request: NextRequest) {
  try {
    console.log("[customer:otp:send] start");
    const raw = await request.json().catch(() => null);
    const v = validate(raw);
    if (!v.ok) {
      console.log("[customer:otp:send] validation failed", v.errors);
      return NextResponse.json(
        { error: "Validation failed", errors: v.errors },
        { status: 400 }
      );
    }
    const body = v.data;

    console.log("[customer:otp:send] verifying merchant", {
      merchant_id: body.merchant_id,
    });
    const supa = dbAdmin();
    const { data: merchant, error: mErr } = await supa
      .from("merchants")
      .select("id, is_active")
      .eq("id", body.merchant_id)
      .eq("is_active", true)
      .maybeSingle();
    if (mErr) {
      console.error("[customer:otp:send] merchant lookup error", mErr.message);
      return NextResponse.json(
        { error: "Merchant lookup failed", code: "merchant_lookup_error" },
        { status: 500 }
      );
    }
    if (!merchant) {
      console.log("[customer:otp:send] merchant not found or inactive", {
        merchant_id: body.merchant_id,
      });
      return NextResponse.json(
        { error: "Merchant not found", code: "merchant_not_found" },
        { status: 404 }
      );
    }

    console.log(
      `[customer:otp:send] sending OTP phone=${body.phone} merchant_id=${body.merchant_id}`
    );
    // We do NOT check for an existing customers row here — Route 7 handles
    // claim-guest / fresh-row creation after the OTP is verified.
    const anon = dbAnon();
    // TODO(v2): rate limit this endpoint per phone + per merchant. Currently
    // Supabase's per-project SMS rate limit (~30/hour) is our only defense
    // against enumeration attacks. Add Upstash Redis-based rate limiting
    // (e.g., max 3 OTP requests per phone per 10 minutes) when scaling.
    //
    // TODO(v2): server-side phone normalization (strip spaces, prepend country
    // code if missing). Currently Flutter is responsible for sending strict
    // E.164.
    const { error: otpErr } = await anon.auth.signInWithOtp({
      phone: body.phone,
      options: {
        shouldCreateUser: true,
        data: {
          user_type: "customer",
          merchant_id: body.merchant_id,
        },
      },
    });

    if (otpErr) {
      const msg = otpErr.message || "unknown";
      if (isRateLimited(msg)) {
        console.warn(
          `[customer:otp:send] rate limited phone=${body.phone}`,
          msg
        );
        return NextResponse.json(
          {
            error: "Too many OTP requests. Try again in a few minutes.",
            code: "rate_limited",
          },
          { status: 429 }
        );
      }
      console.error(
        `[customer:otp:send] otp send error phone=${body.phone}`,
        msg
      );
      return NextResponse.json(
        { error: "Failed to send OTP", code: "otp_send_error" },
        { status: 500 }
      );
    }

    console.log(
      `[customer:otp:send] OTP sent phone=${body.phone} merchant_id=${body.merchant_id}`
    );
    return NextResponse.json({ sent: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const stack = err instanceof Error ? err.stack : undefined;
    console.error("[customer:otp:send] unhandled error", msg, stack);
    return NextResponse.json(
      { error: msg || "Unknown error", code: "unhandled" },
      { status: 500 }
    );
  }
}
