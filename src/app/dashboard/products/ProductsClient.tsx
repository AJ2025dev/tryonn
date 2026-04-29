"use client";
import { useState } from "react";
import Link from "next/link";
import { createBrowserClient } from "@supabase/ssr";

function fmt(n: number) { return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n); }

function getSupabase() {
  return createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
}

interface Props {
  products: any[];
  merchantId: number;
}

export default function ProductsClient({ products: initialProducts, merchantId }: Props) {
  const [products, setProducts] = useState(initialProducts);
  const [search, setSearch] = useState("");

  async function toggleActive(id: number, isActive: boolean) {
    const supabase = getSupabase();
    await supabase.from("products").update({ is_active: !isActive }).eq("id", id).eq("merchant_id", merchantId);
    setProducts(prev => prev.map(p => p.id === id ? { ...p, is_active: !isActive } : p));
  }

  async function deleteProduct(id: number) {
    if (!confirm("Delete this product? This cannot be undone.")) return;
    const supabase = getSupabase();
    await supabase.from("product_images").delete().eq("product_id", id);
    await supabase.from("product_variants").delete().eq("product_id", id);
    await supabase.from("products").delete().eq("id", id).eq("merchant_id", merchantId);
    setProducts(prev => prev.filter(p => p.id !== id));
  }

  const filtered = products.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.brand?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-stone-900">Products</h1>
          <p className="text-sm text-stone-400 mt-1">{products.length} product{products.length !== 1 ? "s" : ""}</p>
        </div>
        <Link href="/dashboard/products/new" className="px-5 py-2.5 text-xs tracking-[0.15em] uppercase bg-stone-900 text-white hover:bg-stone-800 transition-colors rounded-lg">
          + Add Product
        </Link>
      </div>

      <div className="mb-6">
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search products..."
          className="w-full max-w-md px-4 py-2.5 border border-stone-200 rounded-lg text-sm text-stone-900 bg-white placeholder:text-stone-400 focus:outline-none focus:border-stone-400"
        />
      </div>

      <div className="bg-white border border-stone-100 rounded-xl overflow-hidden">
        {filtered.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-stone-400 mb-4">No products found</p>
            <Link href="/dashboard/products/new" className="text-sm text-stone-900 underline">Add your first product</Link>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-stone-100">
                <th className="text-left text-[10px] tracking-[0.1em] uppercase text-stone-400 font-medium px-5 py-3">Product</th>
                <th className="text-left text-[10px] tracking-[0.1em] uppercase text-stone-400 font-medium px-5 py-3">Price</th>
                <th className="text-left text-[10px] tracking-[0.1em] uppercase text-stone-400 font-medium px-5 py-3">Stock</th>
                <th className="text-left text-[10px] tracking-[0.1em] uppercase text-stone-400 font-medium px-5 py-3">Status</th>
                <th className="text-right text-[10px] tracking-[0.1em] uppercase text-stone-400 font-medium px-5 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-50">
              {filtered.map(product => {
                const img = product.product_images?.sort((a: any, b: any) => a.sort_order - b.sort_order)[0];
                const lowestPrice = product.product_variants?.sort((a: any, b: any) => a.price - b.price)[0]?.price || 0;
                const totalStock = product.product_variants?.reduce((sum: number, v: any) => sum + (v.stock || 0), 0) || 0;

                return (
                  <tr key={product.id} className="hover:bg-stone-50/50 transition-colors">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-lg overflow-hidden bg-stone-100 flex-shrink-0">
                          {img ? (
                            <img src={img.image_url} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-stone-300 text-xs">No img</div>
                          )}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-stone-900">{product.name}</p>
                          <p className="text-xs text-stone-400">{product.brand}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4 text-sm text-stone-900">{fmt(lowestPrice)}</td>
                    <td className="px-5 py-4">
                      <span className={`text-sm ${totalStock > 10 ? "text-stone-900" : totalStock > 0 ? "text-orange-600" : "text-red-600"}`}>
                        {totalStock} units
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <button
                        onClick={() => toggleActive(product.id, product.is_active)}
                        className={`text-[10px] tracking-[0.1em] uppercase px-2.5 py-1 rounded-full transition-colors ${
                          product.is_active ? "bg-green-50 text-green-700" : "bg-stone-100 text-stone-500"
                        }`}
                      >
                        {product.is_active ? "Active" : "Inactive"}
                      </button>
                    </td>
                    <td className="px-5 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Link href={`/dashboard/products/${product.id}`} className="text-xs text-stone-500 hover:text-stone-900 px-2 py-1 border border-stone-200 rounded hover:border-stone-400 transition-colors">
                          Edit
                        </Link>
                        <button onClick={() => deleteProduct(product.id)} className="text-xs text-red-400 hover:text-red-700 px-2 py-1 border border-red-200 rounded hover:border-red-400 transition-colors">
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
