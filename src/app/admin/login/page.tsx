"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const ADMIN_EMAILS = ["aj@appi-fy.ai", "admin@appi-fy.ai", "ajadmobrev@gmail.com"];

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleLogin() {
    if (!email || !password) {
      setError("Email and password required");
      return;
    }

    setError("");
    setLoading(true);

    // Check email is on the allow-list before even hitting Supabase
    if (!ADMIN_EMAILS.includes(email.toLowerCase())) {
      setError("This email is not authorized for admin access");
      setLoading(false);
      return;
    }

    const { error: err } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (err) {
      setError(err.message);
      setLoading(false);
      return;
    }

    router.push("/admin");
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center p-6"
      style={{
        backgroundColor: "#F0F9FF",
        fontFamily: "'Inter', sans-serif",
      }}
    >
      <link
        href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap"
        rel="stylesheet"
      />

      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-sky-500 mb-4">
            <span className="text-white text-2xl font-bold">A</span>
          </div>
          <h1 className="text-3xl font-bold text-slate-900 mb-2">
            Appify Admin
          </h1>
          <p className="text-slate-500 text-sm">
            Sign in to the platform admin panel
          </p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8">
          <div className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@appi-fy.ai"
                className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-sky-500 focus:ring-2 focus:ring-sky-100 outline-none transition text-slate-900"
                onKeyDown={(e) => e.key === "Enter" && handleLogin()}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-sky-500 focus:ring-2 focus:ring-sky-100 outline-none transition text-slate-900"
                onKeyDown={(e) => e.key === "Enter" && handleLogin()}
              />
            </div>

            {error && (
              <div className="px-4 py-3 rounded-xl bg-red-50 border border-red-100 text-red-600 text-sm">
                {error}
              </div>
            )}

            <button
              onClick={handleLogin}
              disabled={loading}
              className="w-full py-3 rounded-xl bg-sky-500 hover:bg-sky-600 disabled:bg-sky-300 text-white font-semibold transition tracking-wide"
            >
              {loading ? "Signing in..." : "SIGN IN"}
            </button>
          </div>

          <div className="mt-6 pt-6 border-t border-slate-100 text-center">
            <p className="text-xs text-slate-400">
              Restricted access. Authorized personnel only.
            </p>
          </div>
        </div>

        {/* Footer link */}
        <div className="text-center mt-6">
          <a
            href="/dashboard/login"
            className="text-sm text-slate-500 hover:text-slate-700 transition"
          >
            Merchant? Sign in here →
          </a>
        </div>
      </div>
    </div>
  );
}
