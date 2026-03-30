"use client";
import { useState } from "react";

type Variant = { id: number; size: string; price: number; discount: number; discount_type: number; stock: number };

export default function AddToCartButton({ productId, productName, variants, firstImage, color }: { productId: number; productName: string; variants: Variant[]; firstImage: string; color: string }) {
  const [sel, setSel] = useState<Variant>(variants[0]);
  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState(false);
  if (!sel) return <p className="text-gray-500">No sizes available</p>;
  const final1 = sel.discount_type === 1 ? sel.price * (1 - sel.discount / 100) : sel.discount_type === 2 ? sel.price - sel.discount : sel.price;
  const disc = sel.discount > 0;
  function fmt(n: number) { return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n); }
  function add() {
    const cart = JSON.parse(localStorage.getItem("appify-cart") || "[]");
    const ex = cart.find((i: any) => i.productId === productId && i.variantId === sel.id);
    if (ex) { ex.quantity += qty; } else { cart.push({ productId, variantId: sel.id, name: productName, size: sel.size, price: final1, image: firstImage, quantity: qty }); }
    localStorage.setItem("appify-cart", JSON.stringify(cart));
    setAdded(true); setTimeout(() => setAdded(false), 2000);
  }
  return (
    <div>
      <div className="flex items-baseline gap-3 mb-6">
        <span className="text-3xl font-bold text-gray-900">{fmt(final1)}</span>
        {disc && <><span className="text-lg text-gray-400 line-through">{fmt(sel.price)}</span><span className="text-sm font-semibold px-2 py-1 rounded-full text-white" style={{ backgroundColor: color }}>{sel.discount_type === 1 ? `${sel.discount}% OFF` : `₹${sel.discount} OFF`}</span></>}
      </div>
      <div className="mb-6">
        <p className="text-sm font-semibold text-gray-700 mb-2">Size: <span className="font-normal text-gray-500">{sel.size}</span></p>
        <div className="flex gap-2 flex-wrap">
          {variants.map(v => <button key={v.id} onClick={() => { setSel(v); setQty(1); }} disabled={v.stock === 0} className={`px-4 py-2 rounded-lg border text-sm font-medium transition-all ${sel.id === v.id ? "text-white border-transparent" : v.stock === 0 ? "border-gray-200 text-gray-300 cursor-not-allowed line-through" : "border-gray-300 text-gray-700 hover:border-gray-500"}`} style={sel.id === v.id ? { backgroundColor: color } : {}}>{v.size}</button>)}
        </div>
      </div>
      <p className={`text-sm mb-4 ${sel.stock > 5 ? "text-green-600" : sel.stock > 0 ? "text-orange-500" : "text-red-500"}`}>{sel.stock > 5 ? "In Stock" : sel.stock > 0 ? `Only ${sel.stock} left!` : "Out of Stock"}</p>
      {sel.stock > 0 && <div className="flex items-center gap-3 mb-6"><span className="text-sm font-semibold text-gray-700">Qty:</span><div className="flex items-center border rounded-lg"><button onClick={() => setQty(Math.max(1, qty - 1))} className="px-3 py-2 text-lg text-gray-600 hover:bg-gray-50">-</button><span className="px-4 py-2 font-semibold border-x">{qty}</span><button onClick={() => setQty(Math.min(sel.stock, qty + 1))} className="px-3 py-2 text-lg text-gray-600 hover:bg-gray-50">+</button></div><span className="text-sm text-gray-400">Total: {fmt(final1 * qty)}</span></div>}
      <button onClick={add} disabled={sel.stock === 0} className="w-full py-3 rounded-xl text-white text-lg font-bold transition-all disabled:opacity-40 hover:opacity-90 active:scale-[0.98]" style={{ backgroundColor: color }}>{added ? "Added to Cart!" : sel.stock === 0 ? "Out of Stock" : `Add to Cart - ${fmt(final1 * qty)}`}</button>
    </div>
  );
}
