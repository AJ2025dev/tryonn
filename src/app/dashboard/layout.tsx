"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

const NAV = [
  { href: "/dashboard", label: "Overview", icon: "◻" },
  { href: "/dashboard/products", label: "Products", icon: "◈" },
  { href: "/dashboard/orders", label: "Orders", icon: "◇" },
  { href: "/dashboard/inventory", label: "Inventory", icon: "▤" },
  { href: "/dashboard/settings", label: "Settings", icon: "⚙" },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [settings, setSettings] = useState<any>(null);
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [merchantId, setMerchantId] = useState<number | null>(null);

  // Skip auth for login page
  const isLoginPage = pathname === "/dashboard/login";

  useEffect(() => {
    if (isLoginPage) { setLoading(false); return; }
    checkAuth();
  }, [pathname]);

  async function checkAuth() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      router.push("/dashboard/login");
      return;
    }
    setUser(user);

    // Find merchant linked to this auth user
    const { data: merchant } = await supabase
      .from("merchants")
      .select("id")
      .eq("auth_user_id", user.id)
      .single();

    if (merchant) {
      setMerchantId(merchant.id);
      // Store in cookie for other components
      document.cookie = `merchant-id=${merchant.id}; path=/`;

      const { data: s } = await supabase
        .from("merchant_settings")
        .select("app_name, primary_color, logo, store_url")
        .eq("merchant_id", merchant.id)
        .single();
      setSettings(s);
    } else {
      // User exists but no merchant linked — check by email
      const { data: merchantByEmail } = await supabase
        .from("merchants")
        .select("id")
        .eq("email", user.email)
        .single();

      if (merchantByEmail) {
        // Link the auth user to the merchant
        await supabase.from("merchants").update({ auth_user_id: user.id }).eq("id", merchantByEmail.id);
        setMerchantId(merchantByEmail.id);
        document.cookie = `merchant-id=${merchantByEmail.id}; path=/`;

        const { data: s } = await supabase
          .from("merchant_settings")
          .select("app_name, primary_color, logo, store_url")
          .eq("merchant_id", merchantByEmail.id)
          .single();
        setSettings(s);
      }
    }
    setLoading(false);
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/dashboard/login");
  }

  // Don't wrap login page in dashboard layout
  if (isLoginPage) return <>{children}</>;

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: "#F8F7F4", fontFamily: "'Outfit', sans-serif" }}>
      <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700&display=swap" rel="stylesheet" />
      <div className="text-center">
        <div className="inline-block animate-spin w-8 h-8 border-2 border-stone-300 border-t-stone-900 rounded-full mb-4" />
        <p className="text-sm text-stone-500">Loading dashboard...</p>
      </div>
    </div>
  );

  const accent = settings?.primary_color || "#1C1917";

  return (
    <div className="min-h-screen flex" style={{ fontFamily: "'Outfit', sans-serif", backgroundColor: "#F8F7F4" }}>
      <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700&display=swap" rel="stylesheet" />

      {/* Sidebar */}
      <aside className="w-60 bg-white border-r border-stone-100 flex flex-col flex-shrink-0">
        <div className="p-4 border-b border-stone-100">
          <div className="flex items-center gap-3">
            {settings?.logo ? (
              <img src={settings.logo} alt="" className="w-8 h-8 rounded-full object-cover flex-shrink-0" />
            ) : (
              <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0" style={{ backgroundColor: accent }}>
                {(settings?.app_name || "A").charAt(0)}
              </div>
            )}
            <div className="min-w-0">
              <p className="text-sm font-medium text-stone-900 truncate">{settings?.app_name || "Dashboard"}</p>
              <p className="text-[10px] text-stone-400 truncate">{settings?.store_url ? `${settings.store_url}.appi-fy.ai` : ""}</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 py-4 px-2 space-y-1">
          {NAV.map(item => {
            const isActive = pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href));
            return (
              <Link key={item.href} href={item.href} className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all ${isActive ? "bg-stone-900 text-white" : "text-stone-500 hover:bg-stone-50 hover:text-stone-900"}`}>
                <span className="text-base flex-shrink-0">{item.icon}</span>
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-stone-100 space-y-3">
          {settings?.store_url && (
            <a href={`https://${settings.store_url}.appi-fy.ai`} target="_blank" className="text-xs text-stone-400 hover:text-stone-700 transition-colors block">
              ↗ View Store
            </a>
          )}
          <div className="flex items-center justify-between">
            <p className="text-[10px] text-stone-400 truncate">{user?.email}</p>
            <button onClick={handleLogout} className="text-[10px] text-red-400 hover:text-red-700 transition-colors">Logout</button>
          </div>
        </div>
      </aside>

      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  );
}
