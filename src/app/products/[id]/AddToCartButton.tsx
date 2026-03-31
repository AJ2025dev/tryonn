"use client";
import { useState } from "react";

type Variant = { id: number; size: string; price: number; discount: number; discount_type: number; stock: number };

function fmt(n: number) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);
}

export default function AddToCartButton({ productId, productName, variants, firstImage, accent }: { productId: number; productName: string; variants: Variant[]; firstImage: string; accent: string }) {
  const [sel, setSel] = useState<Variant>(variants[0]);
  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState(false);

  if (!sel) return <p className="text-sm text-stone-400" style={{ fontFamily: "'Outfit', sans-serif" }}>No sizes available</p>;

  const finalPrice = sel.discount_type === 1 ? sel.price * (1 - sel.discount / 100) : sel.discount_type === 2 ? sel.price - sel.discount : sel.price;
  const hasDisc = sel.discount > 0;

  function add() {
    const cart = JSON.parse(localStorage.getItem("appify-cart") || "[]");
    const ex = cart.find((i: any) => i.productId === productId && i.variantId === sel.id);
    if (ex) { ex.quantity += qty; } else { cart.push({ productId, variantId: sel.id, name: productName, size: sel.size, price: finalPrice, image: firstImage, quantity: qty }); }
    localStorage.setItem("appify-cart", JSON.stringify(cart));
    setAdded(true);
    setTimeout(() => setAdded(false), 2500);
  }

  return (
    <div style={{ fontFamily: "'Outfit', sans-serif" }}>
      {/* Price */}
      <div className="flex items-baseline gap-3 mb-8">
        <span className="text-2xl font-medium text-stone-900" style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: "32px" }}>{fmt(finalPrice)}</span>
        {hasDisc && (
          <>
            <span className="text-base text-stone-400 line-through">{fmt(sel.price)}</span>
            <span className="text-[10px] tracking-[0.15em] uppercase px-2.5 py-1 text-white" style={{ backgroundColor: accent }}>
              {sel.discount_type === 1 ? `${sel.discount}% off` : `₹${sel.discount} off`}
            </span>
          </>
        )}
      </div>

      {/* Size selector */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs tracking-[0.15em] uppercase text-stone-900 font-medium">
            Size
          </p>
          <p className="text-xs text-stone-400">
            Selected: <span className="text-stone-700">{sel.size}</span>
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {variants.map(v => (
            <button
              key={v.id}
              onClick={() => { setSel(v); setQty(1); }}
              disabled={v.stock === 0}
              className={`min-w-[52px] h-[44px] px-4 border text-xs tracking-[0.1em] uppercase transition-all duration-200 ${
                sel.id === v.id
                  ? "border-stone-900 bg-stone-900 text-white"
                  : v.stock === 0
                  ? "border-stone-200 text-stone-300 cursor-not-allowed line-through"
                  : "border-stone-300 text-stone-700 hover:border-stone-900"
              }`}
            >
              {v.size}
            </button>
          ))}
        </div>
      </div>

      {/* Stock */}
      <div className="mb-6">
        {sel.stock > 5 ? (
          <p className="text-xs text-stone-400">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-green-500 mr-2" />
            In Stock
          </p>
        ) : sel.stock > 0 ? (
          <p className="text-xs" style={{ color: accent }}>
            <span className="inline-block w-1.5 h-1.5 rounded-full mr-2" style={{ backgroundColor: accent }} />
            Only {sel.stock} left — order soon
          </p>
        ) : (
          <p className="text-xs text-stone-400">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-stone-300 mr-2" />
            Currently unavailable
          </p>
        )}
      </div>

      {/* Quantity + Add to Cart row */}
      {sel.stock > 0 && (
        <div className="flex gap-3">
          {/* Quantity */}
          <div className="flex items-center border border-stone-300">
            <button
              onClick={() => setQty(Math.max(1, qty - 1))}
              className="w-11 h-12 flex items-center justify-center text-stone-600 hover:bg-stone-50 transition-colors text-lg"
            >
              −
            </button>
            <span className="w-12 text-center text-sm font-medium text-stone-900 border-x border-stone-300 h-12 flex items-center justify-center">
              {qty}
            </span>
            <button
              onClick={() => setQty(Math.min(sel.stock, qty + 1))}
              className="w-11 h-12 flex items-center justify-center text-stone-600 hover:bg-stone-50 transition-colors text-lg"
            >
              +
            </button>
          </div>

          {/* Add to Cart button */}
          <button
            onClick={add}
            disabled={sel.stock === 0}
            className="flex-1 h-12 text-xs tracking-[0.2em] uppercase text-white transition-all duration-300 hover:opacity-90 active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ backgroundColor: added ? "#4A7C59" : accent }}
          >
            {added ? "✓  Added to Bag" : `Add to Bag — ${fmt(finalPrice * qty)}`}
          </button>
        </div>
      )}

      {sel.stock === 0 && (
        <button disabled className="w-full h-12 text-xs tracking-[0.2em] uppercase bg-stone-200 text-stone-400 cursor-not-allowed">
          Currently Unavailable
        </button>
      )}

      {/* Wishlist link */}
      <button className="mt-4 flex items-center gap-2 text-xs text-stone-400 hover:text-stone-700 transition-colors">
        <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" /></svg>
        Add to Wishlist
      </button>
    </div>
  );
}
