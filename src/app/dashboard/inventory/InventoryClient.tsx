"use client";
import { useState } from "react";
import { createBrowserClient } from "@supabase/ssr";

function getSupabase() {
  return createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
}

interface Props {
  products: any[];
  merchantId: number;
}

export default function InventoryClient({ products: initialProducts, merchantId }: Props) {
  const [products, setProducts] = useState(initialProducts);
  const [filter, setFilter] = useState("all");

  async function updateStock(variantId: number, newStock: number) {
    const supabase = getSupabase();
    // Verify this variant belongs to a product owned by this merchant
    const { data: variant } = await supabase
      .from("product_variants")
      .select("id, product_id, products!inner(merchant_id)")
      .eq("id", variantId)
      .eq("products.merchant_id", merchantId)
      .single();
    if (!variant) return;
    await supabase.from("product_variants").update({ stock: newStock }).eq("id", variantId);
    setProducts(prev => prev.map(p => ({
      ...p,
      product_variants: p.product_variants.map((v: any) => v.id === variantId ? { ...v, stock: newStock } : v),
    })));
  }

  const allVariants = products.flatMap(p => (p.product_variants || []).map((v: any) => ({ ...v, productName: p.name, productId: p.id, image: p.product_images?.[0]?.image_url })));
  const lowStock = allVariants.filter(v => v.stock > 0 && v.stock <= 10);
  const outOfStock = allVariants.filter(v => v.stock === 0);
  const displayed = filter === "low" ? lowStock : filter === "out" ? outOfStock : allVariants;

  return (
    <div className="p-8">
      <h1 className="text-2xl font-semibold text-stone-900 mb-2">Inventory</h1>
      <p className="text-sm text-stone-400 mb-6">{allVariants.length} variants across {products.length} products</p>

      {(lowStock.length > 0 || outOfStock.length > 0) && (
        <div className="grid grid-cols-2 gap-4 mb-6">
          {lowStock.length > 0 && (
            <div className="bg-orange-50 border border-orange-200 rounded-xl p-4">
              <p className="text-sm font-medium text-orange-800">{lowStock.length} items low on stock</p>
              <p className="text-xs text-orange-600 mt-1">10 units or less remaining</p>
            </div>
          )}
          {outOfStock.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4">
              <p className="text-sm font-medium text-red-800">{outOfStock.length} items out of stock</p>
              <p className="text-xs text-red-600 mt-1">Customers cannot purchase these</p>
            </div>
          )}
        </div>
      )}

      <div className="flex gap-2 mb-6">
        {[
          { id: "all", label: `All (${allVariants.length})` },
          { id: "low", label: `Low Stock (${lowStock.length})` },
          { id: "out", label: `Out of Stock (${outOfStock.length})` },
        ].map(f => (
          <button key={f.id} onClick={() => setFilter(f.id)} className={`px-4 py-2 text-xs tracking-[0.1em] uppercase rounded-lg border transition-colors ${filter === f.id ? "bg-stone-900 text-white border-stone-900" : "border-stone-200 text-stone-500 hover:border-stone-400"}`}>
            {f.label}
          </button>
        ))}
      </div>

      <div className="bg-white border border-stone-100 rounded-xl overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-stone-100">
              <th className="text-left text-[10px] tracking-[0.1em] uppercase text-stone-400 font-medium px-5 py-3">Product</th>
              <th className="text-left text-[10px] tracking-[0.1em] uppercase text-stone-400 font-medium px-5 py-3">Variant</th>
              <th className="text-left text-[10px] tracking-[0.1em] uppercase text-stone-400 font-medium px-5 py-3">Stock</th>
              <th className="text-right text-[10px] tracking-[0.1em] uppercase text-stone-400 font-medium px-5 py-3">Quick Update</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-50">
            {displayed.map(v => (
              <tr key={v.id} className="hover:bg-stone-50/50">
                <td className="px-5 py-3">
                  <div className="flex items-center gap-3">
                    {v.image && <img src={v.image} alt="" className="w-8 h-8 rounded object-cover" />}
                    <span className="text-sm text-stone-900">{v.productName}</span>
                  </div>
                </td>
                <td className="px-5 py-3 text-sm text-stone-700">{v.size}</td>
                <td className="px-5 py-3">
                  <span className={`text-sm font-medium ${v.stock === 0 ? "text-red-600" : v.stock <= 10 ? "text-orange-600" : "text-stone-900"}`}>
                    {v.stock}
                  </span>
                </td>
                <td className="px-5 py-3 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <button onClick={() => updateStock(v.id, Math.max(0, v.stock - 1))} className="w-7 h-7 border border-stone-200 rounded text-stone-500 hover:bg-stone-50 text-sm">-</button>
                    <input type="number" value={v.stock} onChange={e => updateStock(v.id, Math.max(0, Number(e.target.value)))} className="w-16 text-center text-sm border border-stone-200 rounded py-1 focus:outline-none focus:border-stone-400" />
                    <button onClick={() => updateStock(v.id, v.stock + 1)} className="w-7 h-7 border border-stone-200 rounded text-stone-500 hover:bg-stone-50 text-sm">+</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
