"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import Script from "next/script";
import { createClient } from "@supabase/supabase-js";
import { getMerchantIdClient } from "@/lib/merchant-client";

type CartItem = { productId: number; variantId: number; name: string; size: string; price: number; image: string; quantity: number };

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
function fmt(n: number) { return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n); }

declare global { interface Window { Razorpay: any; } }

export default function CheckoutPage() {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [placing, setPlacing] = useState(false);
  const [orderId, setOrderId] = useState<number | null>(null);
  const [orderNo, setOrderNo] = useState("");
  const [error, setError] = useState("");
  const [form, setForm] = useState({ firstName: "", lastName: "", phone: "", houseNo: "", address1: "", address2: "", landmark: "", city: "", state: "", pincode: "", paymentMethod: "cod" as "cod" | "online" });

  useEffect(() => { setCart(JSON.parse(localStorage.getItem("appify-cart") || "[]")); setLoaded(true); }, []);

  function updateField(field: string, value: string) { setForm(prev => ({ ...prev, [field]: value })); }

  const subtotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const deliveryFee = subtotal >= 999 ? 0 : 50;
  const total = subtotal + deliveryFee;
  const itemCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  function validate() {
    if (!form.firstName.trim()) return "First name is required";
    if (!form.phone.trim() || form.phone.length !== 10) return "Valid 10-digit phone number required";
    if (!form.houseNo.trim()) return "House/Flat number required";
    if (!form.address1.trim()) return "Address line 1 required";
    if (!form.city.trim()) return "City is required";
    if (!form.state.trim()) return "State is required";
    if (!form.pincode.trim() || form.pincode.length !== 6) return "Valid 6-digit pincode required";
    return null;
  }

  function generateOrderNo() {
    const d = new Date();
    return `APP-${d.getFullYear()}${String(d.getMonth()+1).padStart(2,"0")}${String(d.getDate()).padStart(2,"0")}-${String(Math.floor(Math.random()*10000)).padStart(4,"0")}`;
  }

  async function saveOrder(paymentRef: string = "", status: number = 1, statusDesc: string = "Placed") {
    const merchantId = getMerchantIdClient();
    const oNo = generateOrderNo();
    const { data: addr, error: addrErr } = await supabase.from("addresses").insert({ link_id: merchantId, link_type: "customer", house_no: form.houseNo, address1: form.address1, address2: form.address2, landmark: form.landmark, city: form.city, state: form.state, country: "India", zip_code: form.pincode, is_default: true, is_active: true }).select("id").single();
    if (addrErr) throw new Error("Failed to save address: " + addrErr.message);
    const { data: order, error: orderErr } = await supabase.from("orders").insert({ merchant_id: merchantId, order_no: oNo, order_date: new Date().toISOString(), order_placed_date: new Date().toISOString(), status, status_description: statusDesc, order_amount: subtotal, discount_amount: 0, tax_amount: 0, delivery_cost: deliveryFee, total_amount: total, address_id: addr.id, shipping_address: `${form.houseNo}, ${form.address1}, ${form.address2}, ${form.city}, ${form.state} - ${form.pincode}`, payment_type: form.paymentMethod === "cod" ? 1 : 2, payment_reference_no: paymentRef, first_name: form.firstName, last_name: form.lastName, delivery_channel: 1, delivery_channel_description: "Standard" }).select("id").single();
    if (orderErr) throw new Error("Failed to create order: " + orderErr.message);
    const items = cart.map(item => ({ order_id: order.id, product_id: item.productId, variant_id: item.variantId, product_description: item.name, size: item.size, quantity: item.quantity, unit_price: item.price, selling_price: item.price, image_url: item.image }));
    const { error: itemsErr } = await supabase.from("order_items").insert(items);
    if (itemsErr) throw new Error("Failed to save items: " + itemsErr.message);
    return { orderId: order.id, orderNo: oNo };
  }

  async function handleCOD() {
    setPlacing(true); setError("");
    try { const result = await saveOrder("", 1, "Placed"); localStorage.removeItem("appify-cart"); setCart([]); setOrderId(result.orderId); setOrderNo(result.orderNo); } catch (e: any) { setError(e.message); }
    setPlacing(false);
  }

  async function handleRazorpay() {
    const err = validate(); if (err) { setError(err); return; }
    setError(""); setPlacing(true);
    try {
      const res = await fetch("/api/razorpay/create-order", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ amount: total, receipt: `order_${Date.now()}` }) });
      const data = await res.json(); if (data.error) throw new Error(data.error);
      const options = {
        key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID, amount: data.amount, currency: data.currency, name: "Appify Store", description: `Order - ${itemCount} item${itemCount > 1 ? "s" : ""}`, order_id: data.orderId,
        handler: async function (response: any) {
          try {
            const result = await saveOrder(response.razorpay_payment_id, 2, "Payment Confirmed");
            await fetch("/api/razorpay/verify-payment", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ razorpay_payment_id: response.razorpay_payment_id, razorpay_order_id: response.razorpay_order_id, razorpay_signature: response.razorpay_signature, order_id: result.orderId }) });
            localStorage.removeItem("appify-cart"); setCart([]); setOrderId(result.orderId); setOrderNo(result.orderNo);
          } catch (e: any) { setError("Payment received but order save failed. Contact support."); }
          setPlacing(false);
        },
        prefill: { name: `${form.firstName} ${form.lastName}`.trim(), contact: form.phone },
        theme: { color: "#1C1917" },
        modal: { ondismiss: function () { setPlacing(false); } },
      };
      const rzp = new window.Razorpay(options);
      rzp.on("payment.failed", function (response: any) { setError(`Payment failed: ${response.error.description}`); setPlacing(false); });
      rzp.open();
    } catch (e: any) { setError(e.message || "Payment initiation failed"); setPlacing(false); }
  }

  async function placeOrder() { const err = validate(); if (err) { setError(err); return; } if (form.paymentMethod === "cod") handleCOD(); else handleRazorpay(); }

  const inputClass = "w-full px-4 py-3 border border-stone-200 text-sm text-stone-900 bg-white placeholder:text-stone-400 focus:outline-none focus:border-stone-500 transition-colors";

  if (!loaded) return <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: "#FDFCFA" }}><p className="text-stone-400 text-sm">Loading...</p></div>;

  if (orderId) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6" style={{ backgroundColor: "#FDFCFA" }}>
        <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,500;0,600;0,700;1,400&family=Outfit:wght@300;400;500;600&display=swap" rel="stylesheet" />
        <div className="max-w-md w-full text-center">
          <div className="w-16 h-16 rounded-full border-2 border-green-700 flex items-center justify-center mx-auto mb-6"><svg xmlns="http://www.w3.org/2000/svg" className="w-8 h-8 text-green-700" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg></div>
          <h1 className="text-3xl font-light text-stone-900 mb-2" style={{ fontFamily: "'Cormorant Garamond', serif" }}>Thank You</h1>
          <p className="text-sm text-stone-400 mb-8" style={{ fontFamily: "'Outfit', sans-serif" }}>Your order has been placed successfully</p>
          <div className="border border-stone-200 p-6 text-left mb-8" style={{ fontFamily: "'Outfit', sans-serif" }}>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between"><span className="text-stone-400">Order Number</span><span className="text-stone-900 font-medium">{orderNo}</span></div>
              <div className="flex justify-between"><span className="text-stone-400">Total</span><span className="text-stone-900 font-medium">{fmt(total)}</span></div>
              <div className="flex justify-between"><span className="text-stone-400">Payment</span><span className="text-stone-900">{form.paymentMethod === "cod" ? "Cash on Delivery" : "Paid Online"}</span></div>
              <div className="flex justify-between"><span className="text-stone-400">Delivery To</span><span className="text-stone-900 text-right max-w-[200px]">{form.city}, {form.state}</span></div>
            </div>
          </div>
          <Link href="/" className="inline-block w-full py-3.5 text-xs tracking-[0.2em] uppercase bg-stone-900 text-white hover:bg-stone-800 transition-colors" style={{ fontFamily: "'Outfit', sans-serif" }}>Continue Shopping</Link>
        </div>
      </div>
    );
  }

  if (cart.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: "#FDFCFA" }}>
        <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@300;400;500&family=Outfit:wght@300;400;500&display=swap" rel="stylesheet" />
        <div className="text-center">
          <h1 className="text-3xl font-light text-stone-900 mb-3" style={{ fontFamily: "'Cormorant Garamond', serif" }}>Nothing to checkout</h1>
          <p className="text-sm text-stone-400 mb-6" style={{ fontFamily: "'Outfit', sans-serif" }}>Add some items to your bag first</p>
          <Link href="/" className="inline-block px-8 py-3 text-xs tracking-[0.2em] uppercase border border-stone-900 text-stone-900 hover:bg-stone-900 hover:text-white transition-all" style={{ fontFamily: "'Outfit', sans-serif" }}>Explore Collection</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: "#FDFCFA" }}>
      <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,500;0,600;0,700;1,400&family=Outfit:wght@300;400;500;600&display=swap" rel="stylesheet" />
      <Script src="https://checkout.razorpay.com/v1/checkout.js" strategy="lazyOnload" />
      <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-sm border-b border-stone-100"><div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between"><Link href="/cart" className="text-2xl font-light tracking-wide text-stone-900" style={{ fontFamily: "'Cormorant Garamond', serif" }}>Checkout</Link><Link href="/cart" className="text-xs tracking-[0.1em] uppercase text-stone-400 hover:text-stone-900 transition-colors" style={{ fontFamily: "'Outfit', sans-serif" }}>Back to Bag</Link></div></header>
      <main className="max-w-7xl mx-auto px-6 py-10" style={{ fontFamily: "'Outfit', sans-serif" }}>
        {error && <div className="mb-8 p-4 border border-red-200 text-sm text-red-700 bg-red-50/50">{error}</div>}
        <div className="grid md:grid-cols-3 gap-12">
          <div className="md:col-span-2 space-y-10">
            <div><h2 className="text-xs tracking-[0.2em] uppercase text-stone-900 font-medium mb-5">Contact Details</h2><div className="grid grid-cols-2 gap-4"><div><label className="block text-xs text-stone-500 mb-1.5">First Name *</label><input value={form.firstName} onChange={e => updateField("firstName", e.target.value)} className={inputClass} placeholder="John" /></div><div><label className="block text-xs text-stone-500 mb-1.5">Last Name</label><input value={form.lastName} onChange={e => updateField("lastName", e.target.value)} className={inputClass} placeholder="Doe" /></div></div><div className="mt-4"><label className="block text-xs text-stone-500 mb-1.5">Phone Number *</label><input value={form.phone} onChange={e => updateField("phone", e.target.value.replace(/\D/g, "").slice(0, 10))} className={inputClass} placeholder="9876543210" /></div></div>
            <div><h2 className="text-xs tracking-[0.2em] uppercase text-stone-900 font-medium mb-5">Delivery Address</h2><div className="space-y-4"><div><label className="block text-xs text-stone-500 mb-1.5">House / Flat No *</label><input value={form.houseNo} onChange={e => updateField("houseNo", e.target.value)} className={inputClass} placeholder="Flat 401" /></div><div><label className="block text-xs text-stone-500 mb-1.5">Address Line 1 *</label><input value={form.address1} onChange={e => updateField("address1", e.target.value)} className={inputClass} placeholder="Street name" /></div><div><label className="block text-xs text-stone-500 mb-1.5">Address Line 2</label><input value={form.address2} onChange={e => updateField("address2", e.target.value)} className={inputClass} placeholder="Colony" /></div><div><label className="block text-xs text-stone-500 mb-1.5">Landmark</label><input value={form.landmark} onChange={e => updateField("landmark", e.target.value)} className={inputClass} placeholder="Near Metro" /></div><div className="grid grid-cols-3 gap-4"><div><label className="block text-xs text-stone-500 mb-1.5">City *</label><input value={form.city} onChange={e => updateField("city", e.target.value)} className={inputClass} placeholder="Hyderabad" /></div><div><label className="block text-xs text-stone-500 mb-1.5">State *</label><input value={form.state} onChange={e => updateField("state", e.target.value)} className={inputClass} placeholder="Telangana" /></div><div><label className="block text-xs text-stone-500 mb-1.5">Pincode *</label><input value={form.pincode} onChange={e => updateField("pincode", e.target.value.replace(/\D/g, "").slice(0, 6))} className={inputClass} placeholder="500081" /></div></div></div></div>
            <div><h2 className="text-xs tracking-[0.2em] uppercase text-stone-900 font-medium mb-5">Payment Method</h2><div className="space-y-3"><label className={`flex items-center gap-4 p-4 border cursor-pointer transition-all ${form.paymentMethod === "cod" ? "border-stone-900 bg-stone-50/50" : "border-stone-200 hover:border-stone-400"}`}><input type="radio" name="payment" checked={form.paymentMethod === "cod"} onChange={() => updateField("paymentMethod", "cod")} className="w-4 h-4 accent-stone-900" /><div><p className="text-sm text-stone-900">Cash on Delivery</p><p className="text-[11px] text-stone-400">Pay when your order arrives</p></div></label><label className={`flex items-center gap-4 p-4 border cursor-pointer transition-all ${form.paymentMethod === "online" ? "border-stone-900 bg-stone-50/50" : "border-stone-200 hover:border-stone-400"}`}><input type="radio" name="payment" checked={form.paymentMethod === "online"} onChange={() => updateField("paymentMethod", "online")} className="w-4 h-4 accent-stone-900" /><div><p className="text-sm text-stone-900">Pay Online</p><p className="text-[11px] text-stone-400">UPI, Cards, Net Banking via Razorpay</p></div></label></div></div>
          </div>
          <div className="md:sticky md:top-24 h-fit"><div className="border border-stone-200 p-8"><h2 className="text-xs tracking-[0.2em] uppercase text-stone-900 font-medium mb-6">Your Order</h2><div className="space-y-4 mb-6">{cart.map(item => (<div key={item.variantId} className="flex gap-3 items-center"><div className="w-14 h-18 flex-shrink-0 overflow-hidden" style={{ backgroundColor: "#F0EBE3" }}><img src={item.image || "https://placehold.co/56x72/F0EBE3/8B6F4E"} alt="" className="w-full h-full object-cover" /></div><div className="flex-1 min-w-0"><p className="text-xs text-stone-900 font-medium truncate">{item.name}</p><p className="text-[11px] text-stone-400">{item.size} × {item.quantity}</p></div><p className="text-xs text-stone-900 font-medium flex-shrink-0">{fmt(item.price * item.quantity)}</p></div>))}</div><div className="border-t border-stone-200 pt-4 space-y-2 text-sm"><div className="flex justify-between text-stone-500"><span>Subtotal</span><span className="text-stone-900">{fmt(subtotal)}</span></div><div className="flex justify-between text-stone-500"><span>Delivery</span><span className={deliveryFee === 0 ? "text-green-700" : "text-stone-900"}>{deliveryFee === 0 ? "Complimentary" : fmt(deliveryFee)}</span></div><div className="border-t border-stone-200 pt-3 flex justify-between"><span className="text-stone-900 font-medium">Total</span><span className="text-stone-900 font-medium text-lg" style={{ fontFamily: "'Cormorant Garamond', serif" }}>{fmt(total)}</span></div></div><button onClick={placeOrder} disabled={placing} className="mt-6 w-full py-3.5 text-xs tracking-[0.2em] uppercase bg-stone-900 text-white hover:bg-stone-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">{placing ? "Processing..." : form.paymentMethod === "online" ? `Pay ${fmt(total)}` : `Place Order — ${fmt(total)}`}</button>{form.paymentMethod === "cod" && <p className="text-[11px] text-stone-400 text-center mt-3">Pay {fmt(total)} at delivery</p>}{form.paymentMethod === "online" && <p className="text-[11px] text-stone-400 text-center mt-3">Secure payment via Razorpay</p>}</div></div>
        </div>
      </main>
    </div>
  );
}
