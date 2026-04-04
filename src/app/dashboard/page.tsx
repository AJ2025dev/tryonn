"use client";
import { useState, useEffect } from "react";
import { createClient } from "@supabase/supabase-js";
import { getMerchantIdClient } from "@/lib/merchant-client";
import Link from "next/link";

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

function fmt(n: number) { return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n); }

export default function DashboardOverview() {
  const [stats, setStats] = useState({ products: 0, orders: 0, revenue: 0, customers: 0 });
  const [recentOrders, setRecentOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const mid = getMerchantIdClient();

      const [prods, orders, items] = await Promise.all([
        supabase.from("products").select("id", { count: "exact", head: true }).eq("merchant_id", mid).eq("is_active", true),
        supabase.from("orders").select("id, order_no, total_amount, status_description, created_on, first_name").eq("merchant_id", mid).order("created_on", { ascending: false }).limit(5),
        supabase.from("orders").select("total_amount").eq("merchant_id", mid),
      ]);

      const revenue = (items.data || []).reduce((sum: number, o: any) => sum + (o.total_amount || 0), 0);

      setStats({
        products: prods.count || 0,
        orders: (items.data || []).length,
        revenue,
        customers: new Set((orders.data || []).map((o: any) => o.first_name)).size,
      });
      setRecentOrders(orders.data || []);
      setLoading(false);
    }
    load();
  }, []);

  if (loading) return (
    <div className="p-8">
      <div className="animate-pulse space-y-6">
        <div className="h-8 bg-stone-200 rounded w-48" />
        <div className="grid grid-cols-4 gap-4">{[1,2,3,4].map(i => <div key={i} className="h-24 bg-stone-200 rounded-lg" />)}</div>
      </div>
    </div>
  );

  return (
    <div className="p-8">
      <h1 className="text-2xl font-semibold text-stone-900 mb-8">Dashboard</h1>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
        {[
          { label: "Total Products", value: stats.products, icon: "◈", href: "/dashboard/products" },
          { label: "Total Orders", value: stats.orders, icon: "◇", href: "/dashboard/orders" },
          { label: "Revenue", value: fmt(stats.revenue), icon: "₹", href: "/dashboard/orders" },
          { label: "Customers", value: stats.customers, icon: "♡", href: "#" },
        ].map(s => (
          <Link key={s.label} href={s.href} className="bg-white border border-stone-100 rounded-xl p-5 hover:shadow-sm transition-shadow">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs tracking-[0.1em] uppercase text-stone-400">{s.label}</span>
              <span className="text-stone-300">{s.icon}</span>
            </div>
            <p className="text-2xl font-semibold text-stone-900">{s.value}</p>
          </Link>
        ))}
      </div>

      {/* Recent Orders */}
      <div className="bg-white border border-stone-100 rounded-xl p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-sm font-medium text-stone-900">Recent Orders</h2>
          <Link href="/dashboard/orders" className="text-xs text-stone-400 hover:text-stone-700">View all →</Link>
        </div>
        {recentOrders.length === 0 ? (
          <p className="text-sm text-stone-400 text-center py-8">No orders yet</p>
        ) : (
          <div className="space-y-0 divide-y divide-stone-50">
            {recentOrders.map(order => (
              <div key={order.id} className="flex items-center justify-between py-3">
                <div>
                  <p className="text-sm font-medium text-stone-900">{order.order_no}</p>
                  <p className="text-xs text-stone-400">{order.first_name} · {new Date(order.created_on).toLocaleDateString()}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium text-stone-900">{fmt(order.total_amount)}</p>
                  <span className={`text-[10px] tracking-[0.1em] uppercase px-2 py-0.5 rounded-full ${
                    order.status_description === "Payment Confirmed" ? "bg-green-50 text-green-700" :
                    order.status_description === "Placed" ? "bg-blue-50 text-blue-700" :
                    "bg-stone-50 text-stone-700"
                  }`}>{order.status_description}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
