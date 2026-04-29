"use client";
import { useState, useEffect } from "react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

function fmt(n: number) { return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n); }

export default function MerchantsPage() {
  const [merchants, setMerchants] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [merchantOrders, setMerchantOrders] = useState<Record<number, any[]>>({});

  useEffect(() => { load(); }, []);

  async function load() {
    const [m, s, o] = await Promise.all([
      supabase.from("merchants").select("*").order("created_on", { ascending: false }),
      supabase.from("merchant_settings").select("*"),
      supabase.from("orders").select("merchant_id, total_amount"),
    ]);

    const settingsMap = new Map((s.data || []).map((s: any) => [s.merchant_id, s]));
    const revenueMap = new Map<number, number>();
    const orderCountMap = new Map<number, number>();
    for (const order of (o.data || [])) {
      revenueMap.set(order.merchant_id, (revenueMap.get(order.merchant_id) || 0) + (order.total_amount || 0));
      orderCountMap.set(order.merchant_id, (orderCountMap.get(order.merchant_id) || 0) + 1);
    }

    const enriched = (m.data || []).map((merchant: any) => ({
      ...merchant,
      settings: settingsMap.get(merchant.id),
      revenue: revenueMap.get(merchant.id) || 0,
      orderCount: orderCountMap.get(merchant.id) || 0,
    }));

    setMerchants(enriched);
    setLoading(false);
  }

  async function toggleActive(id: number, isActive: boolean) {
    await supabase.from("merchants").update({ is_active: !isActive }).eq("id", id);
    setMerchants(prev => prev.map(m => m.id === id ? { ...m, is_active: !isActive } : m));
  }

  async function toggleExpand(id: number) {
    if (expandedId === id) { setExpandedId(null); return; }
    setExpandedId(id);
    if (!merchantOrders[id]) {
      const { data } = await supabase.from("orders").select("*").eq("merchant_id", id).order("created_on", { ascending: false }).limit(5);
      setMerchantOrders(prev => ({ ...prev, [id]: data || [] }));
    }
  }

  const filtered = merchants.filter(m => {
    if (filter === "active" && !m.is_active) return false;
    if (filter === "inactive" && m.is_active) return false;
    if (search && !(m.settings?.app_name || m.first_name || "").toLowerCase().includes(search.toLowerCase()) && !(m.email || "").toLowerCase().includes(search.toLowerCase()) && !(m.settings?.store_url || "").toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  if (loading) return (
    <div className="p-8"><div className="animate-pulse space-y-4"><div className="h-8 bg-slate-200 rounded w-48" />{[1,2,3].map(i => <div key={i} className="h-20 bg-slate-200 rounded-xl" />)}</div></div>
  );

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Merchants</h1>
          <p className="text-sm text-slate-400 mt-1">{merchants.length} total merchant{merchants.length !== 1 ? "s" : ""}</p>
        </div>
      </div>

      {/* Search + Filters */}
      <div className="flex items-center gap-4 mb-6">
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search merchants..." className="flex-1 max-w-md px-4 py-2.5 border border-slate-200 rounded-lg text-sm bg-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500" />
        <div className="flex gap-2">
          {["all", "active", "inactive"].map(f => (
            <button key={f} onClick={() => setFilter(f)} className={`px-4 py-2 text-xs font-medium rounded-lg border transition ${filter === f ? "bg-sky-500 text-white border-sky-500" : "border-slate-200 text-slate-500 hover:border-slate-400"}`}>
              {f.charAt(0).toUpperCase() + f.slice(1)} ({f === "all" ? merchants.length : f === "active" ? merchants.filter(m => m.is_active).length : merchants.filter(m => !m.is_active).length})
            </button>
          ))}
        </div>
      </div>

      {/* Merchants List */}
      <div className="space-y-3">
        {filtered.map(m => (
          <div key={m.id} className="bg-white rounded-xl border border-slate-100 overflow-hidden">
            {/* Row */}
            <div className="flex items-center justify-between p-5 cursor-pointer hover:bg-slate-50/50 transition" onClick={() => toggleExpand(m.id)}>
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-lg flex items-center justify-center text-white text-sm font-bold" style={{ backgroundColor: m.settings?.primary_color || "#0EA5E9" }}>
                  {(m.settings?.app_name || m.first_name || "?").charAt(0)}
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-900">{m.settings?.app_name || m.first_name || "Unnamed"}</p>
                  <p className="text-xs text-slate-400">{m.settings?.store_url ? `${m.settings.store_url}.appi-fy.ai` : m.email}</p>
                </div>
              </div>

              <div className="flex items-center gap-6">
                <div className="text-right hidden md:block">
                  <p className="text-sm font-semibold text-slate-900">{fmt(m.revenue)}</p>
                  <p className="text-xs text-slate-400">{m.orderCount} orders</p>
                </div>
                <div className="text-right hidden md:block">
                  <p className="text-xs text-slate-400">{m.email}</p>
                  <p className="text-xs text-slate-400">{new Date(m.created_on).toLocaleDateString()}</p>
                </div>
                <span className={`text-[10px] font-medium px-2.5 py-1 rounded-full ${m.is_active ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>
                  {m.is_active ? "Active" : "Inactive"}
                </span>
                <span className={`text-slate-400 transition-transform text-sm ${expandedId === m.id ? "rotate-180" : ""}`}>▾</span>
              </div>
            </div>

            {/* Expanded */}
            {expandedId === m.id && (
              <div className="border-t border-slate-100 p-5 bg-slate-50/30">
                <div className="grid md:grid-cols-3 gap-6">
                  {/* Details */}
                  <div>
                    <p className="text-xs font-semibold text-slate-500 mb-3">STORE DETAILS</p>
                    <div className="space-y-2 text-sm">
                      <div><span className="text-slate-400">Brand:</span> <span className="text-slate-900">{m.settings?.app_name || "—"}</span></div>
                      <div><span className="text-slate-400">URL:</span> <a href={`https://${m.settings?.store_url}.appi-fy.ai`} target="_blank" className="text-sky-500 hover:underline">{m.settings?.store_url}.appi-fy.ai</a></div>
                      <div><span className="text-slate-400">Email:</span> <span className="text-slate-900">{m.email}</span></div>
                      <div><span className="text-slate-400">Phone:</span> <span className="text-slate-900">{m.mobile_no || "—"}</span></div>
                      <div><span className="text-slate-400">Category:</span> <span className="text-slate-900">{m.settings?.design_style || "—"}</span></div>
                      <div><span className="text-slate-400">Joined:</span> <span className="text-slate-900">{new Date(m.created_on).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</span></div>
                    </div>
                  </div>

                  {/* Stats */}
                  <div>
                    <p className="text-xs font-semibold text-slate-500 mb-3">PERFORMANCE</p>
                    <div className="space-y-2 text-sm">
                      <div><span className="text-slate-400">Total Revenue:</span> <span className="text-slate-900 font-semibold">{fmt(m.revenue)}</span></div>
                      <div><span className="text-slate-400">Total Orders:</span> <span className="text-slate-900">{m.orderCount}</span></div>
                      <div><span className="text-slate-400">Online Payment:</span> <span className="text-slate-900">{m.is_online_payment_enabled ? "Enabled" : "Disabled"}</span></div>
                      <div><span className="text-slate-400">Subscription:</span> <span className="text-amber-600 font-medium">Not set up</span></div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div>
                    <p className="text-xs font-semibold text-slate-500 mb-3">ACTIONS</p>
                    <div className="space-y-2">
                      <button onClick={() => toggleActive(m.id, m.is_active)} className={`w-full px-4 py-2 text-xs font-medium rounded-lg border transition ${m.is_active ? "border-red-200 text-red-600 hover:bg-red-50" : "border-green-200 text-green-600 hover:bg-green-50"}`}>
                        {m.is_active ? "Deactivate Store" : "Activate Store"}
                      </button>
                      <a href={`https://${m.settings?.store_url}.appi-fy.ai`} target="_blank" className="block w-full px-4 py-2 text-xs font-medium rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 text-center transition">
                        Visit Store ↗
                      </a>
                      <button className="w-full px-4 py-2 text-xs font-medium rounded-lg border border-sky-200 text-sky-600 hover:bg-sky-50 transition">
                        Set Up Subscription
                      </button>
                    </div>
                  </div>
                </div>

                {/* Recent Orders */}
                {merchantOrders[m.id] && merchantOrders[m.id].length > 0 && (
                  <div className="mt-6 pt-4 border-t border-slate-200">
                    <p className="text-xs font-semibold text-slate-500 mb-3">RECENT ORDERS</p>
                    <div className="space-y-2">
                      {merchantOrders[m.id].map((o: any) => (
                        <div key={o.id} className="flex items-center justify-between text-sm">
                          <div><span className="text-slate-900 font-medium">{o.order_no}</span> <span className="text-slate-400 ml-2">{o.first_name}</span></div>
                          <div className="flex items-center gap-3">
                            <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${o.status_description === "Delivered" ? "bg-green-50 text-green-700" : o.status_description === "Placed" ? "bg-blue-50 text-blue-700" : "bg-slate-50 text-slate-600"}`}>{o.status_description}</span>
                            <span className="text-slate-900 font-medium">{fmt(o.total_amount)}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
