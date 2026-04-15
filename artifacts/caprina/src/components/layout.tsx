import { Link, useLocation } from "wouter";
import { LayoutDashboard, Package, Plus, Settings } from "lucide-react";
import { cn } from "@/lib/utils";

interface LayoutProps {
  children: React.ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const [location] = useLocation();

  const navItems = [
    { href: "/", label: "Dashboard", icon: LayoutDashboard },
    { href: "/orders", label: "Orders", icon: Package },
    { href: "/orders/new", label: "New Order", icon: Plus },
  ];

  return (
    <div className="flex min-h-screen bg-background">
      {/* Sidebar */}
      <aside className="w-64 border-r border-border bg-sidebar shrink-0 hidden md:block">
        <div className="p-6 flex items-center gap-2">
          <div className="w-8 h-8 rounded-sm bg-primary flex items-center justify-center text-primary-foreground font-serif font-bold text-xl">
            C
          </div>
          <span className="font-serif text-xl font-bold tracking-tight text-sidebar-foreground">CAPRINA</span>
        </div>
        
        <nav className="px-4 py-2 space-y-1">
          {navItems.map((item) => {
            const isActive = location === item.href || (item.href !== "/" && location.startsWith(item.href));
            const Icon = item.icon;
            
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors hover-elevate",
                  isActive 
                    ? "bg-sidebar-accent text-sidebar-accent-foreground shadow-xs" 
                    : "text-muted-foreground hover:text-sidebar-foreground"
                )}
                data-testid={`nav-${item.label.toLowerCase().replace(" ", "-")}`}
              >
                <Icon className="w-4 h-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0">
        {/* Mobile Header */}
        <header className="h-14 border-b border-border bg-card flex items-center justify-between px-4 md:hidden shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-sm bg-primary flex items-center justify-center text-primary-foreground font-serif font-bold text-sm">
              C
            </div>
            <span className="font-serif text-lg font-bold tracking-tight">CAPRINA</span>
          </div>
          <div className="flex items-center gap-4 text-sm font-medium">
            <Link href="/">Dash</Link>
            <Link href="/orders">Orders</Link>
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
