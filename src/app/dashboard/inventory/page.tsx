import { requireMerchant, getServerSupabase } from "@/lib/supabase-server";
import InventoryClient from "./InventoryClient";

export const dynamic = "force-dynamic";

export default async function InventoryPage() {
  const { merchantId } = await requireMerchant();
  const supabase = await getServerSupabase();

  const { data } = await supabase
    .from("products")
    .select("id, name, brand, product_variants(id, size, price, stock), product_images(image_url, sort_order)")
    .eq("merchant_id", merchantId)
    .eq("is_active", true)
    .order("name");

  return <InventoryClient products={data || []} merchantId={merchantId} />;
}
