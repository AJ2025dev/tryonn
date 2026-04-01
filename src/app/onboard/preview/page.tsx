"use client";
import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function PreviewPage() {
  const params = useSearchParams();
  const merchantId = params.get("merchant");
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState<any>(null);
  const [designSpec, setDesignSpec] = useState<any>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!merchantId) return;
    loadData();
  }, [merchantId]);

  async function loadData() {
    try {
      const { data: s } = await supabase
        .from("merchant_settings")
        .select("*")
        .eq("merchant_id", Number(merchantId))
        .single();

      const { data: d } = await supabase
        .from("design_specs")
        .select("spec_json")
        .eq("merchant_id", Number(merchantId))
        .order("created_on", { ascending: false })
        .limit(1)
        .single();

      setSettings(s);
      setDesignSpec(d?.spec_json);
    } catch (e: any) {
      setError("Failed to load store preview");
    }
    setLoading(false);
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: "#FDFCFA" }}>
        <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@300;400;500&family=Outfit:wght@300;400;500&display=swap" rel="stylesheet" />
        <div className="text-center" style={{ fontFamily: "'Outfit', sans-serif" }}>
          <div className="inline-block animate-spin w-8 h-8 border-2 border-stone-300 border-t-stone-900 rounded-full mb-4" />
          <p className="text-sm text-stone-500">Loading your store preview...</p>
        </div>
      </div>
    );
  }

  if (error || !settings) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: "#FDFCFA", fontFamily: "'Outfit', sans-serif" }}>
        <div className="text-center">
          <p className="text-red-600 mb-4">{error || "Store not found"}</p>
          <Link href="/onboard" className="text-sm text-stone-500 underline">Start over</Link>
        </div>
      </div>
    );
  }

  const accent = settings.primary_color || "#E94560";
  const name = settings.app_name;
  const storeUrl = settings.store_url;
  const tagline = designSpec?.tagline || settings.short_description || "";
  const heroText = designSpec?.heroBannerText || name;
  const heroSub = designSpec?.heroSubtext || tagline;
  const ctaText = designSpec?.ctaText || "Shop Now";
  const usps = designSpec?.uspItems || ["Premium Quality", "Free Delivery", "Easy Returns", "100% Authentic"];
  const headingFont = designSpec?.fontFamily || "Cormorant Garamond";
  const bodyFont = designSpec?.bodyFont || "Outfit";

  return (
    <div className="min-h-screen" style={{ backgroundColor: "#FDFCFA" }}>
      <link href={`https://fonts.googleapis.com/css2?family=${encodeURIComponent(headingFont)}:wght@300;400;500;600;700&family=${encodeURIComponent(bodyFont)}:wght@300;400;500;600&display=swap`} rel="stylesheet" />

      {/* ─── CONTROL BAR ─── */}
      <div className="sticky top-0 z-[100] bg-stone-900 text-white">
        <div className="max-w-7xl mx-auto px-6 py-3 flex items-center justify-between" style={{ fontFamily: "'Outfit', sans-serif" }}>
          <div className="flex items-center gap-4">
            <span className="text-xs tracking-[0.15em] uppercase opacity-60">Preview</span>
            <span className="text-sm font-medium">{name}</span>
            <span className="text-xs opacity-40">→ {storeUrl}.appi-fy.ai</span>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/onboard" className="px-4 py-1.5 text-xs tracking-[0.1em] uppercase border border-white/30 text-white/80 hover:bg-white/10 transition-colors">
              Edit
            </Link>
            <a
              href={`https://${storeUrl}.appi-fy.ai`}
              target="_blank"
              className="px-5 py-1.5 text-xs tracking-[0.1em] uppercase bg-green-600 text-white hover:bg-green-700 transition-colors"
            >
              ✓ Go Live
            </a>
          </div>
        </div>
      </div>

      {/* ─── STORE PREVIEW ─── */}
      <div className="border-4 border-stone-200 mx-4 my-4 rounded-lg overflow-hidden" style={{ backgroundColor: settings.background_color || "#FDFCFA" }}>
        {/* Announcement Bar */}
        <div className="text-center py-2.5 text-xs tracking-[0.2em] uppercase" style={{ fontFamily: `'${bodyFont}', sans-serif`, backgroundColor: accent + "15", color: accent }}>
          {usps[1]} &nbsp;·&nbsp; {usps[2]}
        </div>

        {/* Header */}
        <header className="border-b border-stone-100 bg-white/95">
          <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-bold" style={{ backgroundColor: accent, fontFamily: `'${bodyFont}', sans-serif` }}>
                {name.charAt(0)}
              </div>
              <span className="text-2xl font-light tracking-wide" style={{ fontFamily: `'${headingFont}', serif`, color: settings.text_color || "#1C1917" }}>{name}</span>
            </div>
            <div className="flex items-center gap-5" style={{ fontFamily: `'${bodyFont}', sans-serif` }}>
              <div className="hidden md:flex items-center border border-stone-200 rounded-full px-4 py-2 gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-stone-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                <span className="text-sm text-stone-400">Search</span>
              </div>
              <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-stone-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" /></svg>
            </div>
          </div>
        </header>

        {/* Hero */}
        <section className="relative overflow-hidden" style={{ backgroundColor: accent + "12" }}>
          <div className="max-w-7xl mx-auto px-6">
            <div className="grid md:grid-cols-2 gap-8 items-center min-h-[450px]">
              <div className="py-16">
                <p className="text-xs tracking-[0.25em] uppercase mb-4" style={{ fontFamily: `'${bodyFont}', sans-serif`, color: accent }}>
                  {heroText}
                </p>
                <h1 className="text-5xl md:text-6xl font-light leading-[1.1] mb-6 tracking-tight" style={{ fontFamily: `'${headingFont}', serif`, color: settings.text_color || "#1C1917" }}>
                  Discover<br /><span className="italic" style={{ color: accent }}>Your</span><br />Style
                </h1>
                <p className="text-base mb-8 max-w-md leading-relaxed" style={{ fontFamily: `'${bodyFont}', sans-serif`, color: "#78716c" }}>
                  {heroSub}
                </p>
                <button className="px-8 py-3.5 text-xs tracking-[0.2em] uppercase text-white transition-all hover:opacity-90" style={{ fontFamily: `'${bodyFont}', sans-serif`, backgroundColor: accent }}>
                  {ctaText}
                </button>
              </div>
              <div className="hidden md:block h-[450px] rounded-lg" style={{ background: `linear-gradient(135deg, ${accent}33, ${accent}66)` }} />
            </div>
          </div>
        </section>

        {/* USP Bar */}
        <section className="border-y border-stone-100 bg-white">
          <div className="max-w-7xl mx-auto px-6 py-6 grid grid-cols-2 md:grid-cols-4 gap-6" style={{ fontFamily: `'${bodyFont}', sans-serif` }}>
            {usps.map((usp: string, i: number) => (
              <div key={i} className="flex items-center gap-3 justify-center">
                <span style={{ color: accent }}>✦</span>
                <span className="text-xs tracking-[0.1em] uppercase text-stone-500">{usp}</span>
              </div>
            ))}
          </div>
        </section>

        {/* Sample Products */}
        <section className="py-16" style={{ backgroundColor: settings.background_color || "#FDFCFA" }}>
          <div className="max-w-7xl mx-auto px-6">
            <div className="text-center mb-12">
              <p className="text-xs tracking-[0.25em] uppercase text-stone-400 mb-3" style={{ fontFamily: `'${bodyFont}', sans-serif` }}>Collection</p>
              <h2 className="text-3xl font-light tracking-tight" style={{ fontFamily: `'${headingFont}', serif`, color: settings.text_color }}>Featured Products</h2>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
              {["Product 1", "Product 2", "Product 3", "Product 4"].map((p, i) => (
                <div key={i} className="group">
                  <div className="relative overflow-hidden mb-4" style={{ aspectRatio: "3/4", backgroundColor: accent + (i % 2 === 0 ? "22" : "33") }}>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-white/60 text-sm" style={{ fontFamily: `'${bodyFont}', sans-serif` }}>Product Image</span>
                    </div>
                    {i === 0 && (
                      <span className="absolute top-3 left-3 text-[10px] tracking-[0.2em] uppercase px-2.5 py-1 bg-white text-stone-900" style={{ fontFamily: `'${bodyFont}', sans-serif` }}>New</span>
                    )}
                  </div>
                  <p className="text-[11px] tracking-[0.1em] uppercase text-stone-400 mb-1" style={{ fontFamily: `'${bodyFont}', sans-serif` }}>{name}</p>
                  <p className="text-base font-normal text-stone-800 mb-2" style={{ fontFamily: `'${headingFont}', serif` }}>{p}</p>
                  <p className="text-sm font-medium text-stone-900" style={{ fontFamily: `'${bodyFont}', sans-serif` }}>₹999</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="border-t border-stone-100 bg-white" style={{ fontFamily: `'${bodyFont}', sans-serif` }}>
          <div className="max-w-7xl mx-auto px-6 py-8 flex items-center justify-between">
            <span className="text-xl font-light tracking-wide" style={{ fontFamily: `'${headingFont}', serif`, color: settings.text_color }}>{name}</span>
            <p className="text-xs text-stone-300">Powered by <span className="text-stone-400">Appify</span></p>
          </div>
        </footer>
      </div>

      {/* ─── DESIGN SPEC DETAILS ─── */}
      <div className="max-w-3xl mx-auto px-6 py-12" style={{ fontFamily: "'Outfit', sans-serif" }}>
        <h2 className="text-xs tracking-[0.2em] uppercase text-stone-900 font-medium mb-6">AI-Generated Design Spec</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {[
            { label: "Primary", color: settings.primary_color },
            { label: "Secondary", color: settings.secondary_color },
            { label: "Accent", color: settings.accent_color },
            { label: "Background", color: settings.background_color },
          ].map(c => (
            <div key={c.label} className="text-center">
              <div className="w-full h-16 rounded-lg mb-2 border border-stone-100" style={{ backgroundColor: c.color }} />
              <p className="text-xs text-stone-500">{c.label}</p>
              <p className="text-[10px] text-stone-400 font-mono">{c.color}</p>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div><span className="text-stone-400">Heading Font:</span> <span className="text-stone-900">{designSpec?.fontFamily || headingFont}</span></div>
          <div><span className="text-stone-400">Body Font:</span> <span className="text-stone-900">{designSpec?.bodyFont || bodyFont}</span></div>
          <div><span className="text-stone-400">Tagline:</span> <span className="text-stone-900">{tagline}</span></div>
          <div><span className="text-stone-400">CTA:</span> <span className="text-stone-900">{ctaText}</span></div>
        </div>
      </div>
    </div>
  );
}
