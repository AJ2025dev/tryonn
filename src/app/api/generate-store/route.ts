import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function db() { return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!); }

function dbAdmin() { return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!); }

export async function POST(req: NextRequest) {
  try {
    const brief = await req.json();

    // 1. Check if store URL is taken
    const { data: existing } = await db()
      .from("merchant_settings")
      .select("id")
      .eq("store_url", brief.storeUrl)
      .single();

    if (existing) {
      return NextResponse.json({ error: "This store URL is already taken. Try a different one." }, { status: 400 });
    }

    // 2. Create auth account if email + password provided
    let authUserId = null;
    if (brief.email && brief.password) {
      // Check if email already exists
      const { data: existingEmail } = await db()
        .from("merchants")
        .select("id")
        .eq("email", brief.email)
        .single();

      if (existingEmail) {
        return NextResponse.json({ error: "An account with this email already exists." }, { status: 400 });
      }

      const { data: authData, error: authErr } = await dbAdmin().auth.admin.createUser({
        email: brief.email,
        password: brief.password,
        email_confirm: true,
      });

      if (authErr) {
        // If admin API fails, try regular signup
        const { data: signupData, error: signupErr } = await db().auth.signUp({
          email: brief.email,
          password: brief.password,
        });
        if (signupErr) {
          return NextResponse.json({ error: "Failed to create account: " + signupErr.message }, { status: 400 });
        }
        authUserId = signupData.user?.id || null;
      } else {
        authUserId = authData.user?.id || null;
      }
    }

    // 3. Call Claude API to generate DesignSpec
    const designSpec = await generateDesignSpec(brief);

    // 4. Determine logo URL
    const logoUrl = brief.logoUrl || `https://placehold.co/200x200/${designSpec.primaryColor.replace("#", "")}/${designSpec.textOnPrimary.replace("#", "")}?text=${encodeURIComponent(brief.brandName.substring(0, 2).toUpperCase())}`;

    // 5. Create merchant
    const { data: merchant, error: merchantErr } = await db()
      .from("merchants")
      .insert({
        email: brief.email || `${brief.storeUrl}@appi-fy.ai`,
        mobile_no: brief.phone || "0000000000",
        first_name: brief.brandName,
        last_name: "",
        is_active: true,
        is_verified: true,
        is_ecommerce: true,
        is_online_payment_enabled: true,
        auth_user_id: authUserId,
      })
      .select("id")
      .single();

    if (merchantErr) throw new Error("Failed to create merchant: " + merchantErr.message);

    // 6. Save merchant settings
    const { error: settingsErr } = await db()
      .from("merchant_settings")
      .insert({
        merchant_id: merchant.id,
        app_name: brief.brandName,
        short_description: designSpec.tagline || brief.tagline || `Welcome to ${brief.brandName}`,
        description: brief.description || designSpec.description || "",
        logo: logoUrl,
        primary_color: designSpec.primaryColor,
        secondary_color: designSpec.secondaryColor,
        accent_color: designSpec.accentColor,
        background_color: designSpec.backgroundColor,
        text_color: designSpec.textColor,
        font_family: designSpec.fontFamily,
        design_style: brief.style,
        store_url: brief.storeUrl,
      });

    if (settingsErr) throw new Error("Failed to save settings: " + settingsErr.message);

    // 7. Save MerchantBrief + DesignSpec
    await db().from("merchant_briefs").insert({ merchant_id: merchant.id, brief_json: brief, status: "approved" });
    await db().from("design_specs").insert({ merchant_id: merchant.id, spec_json: designSpec, status: "applied" });

    // 8. Create banner
    await db().from("banners").insert({
      merchant_id: merchant.id,
      name: designSpec.heroBannerText || `Welcome to ${brief.brandName}`,
      image_url: `https://placehold.co/1200x400/${designSpec.primaryColor.replace("#", "")}/${designSpec.textOnPrimary.replace("#", "")}?text=${encodeURIComponent(designSpec.heroBannerText || brief.brandName)}`,
      banner_type: 1,
      is_active: true,
    });

    return NextResponse.json({
      merchantId: merchant.id,
      storeUrl: brief.storeUrl,
      designSpec,
      hasAuth: !!authUserId,
    });
  } catch (error: any) {
    console.error("Store generation failed:", error);
    return NextResponse.json({ error: error.message || "Generation failed" }, { status: 500 });
  }
}

async function generateDesignSpec(brief: any) {
  const prompt = `You are a world-class e-commerce design expert. A merchant wants to create an online store. Based on their input, generate a complete design specification.

MERCHANT INPUT:
- Brand Name: ${brief.brandName}
- Category: ${brief.category}
- Tagline: ${brief.tagline || "none provided"}
- Design Style: ${brief.style}
- Target Audience: ${brief.audience || "general"}
- Color Preference: ${brief.colorPreference || "AI decides"}
- Brand Description: ${brief.description || "none provided"}

Generate a JSON design spec. Choose colors, fonts, and text that perfectly match this brand.

Respond with ONLY valid JSON, no other text:
{
  "primaryColor": "#hex",
  "secondaryColor": "#hex",
  "accentColor": "#hex",
  "backgroundColor": "#hex",
  "textColor": "#hex",
  "textOnPrimary": "#hex",
  "fontFamily": "font name (from: Cormorant Garamond, Playfair Display, Libre Baskerville, Montserrat, Poppins, Raleway, Lora, DM Sans, Space Grotesk, Sora)",
  "bodyFont": "body font name",
  "tagline": "short tagline (max 8 words)",
  "description": "2-sentence brand description",
  "heroBannerText": "hero text (max 5 words)",
  "heroSubtext": "one line hero subtext",
  "uspItems": ["4 short USP phrases"],
  "ctaText": "CTA button text",
  "heroHeadline1": "first word of 3-line headline",
  "heroHeadline2": "italic accent word",
  "heroHeadline3": "third word",
  "editorialTitle1": "editorial section word 1",
  "editorialTitle2": "editorial italic word 2"
}`;

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY!,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1000,
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
