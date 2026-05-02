import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { dbAdmin } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

// Anon client for verifyOtp — issues the session.
function dbAnon() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
}

type OtpVerifyBody = {
  merchant_id: number;
  phone: string;
  otp: string;
};

const E164_RE = /^\+[1-9]\d{9,14}$/;
const OTP_RE = /^\d{4,8}$/;

function validate(
  body: unknown
):
  | { ok: true; data: OtpVerifyBody }
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
  if (typeof b.otp !== "string" || !OTP_RE.test(b.otp)) {
    errors.otp = "otp must be 4–8 digits";
  }

  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return { ok: true, data: body as OtpVerifyBody };
}

function isInvalidOrExpired(msg: string): boolean {
  const m = msg.toLowerCase();
  return (
    m.includes("expired") ||
    m.includes("invalid") ||
    m.includes("token has expired") ||
    m.includes("otp_expired") ||
    m.includes("invalid_otp")
  );
}

function truncateUuid(id: string | undefined): string {
  if (!id) return "<none>";
  return id.length > 8 ? `${id.slice(0, 8)}…` : id;
}

export async function POST(request: NextRequest) {
  try {
    console.log("[customer:otp:verify] start");
    const raw = await request.json().catch(() => null);
    const v = validate(raw);
    if (!v.ok) {
      console.log("[customer:otp:verify] validation failed", v.errors);
      return NextResponse.json(
        { error: "Validation failed", errors: v.errors },
        { status: 400 }
      );
    }
    const body = v.data;

    console.log("[customer:otp:verify] verifying merchant", {
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
      console.error(
        "[customer:otp:verify] merchant lookup error",
        mErr.message
      );
      return NextResponse.json(
        { error: "Merchant lookup failed", code: "merchant_lookup_error" },
        { status: 500 }
      );
    }
    if (!merchant) {
      console.log("[customer:otp:verify] merchant not found or inactive", {
        merchant_id: body.merchant_id,
      });
      return NextResponse.json(
        { error: "Merchant not found", code: "merchant_not_found" },
        { status: 404 }
      );
    }

    console.log(
      `[customer:otp:verify] verifying OTP phone=${body.phone} merchant_id=${body.merchant_id}`
    );
    const anon = dbAnon();
    const { data: sessionData, error: otpErr } = await anon.auth.verifyOtp({
      phone: body.phone,
      token: body.otp,
      type: "sms",
    });

    if (otpErr || !sessionData?.session || !sessionData.user) {
      const msg = otpErr?.message ?? "no session returned";
      if (otpErr && isInvalidOrExpired(msg)) {
        console.log(
          `[customer:otp:verify] invalid or expired OTP phone=${body.phone}`
        );
        return NextResponse.json(
          {
            error: "OTP is invalid or has expired",
            code: "invalid_or_expired_otp",
          },
          { status: 401 }
        );
      }
      console.error(
        `[customer:otp:verify] otp verify error phone=${body.phone}`,
        msg
      );
      return NextResponse.json(
        { error: "Failed to verify OTP", code: "otp_verify_error" },
        { status: 500 }
      );
    }

    const session = sessionData.session;
    const user = sessionData.user;
    const metadata = (user.user_metadata as Record<string, unknown> | null) ?? {};
    const userType = metadata["user_type"];

    if (userType === "merchant") {
      console.log(
        `[customer:otp:verify] wrong account type user_type=merchant auth_user_id=${truncateUuid(user.id)}`
      );
      return NextResponse.json(
        {
          error: "This phone is registered as a merchant account.",
          code: "wrong_account_type",
        },
        { status: 403 }
      );
    }

    // First-time stamp: if user_type wasn't set on this auth user yet
    // (legacy users created before Route 6 stamped metadata), do it now.
    if (userType !== "customer") {
      console.log(
        `[customer:otp:verify] stamped user_metadata for new user auth_user_id=${truncateUuid(user.id)}`
      );
      const { error: stampErr } = await supa.auth.admin.updateUserById(user.id, {
        user_metadata: {
          ...metadata,
          user_type: "customer",
          mobile_no: body.phone,
        },
      });
      if (stampErr) {
        console.warn(
          "[customer:otp:verify] failed to stamp user_metadata (non-fatal)",
          stampErr.message
        );
      }
    }

    // 6a: existing customers row at this merchant linked to this auth user.
    console.log("[customer:otp:verify] looking up customers row", {
      merchant_id: body.merchant_id,
      auth_user_id_truncated: truncateUuid(user.id),
    });
    const { data: existing, error: existingErr } = await supa
      .from("customers")
      .select("id, is_active")
      .eq("auth_user_id", user.id)
      .eq("merchant_id", body.merchant_id)
      .maybeSingle();
    if (existingErr) {
      console.error(
        "[customer:otp:verify] existing customer lookup error",
        existingErr.message
      );
      return NextResponse.json(
        { error: "Customer lookup failed", code: "customer_lookup_error" },
        { status: 500 }
      );
    }

    let customerId: number;

    if (existing) {
      const existingRow = existing as { id: number; is_active: boolean | null };
      if (existingRow.is_active === false) {
        console.log(
          `[customer:otp:verify] customer disabled customer_id=${existingRow.id}`
        );
        return NextResponse.json(
          {
            error: "This account has been disabled. Contact the store.",
            code: "customer_disabled",
          },
          { status: 403 }
        );
      }
      customerId = existingRow.id;
      console.log("[customer:otp:verify] existing customer linked", {
        customer_id: customerId,
      });
    } else {
      // TODO(post-Route-7): standardize on E.164 in customers.mobile_no everywhere.
      // Route 1 currently accepts any string for customer.mobile_no during guest
      // checkout. After this route ships, update Route 1's validation to use the
      // same E.164 regex so guest rows are always claim-eligible from this flow.
      //
      // 6b: claim a guest row matching this phone at this merchant.
      // Note: relies on guest rows being stored with mobile_no in the
      // same format we receive here (E.164 with leading +). Legacy
      // 10-digit guest rows will not match and will fall through to 6c.
      const { data: guest, error: guestErr } = await supa
        .from("customers")
        .select("id")
        .eq("merchant_id", body.merchant_id)
        .eq("mobile_no", body.phone)
        .is("auth_user_id", null)
        .maybeSingle();
      if (guestErr) {
        console.error(
          "[customer:otp:verify] guest lookup error",
          guestErr.message
        );
        return NextResponse.json(
          { error: "Customer lookup failed", code: "customer_lookup_error" },
          { status: 500 }
        );
      }

      if (guest) {
        const guestRow = guest as { id: number };
        const { data: claimed, error: claimErr } = await supa
          .from("customers")
          .update({
            auth_user_id: user.id,
            is_active: true,
            modified_on: new Date().toISOString(),
          })
          .eq("id", guestRow.id)
          .eq("merchant_id", body.merchant_id)
          .is("auth_user_id", null)
          .select("id")
          .single();
        if (claimErr || !claimed) {
          console.error(
            "[customer:otp:verify] guest claim error",
            claimErr?.message
          );
          return NextResponse.json(
            { error: "Failed to claim customer record", code: "guest_claim_error" },
            { status: 500 }
          );
        }
        customerId = (claimed as { id: number }).id;
        console.log(
          `[customer:otp:verify] claimed guest customer row customer_id=${customerId}`
        );
      } else {
        // 6c: insert a fresh customers row.
        const firstName =
          typeof metadata["first_name"] === "string" &&
          (metadata["first_name"] as string).trim()
            ? (metadata["first_name"] as string)
            : "Customer";
        const lastName =
          typeof metadata["last_name"] === "string"
            ? (metadata["last_name"] as string)
            : null;
        const { data: inserted, error: insErr } = await supa
          .from("customers")
          .insert({
            merchant_id: body.merchant_id,
            mobile_no: body.phone,
            first_name: firstName,
            last_name: lastName,
            email: user.email ?? null,
            auth_user_id: user.id,
            is_active: true,
          })
          .select("id")
          .single();
        if (insErr || !inserted) {
          console.error(
            "[customer:otp:verify] customer insert error",
            insErr?.message
          );
          return NextResponse.json(
            {
              error: "Failed to create customer record",
              code: "customer_insert_error",
            },
            { status: 500 }
          );
        }
        customerId = (inserted as { id: number }).id;
        console.log(
          `[customer:otp:verify] inserted new customer customer_id=${customerId}`
        );
      }
    }

    console.log("[customer:otp:verify] success", {
      customer_id: customerId,
      auth_user_id_truncated: truncateUuid(user.id),
    });

    return NextResponse.json({
      success: true,
      customer_id: customerId,
      session: {
        access_token: session.access_token,
        refresh_token: session.refresh_token,
        expires_at: session.expires_at,
        user: {
          id: user.id,
          phone: user.phone,
        },
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const stack = err instanceof Error ? err.stack : undefined;
    console.error("[customer:otp:verify] unhandled error", msg, stack);
    return NextResponse.json(
      { error: msg || "Unknown error", code: "unhandled" },
      { status: 500 }
    );
  }
}
