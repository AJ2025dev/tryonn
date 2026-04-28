import { getCurrentMerchant, getServerSupabase } from "@/lib/supabase-server";
import DashboardShell from "./DashboardShell";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  // getCurrentMerchant returns null if not logged in.
  // We don't use requireMerchant() here because the login page
  // is a child of this layout and must render without auth.
  const result = await getCurrentMerchant();

  // Not logged in — render children bare (login page will render itself)
  if (!result) {
    return <>{children}</>;
  }

  // Fetch merchant settings for the sidebar
  const supabase = await getServerSupabase();
  const { data: settings } = await supabase
    .from("merchant_settings")
    .select("app_name, primary_color, logo, store_url")
    .eq("merchant_id", result.merchantId)
    .single();

  return (
    <DashboardShell
      merchantId={result.merchantId}
      userEmail={result.merchant.email}
      settings={settings}
    >
      {children}
    </DashboardShell>
  );
}
