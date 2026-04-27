"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

function fmt(n: number) { return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n); }

export default function AdminDashboard() {
  const [stats, setStats] = useState({ merchants: 0, activeStores: 0, totalOrders: 0, totalRevenue: 0, todayOrders: 0, todayRevenue: 0 });
  const [recentMerchants, setRecentMerchants] = useState<any[]>([]);
  const [recentOrders, setRecentOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { load(); }, []);

  async function load() {
    try {
      const [merchants, orders, settings] = await Promise.all([
        supabase.from("merchants").select("id, first_name, email, is_active, created_on").order("created_on", { ascending: false }),
        supabase.from("orders").select("id, order_no, total_amount, status_description, created_on, first_name, merchant_id").order("created_on", { ascending: false }).limit(10),
        supabase.from("merchant_settings").select("merchant_id, app_name, store_url, primary_color").order("merchant_id"),
      ]);

      const allOrders = orders.data || [];
      const allMerchants = merchants.data || [];
      const totalRevenue = allOrders.reduce((s: number, o: any) => s + (o.total_amount || 0), 0);

      const today = new Date().toISOString().split("T")[0];
      const todayOrders = allOrders.filter((o: any) => o.created_on?.startsWith(today));

      // Merge settings into merchants
      const settingsMap = new Map((settings.data || []).map((s: any) => [s.merchant_id, s]));
      const enrichedMerchants = allMerchants.map((m: any) => ({ ...m, settings: settingsMap.get(m.id) }));

      setStats({
        merchants: allMerchants.length,
        activeStores: allMerchants.filter((m: any) => m.is_active).length,
        totalOrders: allOrders.length,
        totalRevenue,
        todayOrders: todayOrders.length,
        todayRevenue: todayOrders.reduce((s: number, o: any) => s + (o.total_amount || 0), 0),
      });
      setRecentMerchants(enrichedMerchants.slice(0, 5));
      setRecentOrders(allOrders.slice(0, 5));
    } catch (e) { console.error(e); }
    setLoading(false);
  }

  if (loading) return (
    <div className="p-8"><div className="animate-pulse space-y-6"><div className="h-8 bg-slate-200 rounded w-48" /><div className="grid grid-cols-4 gap-4">{[1,2,3,4].map(i => <div key={i} className="h-28 bg-slate-200 rounded-xl" />)}</div></div></div>
  );

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Platform Dashboard</h1>
          <p className="text-sm text-slate-400 mt-1">Overview of all Appify merchants and activity</p>
        </div>
        <Link href="/admin/merchants" className="px-4 py-2 bg-sky-500 text-white text-sm font-medium rounded-lg hover:bg-sky-600 transition">
          View All Merchants
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
        {[
          { label: "Total Merchants", value: stats.merchants, color: "bg-sky-50 text-sky-700" },
          { label: "Active Stores", value: stats.activeStores, color: "bg-green-50 text-green-700" },
          { label: "Total Orders", value: stats.totalOrders, color: "bg-purple-50 text-purple-700" },
          { label: "Total Revenue", value: fmt(stats.totalRevenue), color: "bg-amber-50 text-amber-700" },
          { label: "Today's Orders", value: stats.todayOrders, color: "bg-blue-50 text-blue-700" },
          { label: "Today's Revenue", value: fmt(stats.todayRevenue), color: "bg-emerald-50 text-emerald-700" },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-xl border border-slate-100 p-5">
            <p className="text-xs text-slate-400 font-medium mb-2">{s.label}</p>
            <p className={`text-xl font-semibold ${s.color.split(" ")[1]}`}>{s.value}</p>
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Recent Merchants */}
        <div className="bg-white rounded-xl border border-slate-100 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-slate-900">Recent Merchants</h2>
            <Link href="/admin/merchants" className="text-xs text-sky-500 hover:text-sky-700">View all →</Link>
          </div>
          {recentMerchants.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-8">No merchants yet</p>
          ) : (
            <div className="space-y-3">
              {recentMerchants.map((m: any) => (
                <div key={m.id} className="flex items-center justify-between py-2">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-xs font-bold" style={{ backgroundColor: m.settings?.primary_color || "#0EA5E9" }}>
                      {(m.settings?.app_name || m.first_name || "?").charAt(0)}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-slate-900">{m.settings?.app_name || m.first_name}</p>
                      <p className="text-xs text-slate-400">{m.settings?.store_url ? `${m.settings.store_url}.appi-fy.ai` : m.email}</p>
                    </div>
                  </div>
                  <span className={`text-[10px] font-medium px-2 py-1 rounded-full ${m.is_active ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>
                    {m.is_active ? "Active" : "Inactive"}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent Orders */}
        <div className="bg-white rounded-xl border border-slate-100 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-slate-900">Recent Orders</h2>
            <Link href="/admin/orders" className="text-xs text-sky-500 hover:text-sky-700">View all →</Link>
          </div>
          {recentOrders.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-8">No orders yet</p>
          ) : (
            <div className="space-y-3">
              {recentOrders.map((o: any) => (
                <div key={o.id} className="flex items-center justify-between py-2">
                  <div>
                    <p className="text-sm font-medium text-slate-900">{o.order_no}</p>
                    <p className="text-xs text-slate-400">{o.first_name} · {new Date(o.created_on).toLocaleDateString()}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-slate-900">{fmt(o.total_amount)}</p>
                    <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${
                      o.status_description === "Delivered" ? "bg-green-50 text-green-700" :
                      o.status_description === "Placed" ? "bg-blue-50 text-blue-700" :
                      "bg-slate-50 text-slate-600"
                    }`}>{o.status_description}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
