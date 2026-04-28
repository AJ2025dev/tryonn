"use client";
import Link from "next/link";

function fmt(n: number) { return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n); }

interface Props {
  stats: { products: number; orders: number; revenue: number; customers: number };
  recentOrders: any[];
}

export default function DashboardOverviewClient({ stats, recentOrders }: Props) {
  return (
    <div className="p-8">
      <h1 className="text-2xl font-semibold text-stone-900 mb-8">Dashboard</h1>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
        {[
          { label: "Total Products", value: stats.products, icon: "\u25C8", href: "/dashboard/products" },
          { label: "Total Orders", value: stats.orders, icon: "\u25C7", href: "/dashboard/orders" },
          { label: "Revenue", value: fmt(stats.revenue), icon: "\u20B9", href: "/dashboard/orders" },
          { label: "Customers", value: stats.customers, icon: "\u2661", href: "#" },
        ].map(s => (
          <Link key={s.label} href={s.href} className="bg-white border border-stone-100 rounded-xl p-5 hover:shadow-sm transition-shadow">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs tracking-[0.1em] uppercase text-stone-400">{s.label}</span>
              <span className="text-stone-300">{s.icon}</span>
            </div>
            <p className="text-2xl font-semibold text-stone-900">{typeof s.value === "string" ? s.value : s.value}</p>
          </Link>
        ))}
      </div>

      {/* Recent Orders */}
      <div className="bg-white border border-stone-100 rounded-xl p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-sm font-medium text-stone-900">Recent Orders</h2>
          <Link href="/dashboard/orders" className="text-xs text-stone-400 hover:text-stone-700">View all &rarr;</Link>
        </div>
        {recentOrders.length === 0 ? (
          <p className="text-sm text-stone-400 text-center py-8">No orders yet</p>
        ) : (
          <div className="space-y-0 divide-y divide-stone-50">
            {recentOrders.map((order: any) => (
              <div key={order.id} className="flex items-center justify-between py-3">
                <div>
                  <p className="text-sm font-medium text-stone-900">{order.order_no}</p>
                  <p className="text-xs text-stone-400">{order.first_name} &middot; {new Date(order.created_on).toLocaleDateString()}</p>
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
