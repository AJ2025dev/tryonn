import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { dbAdmin } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

// Anon client for signInWithPassword — service role can't issue user
// sessions. Lazy factory so build doesn't require env at import time.
function dbAnon() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
}

type SignupBody = {
  merchant_id: number;
  email: string;
  password: string;
  first_name: string;
  last_name?: string | null;
  mobile_no: string;
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validate(
  body: unknown
):
  | { ok: true; data: SignupBody }
  | { ok: false; errors: Record<string, string> } {
  const errors: Record<string, string> = {};
  if (!body || typeof body !== "object") {
    return { ok: false, errors: { _root: "Body must be a JSON object" } };
  }
  const b = body as Record<string, unknown>;

  if (typeof b.merchant_id !== "number" || !(b.merchant_id > 0)) {
    errors.merchant_id = "merchant_id must be a positive number";
  }
  if (typeof b.email !== "string" || !EMAIL_RE.test(b.email)) {
    errors.email = "valid email required";
  }
  if (typeof b.password !== "string" || b.password.length < 8) {
    errors.password = "password must be at least 8 characters";
  }
  if (typeof b.first_name !== "string" || !b.first_name.trim()) {
    errors.first_name = "required";
  }
  if (typeof b.mobile_no !== "string" || b.mobile_no.trim().length < 10) {
    errors.mobile_no = "mobile_no must be at least 10 characters";
  }
  if (
    b.last_name != null &&
    typeof b.last_name !== "string"
  ) {
    errors.last_name = "must be a string or null";
  }

  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return { ok: true, data: body as SignupBody };
}

function isAlreadyRegisteredError(msg: string): boolean {
  const m = msg.toLowerCase();
  return (
    m.includes("already registered") ||
    m.includes("already been registered") ||
    m.includes("already exists") ||
    m.includes("user already")
  );
}

export async function POST(request: NextRequest) {
  try {
    console.log("[customer:signup] start");
    const raw = await request.json().catch(() => null);
    const v = validate(raw);
    if (!v.ok) {
      console.log("[customer:signup] validation failed", v.errors);
      return NextResponse.json(
        { error: "Validation failed", errors: v.errors },
        { status: 400 }
      );
    }
    const body = v.data;
    const supa = dbAdmin();

    console.log("[customer:signup] verifying merchant", {
      merchant_id: body.merchant_id,
    });
    const { data: merchant, error: mErr } = await supa
      .from("merchants")
      .select("id, is_active")
      .eq("id", body.merchant_id)
      .eq("is_active", true)
      .maybeSingle();
    if (mErr) {
      console.error("[customer:signup] merchant lookup error", mErr.message);
      return NextResponse.json(
        { error: "Merchant lookup failed", code: "merchant_lookup_error" },
        { status: 500 }
      );
    }
    if (!merchant) {
      console.log("[customer:signup] merchant not found or inactive", {
        merchant_id: body.merchant_id,
      });
      return NextResponse.json(
        { error: "Merchant not found", code: "merchant_not_found" },
        { status: 404 }
      );
    }

    console.log("[customer:signup] checking existing customer row", {
      merchant_id: body.merchant_id,
      email: body.email,
    });
    const { data: existing, error: lookupErr } = await supa
      .from("customers")
      .select("id, auth_user_id")
      .eq("merchant_id", body.merchant_id)
      .eq("email", body.email)
      .maybeSingle();
    if (lookupErr) {
      console.error(
        "[customer:signup] customer lookup error",
        lookupErr.message
      );
      return NextResponse.json(
        { error: "Customer lookup failed", code: "customer_lookup_error" },
        { status: 500 }
      );
    }
    const existingRow = existing as
      | { id: number; auth_user_id: string | null }
      | null;
    const claimingGuest =
      existingRow != null && existingRow.auth_user_id == null;
    if (existingRow && existingRow.auth_user_id) {
      console.log("[customer:signup] customer already registered", {
        merchant_id: body.merchant_id,
      });
      // Note: this 409 leaks whether an email is registered at this merchant —
      // standard e-commerce UX trade-off (Shopify/Amazon do the same so users
      // know whether to log in or sign up). Acceptable for v1.
      return NextResponse.json(
        {
          error: "An account already exists for this email at this store",
          code: "customer_exists",
        },
        { status: 409 }
      );
    }
    if (claimingGuest) {
      console.log("[customer:signup] claiming guest customer row", {
        customer_id: existingRow!.id,
      });
    }

    console.log("[customer:signup] creating auth user");
    // TODO(v2): rate limit this endpoint. Currently unbounded — Vercel's
    // edge protection + Supabase Auth's built-in per-project limits are
    // our only line of defense. Add Upstash Redis-based rate limiting
    // when we have real customer traffic.
    const { data: authData, error: authErr } = await supa.auth.admin.createUser(
      {
        email: body.email,
        password: body.password,
        // TODO(v2): require email verification (set email_confirm: false and
        // send confirmation email) OR require Phone OTP step before activation.
        // Auto-confirming for v1 prioritizes signup conversion; account squatting
        // is mitigated by sending order/transaction emails to the address.
        email_confirm: true,
        user_metadata: {
          user_type: "customer",
          first_name: body.first_name,
          last_name: body.last_name ?? null,
          mobile_no: body.mobile_no,
          merchant_id: body.merchant_id,
        },
      }
    );

    if (authErr || !authData?.user) {
      const msg = authErr?.message ?? "auth.admin.createUser returned no user";
      if (authErr && isAlreadyRegisteredError(msg)) {
        console.log("[customer:signup] auth user exists for email");
        return NextResponse.json(
          {
            error: "This email is already registered",
            code: "auth_user_exists",
          },
          { status: 409 }
        );
      }
      console.error("[customer:signup] auth create error", msg);
      return NextResponse.json(
        { error: "Failed to create account", code: "auth_create_error" },
        { status: 500 }
      );
    }
    const authUserId = authData.user.id;
    console.log("[customer:signup] auth user created", { auth_user_id: authUserId });

    // TODO(v2): wrap auth.admin.createUser + customers insert/update in a
    // single transaction. Until Supabase exposes that, we manually compensate
    // by deleting the auth user if the customers write fails below.
    let customerId: number;
    if (claimingGuest && existingRow) {
      console.log("[customer:signup] updating guest customer row", {
        customer_id: existingRow.id,
      });
      const { data: updated, error: updErr } = await supa
        .from("customers")
        .update({
          auth_user_id: authUserId,
          first_name: body.first_name,
          last_name: body.last_name ?? null,
          mobile_no: body.mobile_no,
          email: body.email,
          is_active: true,
          modified_on: new Date().toISOString(),
        })
        .eq("id", existingRow.id)
        .eq("merchant_id", body.merchant_id)
        .select("id")
        .single();
      if (updErr || !updated) {
        console.error(
          "[customer:signup] customer update error, rolling back auth user",
          updErr?.message
        );
        const { error: delErr } = await supa.auth.admin.deleteUser(authUserId);
        if (delErr) {
          console.error(
            "[customer:signup] orphaned auth user — manual cleanup needed",
            { auth_user_id: authUserId, error: delErr.message }
          );
        }
        return NextResponse.json(
          {
            error: "Failed to link customer record",
            code: "customer_update_error",
          },
          { status: 500 }
        );
      }
      customerId = (updated as { id: number }).id;
    } else {
      console.log("[customer:signup] inserting new customer row");
      const { data: inserted, error: insErr } = await supa
        .from("customers")
        .insert({
          merchant_id: body.merchant_id,
          email: body.email,
          first_name: body.first_name,
          last_name: body.last_name ?? null,
          mobile_no: body.mobile_no,
          auth_user_id: authUserId,
          is_active: true,
        })
        .select("id")
        .single();
      if (insErr || !inserted) {
        console.error(
          "[customer:signup] customer insert error, rolling back auth user",
          insErr?.message
        );
        const { error: delErr } = await supa.auth.admin.deleteUser(authUserId);
        if (delErr) {
          console.error(
            "[customer:signup] orphaned auth user — manual cleanup needed",
            { auth_user_id: authUserId, error: delErr.message }
          );
        }
        return NextResponse.json(
          {
            error: "Failed to create customer record",
            code: "customer_insert_error",
          },
          { status: 500 }
        );
      }
      customerId = (inserted as { id: number }).id;
    }

    console.log("[customer:signup] signing in to mint session", {
      customer_id: customerId,
    });
    const anon = dbAnon();
    const { data: sessionData, error: sessionErr } =
      await anon.auth.signInWithPassword({
        email: body.email,
        password: body.password,
      });

    if (sessionErr || !sessionData?.session) {
      // Account is created and linked correctly; the customer can log in
      // manually. Return success without tokens rather than failing the
      // whole signup.
      console.warn(
        "[customer:signup] signin after signup failed",
        sessionErr?.message
      );
      return NextResponse.json({
        success: true,
        customer_id: customerId,
        session: null,
      });
    }

    const session = sessionData.session;
    console.log("[customer:signup] success", {
      customer_id: customerId,
      auth_user_id: authUserId,
    });

    return NextResponse.json({
      success: true,
      customer_id: customerId,
      session: {
        access_token: session.access_token,
        refresh_token: session.refresh_token,
        expires_at: session.expires_at,
        user: {
          id: session.user.id,
          email: session.user.email,
        },
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const stack = err instanceof Error ? err.stack : undefined;
    console.error("[customer:signup] unhandled error", msg, stack);
    return NextResponse.json(
      { error: msg || "Unknown error", code: "unhandled" },
      { status: 500 }
    );
  }
}
