import { Link, useLocation } from "wouter";
import { LayoutDashboard, Package, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

interface LayoutProps {
  children: React.ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const [location] = useLocation();

  const navItems = [
    { href: "/", label: "لوحة التحكم", icon: LayoutDashboard },
    { href: "/orders", label: "الطلبات", icon: Package },
    { href: "/orders/new", label: "طلب جديد", icon: Plus },
  ];

  return (
    <div className="flex min-h-screen bg-background" dir="rtl">
      {/* Sidebar */}
      <aside className="w-64 border-l border-sidebar-border bg-sidebar shrink-0 hidden md:flex md:flex-col">
        <div className="p-6 flex items-center gap-3 border-b border-sidebar-border">
          <div className="w-9 h-9 rounded-sm bg-primary flex items-center justify-center text-primary-foreground font-bold text-lg">
            C
          </div>
          <div>
            <span className="text-lg font-bold tracking-tight text-sidebar-foreground">CAPRINA</span>
            <p className="text-[10px] text-sidebar-foreground/50 tracking-widest uppercase">مركز التحكم</p>
          </div>
        </div>

        <nav className="px-3 py-4 space-y-1 flex-1">
          {navItems.map((item) => {
            const isActive = location === item.href || (item.href !== "/" && location.startsWith(item.href));
            const Icon = item.icon;

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-all",
                  isActive
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-white/5"
                )}
                data-testid={`nav-${item.href.replace("/", "") || "dashboard"}`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-sidebar-border">
          <p className="text-[10px] text-sidebar-foreground/30 text-center tracking-wider uppercase">WIN OR DIE</p>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0">
        {/* Mobile Header */}
        <header className="h-14 border-b border-border bg-sidebar flex items-center justify-between px-4 md:hidden shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-sm bg-primary flex items-center justify-center text-primary-foreground font-bold text-sm">
              C
            </div>
            <span className="text-base font-bold text-sidebar-foreground">CAPRINA</span>
          </div>
          <div className="flex items-center gap-4 text-sm font-medium text-sidebar-foreground/70">
            <Link href="/">لوحة التحكم</Link>
            <Link href="/orders">الطلبات</Link>
            <Link href="/orders/new" className="text-primary">+ جديد</Link>
          </div>
        </header>

        <div className="flex-1 overflow-auto">
          <div className="mx-auto max-w-5xl p-4 md:p-8">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}
