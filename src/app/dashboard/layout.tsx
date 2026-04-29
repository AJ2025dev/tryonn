import { getCurrentMerchant, getServerSupabase } from "@/lib/supabase-server";
import DashboardShell from "./DashboardShell";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  // getCurrentMerchant returns null if not logged in.
  // We don't use requireMerchant() here because the login page
  // is a child of this layout and must render without auth.
  const result = await getCurrentMerchant();
  console.log("[layout] result:", { hasResult: !!result, merchantId: result?.merchantId });

  // Not logged in — render children bare (login page will render itself)
  if (!result) {
    console.log("[layout] no result, rendering bare children");
    return <>{children}</>;
  }

  // Fetch merchant settings for the sidebar
  const supabase = await getServerSupabase();
  const { data: settings, error: settingsError } = await supabase
    .from("merchant_settings")
    .select("app_name, primary_color, logo, store_url")
    .eq("merchant_id", result.merchantId)
    .single();
  console.log("[layout] settings query:", {
    hasSettings: !!settings,
    merchantId: result.merchantId,
    error: settingsError?.message ?? null,
  });

  console.log("[layout] rendering DashboardShell");
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
