import { createServerClient } from "@/lib/supabase/server";

async function getData(mid: number) {
  const sb = createServerClient();
  const [s, b, p] = await Promise.all([
    sb.from("merchant_settings").select("*").eq("merchant_id", mid).single(),
    sb.from("banners").select("*").eq("merchant_id", mid).eq("is_active", true),
    sb.from("products").select("id, name, brand, is_new, product_variants(price, discount, discount_type), product_images(image_url, sort_order)").eq("merchant_id", mid).eq("is_active", true).eq("is_available", true).limit(8),
  ]);
  return { settings: s.data, banners: b.data || [], products: p.data || [], err: { s: s.error?.message, b: b.error?.message, p: p.error?.message } };
}

function fmt(n: number) { return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n); }

export default async function Home() {
  const mid = Number(process.env.NEXT_PUBLIC_DEFAULT_MERCHANT_ID || "1");
  const { settings, banners, products, err } = await getData(mid);
  const name = settings?.app_name || "Appify Store";
  const color = settings?.primary_color || "#e94560";
  return (
    <div>
      <header className="sticky top-0 z-50 bg-white border-b shadow-sm">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {settings?.logo && <img src={settings.logo} alt="" className="w-10 h-10 rounded-lg" />}
            <span className="text-xl font-bold" style={{ color }}>{name}</span>
          </div>
          <input type="text" placeholder="Search products..." className="hidden md:block w-80 px-4 py-2 rounded-full border text-sm" />
          <a href="/cart" className="text-2xl">🛒</a>
        </div>
      </header>
      <main className="max-w-6xl mx-auto px-4">
        {(err.s || err.b || err.p) && <div className="my-4 p-4 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700"><p className="font-bold mb-1">Supabase Errors:</p>{err.s && <p>Settings: {err.s}</p>}{err.b && <p>Banners: {err.b}</p>}{err.p && <p>Products: {err.p}</p>}</div>}
        {!err.s && !err.b && !err.p && products.length === 0 && <div className="my-4 p-4 bg-green-50 border border-green-200 rounded-lg text-sm text-green-800">Connected to Supabase ✓ but no data for merchant_id={mid}. Run the test data SQL in Supabase.</div>}
        <section className="my-6">{banners.length > 0 ? <div className="rounded-2xl overflow-hidden"><img src={banners[0].image_url} alt={banners[0].name} className="w-full h-48 md:h-72 object-cover" /></div> : <div className="rounded-2xl h-48 md:h-72 flex items-center justify-center" style={{ background: `linear-gradient(135deg, ${color}, #0f3460)` }}><div className="text-center text-white"><h1 className="text-3xl md:text-5xl font-bold mb-2">{name}</h1><p className="text-gray-200">{settings?.short_description || "Welcome"}</p></div></div>}</section>
        <section className="my-10">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Featured Products</h2>
          {products.length > 0 ? <div className="grid grid-cols-2 md:grid-cols-4 gap-4">{products.map((p: any) => { const v = p.product_variants?.sort((a: any, b: any) => a.price - b.price)[0]; const img = p.product_images?.sort((a: any, b: any) => a.sort_order - b.sort_order)[0]; const disc = v?.discount > 0; const final1 = v ? (v.discount_type === 1 ? v.price * (1 - v.discount / 100) : v.discount_type === 2 ? v.price - v.discount : v.price) : 0; return (<a href={`/products/${p.id}`} key={p.id} className="group bg-white rounded-xl border overflow-hidden hover:shadow-lg transition-shadow"><div className="relative aspect-square bg-gray-50"><img src={img?.image_url || "https://placehold.co/400x400/eee/999?text=No+Image"} alt={p.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />{p.is_new && <span className="absolute top-2 left-2 bg-green-500 text-white text-xs font-bold px-2 py-1 rounded-full">NEW</span>}{disc && <span className="absolute top-2 right-2 text-white text-xs font-bold px-2 py-1 rounded-full" style={{ backgroundColor: color }}>{v.discount_type === 1 ? `${v.discount}% OFF` : `₹${v.discount} OFF`}</span>}</div><div className="p-3"><p className="text-xs text-gray-400">{p.brand}</p><h3 className="font-semibold text-sm text-gray-900 mb-2 line-clamp-2">{p.name}</h3><div className="flex items-center gap-2"><span className="font-bold">{fmt(final1)}</span>{disc && <span className="text-xs text-gray-400 line-through">{fmt(v.price)}</span>}</div><button className="mt-3 w-full py-2 rounded-lg text-white text-sm font-semibold" style={{ backgroundColor: color }}>View Product</button></div></a>); })}</div> : <p className="text-center py-12 text-gray-500 bg-gray-50 rounded-xl">No products found</p>}
        </section>
      </main>
      <footer className="border-t mt-16 py-8 text-center text-gray-400 text-sm">{name} · Powered by Appify</footer>
    </div>
  );
}
