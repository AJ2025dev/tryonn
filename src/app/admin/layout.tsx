"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
const ADMIN_EMAILS = ["aj@appi-fy.ai", "admin@appi-fy.ai", "ajadmobrev@gmail.com"];

const NAV = [
  { href: "/admin", label: "Dashboard", icon: "📊" },
  { href: "/admin/merchants", label: "Merchants", icon: "🏪" },
  { href: "/admin/orders", label: "All Orders", icon: "📦" },
  { href: "/admin/subscriptions", label: "Subscriptions", icon: "💳" },
  { href: "/admin/settings", label: "Settings", icon: "⚙️" },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const isLoginPage = pathname === "/admin/login";

  useEffect(() => { if (!isLoginPage) checkAuth(); else setLoading(false); }, [pathname]);

  async function checkAuth() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user || !ADMIN_EMAILS.includes(user.email?.toLowerCase() || "")) {
      router.push("/admin/login");
      return;
    }
    setUser(user);
    setLoading(false);
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/admin/login");
  }

  if (isLoginPage) return <>{children}</>;

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: "#F8FAFC", fontFamily: "'Inter', sans-serif" }}>
      <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet" />
      <div className="animate-spin w-8 h-8 border-2 border-slate-300 border-t-sky-500 rounded-full" />
    </div>
  );

  return (
    <div className="min-h-screen flex" style={{ backgroundColor: "#F8FAFC", fontFamily: "'Inter', sans-serif" }}>
      <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet" />

      <aside className="w-56 bg-slate-900 flex flex-col flex-shrink-0">
        <div className="p-5 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-sky-500 flex items-center justify-center">
              <span className="text-white font-bold text-sm">A</span>
            </div>
            <div>
              <p className="text-sm font-semibold text-white">Appify</p>
              <p className="text-[10px] text-slate-400">Super Admin</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 py-4 px-3 space-y-1">
          {NAV.map(item => {
            const isActive = pathname === item.href || (item.href !== "/admin" && pathname.startsWith(item.href));
            return (
              <Link key={item.href} href={item.href} className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all ${isActive ? "bg-sky-500/15 text-sky-400" : "text-slate-400 hover:bg-slate-800 hover:text-white"}`}>
                <span className="text-base">{item.icon}</span>
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-slate-800">
          <p className="text-[10px] text-slate-500 truncate mb-2">{user?.email}</p>
          <button onClick={handleLogout} className="text-xs text-slate-500 hover:text-red-400 transition">Logout</button>
        </div>
      </aside>

      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  );
}
