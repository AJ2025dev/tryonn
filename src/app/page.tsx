import { createServerClient } from "@/lib/supabase/server";
import { getMerchantId } from "@/lib/merchant";
import Link from "next/link";

async function getData(merchantId: number) {
  const sb = createServerClient();
  const [s, b, p, c] = await Promise.all([
    sb.from("merchant_settings").select("*").eq("merchant_id", merchantId).single(),
    sb.from("banners").select("*").eq("merchant_id", merchantId).eq("is_active", true),
    sb.from("products").select("id, name, brand, is_new, description, product_variants(price, discount, discount_type, size), product_images(image_url, sort_order)").eq("merchant_id", merchantId).eq("is_active", true).eq("is_available", true).limit(8),
    sb.from("categories").select("id, name, parent_id").is("parent_id", null).eq("is_active", true),
  ]);
  return { settings: s.data, banners: b.data || [], products: p.data || [], categories: c.data || [] };
}

function fmt(n: number) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);
}

export default async function Home() {
  const mid = await getMerchantId();
  const { settings, banners, products, categories } = await getData(mid);
  const name = settings?.app_name || "Appify Store";
  const accent = settings?.primary_color || "#8B6F4E";
  const tagline = settings?.short_description || "Curated fashion for modern living";

  const newArrivals = products.filter((p: any) => p.is_new);
  const allProducts = products;

  return (
    <div className="min-h-screen" style={{ fontFamily: "'Cormorant Garamond', Georgia, serif" }}>
      <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,500;0,600;0,700;1,400&family=Outfit:wght@300;400;500;600&display=swap" rel="stylesheet" />

      <div className="text-center py-2.5 text-xs tracking-[0.2em] uppercase" style={{ fontFamily: "'Outfit', sans-serif", backgroundColor: "#F7F4F0", color: "#6B5E50" }}>
        Free delivery on orders above ₹999 &nbsp;·&nbsp; Easy 7-day returns
      </div>

      <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-sm border-b border-stone-100">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3">
            {settings?.logo ? (
              <img src={settings.logo} alt={name} className="w-9 h-9 rounded-full object-cover" />
            ) : (
              <div className="w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-bold" style={{ backgroundColor: accent, fontFamily: "'Outfit', sans-serif" }}>
                {name.charAt(0)}
              </div>
            )}
            <span className="text-2xl font-light tracking-wide text-stone-900">{name}</span>
          </Link>
          <nav className="hidden md:flex items-center gap-8" style={{ fontFamily: "'Outfit', sans-serif" }}>
            {categories.slice(0, 4).map((cat: any) => (
              <span key={cat.id} className="text-xs tracking-[0.15em] uppercase text-stone-500 hover:text-stone-900 cursor-pointer transition-colors">{cat.name}</span>
            ))}
          </nav>
          <div className="flex items-center gap-5" style={{ fontFamily: "'Outfit', sans-serif" }}>
            <div className="hidden md:flex items-center border border-stone-200 rounded-full px-4 py-2 gap-2 hover:border-stone-400 transition-colors">
              <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-stone-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
              <input type="text" placeholder="Search" className="bg-transparent outline-none text-sm text-stone-700 w-40 placeholder:text-stone-400" />
            </div>
            <Link href="/cart" className="relative group">
              <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-stone-600 group-hover:text-stone-900 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" /></svg>
            </Link>
          </div>
        </div>
      </header>

      <main>
        <section className="relative overflow-hidden" style={{ backgroundColor: "#F7F4F0" }}>
          <div className="max-w-7xl mx-auto px-6">
            <div className="grid md:grid-cols-2 gap-8 items-center min-h-[520px]">
              <div className="py-16 md:py-24">
                <p className="text-xs tracking-[0.25em] uppercase mb-4" style={{ fontFamily: "'Outfit', sans-serif", color: accent }}>{banners.length > 0 ? banners[0].name : "New Collection"}</p>
                <h1 className="text-5xl md:text-7xl font-light text-stone-900 leading-[1.1] mb-6 tracking-tight">Discover<br /><span className="italic font-normal" style={{ color: accent }}>Timeless</span><br />Style</h1>
                <p className="text-base text-stone-500 mb-8 max-w-md leading-relaxed" style={{ fontFamily: "'Outfit', sans-serif" }}>{tagline}</p>
                <Link href="#products" className="inline-block px-8 py-3.5 text-xs tracking-[0.2em] uppercase text-white transition-all hover:opacity-90" style={{ fontFamily: "'Outfit', sans-serif", backgroundColor: accent }}>Shop Now</Link>
              </div>
              <div className="hidden md:block relative h-[520px]">
                {banners.length > 0 ? <img src={banners[0].image_url} alt="" className="absolute inset-0 w-full h-full object-cover" /> : <div className="absolute inset-0" style={{ background: `linear-gradient(135deg, ${accent}22, ${accent}44)` }} />}
              </div>
            </div>
          </div>
        </section>

        <section className="border-y border-stone-100 bg-white">
          <div className="max-w-7xl mx-auto px-6 py-6 grid grid-cols-2 md:grid-cols-4 gap-6" style={{ fontFamily: "'Outfit', sans-serif" }}>
            {[{ icon: "✦", text: "Premium Quality" }, { icon: "◇", text: "Free Delivery ₹999+" }, { icon: "↻", text: "7-Day Easy Returns" }, { icon: "♡", text: "100% Authentic" }].map((item) => (
              <div key={item.text} className="flex items-center gap-3 justify-center">
                <span className="text-lg" style={{ color: accent }}>{item.icon}</span>
                <span className="text-xs tracking-[0.1em] uppercase text-stone-500">{item.text}</span>
              </div>
            ))}
          </div>
        </section>

        {categories.length > 0 && (
          <section className="py-16 bg-white">
            <div className="max-w-7xl mx-auto px-6">
              <div className="text-center mb-12">
                <p className="text-xs tracking-[0.25em] uppercase text-stone-400 mb-3" style={{ fontFamily: "'Outfit', sans-serif" }}>Explore</p>
                <h2 className="text-3xl md:text-4xl font-light text-stone-900 tracking-tight">Shop by Category</h2>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {categories.map((cat: any, i: number) => {
                  const warmColors = ["#D4C4B0", "#C4B5A0", "#B8A892", "#E8DDD3", "#CDB9A7", "#A69584"];
                  return (
                    <div key={cat.id} className="group relative overflow-hidden cursor-pointer" style={{ aspectRatio: i === 0 ? "2/1" : "1/1", gridColumn: i === 0 ? "span 2" : "span 1" }}>
                      <div className="absolute inset-0 transition-transform duration-700 group-hover:scale-105" style={{ backgroundColor: warmColors[i % warmColors.length] }} />
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="text-center">
                          <h3 className="text-2xl md:text-3xl font-light text-white tracking-wide">{cat.name}</h3>
                          <div className="mt-3 overflow-hidden"><p className="text-xs tracking-[0.2em] uppercase text-white/80 translate-y-4 group-hover:translate-y-0 opacity-0 group-hover:opacity-100 transition-all duration-500" style={{ fontFamily: "'Outfit', sans-serif" }}>Discover →</p></div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </section>
        )}

        {newArrivals.length > 0 && (
          <section className="py-16" style={{ backgroundColor: "#FDFCFA" }}>
            <div className="max-w-7xl mx-auto px-6">
              <div className="flex items-end justify-between mb-10">
                <div>
                  <p className="text-xs tracking-[0.25em] uppercase text-stone-400 mb-3" style={{ fontFamily: "'Outfit', sans-serif" }}>Just In</p>
                  <h2 className="text-3xl md:text-4xl font-light text-stone-900 tracking-tight">New Arrivals</h2>
                </div>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-10">
                {newArrivals.map((p: any) => <ProductCard key={p.id} product={p} accent={accent} />)}
              </div>
            </div>
          </section>
        )}

        <section className="py-16 bg-white">
          <div className="max-w-7xl mx-auto px-6">
            <div className="grid md:grid-cols-2 gap-0 overflow-hidden" style={{ backgroundColor: "#F0EBE3" }}>
              <div className="p-12 md:p-16 flex flex-col justify-center">
                <p className="text-xs tracking-[0.25em] uppercase mb-4" style={{ fontFamily: "'Outfit', sans-serif", color: accent }}>The Edit</p>
                <h2 className="text-3xl md:text-5xl font-light text-stone-900 leading-tight mb-6 tracking-tight">Effortless<br /><span className="italic">Elegance</span></h2>
                <p className="text-sm text-stone-500 mb-8 max-w-sm leading-relaxed" style={{ fontFamily: "'Outfit', sans-serif" }}>Curated pieces that transition seamlessly from day to evening. Timeless designs crafted with care.</p>
                <div><Link href="#products" className="inline-block px-8 py-3 text-xs tracking-[0.2em] uppercase border border-stone-900 text-stone-900 hover:bg-stone-900 hover:text-white transition-all" style={{ fontFamily: "'Outfit', sans-serif" }}>Explore Collection</Link></div>
              </div>
              <div className="h-64 md:h-auto" style={{ background: `linear-gradient(135deg, ${accent}33, ${accent}55)` }}>
                {banners.length > 1 && <img src={banners[1].image_url} alt="" className="w-full h-full object-cover" />}
              </div>
            </div>
          </div>
        </section>

        <section id="products" className="py-16" style={{ backgroundColor: "#FDFCFA" }}>
          <div className="max-w-7xl mx-auto px-6">
            <div className="text-center mb-12">
              <p className="text-xs tracking-[0.25em] uppercase text-stone-400 mb-3" style={{ fontFamily: "'Outfit', sans-serif" }}>Collection</p>
              <h2 className="text-3xl md:text-4xl font-light text-stone-900 tracking-tight">Featured Products</h2>
            </div>
            {allProducts.length > 0 ? (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-x-5 gap-y-10">
                {allProducts.map((p: any) => <ProductCard key={p.id} product={p} accent={accent} />)}
              </div>
            ) : (
              <p className="text-center py-16 text-stone-400" style={{ fontFamily: "'Outfit', sans-serif" }}>No products yet</p>
            )}
          </div>
        </section>

        <section className="py-20 bg-white border-t border-stone-100">
          <div className="max-w-xl mx-auto px-6 text-center">
            <h2 className="text-3xl font-light text-stone-900 mb-3 tracking-tight">Stay in Touch</h2>
            <p className="text-sm text-stone-400 mb-8" style={{ fontFamily: "'Outfit', sans-serif" }}>Subscribe for early access to new collections and exclusive offers.</p>
            <div className="flex gap-3">
              <input type="email" placeholder="Your email address" className="flex-1 px-5 py-3 border border-stone-200 text-sm text-stone-700 bg-transparent placeholder:text-stone-400 focus:outline-none focus:border-stone-500 transition-colors" style={{ fontFamily: "'Outfit', sans-serif" }} />
              <button className="px-8 py-3 text-xs tracking-[0.2em] uppercase text-white transition-all hover:opacity-90" style={{ fontFamily: "'Outfit', sans-serif", backgroundColor: accent }}>Subscribe</button>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-stone-100 bg-white" style={{ fontFamily: "'Outfit', sans-serif" }}>
        <div className="max-w-7xl mx-auto px-6 py-12">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-12">
            <div>
              <span className="text-xl font-light tracking-wide text-stone-900" style={{ fontFamily: "'Cormorant Garamond', serif" }}>{name}</span>
              <p className="text-xs text-stone-400 mt-3 leading-relaxed">{tagline}</p>
            </div>
            <div>
              <p className="text-xs tracking-[0.15em] uppercase text-stone-900 mb-4 font-medium">Shop</p>
              {categories.slice(0, 4).map((cat: any) => <p key={cat.id} className="text-xs text-stone-400 mb-2 hover:text-stone-700 cursor-pointer transition-colors">{cat.name}</p>)}
            </div>
            <div>
              <p className="text-xs tracking-[0.15em] uppercase text-stone-900 mb-4 font-medium">Help</p>
              <p className="text-xs text-stone-400 mb-2">Shipping & Delivery</p>
              <p className="text-xs text-stone-400 mb-2">Returns & Exchanges</p>
              <p className="text-xs text-stone-400 mb-2">Contact Us</p>
            </div>
            <div>
              <p className="text-xs tracking-[0.15em] uppercase text-stone-900 mb-4 font-medium">Company</p>
              <p className="text-xs text-stone-400 mb-2">About Us</p>
              <p className="text-xs text-stone-400 mb-2">Privacy Policy</p>
              <p className="text-xs text-stone-400 mb-2">Terms of Service</p>
            </div>
          </div>
          <div className="border-t border-stone-100 pt-8 flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="text-xs text-stone-300">© 2026 {name}. All rights reserved.</p>
            <p className="text-xs text-stone-300">Powered by <span className="text-stone-400">Appify</span></p>
          </div>
        </div>
      </footer>
    </div>
  );
}

function ProductCard({ product, accent }: { product: any; accent: string }) {
  const v = product.product_variants?.sort((a: any, b: any) => a.price - b.price)[0];
  const img = product.product_images?.sort((a: any, b: any) => a.sort_order - b.sort_order)[0];
  const hasDisc = v?.discount > 0;
  const finalPrice = v ? (v.discount_type === 1 ? v.price * (1 - v.discount / 100) : v.discount_type === 2 ? v.price - v.discount : v.price) : 0;
  function fmt(n: number) { return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n); }
  return (
    <Link href={`/products/${product.id}`} className="group block">
      <div className="relative overflow-hidden mb-4" style={{ aspectRatio: "3/4", backgroundColor: "#F0EBE3" }}>
        <img src={img?.image_url || "https://placehold.co/600x800/F0EBE3/8B6F4E?text=" + encodeURIComponent(product.name)} alt={product.name} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" />
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors duration-500" />
        <div className="absolute bottom-0 left-0 right-0 translate-y-full group-hover:translate-y-0 transition-transform duration-500">
          <div className="mx-3 mb-3 py-2.5 text-center text-xs tracking-[0.15em] uppercase bg-white/95 backdrop-blur-sm text-stone-900" style={{ fontFamily: "'Outfit', sans-serif" }}>Quick View</div>
        </div>
        {product.is_new && <span className="absolute top-3 left-3 text-[10px] tracking-[0.2em] uppercase px-2.5 py-1 bg-white text-stone-900" style={{ fontFamily: "'Outfit', sans-serif" }}>New</span>}
        {hasDisc && <span className="absolute top-3 right-3 text-[10px] tracking-[0.2em] uppercase px-2.5 py-1 text-white" style={{ fontFamily: "'Outfit', sans-serif", backgroundColor: accent }}>{v.discount_type === 1 ? `${v.discount}% Off` : `₹${v.discount} Off`}</span>}
      </div>
      <div>
        <p className="text-[11px] tracking-[0.1em] uppercase text-stone-400 mb-1" style={{ fontFamily: "'Outfit', sans-serif" }}>{product.brand}</p>
        <h3 className="text-base font-normal text-stone-800 mb-2 leading-snug tracking-wide">{product.name}</h3>
        <div className="flex items-center gap-2" style={{ fontFamily: "'Outfit', sans-serif" }}>
          <span className="text-sm font-medium text-stone-900">{fmt(finalPrice)}</span>
          {hasDisc && <span className="text-xs text-stone-400 line-through">{fmt(v.price)}</span>}
        </div>
        {product.product_variants && product.product_variants.length > 1 && (
          <div className="flex gap-1.5 mt-2">
            {product.product_variants.slice(0, 4).map((variant: any, i: number) => (
              <span key={i} className="text-[10px] text-stone-400 border border-stone-200 px-1.5 py-0.5" style={{ fontFamily: "'Outfit', sans-serif" }}>{variant.size}</span>
            ))}
          </div>
        )}
      </div>
    </Link>
  );
}
