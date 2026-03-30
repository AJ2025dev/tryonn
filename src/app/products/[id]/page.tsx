import { createServerClient } from "@/lib/supabase/server";
import Link from "next/link";
import AddToCartButton from "./AddToCartButton";

async function getProduct(id: number) {
  const sb = createServerClient();
  const { data, error } = await sb.from("products").select("id, name, description, brand, is_new, product_variants(id, price, discount, discount_type, size, stock), product_images(id, image_url, sort_order)").eq("id", id).single();
  const settings = await sb.from("merchant_settings").select("app_name, primary_color, logo").eq("merchant_id", Number(process.env.NEXT_PUBLIC_DEFAULT_MERCHANT_ID || "1")).single();
  return { product: data, settings: settings.data, error: error?.message };
}

function fmt(n: number) { return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n); }

export default async function ProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { product, settings, error } = await getProduct(Number(id));
  const color = settings?.primary_color || "#e94560";
  const name = settings?.app_name || "Appify Store";
  if (error || !product) return <div className="min-h-screen flex items-center justify-center"><div className="text-center"><h1 className="text-2xl font-bold mb-2">Product not found</h1><Link href="/" className="text-blue-600 underline">Back to store</Link></div></div>;
  const images = (product.product_images || []).sort((a: any, b: any) => a.sort_order - b.sort_order);
  const variants = (product.product_variants || []).sort((a: any, b: any) => a.price - b.price);
  return (
    <div>
      <header className="sticky top-0 z-50 bg-white border-b shadow-sm"><div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between"><Link href="/" className="flex items-center gap-3">{settings?.logo && <img src={settings.logo} alt="" className="w-10 h-10 rounded-lg" />}<span className="text-xl font-bold" style={{ color }}>{name}</span></Link><div className="flex items-center gap-4"><Link href="/cart" className="text-2xl">🛒</Link><Link href="/" className="text-sm text-gray-500 hover:text-gray-900">← Back to store</Link></div></div></header>
      <main className="max-w-6xl mx-auto px-4 py-8">
        <nav className="text-sm text-gray-400 mb-6"><Link href="/" className="hover:text-gray-600">Home</Link><span className="mx-2">/</span><span className="text-gray-700">{product.name}</span></nav>
        <div className="grid md:grid-cols-2 gap-8">
          <div>
            <div className="aspect-square bg-gray-50 rounded-2xl overflow-hidden mb-3"><img src={images[0]?.image_url || "https://placehold.co/600x600/eee/999?text=No+Image"} alt={product.name} className="w-full h-full object-cover" /></div>
            {images.length > 1 && <div className="flex gap-2">{images.map((img: any) => <div key={img.id} className="w-20 h-20 rounded-lg overflow-hidden border-2 border-gray-200 cursor-pointer hover:border-gray-400"><img src={img.image_url} alt="" className="w-full h-full object-cover" /></div>)}</div>}
          </div>
          <div>
            {product.is_new && <span className="inline-block bg-green-500 text-white text-xs font-bold px-3 py-1 rounded-full mb-3">NEW ARRIVAL</span>}
            <p className="text-sm text-gray-400 mb-1">{product.brand}</p>
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-3">{product.name}</h1>
            {product.description && <p className="text-gray-600 leading-relaxed mb-6">{product.description}</p>}
            <AddToCartButton productId={product.id} productName={product.name} variants={variants} firstImage={images[0]?.image_url || ""} color={color} />
          </div>
        </div>
      </main>
      <footer className="border-t mt-16 py-8 text-center text-gray-400 text-sm">{name} · Powered by Appify</footer>
    </div>
  );
}
