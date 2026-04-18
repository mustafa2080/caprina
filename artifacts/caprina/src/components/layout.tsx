import { Link, useLocation } from "wouter";
import { LayoutDashboard, Package, Plus, Boxes, Truck, FileText, Upload, Activity } from "lucide-react";
import { cn } from "@/lib/utils";

interface LayoutProps {
  children: React.ReactNode;
}

const navItems = [
  { href: "/", label: "لوحة التحكم", icon: LayoutDashboard, exact: true },
  { href: "/orders", label: "الطلبات", icon: Package },
  { href: "/orders/new", label: "طلب جديد", icon: Plus },
  { href: "/inventory", label: "المخزون", icon: Boxes },
  { href: "/movements", label: "حركات المخزون", icon: Activity },
  { href: "/shipping", label: "شركات الشحن", icon: Truck },
  { href: "/invoices", label: "الفواتير", icon: FileText },
  { href: "/import", label: "استيراد Excel", icon: Upload },
];

export default function Layout({ children }: LayoutProps) {
  const [location] = useLocation();

  return (
    <div className="flex min-h-screen bg-background" dir="rtl">
      {/* Sidebar */}
      <aside className="w-60 border-l border-sidebar-border bg-sidebar shrink-0 hidden md:flex md:flex-col">
        <div className="p-5 border-b border-sidebar-border">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-sm bg-primary flex items-center justify-center text-primary-foreground font-bold text-base shrink-0">
              C
            </div>
            <div>
              <p className="text-sm font-bold text-sidebar-foreground">CAPRINA</p>
              <p className="text-[9px] text-sidebar-foreground/40 tracking-widest uppercase">Sales Operations</p>
            </div>
          </div>
        </div>

        <nav className="px-2 py-3 flex-1 space-y-0.5">
          {navItems.map((item) => {
            const isActive = item.exact ? location === item.href : (location === item.href || location.startsWith(item.href + "/") || (item.href !== "/" && location.startsWith(item.href)));
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-md text-xs font-semibold transition-all",
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : "text-sidebar-foreground/55 hover:text-sidebar-foreground hover:bg-white/5"
                )}
              >
                <Icon className="w-3.5 h-3.5 shrink-0" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="p-3 border-t border-sidebar-border">
          <p className="text-[9px] text-sidebar-foreground/25 text-center tracking-widest font-bold uppercase">WIN OR DIE</p>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 flex flex-col min-w-0">
        {/* Mobile header */}
        <header className="h-12 border-b border-sidebar-border bg-sidebar flex items-center justify-between px-4 md:hidden shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-sm bg-primary flex items-center justify-center text-primary-foreground font-bold text-xs">C</div>
            <span className="text-sm font-bold text-sidebar-foreground">CAPRINA</span>
          </div>
          <div className="flex items-center gap-3 text-xs font-semibold text-sidebar-foreground/60">
            <Link href="/">لوحة</Link>
            <Link href="/orders">طلبات</Link>
            <Link href="/inventory">مخزون</Link>
            <Link href="/orders/new" className="text-primary">+ جديد</Link>
          </div>
        </header>

        <div className="flex-1 overflow-auto">
          <div className="mx-auto max-w-6xl p-4 md:p-6">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}
