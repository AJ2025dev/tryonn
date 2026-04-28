import { requireMerchant, getServerSupabase } from "@/lib/supabase-server";
import ProductsClient from "./ProductsClient";

export const dynamic = "force-dynamic";

export default async function ProductsPage() {
  const { merchantId } = await requireMerchant();
  const supabase = await getServerSupabase();

  const { data } = await supabase
    .from("products")
    .select("id, name, brand, is_active, is_available, is_new, created_on, product_variants(price, stock), product_images(image_url, sort_order)")
    .eq("merchant_id", merchantId)
    .order("created_on", { ascending: false });

  return <ProductsClient products={data || []} merchantId={merchantId} />;
}
