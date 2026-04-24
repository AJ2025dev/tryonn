import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function db() { return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!); }

const CATEGORY_MAP: Record<string, string[]> = {
  fashion: ["Men", "Women", "Kids", "Accessories"],
  electronics: ["Phones & Tablets", "Audio", "Computers", "Accessories"],
  food: ["Snacks", "Beverages", "Meals", "Desserts"],
  beauty: ["Skincare", "Makeup", "Haircare", "Fragrances"],
  home: ["Furniture", "Decor", "Kitchen", "Bedding"],
  sports: ["Clothing", "Equipment", "Footwear", "Accessories"],
  books: ["Fiction", "Non-Fiction", "Stationery", "Gifts"],
  jewelry: ["Rings", "Necklaces", "Bracelets", "Earrings"],
  other: ["Category 1", "Category 2", "Category 3", "Category 4"],
};

export async function POST(req: NextRequest) {
  try {
    const { merchantId, brandName, category, style, primaryColor } = await req.json();

    if (!merchantId || !category) {
      return NextResponse.json({ error: "Missing merchantId or category" }, { status: 400 });
    }

    // 1. Create categories for this merchant's type
    // Support multiple categories (comma-separated)
    const categoryList = category.split(",").map((c: string) => c.trim()).filter(Boolean);
    const categoryNames: string[] = [];
    for (const cat of categoryList) {
      const names = CATEGORY_MAP[cat] || [];
      for (const n of names) {
        if (!categoryNames.includes(n)) categoryNames.push(n);
      }
    }
    if (categoryNames.length === 0) categoryNames.push(...(CATEGORY_MAP["other"] || ["General"]));
    const categoryIds: number[] = [];

    for (const catName of categoryNames) {
      const { data: cat } = await db()
        .from("categories")
        .insert({ name: catName, parent_id: null, full_path: catName, is_active: true })
        .select("id")
        .single();
      if (cat) {
        categoryIds.push(cat.id);
      }
    }

    // 2. Generate product ideas from Claude
    const products = await generateProducts(brandName, category, style, categoryNames);

    // 3. Insert products into Supabase
    let productCount = 0;
    for (let i = 0; i < products.length; i++) {
      const product = products[i];
      // Assign to a category (round-robin)
      const catId = categoryIds[i % categoryIds.length] || null;

      const { data: prod, error: prodErr } = await db()
        .from("products")
        .insert({
          merchant_id: merchantId,
          name: product.name,
          description: product.description,
          category_id: catId,
          brand: brandName,
          is_active: true,
          is_available: true,
          is_new: product.isNew || false,
        })
        .select("id")
        .single();

      if (prodErr) {
        console.error("Failed to create product:", prodErr.message);
        continue;
      }

      const variants = product.variants.map((v: any) => ({
        product_id: prod.id,
        size: v.size,
        price: v.price,
        discount: v.discount || 0,
        discount_type: v.discountType || 0,
        stock: v.stock || 25,
        weight: v.weight || 0.5,
        is_active: true,
      }));

      await db().from("product_variants").insert(variants);

      const color = primaryColor?.replace("#", "") || "8B6F4E";
      await db().from("product_images").insert({
        product_id: prod.id,
        image_url: `https://placehold.co/600x800/${color}/ffffff?text=${encodeURIComponent(product.name.split(" ").slice(0, 2).join("+"))}`,
        sort_order: 1,
      });

      productCount++;
    }

    // 4. Create featured categories
    for (let i = 0; i < Math.min(categoryIds.length, 3); i++) {
      await db().from("featured_categories").insert({
        merchant_id: merchantId,
        category_id: categoryIds[i],
        seq_no: i + 1,
        breadcrumb: categoryNames[i],
      });
    }

    return NextResponse.json({ success: true, productCount, categoryCount: categoryIds.length });
  } catch (error: any) {
    console.error("Product generation failed:", error);
    return NextResponse.json({ error: error.message || "Failed to generate products" }, { status: 500 });
  }
}

async function generateProducts(brandName: string, category: string, style: string, categoryNames: string[]) {
  const prompt = `You are a product catalog expert. Generate 6 sample products for an online store.

STORE INFO:
- Brand: ${brandName}
- Category: ${category}
- Style: ${style}
- Store Categories: ${categoryNames.join(", ")}

Generate 6 realistic products that this store would sell. Distribute them across the categories above. Each product needs a name, description, whether it's a new arrival, and 2-3 size/variant options with realistic Indian Rupee prices.

Respond with ONLY valid JSON array, no other text:
[
  {
    "name": "Product Name",
    "description": "2-3 sentence product description",
    "isNew": true,
    "categoryName": "${categoryNames[0]}",
    "variants": [
      { "size": "S", "price": 999, "discount": 0, "discountType": 0, "stock": 25 },
      { "size": "M", "price": 999, "discount": 0, "discountType": 0, "stock": 30 },
      { "size": "L", "price": 1099, "discount": 100, "discountType": 2, "stock": 20 }
    ]
  }
]

Rules:
- Prices in INR (Indian Rupees), realistic for the category
- discountType: 0 = no discount, 1 = percentage, 2 = flat amount
- For fashion: use sizes S, M, L, XL
- For electronics: use variants like "64GB", "128GB" or "Standard", "Pro"
- For food: use variants like "250g", "500g", "1kg" or "Regular", "Large"
- For beauty: use variants like "50ml", "100ml" or "Standard", "Travel Size"
- For other categories: use appropriate variant names
- Mark 2-3 products as isNew: true
- Give some products a discount
- Distribute products across categories: ${categoryNames.join(", ")}
- Make descriptions compelling and specific`;

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY!,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 2000,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Claude API error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  const text = data.content[0].text.trim();
  const cleaned = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
  return JSON.parse(cleaned);
}
