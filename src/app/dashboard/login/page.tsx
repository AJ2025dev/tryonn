"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "signup" | "forgot">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function handleLogin() {
    if (!email || !password) { setError("Email and password required"); return; }
    setError(""); setLoading(true);
    const { error: err } = await supabase.auth.signInWithPassword({ email, password });
    if (err) { setError(err.message); setLoading(false); return; }
    router.push("/dashboard");
  }

  async function handleSignup() {
    if (!email || !password) { setError("Email and password required"); return; }
    if (password.length < 6) { setError("Password must be at least 6 characters"); return; }
    if (password !== confirmPassword) { setError("Passwords don't match"); return; }
    setError(""); setLoading(true);
    const { error: err } = await supabase.auth.signUp({ email, password });
    if (err) { setError(err.message); setLoading(false); return; }
    setMessage("Account created. Check your email to verify, then log in.");
    setMode("login");
    setLoading(false);
  }

  async function handleForgotPassword() {
    if (!email) { setError("Enter your email address"); return; }
    setError(""); setLoading(true);
    const { error: err } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/dashboard/login`,
    });
    if (err) { setError(err.message); setLoading(false); return; }
    setMessage("Password reset link sent to your email.");
    setLoading(false);
  }

  const inputClass = "w-full px-4 py-3 border border-stone-200 text-sm text-stone-900 bg-white placeholder:text-stone-400 focus:outline-none focus:border-stone-500 transition-colors";

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: "#FDFCFA", fontFamily: "'Outfit', sans-serif" }}>
      <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@300;400;500;600&family=Outfit:wght@300;400;500;600&display=swap" rel="stylesheet" />

      <div className="w-full max-w-md px-6">
        {/* Logo */}
        <div className="text-center mb-10">
          <h1 className="text-3xl font-light text-stone-900 mb-2" style={{ fontFamily: "'Cormorant Garamond', serif" }}>Appify</h1>
          <p className="text-sm text-stone-400">
            {mode === "login" ? "Sign in to your merchant dashboard" :
             mode === "signup" ? "Create your merchant account" :
             "Reset your password"}
          </p>
        </div>

        {error && <div className="mb-6 p-4 border border-red-200 text-sm text-red-700 bg-red-50/50 rounded">{error}</div>}
        {message && <div className="mb-6 p-4 border border-green-200 text-sm text-green-700 bg-green-50/50 rounded">{message}</div>}

        <div className="bg-white border border-stone-100 rounded-xl p-8">
          <div className="space-y-4">
            <div>
              <label className="block text-xs text-stone-500 mb-1.5">Email</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} className={inputClass} placeholder="you@yourbrand.com" />
            </div>

            {mode !== "forgot" && (
              <div>
                <label className="block text-xs text-stone-500 mb-1.5">Password</label>
                <input type="password" value={password} onChange={e => setPassword(e.target.value)} className={inputClass} placeholder="Min 6 characters" onKeyDown={e => e.key === "Enter" && (mode === "login" ? handleLogin() : handleSignup())} />
              </div>
            )}

            {mode === "signup" && (
              <div>
                <label className="block text-xs text-stone-500 mb-1.5">Confirm Password</label>
                <input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} className={inputClass} placeholder="Re-enter password" onKeyDown={e => e.key === "Enter" && handleSignup()} />
              </div>
            )}
          </div>

          <button
            onClick={mode === "login" ? handleLogin : mode === "signup" ? handleSignup : handleForgotPassword}
            disabled={loading}
            className="mt-6 w-full py-3 text-xs tracking-[0.2em] uppercase bg-stone-900 text-white hover:bg-stone-800 transition-colors disabled:opacity-50 rounded-lg"
          >
            {loading ? "..." : mode === "login" ? "Sign In" : mode === "signup" ? "Create Account" : "Send Reset Link"}
          </button>

          <div className="mt-6 space-y-2 text-center">
            {mode === "login" && (
              <>
                <button onClick={() => { setMode("forgot"); setError(""); setMessage(""); }} className="text-xs text-stone-400 hover:text-stone-700 block w-full">Forgot password?</button>
                <button onClick={() => { setMode("signup"); setError(""); setMessage(""); }} className="text-xs text-stone-400 hover:text-stone-700 block w-full">Don't have an account? <span className="text-stone-900 font-medium">Sign up</span></button>
              </>
            )}
            {mode === "signup" && (
              <button onClick={() => { setMode("login"); setError(""); setMessage(""); }} className="text-xs text-stone-400 hover:text-stone-700 block w-full">Already have an account? <span className="text-stone-900 font-medium">Sign in</span></button>
            )}
            {mode === "forgot" && (
              <button onClick={() => { setMode("login"); setError(""); setMessage(""); }} className="text-xs text-stone-400 hover:text-stone-700 block w-full">Back to sign in</button>
            )}
          </div>
        </div>

        <div className="mt-8 text-center">
          <p className="text-xs text-stone-300">Don't have a store yet?</p>
          <a href="/onboard" className="text-xs text-stone-500 hover:text-stone-900 font-medium">Create one with AI →</a>
        </div>
      </div>
    </div>
  );
}
