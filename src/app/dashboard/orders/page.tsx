"use client";
import { useState, useEffect } from "react";
import { createClient } from "@supabase/supabase-js";
import { getMerchantIdClient } from "@/lib/merchant-client";

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

function fmt(n: number) { return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n); }

const STATUSES = [
  { value: 1, label: "Placed", color: "bg-blue-50 text-blue-700" },
  { value: 2, label: "Confirmed", color: "bg-yellow-50 text-yellow-700" },
  { value: 3, label: "Shipped", color: "bg-purple-50 text-purple-700" },
  { value: 4, label: "Delivered", color: "bg-green-50 text-green-700" },
  { value: 5, label: "Cancelled", color: "bg-red-50 text-red-700" },
];

export default function OrdersPage() {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedOrder, setExpandedOrder] = useState<number | null>(null);
  const [orderItems, setOrderItems] = useState<Record<number, any[]>>({});
  const [filter, setFilter] = useState("all");

  useEffect(() => { loadOrders(); }, []);

  async function loadOrders() {
    const mid = getMerchantIdClient();
    const { data } = await supabase
      .from("orders")
      .select("*")
      .eq("merchant_id", mid)
      .order("created_on", { ascending: false });
    setOrders(data || []);
    setLoading(false);
  }

  async function toggleExpand(orderId: number) {
    if (expandedOrder === orderId) {
      setExpandedOrder(null);
      return;
    }
    setExpandedOrder(orderId);
    if (!orderItems[orderId]) {
      const { data } = await supabase
        .from("order_items")
        .select("*")
        .eq("order_id", orderId);
      setOrderItems(prev => ({ ...prev, [orderId]: data || [] }));
    }
  }

  async function updateStatus(orderId: number, status: number) {
    const statusObj = STATUSES.find(s => s.value === status);
    const mid = getMerchantIdClient();
    await supabase.from("orders").update({
      status,
      status_description: statusObj?.label || "Updated",
    }).eq("id", orderId).eq("merchant_id", mid);
    setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status, status_description: statusObj?.label } : o));
  }

  const filtered = filter === "all" ? orders : orders.filter(o => o.status === Number(filter));

  if (loading) return (
    <div className="p-8">
      <div className="animate-pulse space-y-4">
        <div className="h-8 bg-stone-200 rounded w-48" />
        {[1,2,3].map(i => <div key={i} className="h-20 bg-stone-200 rounded" />)}
      </div>
    </div>
  );

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-stone-900">Orders</h1>
          <p className="text-sm text-stone-400 mt-1">{orders.length} total order{orders.length !== 1 ? "s" : ""}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-2 mb-6 flex-wrap">
        <button onClick={() => setFilter("all")} className={`px-4 py-2 text-xs tracking-[0.1em] uppercase rounded-lg border transition-colors ${filter === "all" ? "bg-stone-900 text-white border-stone-900" : "border-stone-200 text-stone-500 hover:border-stone-400"}`}>
          All ({orders.length})
        </button>
        {STATUSES.map(s => {
          const count = orders.filter(o => o.status === s.value).length;
          return (
            <button key={s.value} onClick={() => setFilter(String(s.value))} className={`px-4 py-2 text-xs tracking-[0.1em] uppercase rounded-lg border transition-colors ${filter === String(s.value) ? "bg-stone-900 text-white border-stone-900" : "border-stone-200 text-stone-500 hover:border-stone-400"}`}>
              {s.label} ({count})
            </button>
          );
        })}
      </div>

      {/* Orders List */}
      <div className="space-y-3">
        {filtered.length === 0 ? (
          <div className="bg-white border border-stone-100 rounded-xl text-center py-16">
            <p className="text-stone-400">No orders found</p>
          </div>
        ) : (
          filtered.map(order => {
            const statusObj = STATUSES.find(s => s.value === order.status) || STATUSES[0];
            const isExpanded = expandedOrder === order.id;
            return (
              <div key={order.id} className="bg-white border border-stone-100 rounded-xl overflow-hidden">
                {/* Order Header */}
                <div className="flex items-center justify-between p-5 cursor-pointer hover:bg-stone-50/50 transition-colors" onClick={() => toggleExpand(order.id)}>
                  <div className="flex items-center gap-6">
                    <div>
                      <p className="text-sm font-medium text-stone-900">{order.order_no}</p>
                      <p className="text-xs text-stone-400">{new Date(order.created_on).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</p>
                    </div>
                    <div>
                      <p className="text-sm text-stone-700">{order.first_name} {order.last_name}</p>
                      <p className="text-xs text-stone-400">{order.payment_type === 1 ? "COD" : "Paid Online"}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className={`text-[10px] tracking-[0.1em] uppercase px-2.5 py-1 rounded-full ${statusObj.color}`}>
                      {statusObj.label}
                    </span>
                    <p className="text-sm font-semibold text-stone-900 w-24 text-right">{fmt(order.total_amount)}</p>
                    <span className={`text-stone-400 transition-transform ${isExpanded ? "rotate-180" : ""}`}>▾</span>
                  </div>
                </div>

                {/* Expanded Details */}
                {isExpanded && (
                  <div className="border-t border-stone-100 p-5 bg-stone-50/30">
                    <div className="grid md:grid-cols-2 gap-6">
                      {/* Items */}
                      <div>
                        <p className="text-xs tracking-[0.1em] uppercase text-stone-400 font-medium mb-3">Items</p>
                        {orderItems[order.id] ? (
                          <div className="space-y-2">
                            {orderItems[order.id].map((item: any) => (
                              <div key={item.id} className="flex items-center gap-3">
                                {item.image_url && <img src={item.image_url} alt="" className="w-10 h-10 rounded object-cover" />}
                                <div className="flex-1">
                                  <p className="text-sm text-stone-900">{item.product_description}</p>
                                  <p className="text-xs text-stone-400">{item.size} × {item.quantity}</p>
                                </div>
                                <p className="text-sm text-stone-900">{fmt(item.selling_price * item.quantity)}</p>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-xs text-stone-400">Loading items...</p>
                        )}
                      </div>

                      {/* Details + Actions */}
                      <div>
                        <p className="text-xs tracking-[0.1em] uppercase text-stone-400 font-medium mb-3">Details</p>
                        <div className="space-y-2 text-sm mb-6">
                          <div className="flex justify-between"><span className="text-stone-400">Subtotal</span><span>{fmt(order.order_amount)}</span></div>
                          <div className="flex justify-between"><span className="text-stone-400">Delivery</span><span>{fmt(order.delivery_cost)}</span></div>
                          <div className="flex justify-between font-medium"><span>Total</span><span>{fmt(order.total_amount)}</span></div>
                          {order.payment_reference_no && <div className="flex justify-between"><span className="text-stone-400">Payment ID</span><span className="text-xs font-mono">{order.payment_reference_no}</span></div>}
                          {order.shipping_address && <div className="mt-3"><span className="text-stone-400 block mb-1">Shipping Address</span><span className="text-xs text-stone-700">{order.shipping_address}</span></div>}
                        </div>

                        <p className="text-xs tracking-[0.1em] uppercase text-stone-400 font-medium mb-2">Update Status</p>
                        <div className="flex flex-wrap gap-2">
                          {STATUSES.map(s => (
                            <button
                              key={s.value}
                              onClick={() => updateStatus(order.id, s.value)}
                              className={`text-[10px] tracking-[0.05em] uppercase px-3 py-1.5 rounded border transition-colors ${
                                order.status === s.value
                                  ? "bg-stone-900 text-white border-stone-900"
                                  : "border-stone-200 text-stone-500 hover:border-stone-400"
                              }`}
                            >
                              {s.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
