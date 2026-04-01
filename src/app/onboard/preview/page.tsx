"use client";
import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useState, useEffect } from "react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

function PreviewInner() {
  const params = useSearchParams();
  const merchantId = params.get("merchant");
  const [settings, setSettings] = useState<any>(null);
  const [designSpec, setDesignSpec] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!merchantId) return;
    async function load() {
      const { data: s } = await supabase.from("merchant_settings").select("*").eq("merchant_id", Number(merchantId)).single();
      const { data: d } = await supabase.from("design_specs").select("spec_json").eq("merchant_id", Number(merchantId)).order("created_on", { ascending: false }).limit(1).single();
      setSettings(s);
      setDesignSpec(d?.spec_json);
      setLoading(false);
    }
    load();
  }, [merchantId]);

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: "#FDFCFA" }}>
      <div className="text-center" style={{ fontFamily: "Outfit, sans-serif" }}>
        <div className="inline-block animate-spin w-8 h-8 border-2 border-stone-300 border-t-stone-900 rounded-full mb-4" />
        <p className="text-sm text-stone-500">Loading your store preview...</p>
      </div>
    </div>
  );

  if (!settings) return (
    <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: "#FDFCFA", fontFamily: "Outfit, sans-serif" }}>
      <p className="text-red-600">Store not found</p>
    </div>
  );

  const storeUrl = settings.store_url;
  const previewUrl = typeof window !== "undefined" && window.location.hostname === "localhost"
    ? `http://localhost:3000?store=${storeUrl}`
    : `https://${storeUrl}.appi-fy.ai`;

  return (
    <div className="min-h-screen" style={{ backgroundColor: "#FDFCFA" }}>
      <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@300;400;500;600&family=Outfit:wght@300;400;500;600&display=swap" rel="stylesheet" />

      <div className="sticky top-0 z-[100] bg-stone-900 text-white" style={{ fontFamily: "Outfit, sans-serif" }}>
        <div className="max-w-7xl mx-auto px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <span className="text-xs tracking-[0.15em] uppercase opacity-60">Preview</span>
            <span className="text-sm font-medium">{settings.app_name}</span>
            <span className="text-xs opacity-40">→ {storeUrl}.appi-fy.ai</span>
          </div>
          <div className="flex items-center gap-3">
            <a href="/onboard" className="px-4 py-1.5 text-xs tracking-[0.1em] uppercase border border-white/30 text-white/80 hover:bg-white/10 transition-colors">Edit</a>
            <a href={previewUrl} target="_blank" className="px-5 py-1.5 text-xs tracking-[0.1em] uppercase bg-green-600 text-white hover:bg-green-700 transition-colors">Go Live</a>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-8" style={{ fontFamily: "Outfit, sans-serif" }}>
        <h2 className="text-xs tracking-[0.2em] uppercase text-stone-900 font-medium mb-6">AI-Generated Design</h2>

        <div className="grid grid-cols-4 md:grid-cols-5 gap-4 mb-8">
          {[
            { label: "Primary", color: settings.primary_color },
            { label: "Secondary", color: settings.secondary_color },
            { label: "Accent", color: settings.accent_color },
            { label: "Background", color: settings.background_color },
            { label: "Text", color: settings.text_color },
          ].map(c => (
            <div key={c.label} className="text-center">
              <div className="w-full h-14 rounded-lg mb-2 border border-stone-100" style={{ backgroundColor: c.color }} />
              <p className="text-[10px] text-stone-500">{c.label}</p>
              <p className="text-[9px] text-stone-400 font-mono">{c.color}</p>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm mb-8">
          <div className="border border-stone-200 p-4">
            <p className="text-[10px] tracking-[0.1em] uppercase text-stone-400 mb-1">Heading Font</p>
            <p className="text-stone-900">{designSpec?.fontFamily || "Cormorant Garamond"}</p>
          </div>
          <div className="border border-stone-200 p-4">
            <p className="text-[10px] tracking-[0.1em] uppercase text-stone-400 mb-1">Body Font</p>
            <p className="text-stone-900">{designSpec?.bodyFont || "Outfit"}</p>
          </div>
          <div className="border border-stone-200 p-4">
            <p className="text-[10px] tracking-[0.1em] uppercase text-stone-400 mb-1">Tagline</p>
            <p className="text-stone-900">{designSpec?.tagline || settings.short_description}</p>
          </div>
          <div className="border border-stone-200 p-4">
            <p className="text-[10px] tracking-[0.1em] uppercase text-stone-400 mb-1">CTA</p>
            <p className="text-stone-900">{designSpec?.ctaText || "Shop Now"}</p>
          </div>
        </div>

        <p className="text-xs text-stone-400 mb-4">Your live store preview:</p>
      </div>

      <div className="mx-4 mb-8 border-4 border-stone-200 rounded-lg overflow-hidden" style={{ height: "80vh" }}>
        <iframe src={previewUrl} className="w-full h-full" title="Store Preview" />
      </div>
    </div>
  );
}

export default function PreviewPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: "#FDFCFA" }}>
        <div className="inline-block animate-spin w-8 h-8 border-2 border-stone-300 border-t-stone-900 rounded-full" />
      </div>
    }>
      <PreviewInner />
    </Suspense>
  );
}
