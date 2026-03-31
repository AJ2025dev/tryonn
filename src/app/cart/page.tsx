"use client";
import { useState, useEffect } from "react";
import Link from "next/link";

type CartItem = { productId: number; variantId: number; name: string; size: string; price: number; image: string; quantity: number };

function fmt(n: number) { return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n); }

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

  const subtotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const deliveryFee = subtotal >= 999 ? 0 : 50;
  const total = subtotal + deliveryFee;
  const itemCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  if (!loaded) return <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: "#FDFCFA" }}><p className="text-stone-400 text-sm" style={{ fontFamily: "'Outfit', sans-serif" }}>Loading...</p></div>;

  return (
    <div className="min-h-screen" style={{ backgroundColor: "#FDFCFA" }}>
      <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,500;0,600;0,700;1,400&family=Outfit:wght@300;400;500;600&display=swap" rel="stylesheet" />

      <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-sm border-b border-stone-100">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="text-2xl font-light tracking-wide text-stone-900" style={{ fontFamily: "'Cormorant Garamond', serif" }}>Shopping Bag</Link>
          <Link href="/" className="text-xs tracking-[0.1em] uppercase text-stone-400 hover:text-stone-900 transition-colors" style={{ fontFamily: "'Outfit', sans-serif" }}>Continue Shopping</Link>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-10">
        {cart.length === 0 ? (
          <div className="text-center py-24">
            <svg xmlns="http://www.w3.org/2000/svg" className="w-16 h-16 mx-auto mb-6 text-stone-200" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={0.5} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" /></svg>
            <h2 className="text-3xl font-light text-stone-900 mb-3" style={{ fontFamily: "'Cormorant Garamond', serif" }}>Your bag is empty</h2>
            <p className="text-sm text-stone-400 mb-8" style={{ fontFamily: "'Outfit', sans-serif" }}>Discover our collections and find something you love.</p>
            <Link href="/" className="inline-block px-8 py-3 text-xs tracking-[0.2em] uppercase border border-stone-900 text-stone-900 hover:bg-stone-900 hover:text-white transition-all" style={{ fontFamily: "'Outfit', sans-serif" }}>
              Explore Collection
            </Link>
          </div>
        ) : (
          <div className="grid md:grid-cols-3 gap-12">
            {/* Items */}
            <div className="md:col-span-2">
              <p className="text-xs tracking-[0.15em] uppercase text-stone-400 mb-6" style={{ fontFamily: "'Outfit', sans-serif" }}>
                {itemCount} item{itemCount !== 1 ? "s" : ""} in your bag
              </p>
              <div className="space-y-0 divide-y divide-stone-100">
                {cart.map(item => (
                  <div key={item.variantId} className="py-6 flex gap-5">
                    <Link href={`/products/${item.productId}`} className="flex-shrink-0">
                      <div className="w-28 h-36 overflow-hidden" style={{ backgroundColor: "#F0EBE3" }}>
                        <img src={item.image || "https://placehold.co/112x144/F0EBE3/8B6F4E?text=..."} alt={item.name} className="w-full h-full object-cover hover:scale-105 transition-transform duration-500" />
                      </div>
                    </Link>
                    <div className="flex-1 flex flex-col justify-between" style={{ fontFamily: "'Outfit', sans-serif" }}>
                      <div>
                        <Link href={`/products/${item.productId}`} className="text-sm text-stone-900 hover:underline font-medium">{item.name}</Link>
                        <p className="text-xs text-stone-400 mt-1">Size: {item.size}</p>
                      </div>
                      <div className="flex items-center justify-between mt-4">
                        <div className="flex items-center border border-stone-300">
                          <button onClick={() => updateQty(item.variantId, -1)} className="w-8 h-8 flex items-center justify-center text-stone-600 hover:bg-stone-50 text-sm">−</button>
                          <span className="w-8 text-center text-xs font-medium text-stone-900 border-x border-stone-300 h-8 flex items-center justify-center">{item.quantity}</span>
                          <button onClick={() => updateQty(item.variantId, 1)} className="w-8 h-8 flex items-center justify-center text-stone-600 hover:bg-stone-50 text-sm">+</button>
                        </div>
                        <button onClick={() => removeItem(item.variantId)} className="text-xs text-stone-400 hover:text-stone-900 underline transition-colors">Remove</button>
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0" style={{ fontFamily: "'Outfit', sans-serif" }}>
                      <p className="text-sm font-medium text-stone-900">{fmt(item.price * item.quantity)}</p>
                      {item.quantity > 1 && <p className="text-xs text-stone-400 mt-1">{fmt(item.price)} each</p>}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Summary */}
            <div className="md:sticky md:top-24 h-fit" style={{ fontFamily: "'Outfit', sans-serif" }}>
              <div className="border border-stone-200 p-8">
                <h2 className="text-xs tracking-[0.2em] uppercase text-stone-900 font-medium mb-6">Order Summary</h2>
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between text-stone-500"><span>Subtotal</span><span className="text-stone-900">{fmt(subtotal)}</span></div>
                  <div className="flex justify-between text-stone-500"><span>Delivery</span><span className={deliveryFee === 0 ? "text-green-700" : "text-stone-900"}>{deliveryFee === 0 ? "Complimentary" : fmt(deliveryFee)}</span></div>
                  <div className="border-t border-stone-200 pt-3 flex justify-between">
                    <span className="text-stone-900 font-medium">Total</span>
                    <span className="text-stone-900 font-medium text-lg" style={{ fontFamily: "'Cormorant Garamond', serif" }}>{fmt(total)}</span>
                  </div>
                </div>
                {subtotal > 0 && subtotal < 999 && (
                  <p className="text-[11px] text-stone-400 mt-3">Add {fmt(999 - subtotal)} more for complimentary delivery</p>
                )}
                <Link href="/checkout" className="block mt-6 w-full py-3.5 text-center text-xs tracking-[0.2em] uppercase bg-stone-900 text-white hover:bg-stone-800 transition-colors">
                  Proceed to Checkout
                </Link>
                <Link href="/" className="block mt-3 text-center text-xs text-stone-400 hover:text-stone-700 transition-colors">
                  Continue Shopping
                </Link>
              </div>
            </div>
          </div>
        )}
      </main>

      <footer className="border-t border-stone-100 bg-white" style={{ fontFamily: "'Outfit', sans-serif" }}>
        <div className="max-w-7xl mx-auto px-6 py-8 flex items-center justify-between">
          <p className="text-xs text-stone-300">© 2026</p>
          <p className="text-xs text-stone-300">Powered by <span className="text-stone-400">Appify</span></p>
        </div>
      </footer>
    </div>
  );
}
