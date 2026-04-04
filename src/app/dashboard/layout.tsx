"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import { getMerchantIdClient } from "@/lib/merchant-client";

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
  const [settings, setSettings] = useState<any>(null);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    async function load() {
      const mid = getMerchantIdClient();
      const { data } = await supabase.from("merchant_settings").select("app_name, primary_color, logo, store_url").eq("merchant_id", mid).single();
      setSettings(data);
    }
    load();
  }, []);

  const accent = settings?.primary_color || "#1C1917";

  return (
    <div className="min-h-screen flex" style={{ fontFamily: "'Outfit', sans-serif", backgroundColor: "#F8F7F4" }}>
      <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700&display=swap" rel="stylesheet" />

      {/* Sidebar */}
      <aside className={`${collapsed ? "w-16" : "w-60"} bg-white border-r border-stone-100 flex flex-col transition-all duration-200 flex-shrink-0`}>
        {/* Brand */}
        <div className="p-4 border-b border-stone-100">
          <div className="flex items-center gap-3">
            {settings?.logo ? (
              <img src={settings.logo} alt="" className="w-8 h-8 rounded-full object-cover flex-shrink-0" />
            ) : (
              <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0" style={{ backgroundColor: accent }}>
                {(settings?.app_name || "A").charAt(0)}
              </div>
            )}
            {!collapsed && (
              <div className="min-w-0">
                <p className="text-sm font-medium text-stone-900 truncate">{settings?.app_name || "Dashboard"}</p>
                <p className="text-[10px] text-stone-400 truncate">{settings?.store_url}.appi-fy.ai</p>
              </div>
            )}
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 py-4 px-2 space-y-1">
          {NAV.map(item => {
            const isActive = pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all ${
                  isActive
                    ? "bg-stone-900 text-white"
                    : "text-stone-500 hover:bg-stone-50 hover:text-stone-900"
                }`}
              >
                <span className="text-base flex-shrink-0">{item.icon}</span>
                {!collapsed && <span>{item.label}</span>}
              </Link>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="p-4 border-t border-stone-100">
          {!collapsed && (
            <Link href="/" className="text-xs text-stone-400 hover:text-stone-700 transition-colors">
              ← View Store
            </Link>
          )}
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  );
}
