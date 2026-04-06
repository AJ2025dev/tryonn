"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

const CATEGORIES = [
  { id: "fashion", label: "Fashion & Apparel", icon: "👗" },
  { id: "electronics", label: "Electronics & Gadgets", icon: "📱" },
  { id: "food", label: "Food & Beverages", icon: "🍕" },
  { id: "beauty", label: "Beauty & Personal Care", icon: "💄" },
  { id: "home", label: "Home & Living", icon: "🏠" },
  { id: "sports", label: "Sports & Fitness", icon: "⚽" },
  { id: "books", label: "Books & Stationery", icon: "📚" },
  { id: "jewelry", label: "Jewelry & Accessories", icon: "💎" },
  { id: "other", label: "Other", icon: "🛍️" },
];

const STYLES = [
  { id: "minimal", label: "Clean & Minimal", desc: "Simple, spacious, modern" },
  { id: "bold", label: "Bold & Vibrant", desc: "Strong colors, energetic" },
  { id: "luxury", label: "Warm & Premium", desc: "Elegant, sophisticated" },
  { id: "playful", label: "Fun & Playful", desc: "Colorful, friendly, casual" },
  { id: "editorial", label: "Editorial & Magazine", desc: "Typography-focused, artistic" },
  { id: "dark", label: "Dark & Sleek", desc: "Dark backgrounds, high contrast" },
];

const AUDIENCES = [
  { id: "young", label: "Gen Z (18-25)" },
  { id: "millennials", label: "Millennials (25-40)" },
  { id: "premium", label: "Premium / Luxury buyers" },
  { id: "families", label: "Families" },
  { id: "professionals", label: "Working Professionals" },
  { id: "everyone", label: "Everyone" },
];

export default function OnboardPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [generating, setGenerating] = useState(false);
  const [generatingStatus, setGeneratingStatus] = useState("");
  const [error, setError] = useState("");
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState("");
  const [form, setForm] = useState({
    brandName: "", tagline: "", categories: [] as string[], style: "", audience: "",
    colorPreference: "", description: "", storeUrl: "", logoUrl: "",
    email: "", password: "", phone: "",
  });

  function update(field: string, value: string) { setForm(prev => ({ ...prev, [field]: value })); }

  function handleLogoSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { setError("Logo must be under 5MB"); return; }
    setLogoFile(file);
    setLogoPreview(URL.createObjectURL(file));
    setError("");
  }

  function removeLogo() { setLogoFile(null); setLogoPreview(""); update("logoUrl", ""); }

  function nextStep() {
    if (step === 1 && (!form.brandName.trim() || form.categories.length === 0)) { setError("Please fill in your brand name and select at least one category"); return; }
    if (step === 2 && !form.style) { setError("Please select a design style"); return; }
    setError(""); setStep(step + 1);
  }

  function prevStep() { setError(""); setStep(step - 1); }

  async function uploadLogo(): Promise<string> {
    if (!logoFile) return "";
    const ext = logoFile.name.split(".").pop();
    const fileName = `${form.storeUrl}-${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("merchant-logos").upload(fileName, logoFile, { contentType: logoFile.type });
    if (error) throw new Error("Logo upload failed: " + error.message);
    const { data: urlData } = supabase.storage.from("merchant-logos").getPublicUrl(fileName);
    return urlData.publicUrl;
  }

  async function generateStore() {
    if (!form.storeUrl.trim()) { setError("Please choose a store URL"); return; }
    if (!form.email.trim()) { setError("Email is required for your merchant account"); return; }
    if (!form.password.trim() || form.password.length < 6) { setError("Password must be at least 6 characters"); return; }
    const urlRegex = /^[a-z0-9-]+$/;
    if (!urlRegex.test(form.storeUrl)) { setError("Store URL can only contain lowercase letters, numbers, and hyphens"); return; }
    setError(""); setGenerating(true);

    try {
      setGeneratingStatus("Uploading logo...");
      let logoUrl = "";
      if (logoFile) { try { logoUrl = await uploadLogo(); } catch (e) { console.warn("Logo upload failed, continuing without"); } }

      setGeneratingStatus("AI is designing your store...");
      const res = await fetch("/api/generate-store", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, category: form.categories.join(","), logoUrl }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);

      setGeneratingStatus("Creating sample products...");
      await fetch("/api/generate-products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ merchantId: data.merchantId, brandName: form.brandName, category: form.categories.join(","), style: form.style, primaryColor: data.designSpec.primaryColor }),
      });

      setGeneratingStatus("Done! Redirecting...");

      // Auto-login if auth was created
      if (data.hasAuth) {
        await supabase.auth.signInWithPassword({ email: form.email, password: form.password });
      }

      router.push(`/onboard/preview?merchant=${data.merchantId}`);
    } catch (e: any) {
      setError(e.message || "Failed to generate store");
      setGenerating(false);
      setGeneratingStatus("");
    }
  }

  const totalSteps = 4;
  const inputClass = "w-full px-4 py-3 border border-stone-200 text-sm text-stone-900 bg-white placeholder:text-stone-400 focus:outline-none focus:border-stone-500 transition-colors";

  return (
    <div className="min-h-screen" style={{ backgroundColor: "#FDFCFA" }}>
      <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,500;0,600;0,700;1,400&family=Outfit:wght@300;400;500;600&display=swap" rel="stylesheet" />

      <header className="border-b border-stone-100 bg-white">
        <div className="max-w-3xl mx-auto px-6 py-5 flex items-center justify-between">
          <a href="https://appi-fy.ai" className="text-2xl font-light tracking-wide text-stone-900" style={{ fontFamily: "'Cormorant Garamond', serif" }}>Appify</a>
          <span className="text-xs tracking-[0.15em] uppercase text-stone-400" style={{ fontFamily: "'Outfit', sans-serif" }}>Create Your Store</span>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-6 py-12" style={{ fontFamily: "'Outfit', sans-serif" }}>
        <div className="flex items-center gap-2 mb-12">{[1,2,3,4].map(s => <div key={s} className="flex-1"><div className={`h-1 rounded-full transition-colors ${s <= step ? "bg-stone-900" : "bg-stone-200"}`} /></div>)}</div>

        {error && <div className="mb-8 p-4 border border-red-200 text-sm text-red-700 bg-red-50/50 rounded">{error}</div>}

        {/* Step 1 */}
        {step === 1 && (
          <div>
            <p className="text-xs tracking-[0.2em] uppercase text-stone-400 mb-3">Step 1 of {totalSteps}</p>
            <h1 className="text-3xl font-light text-stone-900 mb-2" style={{ fontFamily: "'Cormorant Garamond', serif" }}>Tell us about your brand</h1>
            <p className="text-sm text-stone-400 mb-10">The basics — what's your business called and what do you sell?</p>
            <div className="space-y-6">
              <div><label className="block text-xs tracking-[0.1em] uppercase text-stone-700 font-medium mb-2">Brand Name *</label><input value={form.brandName} onChange={e => update("brandName", e.target.value)} className="w-full px-4 py-3.5 border border-stone-200 text-stone-900 bg-white placeholder:text-stone-400 focus:outline-none focus:border-stone-500 text-lg" placeholder="e.g. StyleVault, TechBazaar" /></div>
              <div><label className="block text-xs tracking-[0.1em] uppercase text-stone-700 font-medium mb-2">Tagline (optional)</label><input value={form.tagline} onChange={e => update("tagline", e.target.value)} className={inputClass} placeholder="e.g. Curated fashion for modern living" /></div>
              <div>
                <label className="block text-xs tracking-[0.1em] uppercase text-stone-700 font-medium mb-2">Brand Logo (optional)</label>
                <p className="text-xs text-stone-400 mb-3">PNG or JPG, max 5MB. Skip to let AI generate one.</p>
                {logoPreview ? (
                  <div className="flex items-center gap-4"><div className="w-20 h-20 rounded-lg overflow-hidden border border-stone-200"><img src={logoPreview} alt="" className="w-full h-full object-cover" /></div><div><p className="text-sm text-stone-700">{logoFile?.name}</p><button onClick={removeLogo} className="text-xs text-red-500 hover:text-red-700">Remove</button></div></div>
                ) : (
                  <label className="flex items-center justify-center w-full h-24 border-2 border-dashed border-stone-200 hover:border-stone-400 cursor-pointer rounded-lg"><div className="text-center"><svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6 mx-auto mb-1 text-stone-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg><span className="text-xs text-stone-400">Click to upload</span></div><input type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={handleLogoSelect} /></label>
                )}
              </div>
              <div><label className="block text-xs tracking-[0.1em] uppercase text-stone-700 font-medium mb-4">What do you sell? * (select all that apply)</label><div className="grid grid-cols-3 gap-3">{CATEGORIES.map(cat => <button key={cat.id} onClick={() => setForm(prev => ({ ...prev, categories: prev.categories.includes(cat.id) ? prev.categories.filter((c: string) => c !== cat.id) : [...prev.categories, cat.id] }))} className={`p-4 border text-left transition-all ${form.categories.includes(cat.id) ? "border-stone-900 bg-stone-50" : "border-stone-200 hover:border-stone-400"}`}><span className="text-xl mb-2 block">{cat.icon}</span><span className="text-xs text-stone-700">{cat.label}</span></button>)}</div></div>
            </div>
          </div>
        )}

        {/* Step 2 */}
        {step === 2 && (
          <div>
            <p className="text-xs tracking-[0.2em] uppercase text-stone-400 mb-3">Step 2 of {totalSteps}</p>
            <h1 className="text-3xl font-light text-stone-900 mb-2" style={{ fontFamily: "'Cormorant Garamond', serif" }}>Choose your style</h1>
            <p className="text-sm text-stone-400 mb-10">How should your store look and feel?</p>
            <div className="space-y-6">
              <div><label className="block text-xs tracking-[0.1em] uppercase text-stone-700 font-medium mb-4">Design Style *</label><div className="grid grid-cols-2 gap-3">{STYLES.map(s => <button key={s.id} onClick={() => update("style", s.id)} className={`p-5 border text-left transition-all ${form.style === s.id ? "border-stone-900 bg-stone-50" : "border-stone-200 hover:border-stone-400"}`}><p className="text-sm font-medium text-stone-900 mb-1">{s.label}</p><p className="text-xs text-stone-400">{s.desc}</p></button>)}</div></div>
              <div><label className="block text-xs tracking-[0.1em] uppercase text-stone-700 font-medium mb-4">Target Audience</label><div className="grid grid-cols-3 gap-3">{AUDIENCES.map(a => <button key={a.id} onClick={() => update("audience", a.id)} className={`p-3 border text-center transition-all ${form.audience === a.id ? "border-stone-900 bg-stone-50" : "border-stone-200 hover:border-stone-400"}`}><span className="text-xs text-stone-700">{a.label}</span></button>)}</div></div>
            </div>
          </div>
        )}

        {/* Step 3 */}
        {step === 3 && (
          <div>
            <p className="text-xs tracking-[0.2em] uppercase text-stone-400 mb-3">Step 3 of {totalSteps}</p>
            <h1 className="text-3xl font-light text-stone-900 mb-2" style={{ fontFamily: "'Cormorant Garamond', serif" }}>Final details</h1>
            <p className="text-sm text-stone-400 mb-10">Color preferences and brand description.</p>
            <div className="space-y-6">
              <div><label className="block text-xs tracking-[0.1em] uppercase text-stone-700 font-medium mb-2">Color Preference (optional)</label><input value={form.colorPreference} onChange={e => update("colorPreference", e.target.value)} className={inputClass} placeholder="e.g. Blue and gold, earth tones" /></div>
              <div><label className="block text-xs tracking-[0.1em] uppercase text-stone-700 font-medium mb-2">Describe your brand (optional)</label><textarea value={form.description} onChange={e => update("description", e.target.value)} rows={4} className={inputClass + " resize-none"} placeholder="What makes your brand special?" /></div>
            </div>
          </div>
        )}

        {/* Step 4 */}
        {step === 4 && (
          <div>
            <p className="text-xs tracking-[0.2em] uppercase text-stone-400 mb-3">Step 4 of {totalSteps}</p>
            <h1 className="text-3xl font-light text-stone-900 mb-2" style={{ fontFamily: "'Cormorant Garamond', serif" }}>Set up your account</h1>
            <p className="text-sm text-stone-400 mb-10">Choose your store URL and create your merchant account.</p>
            <div className="space-y-6">
              <div>
                <label className="block text-xs tracking-[0.1em] uppercase text-stone-700 font-medium mb-2">Store URL *</label>
                <div className="flex items-center border border-stone-200 overflow-hidden">
                  <input value={form.storeUrl} onChange={e => update("storeUrl", e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))} className="flex-1 px-4 py-3.5 text-stone-900 bg-white placeholder:text-stone-400 focus:outline-none text-lg" placeholder="yourbrand" />
                  <span className="px-4 py-3.5 bg-stone-50 text-stone-500 text-sm border-l border-stone-200">.appi-fy.ai</span>
                </div>
                {form.storeUrl && <p className="text-xs text-stone-400 mt-2">Your store: <span className="text-stone-700 font-medium">{form.storeUrl}.appi-fy.ai</span></p>}
              </div>

              {/* Account credentials */}
              <div className="border-t border-stone-100 pt-6">
                <p className="text-xs tracking-[0.1em] uppercase text-stone-700 font-medium mb-4">Merchant Account</p>
                <p className="text-xs text-stone-400 mb-4">You'll use these to log in to your dashboard and manage your store.</p>
                <div className="space-y-4">
                  <div><label className="block text-xs text-stone-500 mb-1.5">Email *</label><input type="email" value={form.email} onChange={e => update("email", e.target.value)} className={inputClass} placeholder="you@yourbrand.com" /></div>
                  <div><label className="block text-xs text-stone-500 mb-1.5">Password * (min 6 characters)</label><input type="password" value={form.password} onChange={e => update("password", e.target.value)} className={inputClass} placeholder="Choose a strong password" /></div>
                  <div><label className="block text-xs text-stone-500 mb-1.5">Phone (optional)</label><input value={form.phone} onChange={e => update("phone", e.target.value.replace(/\D/g, "").slice(0, 10))} className={inputClass} placeholder="9876543210" /></div>
                </div>
              </div>

              {/* Summary */}
              <div className="border border-stone-200 p-6">
                <p className="text-xs tracking-[0.2em] uppercase text-stone-900 font-medium mb-4">Your Store Summary</p>
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between"><span className="text-stone-400">Brand</span><span className="text-stone-900">{form.brandName || "—"}</span></div>
                  <div className="flex justify-between"><span className="text-stone-400">Category</span><span className="text-stone-900 capitalize">{form.category || "—"}</span></div>
                  <div className="flex justify-between"><span className="text-stone-400">Style</span><span className="text-stone-900 capitalize">{form.style || "—"}</span></div>
                  <div className="flex justify-between"><span className="text-stone-400">Logo</span><span className="text-stone-900">{logoFile ? "Uploaded" : "AI generated"}</span></div>
                  <div className="flex justify-between"><span className="text-stone-400">URL</span><span className="text-stone-900">{form.storeUrl || "—"}.appi-fy.ai</span></div>
                  <div className="flex justify-between"><span className="text-stone-400">Account</span><span className="text-stone-900">{form.email || "—"}</span></div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Navigation */}
        <div className="flex items-center justify-between mt-12 pt-8 border-t border-stone-100">
          {step > 1 ? <button onClick={prevStep} className="text-xs tracking-[0.1em] uppercase text-stone-400 hover:text-stone-900 transition-colors">← Back</button> : <div />}
          {step < totalSteps ? (
            <button onClick={nextStep} className="px-8 py-3 text-xs tracking-[0.2em] uppercase bg-stone-900 text-white hover:bg-stone-800 transition-colors">Continue</button>
          ) : (
            <button onClick={generateStore} disabled={generating} className="px-10 py-3.5 text-xs tracking-[0.2em] uppercase text-white transition-all disabled:opacity-50" style={{ backgroundColor: generating ? "#4A7C59" : "#E94560" }}>
              {generating ? "Generating..." : "Generate My Store"}
            </button>
          )}
        </div>

        {generating && (
          <div className="mt-8 text-center">
            <div className="inline-block animate-spin w-6 h-6 border-2 border-stone-300 border-t-stone-900 rounded-full mb-3" />
            <p className="text-sm text-stone-500">{generatingStatus}</p>
          </div>
        )}
      </main>
    </div>
  );
}
