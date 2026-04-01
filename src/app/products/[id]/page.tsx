export const dynamic = "force-dynamic";

import { createServerClient } from "@/lib/supabase/server";
import { getMerchantId } from "@/lib/merchant";
import Link from "next/link";
import AddToCartButton from "./AddToCartButton";
import ImageGallery from "./ImageGallery";

async function getProduct(id: number, merchantId: number) {
  const sb = createServerClient();
  const { data, error } = await sb.from("products").select("id, name, description, brand, is_new, category_id, product_variants(id, price, discount, discount_type, size, stock), product_images(id, image_url, sort_order)").eq("id", id).single();
  const settings = await sb.from("merchant_settings").select("app_name, primary_color, logo, short_description").eq("merchant_id", merchantId).single();
  const category = data?.category_id ? await sb.from("categories").select("name, full_path").eq("id", data.category_id).single() : null;
  return { product: data, settings: settings.data, category: category?.data, error: error?.message };
}

export default async function ProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const mid = await getMerchantId();
  const { product, settings, category, error } = await getProduct(Number(id), mid);
  const accent = settings?.primary_color || "#8B6F4E";
  const name = settings?.app_name || "Appify Store";

  if (error || !product) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ fontFamily: "'Outfit', sans-serif", backgroundColor: "#FDFCFA" }}>
        <div className="text-center">
          <h1 className="text-2xl font-light text-stone-900 mb-2" style={{ fontFamily: "'Cormorant Garamond', serif" }}>Product not found</h1>
          <p className="text-sm text-stone-400 mb-6">This product may have been removed.</p>
          <Link href="/" className="px-6 py-2.5 text-xs tracking-[0.15em] uppercase border border-stone-900 text-stone-900 hover:bg-stone-900 hover:text-white transition-all">Back to Store</Link>
        </div>
      </div>
    );
  }

  const images = (product.product_images || []).sort((a: any, b: any) => a.sort_order - b.sort_order);
  const variants = (product.product_variants || []).sort((a: any, b: any) => a.price - b.price);

  return (
    <div className="min-h-screen" style={{ backgroundColor: "#FDFCFA" }}>
      <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,500;0,600;0,700;1,400&family=Outfit:wght@300;400;500;600&display=swap" rel="stylesheet" />
      <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-sm border-b border-stone-100">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3">
            {settings?.logo ? <img src={settings.logo} alt={name} className="w-9 h-9 rounded-full object-cover" /> : <div className="w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-bold" style={{ backgroundColor: accent, fontFamily: "'Outfit', sans-serif" }}>{name.charAt(0)}</div>}
            <span className="text-2xl font-light tracking-wide text-stone-900" style={{ fontFamily: "'Cormorant Garamond', serif" }}>{name}</span>
          </Link>
          <div className="flex items-center gap-5" style={{ fontFamily: "'Outfit', sans-serif" }}>
            <Link href="/" className="text-xs tracking-[0.1em] uppercase text-stone-400 hover:text-stone-900 transition-colors">Continue Shopping</Link>
            <Link href="/cart" className="relative group"><svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-stone-600 group-hover:text-stone-900 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" /></svg></Link>
          </div>
        </div>
      </header>
      <main className="max-w-7xl mx-auto px-6">
        <nav className="py-5 flex items-center gap-2 text-xs tracking-[0.05em]" style={{ fontFamily: "'Outfit', sans-serif" }}>
          <Link href="/" className="text-stone-400 hover:text-stone-700 transition-colors">Home</Link><span className="text-stone-300">/</span>
          {category && <><span className="text-stone-400">{category.name}</span><span className="text-stone-300">/</span></>}
          <span className="text-stone-700">{product.name}</span>
        </nav>
        <div className="grid md:grid-cols-2 gap-12 pb-20">
          <ImageGallery images={images} productName={product.name} accent={accent} />
          <div className="md:py-4">
            <p className="text-xs tracking-[0.2em] uppercase text-stone-400 mb-2" style={{ fontFamily: "'Outfit', sans-serif" }}>{product.brand}</p>
            <h1 className="text-3xl md:text-4xl font-light text-stone-900 tracking-tight mb-4" style={{ fontFamily: "'Cormorant Garamond', serif" }}>{product.name}</h1>
            {product.is_new && <span className="inline-block text-[10px] tracking-[0.2em] uppercase px-3 py-1.5 mb-5 bg-white border border-stone-200 text-stone-700" style={{ fontFamily: "'Outfit', sans-serif" }}>New Arrival</span>}
            {product.description && <p className="text-sm text-stone-500 leading-relaxed mb-8 max-w-lg" style={{ fontFamily: "'Outfit', sans-serif" }}>{product.description}</p>}
            <div className="border-t border-stone-100 mb-8" />
            <AddToCartButton productId={product.id} productName={product.name} variants={variants} firstImage={images[0]?.image_url || ""} accent={accent} />
            <div className="border-t border-stone-100 mt-10 pt-8" />
            <div className="space-y-5" style={{ fontFamily: "'Outfit', sans-serif" }}>
              <div><p className="text-xs tracking-[0.15em] uppercase text-stone-900 font-medium mb-2">Delivery & Returns</p><p className="text-xs text-stone-400 leading-relaxed">Free delivery on orders above ₹999. Easy 7-day returns.</p></div>
              <div><p className="text-xs tracking-[0.15em] uppercase text-stone-900 font-medium mb-2">Product Details</p><p className="text-xs text-stone-400 leading-relaxed">Brand: {product.brand}.</p></div>
            </div>
          </div>
        </div>
      </main>
      <footer className="border-t border-stone-100 bg-white" style={{ fontFamily: "'Outfit', sans-serif" }}>
        <div className="max-w-7xl mx-auto px-6 py-8 flex items-center justify-between">
          <p className="text-xs text-stone-300">© 2026 {name}</p>
          <p className="text-xs text-stone-300">Powered by <span className="text-stone-400">Appify</span></p>
        </div>
      </footer>
    </div>
  );
}
