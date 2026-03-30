"use client";
import { useState, useEffect } from "react";
import Link from "next/link";

type CartItem = { productId: number; variantId: number; name: string; size: string; price: number; image: string; quantity: number };

export default function CartPage() {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setCart(JSON.parse(localStorage.getItem("appify-cart") || "[]"));
    setLoaded(true);
  }, []);

  function updateQty(variantId: number, delta: number) {
    setCart(prev => {
      const updated = prev.map(item => {
        if (item.variantId === variantId) {
          const newQty = item.quantity + delta;
          return newQty <= 0 ? null : { ...item, quantity: newQty };
        }
        return item;
      }).filter(Boolean) as CartItem[];
      localStorage.setItem("appify-cart", JSON.stringify(updated));
      return updated;
    });
  }

  function removeItem(variantId: number) {
    setCart(prev => {
      const updated = prev.filter(item => item.variantId !== variantId);
      localStorage.setItem("appify-cart", JSON.stringify(updated));
      return updated;
    });
  }

  function clearCart() {
    localStorage.removeItem("appify-cart");
    setCart([]);
  }

  function fmt(n: number) { return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n); }

  const subtotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const itemCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  if (!loaded) return <div className="min-h-screen flex items-center justify-center"><p className="text-gray-400">Loading cart...</p></div>;

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="sticky top-0 z-50 bg-white border-b shadow-sm">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link href="/" className="text-xl font-bold text-gray-900">← Back to Store</Link>
          <span className="text-sm text-gray-500">{itemCount} item{itemCount !== 1 ? "s" : ""} in cart</span>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Your Cart</h1>

        {cart.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-2xl">
            <p className="text-5xl mb-4">🛒</p>
            <h2 className="text-xl font-bold text-gray-900 mb-2">Your cart is empty</h2>
            <p className="text-gray-500 mb-6">Looks like you haven't added anything yet.</p>
            <Link href="/" className="inline-block px-6 py-3 bg-gray-900 text-white rounded-xl font-semibold hover:bg-gray-800">Continue Shopping</Link>
          </div>
        ) : (
          <div className="grid md:grid-cols-3 gap-6">
            {/* Cart Items */}
            <div className="md:col-span-2 space-y-4">
              {cart.map(item => (
                <div key={item.variantId} className="bg-white rounded-xl p-4 flex gap-4 items-center">
                  <Link href={`/products/${item.productId}`}>
                    <img src={item.image || "https://placehold.co/100x100/eee/999?text=..."} alt={item.name} className="w-24 h-24 rounded-lg object-cover flex-shrink-0" />
                  </Link>
                  <div className="flex-1 min-w-0">
                    <Link href={`/products/${item.productId}`} className="font-semibold text-gray-900 hover:underline block truncate">{item.name}</Link>
                    <p className="text-sm text-gray-400 mt-1">Size: {item.size}</p>
                    <p className="font-bold text-gray-900 mt-1">{fmt(item.price)}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={() => updateQty(item.variantId, -1)} className="w-8 h-8 rounded-lg border text-gray-600 hover:bg-gray-50 flex items-center justify-center">-</button>
                    <span className="w-10 text-center font-semibold">{item.quantity}</span>
                    <button onClick={() => updateQty(item.variantId, 1)} className="w-8 h-8 rounded-lg border text-gray-600 hover:bg-gray-50 flex items-center justify-center">+</button>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-gray-900">{fmt(item.price * item.quantity)}</p>
                    <button onClick={() => removeItem(item.variantId)} className="text-xs text-red-500 hover:text-red-700 mt-1">Remove</button>
                  </div>
                </div>
              ))}
              <button onClick={clearCart} className="text-sm text-gray-400 hover:text-red-500">Clear entire cart</button>
            </div>

            {/* Order Summary */}
            <div className="bg-white rounded-xl p-6 h-fit sticky top-20">
              <h2 className="text-lg font-bold text-gray-900 mb-4">Order Summary</h2>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between"><span className="text-gray-500">Subtotal ({itemCount} items)</span><span className="font-semibold">{fmt(subtotal)}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Delivery</span><span className="text-green-600 font-semibold">{subtotal >= 999 ? "FREE" : fmt(50)}</span></div>
                <div className="border-t pt-3 flex justify-between"><span className="font-bold text-gray-900">Total</span><span className="font-bold text-lg text-gray-900">{fmt(subtotal + (subtotal >= 999 ? 0 : 50))}</span></div>
              </div>
              {subtotal < 999 && <p className="text-xs text-gray-400 mt-2">Add {fmt(999 - subtotal)} more for free delivery</p>}
              <Link href="/checkout" className="block mt-6 w-full py-3 bg-gray-900 text-white text-center rounded-xl font-bold hover:bg-gray-800 transition-colors">Proceed to Checkout</Link>
              <Link href="/" className="block mt-3 text-center text-sm text-gray-500 hover:text-gray-700">Continue Shopping</Link>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
