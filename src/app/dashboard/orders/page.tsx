import { requireMerchant, getServerSupabase } from "@/lib/supabase-server";
import OrdersClient from "./OrdersClient";

export const dynamic = "force-dynamic";

export default async function OrdersPage() {
  const { merchantId } = await requireMerchant();
  const supabase = await getServerSupabase();

  const { data } = await supabase
    .from("orders")
    .select("*")
    .eq("merchant_id", merchantId)
    .order("created_on", { ascending: false });

  return <OrdersClient orders={data || []} merchantId={merchantId} />;
}
