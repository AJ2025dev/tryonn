"use client";
import { useState, useEffect } from "react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

function fmt(n: number) { return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n); }

const PLANS = [
  { id: "starter", name: "Starter", setupFee: 4999, monthlyFee: 999, features: ["Website + Subdomain", "Up to 50 products", "Basic analytics", "Email support"] },
  { id: "growth", name: "Growth", setupFee: 9999, monthlyFee: 1999, features: ["Everything in Starter", "Up to 500 products", "Android App (APK)", "Priority support", "Custom domain"] },
  { id: "pro", name: "Pro", setupFee: 19999, monthlyFee: 3999, features: ["Everything in Growth", "Unlimited products", "Android + iOS App", "Delhivery integration", "Dedicated support", "White-label"] },
];

export default function SubscriptionsPage() {
  const [merchants, setMerchants] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showPlanModal, setShowPlanModal] = useState<number | null>(null);

  useEffect(() => { load(); }, []);

  async function load() {
    const [m, s] = await Promise.all([
      supabase.from("merchants").select("id, first_name, email, is_active, created_on"),
      supabase.from("merchant_settings").select("merchant_id, app_name, store_url, primary_color"),
    ]);
    const settingsMap = new Map((s.data || []).map((s: any) => [s.merchant_id, s]));
    const enriched = (m.data || []).map((merchant: any) => ({ ...merchant, settings: settingsMap.get(merchant.id) }));
    setMerchants(enriched);
    setLoading(false);
  }

  if (loading) return (
    <div className="p-8"><div className="animate-pulse space-y-4"><div className="h-8 bg-slate-200 rounded w-48" />{[1,2,3].map(i => <div key={i} className="h-20 bg-slate-200 rounded-xl" />)}</div></div>
  );

  return (
    <div className="p-8">
      <h1 className="text-2xl font-semibold text-slate-900 mb-2">Subscriptions & Billing</h1>
      <p className="text-sm text-slate-400 mb-8">Manage merchant plans, setup fees, and monthly subscriptions</p>

      {/* Plans Overview */}
      <div className="grid md:grid-cols-3 gap-4 mb-10">
        {PLANS.map(plan => (
          <div key={plan.id} className={`bg-white rounded-xl border p-6 ${plan.id === "growth" ? "border-sky-500 ring-1 ring-sky-500/20" : "border-slate-100"}`}>
            {plan.id === "growth" && <span className="text-[10px] font-semibold text-sky-500 bg-sky-50 px-2 py-1 rounded-full mb-3 inline-block">POPULAR</span>}
            <h3 className="text-lg font-semibold text-slate-900">{plan.name}</h3>
            <div className="mt-2 mb-4">
              <span className="text-2xl font-bold text-slate-900">{fmt(plan.monthlyFee)}</span>
              <span className="text-sm text-slate-400">/month</span>
            </div>
            <p className="text-xs text-slate-400 mb-4">+ {fmt(plan.setupFee)} one-time setup fee</p>
            <ul className="space-y-2">
              {plan.features.map(f => (
                <li key={f} className="flex items-center gap-2 text-sm text-slate-600">
                  <span className="text-green-500 text-xs">✓</span> {f}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      {/* Merchants Subscription Status */}
      <h2 className="text-sm font-semibold text-slate-900 mb-4">Merchant Subscription Status</h2>
      <div className="bg-white rounded-xl border border-slate-100 overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-100">
              <th className="text-left text-xs text-slate-400 font-medium px-5 py-3">Merchant</th>
              <th className="text-left text-xs text-slate-400 font-medium px-5 py-3">Plan</th>
              <th className="text-left text-xs text-slate-400 font-medium px-5 py-3">Setup Fee</th>
              <th className="text-left text-xs text-slate-400 font-medium px-5 py-3">Monthly</th>
              <th className="text-left text-xs text-slate-400 font-medium px-5 py-3">Status</th>
              <th className="text-right text-xs text-slate-400 font-medium px-5 py-3">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {merchants.map(m => (
              <tr key={m.id} className="hover:bg-slate-50/50">
                <td className="px-5 py-4">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-xs font-bold" style={{ backgroundColor: m.settings?.primary_color || "#0EA5E9" }}>
                      {(m.settings?.app_name || m.first_name || "?").charAt(0)}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-slate-900">{m.settings?.app_name || m.first_name}</p>
                      <p className="text-xs text-slate-400">{m.settings?.store_url}.appi-fy.ai</p>
                    </div>
                  </div>
                </td>
                <td className="px-5 py-4"><span className="text-sm text-slate-400">—</span></td>
                <td className="px-5 py-4"><span className="text-sm text-slate-400">—</span></td>
                <td className="px-5 py-4"><span className="text-sm text-slate-400">—</span></td>
                <td className="px-5 py-4">
                  <span className="text-[10px] font-medium px-2.5 py-1 rounded-full bg-amber-50 text-amber-700">No plan</span>
                </td>
                <td className="px-5 py-4 text-right">
                  <button onClick={() => setShowPlanModal(m.id)} className="text-xs font-medium text-sky-500 hover:text-sky-700 border border-sky-200 px-3 py-1.5 rounded-lg hover:bg-sky-50 transition">
                    Assign Plan
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Plan Assignment Modal */}
      {showPlanModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={() => setShowPlanModal(null)}>
          <div className="bg-white rounded-2xl p-8 max-w-md w-full mx-4" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-slate-900 mb-2">Assign Plan</h3>
            <p className="text-sm text-slate-400 mb-6">Choose a plan for this merchant. They will receive a payment link via email.</p>
            <div className="space-y-3">
              {PLANS.map(plan => (
                <button key={plan.id} className="w-full p-4 border border-slate-200 rounded-xl text-left hover:border-sky-500 hover:bg-sky-50/50 transition" onClick={() => { alert(`Plan "${plan.name}" assigned. Payment link feature coming soon.`); setShowPlanModal(null); }}>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{plan.name}</p>
                      <p className="text-xs text-slate-400 mt-1">{fmt(plan.setupFee)} setup + {fmt(plan.monthlyFee)}/mo</p>
                    </div>
                    <span className="text-sky-500">→</span>
                  </div>
                </button>
              ))}
            </div>
            <button onClick={() => setShowPlanModal(null)} className="mt-4 w-full py-2 text-sm text-slate-400 hover:text-slate-700">Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}
