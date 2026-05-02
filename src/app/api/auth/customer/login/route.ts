import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { dbAdmin } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

// Anon client for signInWithPassword. Lazy factory.
// TODO(later): move to a shared supabase-anon.ts helper once 3+ routes
// declare this same factory inline.
function dbAnon() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
}

type LoginBody = {
  merchant_id: number;
  email: string;
  password: string;
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validate(
  body: unknown
):
  | { ok: true; data: LoginBody }
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
  if (typeof b.password !== "string" || b.password.length === 0) {
    errors.password = "required";
  }

  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return { ok: true, data: body as LoginBody };
}

function truncateUuid(id: string | undefined): string {
  if (!id) return "<none>";
  return id.length > 8 ? `${id.slice(0, 8)}…` : id;
}

export async function POST(request: NextRequest) {
  try {
    console.log("[customer:login] start");
    const raw = await request.json().catch(() => null);
    const v = validate(raw);
    if (!v.ok) {
      console.log("[customer:login] validation failed", v.errors);
      return NextResponse.json(
        { error: "Validation failed", errors: v.errors },
        { status: 400 }
      );
    }
    const body = v.data;

    console.log("[customer:login] attempting signin", {
      merchant_id: body.merchant_id,
      email: body.email,
    });
    const anon = dbAnon();
    const { data: sessionData, error: sessionErr } =
      await anon.auth.signInWithPassword({
        email: body.email,
        password: body.password,
      });

    if (sessionErr || !sessionData?.session || !sessionData.user) {
      const msg = sessionErr?.message ?? "no session returned";
      const lower = msg.toLowerCase();
      if (lower.includes("invalid login credentials") || lower.includes("invalid_grant")) {
        console.log(`[customer:login] invalid credentials for email=${body.email}`);
        return NextResponse.json(
          { error: "Invalid email or password", code: "invalid_credentials" },
          { status: 401 }
        );
      }
      if (lower.includes("email not confirmed") || lower.includes("not_confirmed")) {
        console.log(`[customer:login] email not confirmed for email=${body.email}`);
        return NextResponse.json(
          { error: "Email not confirmed", code: "email_not_confirmed" },
          { status: 401 }
        );
      }
      console.error(`[customer:login] auth error for email=${body.email}`, msg);
      return NextResponse.json(
        { error: "Login failed", code: "auth_error" },
        { status: 500 }
      );
    }

    const session = sessionData.session;
    const user = sessionData.user;
    const userType = (user.user_metadata as Record<string, unknown> | null)?.[
      "user_type"
    ];

    if (userType !== "customer") {
      console.log(
        `[customer:login] wrong account type user_type=${String(userType ?? "<missing>")} auth_user_id=${truncateUuid(user.id)}`
      );
      return NextResponse.json(
        {
          error: "Use the merchant dashboard to log in.",
          code: "wrong_account_type",
        },
        { status: 403 }
      );
    }

    console.log("[customer:login] verifying customer at merchant", {
      merchant_id: body.merchant_id,
      auth_user_id_truncated: truncateUuid(user.id),
    });
    const supa = dbAdmin();
    const { data: customer, error: cErr } = await supa
      .from("customers")
      .select("id, merchant_id, is_active")
      .eq("auth_user_id", user.id)
      .eq("merchant_id", body.merchant_id)
      .maybeSingle();

    if (cErr) {
      console.error("[customer:login] customer lookup error", cErr.message);
      return NextResponse.json(
        { error: "Customer lookup failed", code: "customer_lookup_error" },
        { status: 500 }
      );
    }
    if (!customer) {
      console.log(
        `[customer:login] no customer at merchant_id=${body.merchant_id} for auth_user_id=${truncateUuid(user.id)}`
      );
      return NextResponse.json(
        {
          error: "No account at this store. Sign up first.",
          code: "no_customer_at_merchant",
        },
        { status: 403 }
      );
    }

    const customerRow = customer as {
      id: number;
      merchant_id: number;
      is_active: boolean | null;
    };

    // === false (not falsy) — null is legacy "active by default".
    if (customerRow.is_active === false) {
      console.log(
        `[customer:login] customer disabled customer_id=${customerRow.id}`
      );
      return NextResponse.json(
        {
          error: "This account has been disabled. Contact the store.",
          code: "customer_disabled",
        },
        { status: 403 }
      );
    }

    console.log("[customer:login] success", {
      customer_id: customerRow.id,
      auth_user_id_truncated: truncateUuid(user.id),
    });

    return NextResponse.json({
      success: true,
      customer_id: customerRow.id,
      session: {
        access_token: session.access_token,
        refresh_token: session.refresh_token,
        expires_at: session.expires_at,
        user: {
          id: user.id,
          email: user.email,
        },
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const stack = err instanceof Error ? err.stack : undefined;
    console.error("[customer:login] unhandled error", msg, stack);
    return NextResponse.json(
      { error: msg || "Unknown error", code: "unhandled" },
      { status: 500 }
    );
  }
}
