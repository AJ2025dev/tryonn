import { requireMerchant, getServerSupabase } from "@/lib/supabase-server";
import DashboardOverviewClient from "./DashboardOverviewClient";

export const dynamic = "force-dynamic";

export default async function DashboardOverview() {
  const { merchantId } = await requireMerchant();
  const supabase = await getServerSupabase();

  const [prods, orders] = await Promise.all([
    supabase.from("products").select("id", { count: "exact", head: true }).eq("merchant_id", merchantId).eq("is_active", true),
    supabase.from("orders").select("id, order_no, total_amount, status_description, created_on, first_name").eq("merchant_id", merchantId).order("created_on", { ascending: false }),
  ]);

  const allOrders = orders.data || [];
  const revenue = allOrders.reduce((sum: number, o: any) => sum + (o.total_amount || 0), 0);

  const stats = {
    products: prods.count || 0,
    orders: allOrders.length,
    revenue,
    customers: new Set(allOrders.map((o: any) => o.first_name)).size,
  };

  return <DashboardOverviewClient stats={stats} recentOrders={allOrders.slice(0, 5)} />;
}
