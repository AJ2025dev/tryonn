"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { createClient } from "@supabase/supabase-js";

type CartItem = { productId: number; variantId: number; name: string; size: string; price: number; image: string; quantity: number };

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function CheckoutPage() {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [placing, setPlacing] = useState(false);
  const [orderId, setOrderId] = useState<number | null>(null);
  const [orderNo, setOrderNo] = useState("");
  const [error, setError] = useState("");

  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    phone: "",
    houseNo: "",
    address1: "",
    address2: "",
    landmark: "",
    city: "",
    state: "",
    pincode: "",
    paymentMethod: "cod" as "cod" | "online",
  });

  useEffect(() => {
    setCart(JSON.parse(localStorage.getItem("appify-cart") || "[]"));
    setLoaded(true);
  }, []);

  function fmt(n: number) {
    return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);
  }

  function updateField(field: string, value: string) {
    setForm(prev => ({ ...prev, [field]: value }));
  }

  const subtotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const deliveryFee = subtotal >= 999 ? 0 : 50;
  const total = subtotal + deliveryFee;
  const itemCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  function generateOrderNo() {
    const d = new Date();
    const date = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
    const rand = String(Math.floor(Math.random() * 10000)).padStart(4, "0");
    return `APP-${date}-${rand}`;
  }

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

  async function placeOrder() {
    const err = validate();
    if (err) { setError(err); return; }
    setError("");
    setPlacing(true);

    try {
      const merchantId = Number(process.env.NEXT_PUBLIC_DEFAULT_MERCHANT_ID || "1");
      const oNo = generateOrderNo();

      // 1. Save address
      const { data: addr, error: addrErr } = await supabase.from("addresses").insert({
        link_id: merchantId,
        link_type: "customer",
        house_no: form.houseNo,
        address1: form.address1,
        address2: form.address2,
        landmark: form.landmark,
        city: form.city,
        state: form.state,
        country: "India",
        zip_code: form.pincode,
        is_default: true,
        is_active: true,
      }).select("id").single();

      if (addrErr) throw new Error("Failed to save address: " + addrErr.message);

      // 2. Create order
      const { data: order, error: orderErr } = await supabase.from("orders").insert({
        merchant_id: merchantId,
        order_no: oNo,
        order_date: new Date().toISOString(),
        order_placed_date: new Date().toISOString(),
        status: 1,
        status_description: "Placed",
        order_amount: subtotal,
        discount_amount: 0,
        tax_amount: 0,
        delivery_cost: deliveryFee,
        total_amount: total,
        address_id: addr.id,
        shipping_address: `${form.houseNo}, ${form.address1}, ${form.address2}, ${form.city}, ${form.state} - ${form.pincode}`,
        payment_type: form.paymentMethod === "cod" ? 1 : 2,
        payment_reference_no: "",
        first_name: form.firstName,
        last_name: form.lastName,
        delivery_channel: 1,
        delivery_channel_description: "Standard",
      }).select("id").single();

      if (orderErr) throw new Error("Failed to create order: " + orderErr.message);

      // 3. Create order items
      const items = cart.map(item => ({
        order_id: order.id,
        product_id: item.productId,
        variant_id: item.variantId,
        product_description: item.name,
        size: item.size,
        quantity: item.quantity,
        unit_price: item.price,
        selling_price: item.price,
        image_url: item.image,
      }));

      const { error: itemsErr } = await supabase.from("order_items").insert(items);
      if (itemsErr) throw new Error("Failed to save order items: " + itemsErr.message);

      // 4. Clear cart and show success
      localStorage.removeItem("appify-cart");
      setCart([]);
      setOrderId(order.id);
      setOrderNo(oNo);
    } catch (e: any) {
      setError(e.message || "Something went wrong");
    }
    setPlacing(false);
  }

  if (!loaded) return <div className="min-h-screen flex items-center justify-center"><p className="text-gray-400">Loading...</p></div>;

  // Order success screen
  if (orderId) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="bg-white rounded-2xl p-8 max-w-md w-full text-center shadow-sm">
          <div className="text-6xl mb-4">✅</div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Order Placed!</h1>
          <p className="text-gray-500 mb-4">Thank you for your purchase</p>
          <div className="bg-gray-50 rounded-xl p-4 mb-6 text-left">
            <div className="flex justify-between text-sm mb-2"><span className="text-gray-500">Order Number</span><span className="font-bold text-gray-900">{orderNo}</span></div>
            <div className="flex justify-between text-sm mb-2"><span className="text-gray-500">Total Paid</span><span className="font-bold text-gray-900">{fmt(total)}</span></div>
            <div className="flex justify-between text-sm mb-2"><span className="text-gray-500">Payment</span><span className="font-semibold">{form.paymentMethod === "cod" ? "Cash on Delivery" : "Online Payment"}</span></div>
            <div className="flex justify-between text-sm"><span className="text-gray-500">Delivery To</span><span className="font-semibold text-right max-w-[200px]">{form.city}, {form.state} - {form.pincode}</span></div>
          </div>
          <Link href="/" className="inline-block w-full py-3 bg-gray-900 text-white rounded-xl font-bold hover:bg-gray-800">Continue Shopping</Link>
        </div>
      </div>
    );
  }

  // Empty cart
  if (cart.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-5xl mb-4">🛒</p>
          <h1 className="text-xl font-bold mb-2">Nothing to checkout</h1>
          <p className="text-gray-500 mb-6">Add some products first</p>
          <Link href="/" className="px-6 py-3 bg-gray-900 text-white rounded-xl font-semibold">Go Shopping</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="sticky top-0 z-50 bg-white border-b shadow-sm">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link href="/cart" className="text-lg font-bold text-gray-900">← Back to Cart</Link>
          <span className="text-sm text-gray-500">Checkout</span>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Checkout</h1>

        {error && <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">{error}</div>}

        <div className="grid md:grid-cols-3 gap-6">
          {/* Form */}
          <div className="md:col-span-2 space-y-6">
            {/* Contact */}
            <div className="bg-white rounded-xl p-6">
              <h2 className="text-lg font-bold text-gray-900 mb-4">Contact Details</h2>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">First Name *</label>
                  <input value={form.firstName} onChange={e => updateField("firstName", e.target.value)} className="w-full px-4 py-2 border rounded-lg text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-gray-300" placeholder="John" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Last Name</label>
                  <input value={form.lastName} onChange={e => updateField("lastName", e.target.value)} className="w-full px-4 py-2 border rounded-lg text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-gray-300" placeholder="Doe" />
                </div>
              </div>
              <div className="mt-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number *</label>
                <input value={form.phone} onChange={e => updateField("phone", e.target.value.replace(/\D/g, "").slice(0, 10))} className="w-full px-4 py-2 border rounded-lg text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-gray-300" placeholder="9876543210" />
              </div>
            </div>

            {/* Address */}
            <div className="bg-white rounded-xl p-6">
              <h2 className="text-lg font-bold text-gray-900 mb-4">Delivery Address</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">House / Flat No *</label>
                  <input value={form.houseNo} onChange={e => updateField("houseNo", e.target.value)} className="w-full px-4 py-2 border rounded-lg text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-gray-300" placeholder="Flat 401, Tower B" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Address Line 1 *</label>
                  <input value={form.address1} onChange={e => updateField("address1", e.target.value)} className="w-full px-4 py-2 border rounded-lg text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-gray-300" placeholder="Street name, Area" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Address Line 2</label>
                  <input value={form.address2} onChange={e => updateField("address2", e.target.value)} className="w-full px-4 py-2 border rounded-lg text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-gray-300" placeholder="Colony, Locality" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Landmark</label>
                  <input value={form.landmark} onChange={e => updateField("landmark", e.target.value)} className="w-full px-4 py-2 border rounded-lg text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-gray-300" placeholder="Near Metro Station" />
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">City *</label>
                    <input value={form.city} onChange={e => updateField("city", e.target.value)} className="w-full px-4 py-2 border rounded-lg text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-gray-300" placeholder="Hyderabad" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">State *</label>
                    <input value={form.state} onChange={e => updateField("state", e.target.value)} className="w-full px-4 py-2 border rounded-lg text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-gray-300" placeholder="Telangana" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Pincode *</label>
                    <input value={form.pincode} onChange={e => updateField("pincode", e.target.value.replace(/\D/g, "").slice(0, 6))} className="w-full px-4 py-2 border rounded-lg text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-gray-300" placeholder="500081" />
                  </div>
                </div>
              </div>
            </div>

            {/* Payment */}
            <div className="bg-white rounded-xl p-6">
              <h2 className="text-lg font-bold text-gray-900 mb-4">Payment Method</h2>
              <div className="space-y-3">
                <label className={`flex items-center gap-3 p-4 rounded-xl border-2 cursor-pointer transition-colors ${form.paymentMethod === "cod" ? "border-gray-900 bg-gray-50" : "border-gray-200"}`}>
                  <input type="radio" name="payment" checked={form.paymentMethod === "cod"} onChange={() => updateField("paymentMethod", "cod")} className="w-4 h-4" />
                  <div>
                    <p className="font-semibold text-gray-900">Cash on Delivery</p>
                    <p className="text-xs text-gray-500">Pay when your order arrives</p>
                  </div>
                </label>
                <label className={`flex items-center gap-3 p-4 rounded-xl border-2 cursor-pointer transition-colors ${form.paymentMethod === "online" ? "border-gray-900 bg-gray-50" : "border-gray-200"}`}>
                  <input type="radio" name="payment" checked={form.paymentMethod === "online"} onChange={() => updateField("paymentMethod", "online")} className="w-4 h-4" />
                  <div>
                    <p className="font-semibold text-gray-900">Pay Online (Razorpay)</p>
                    <p className="text-xs text-gray-500">UPI, Cards, Net Banking, Wallets — coming soon</p>
                  </div>
                </label>
              </div>
            </div>
          </div>

          {/* Order Summary */}
          <div className="bg-white rounded-xl p-6 h-fit sticky top-20">
            <h2 className="text-lg font-bold text-gray-900 mb-4">Order Summary</h2>
            <div className="space-y-3 mb-4">
              {cart.map(item => (
                <div key={item.variantId} className="flex gap-3 items-center">
                  <img src={item.image || "https://placehold.co/48x48/eee/999"} alt="" className="w-12 h-12 rounded-lg object-cover" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{item.name}</p>
                    <p className="text-xs text-gray-400">{item.size} × {item.quantity}</p>
                  </div>
                  <p className="text-sm font-semibold">{fmt(item.price * item.quantity)}</p>
                </div>
              ))}
            </div>
            <div className="border-t pt-4 space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-gray-500">Subtotal ({itemCount} items)</span><span>{fmt(subtotal)}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Delivery</span><span className={deliveryFee === 0 ? "text-green-600 font-semibold" : ""}>{deliveryFee === 0 ? "FREE" : fmt(deliveryFee)}</span></div>
              <div className="border-t pt-2 flex justify-between font-bold text-lg"><span>Total</span><span>{fmt(total)}</span></div>
            </div>

            <button
              onClick={placeOrder}
              disabled={placing || form.paymentMethod === "online"}
              className="mt-6 w-full py-3 bg-gray-900 text-white rounded-xl font-bold hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {placing ? "Placing Order..." : form.paymentMethod === "online" ? "Online Payment Coming Soon" : `Place Order — ${fmt(total)}`}
            </button>

            {form.paymentMethod === "cod" && (
              <p className="text-xs text-gray-400 text-center mt-3">You will pay {fmt(total)} at delivery</p>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
