"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createBrowserClient } from "@supabase/ssr";

function getSupabase() {
  return createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
}

type Variant = { id?: number; size: string; price: number; discount: number; discountType: number; stock: number };

interface Props {
  merchantId: number;
  paramId: string;
}

export default function ProductFormClient({ merchantId, paramId }: Props) {
  const router = useRouter();
  const productId = paramId === "new" ? null : Number(paramId);
  const isEdit = productId !== null;

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [existingImages, setExistingImages] = useState<any[]>([]);
  const [form, setForm] = useState({
    name: "",
    description: "",
    brand: "",
    isActive: true,
    isAvailable: true,
    isNew: false,
  });
  const [variants, setVariants] = useState<Variant[]>([
    { size: "", price: 0, discount: 0, discountType: 0, stock: 0 },
  ]);

  useEffect(() => {
    if (isEdit) loadProduct();
  }, [productId]);

  async function loadProduct() {
    const supabase = getSupabase();
    const { data } = await supabase
      .from("products")
      .select("*, product_variants(*), product_images(*)")
      .eq("id", productId)
      .eq("merchant_id", merchantId)
      .single();
    if (data) {
      setForm({
        name: data.name || "",
        description: data.description || "",
        brand: data.brand || "",
        isActive: data.is_active,
        isAvailable: data.is_available,
        isNew: data.is_new,
      });
      setVariants(
        (data.product_variants || []).map((v: any) => ({
          id: v.id,
          size: v.size,
          price: v.price,
          discount: v.discount || 0,
          discountType: v.discount_type || 0,
          stock: v.stock || 0,
        }))
      );
      setExistingImages(data.product_images || []);
    }
  }

  function updateForm(field: string, value: any) {
    setForm(prev => ({ ...prev, [field]: value }));
  }

  function updateVariant(index: number, field: string, value: any) {
    setVariants(prev => prev.map((v, i) => i === index ? { ...v, [field]: value } : v));
  }

  function addVariant() {
    setVariants(prev => [...prev, { size: "", price: 0, discount: 0, discountType: 0, stock: 0 }]);
  }

  function removeVariant(index: number) {
    if (variants.length <= 1) return;
    setVariants(prev => prev.filter((_, i) => i !== index));
  }

  function handleImageSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || []);
    setImageFiles(prev => [...prev, ...files]);
  }

  async function removeExistingImage(imageId: number) {
    const supabase = getSupabase();
    await supabase.from("product_images").delete().eq("id", imageId);
    setExistingImages(prev => prev.filter(img => img.id !== imageId));
  }

  async function save() {
    if (!form.name.trim()) { setError("Product name is required"); return; }
    if (variants.some(v => !v.size.trim())) { setError("All variants need a size"); return; }
    if (variants.some(v => v.price <= 0)) { setError("All variants need a price greater than 0"); return; }
    setError(""); setSaving(true);

    try {
      const supabase = getSupabase();

      let prodId = productId;
      if (isEdit) {
        await supabase.from("products").update({
          name: form.name,
          description: form.description,
          brand: form.brand,
          is_active: form.isActive,
          is_available: form.isAvailable,
          is_new: form.isNew,
        }).eq("id", productId).eq("merchant_id", merchantId);
      } else {
        const { data, error: err } = await supabase.from("products").insert({
          merchant_id: merchantId,
          name: form.name,
          description: form.description,
          brand: form.brand,
          is_active: form.isActive,
          is_available: form.isAvailable,
          is_new: form.isNew,
        }).select("id").single();
        if (err) throw new Error(err.message);
        prodId = data.id;
      }

      if (isEdit) {
        await supabase.from("product_variants").delete().eq("product_id", prodId);
      }
      const variantRows = variants.map(v => ({
        product_id: prodId,
        size: v.size,
        price: v.price,
        discount: v.discount,
        discount_type: v.discountType,
        stock: v.stock,
        is_active: true,
      }));
      await supabase.from("product_variants").insert(variantRows);

      for (let i = 0; i < imageFiles.length; i++) {
        const file = imageFiles[i];
        const ext = file.name.split(".").pop();
        const fileName = `product-${prodId}-${Date.now()}-${i}.${ext}`;
        const { error: uploadErr } = await supabase.storage
          .from("product-images")
          .upload(fileName, file, { contentType: file.type });
        if (uploadErr) {
          console.error("Image upload failed:", uploadErr.message);
          continue;
        }
        const { data: urlData } = supabase.storage.from("product-images").getPublicUrl(fileName);
        await supabase.from("product_images").insert({
          product_id: prodId,
          image_url: urlData.publicUrl,
          sort_order: existingImages.length + i + 1,
        });
      }

      router.push("/dashboard/products");
    } catch (e: any) {
      setError(e.message || "Failed to save product");
    }
    setSaving(false);
  }

  const inputClass = "w-full px-4 py-2.5 border border-stone-200 rounded-lg text-sm text-stone-900 bg-white placeholder:text-stone-400 focus:outline-none focus:border-stone-400 transition-colors";

  return (
    <div className="p-8 max-w-3xl">
      <div className="flex items-center gap-3 mb-8">
        <Link href="/dashboard/products" className="text-stone-400 hover:text-stone-900 transition-colors">&larr;</Link>
        <h1 className="text-2xl font-semibold text-stone-900">{isEdit ? "Edit Product" : "Add Product"}</h1>
      </div>

      {error && <div className="mb-6 p-4 border border-red-200 text-sm text-red-700 bg-red-50/50 rounded-lg">{error}</div>}

      <div className="space-y-8">
        <div className="bg-white border border-stone-100 rounded-xl p-6">
          <h2 className="text-xs tracking-[0.15em] uppercase text-stone-900 font-medium mb-5">Basic Information</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-xs text-stone-500 mb-1.5">Product Name *</label>
              <input value={form.name} onChange={e => updateForm("name", e.target.value)} className={inputClass} placeholder="e.g. Classic Black T-Shirt" />
            </div>
            <div>
              <label className="block text-xs text-stone-500 mb-1.5">Description</label>
              <textarea value={form.description} onChange={e => updateForm("description", e.target.value)} rows={3} className={inputClass + " resize-none"} placeholder="Product description..." />
            </div>
            <div>
              <label className="block text-xs text-stone-500 mb-1.5">Brand</label>
              <input value={form.brand} onChange={e => updateForm("brand", e.target.value)} className={inputClass} placeholder="Brand name" />
            </div>
            <div className="flex gap-6">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={form.isActive} onChange={e => updateForm("isActive", e.target.checked)} className="w-4 h-4 accent-stone-900" />
                <span className="text-sm text-stone-700">Active</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={form.isAvailable} onChange={e => updateForm("isAvailable", e.target.checked)} className="w-4 h-4 accent-stone-900" />
                <span className="text-sm text-stone-700">Available</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={form.isNew} onChange={e => updateForm("isNew", e.target.checked)} className="w-4 h-4 accent-stone-900" />
                <span className="text-sm text-stone-700">New Arrival</span>
              </label>
            </div>
          </div>
        </div>

        <div className="bg-white border border-stone-100 rounded-xl p-6">
          <h2 className="text-xs tracking-[0.15em] uppercase text-stone-900 font-medium mb-5">Images</h2>
          <div className="flex flex-wrap gap-3 mb-4">
            {existingImages.map(img => (
              <div key={img.id} className="relative w-24 h-24 rounded-lg overflow-hidden border border-stone-200">
                <img src={img.image_url} alt="" className="w-full h-full object-cover" />
                <button onClick={() => removeExistingImage(img.id)} className="absolute top-1 right-1 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center hover:bg-red-700">x</button>
              </div>
            ))}
            {imageFiles.map((file, i) => (
              <div key={i} className="relative w-24 h-24 rounded-lg overflow-hidden border border-stone-200">
                <img src={URL.createObjectURL(file)} alt="" className="w-full h-full object-cover" />
                <button onClick={() => setImageFiles(prev => prev.filter((_, j) => j !== i))} className="absolute top-1 right-1 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center hover:bg-red-700">x</button>
              </div>
            ))}
            <label className="w-24 h-24 border-2 border-dashed border-stone-200 rounded-lg flex items-center justify-center cursor-pointer hover:border-stone-400 transition-colors">
              <span className="text-2xl text-stone-300">+</span>
              <input type="file" accept="image/*" multiple className="hidden" onChange={handleImageSelect} />
            </label>
          </div>
          <p className="text-xs text-stone-400">Upload product images. First image is the main display image.</p>
        </div>

        <div className="bg-white border border-stone-100 rounded-xl p-6">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-xs tracking-[0.15em] uppercase text-stone-900 font-medium">Variants &amp; Pricing</h2>
            <button onClick={addVariant} className="text-xs text-stone-500 hover:text-stone-900 border border-stone-200 px-3 py-1.5 rounded-lg hover:border-stone-400 transition-colors">
              + Add Variant
            </button>
          </div>
          <div className="space-y-4">
            {variants.map((v, i) => (
              <div key={i} className="grid grid-cols-5 gap-3 items-end">
                <div>
                  <label className="block text-xs text-stone-500 mb-1.5">Size/Variant *</label>
                  <input value={v.size} onChange={e => updateVariant(i, "size", e.target.value)} className={inputClass} placeholder="S, M, L, 500g..." />
                </div>
                <div>
                  <label className="block text-xs text-stone-500 mb-1.5">Price (INR) *</label>
                  <input type="number" value={v.price || ""} onChange={e => updateVariant(i, "price", Number(e.target.value))} className={inputClass} placeholder="999" />
                </div>
                <div>
                  <label className="block text-xs text-stone-500 mb-1.5">Discount</label>
                  <input type="number" value={v.discount || ""} onChange={e => updateVariant(i, "discount", Number(e.target.value))} className={inputClass} placeholder="0" />
                </div>
                <div>
                  <label className="block text-xs text-stone-500 mb-1.5">Stock</label>
                  <input type="number" value={v.stock || ""} onChange={e => updateVariant(i, "stock", Number(e.target.value))} className={inputClass} placeholder="25" />
                </div>
                <div>
                  {variants.length > 1 && (
                    <button onClick={() => removeVariant(i)} className="text-xs text-red-400 hover:text-red-700 px-3 py-2.5 border border-red-200 rounded-lg hover:border-red-400 transition-colors w-full">
                      Remove
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-4">
          <button onClick={save} disabled={saving} className="px-8 py-3 text-xs tracking-[0.15em] uppercase bg-stone-900 text-white hover:bg-stone-800 rounded-lg transition-colors disabled:opacity-50">
            {saving ? "Saving..." : isEdit ? "Update Product" : "Create Product"}
          </button>
          <Link href="/dashboard/products" className="text-xs text-stone-400 hover:text-stone-700 transition-colors">Cancel</Link>
        </div>
      </div>
    </div>
  );
}
