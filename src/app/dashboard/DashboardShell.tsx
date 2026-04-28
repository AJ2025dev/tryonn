"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createBrowserClient } from "@supabase/ssr";

const NAV = [
  { href: "/dashboard", label: "Overview", icon: "\u25FB" },
  { href: "/dashboard/products", label: "Products", icon: "\u25C8" },
  { href: "/dashboard/orders", label: "Orders", icon: "\u25C7" },
  { href: "/dashboard/inventory", label: "Inventory", icon: "\u25A4" },
];

interface DashboardShellProps {
  children: React.ReactNode;
  merchantId: number;
  userEmail: string;
  settings: {
    app_name: string | null;
    primary_color: string | null;
    logo: string | null;
    store_url: string | null;
  } | null;
}

export default function DashboardShell({ children, merchantId, userEmail, settings }: DashboardShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const accent = settings?.primary_color || "#1C1917";

  async function handleLogout() {
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    await supabase.auth.signOut();
    router.push("/dashboard/login");
    router.refresh();
  }

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
              &#8599; View Store
            </a>
          )}
          <div className="flex items-center justify-between">
            <p className="text-[10px] text-stone-400 truncate">{userEmail}</p>
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
