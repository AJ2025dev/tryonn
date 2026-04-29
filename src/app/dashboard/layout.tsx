import { requireMerchant, getServerSupabase } from "@/lib/supabase-server";
import DashboardShell from "./DashboardShell";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { merchantId, merchant } = await requireMerchant();

  const supabase = await getServerSupabase();
  const { data: settings } = await supabase
    .from("merchant_settings")
    .select("app_name, primary_color, logo, store_url")
    .eq("merchant_id", merchantId)
    .single();

  return (
    <DashboardShell
      merchantId={merchantId}
      userEmail={merchant.email}
      settings={settings}
    >
      {children}
    </DashboardShell>
  );
}
