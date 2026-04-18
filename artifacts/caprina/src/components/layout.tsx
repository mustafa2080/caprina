import { Link, useLocation } from "wouter";
import { LayoutDashboard, Package, Plus, Boxes, Truck, FileText, Upload, Activity, BarChart3, Users, Shield, LogOut, ChevronDown, KeyRound } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { useState } from "react";
import { authApi } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface LayoutProps {
  children: React.ReactNode;
}

const ALL_NAV = [
  { href: "/", label: "لوحة التحكم", icon: LayoutDashboard, exact: true, permission: "dashboard" },
  { href: "/product-performance", label: "أداء المنتجات", icon: BarChart3, permission: "analytics" },
  { href: "/orders", label: "الطلبات", icon: Package, permission: "orders" },
  { href: "/orders/new", label: "طلب جديد", icon: Plus, permission: "orders" },
  { href: "/inventory", label: "المخزون", icon: Boxes, permission: "inventory" },
  { href: "/movements", label: "حركات المخزون", icon: Activity, permission: "movements" },
  { href: "/shipping", label: "شركات الشحن", icon: Truck, permission: "shipping" },
  { href: "/invoices", label: "الفواتير", icon: FileText, permission: "invoices" },
  { href: "/import", label: "استيراد Excel", icon: Upload, permission: "import" },
  { href: "/users", label: "إدارة المستخدمين", icon: Users, permission: "users" },
  { href: "/audit-logs", label: "سجل التعديلات", icon: Shield, permission: "audit" },
];

const ROLE_LABELS: Record<string, string> = {
  admin: "مدير", employee: "موظف مبيعات", warehouse: "مسؤول مخزون",
};

export default function Layout({ children }: LayoutProps) {
  const [location] = useLocation();
  const { user, logout, can, isAdmin } = useAuth();
  const { toast } = useToast();
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [pwDialogOpen, setPwDialogOpen] = useState(false);
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [savingPw, setSavingPw] = useState(false);

  const visibleNav = ALL_NAV.filter(item => can(item.permission));

  const handleChangePassword = async () => {
    if (!currentPw || newPw.length < 6) {
      toast({ title: "خطأ", description: "أدخل كلمة المرور الحالية وكلمة مرور جديدة (6 أحرف على الأقل)", variant: "destructive" });
      return;
    }
    setSavingPw(true);
    try {
      await authApi.changePassword(currentPw, newPw);
      toast({ title: "تم تغيير كلمة المرور بنجاح" });
      setPwDialogOpen(false);
      setCurrentPw("");
      setNewPw("");
    } catch (e: any) {
      toast({ title: "خطأ", description: e.message, variant: "destructive" });
    } finally {
      setSavingPw(false);
    }
  };

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

        <nav className="px-2 py-3 flex-1 space-y-0.5 overflow-y-auto">
          {visibleNav.map((item) => {
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

        {/* User info */}
        <div className="border-t border-sidebar-border">
          <div className="relative">
            <button
              type="button"
              onClick={() => setUserMenuOpen(v => !v)}
              className="w-full flex items-center gap-2 p-3 hover:bg-white/5 transition-colors text-right"
            >
              <div className="w-7 h-7 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center text-xs font-bold text-primary shrink-0">
                {user?.displayName?.charAt(0) ?? "?"}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-sidebar-foreground truncate">{user?.displayName}</p>
                <p className="text-[9px] text-sidebar-foreground/40">{ROLE_LABELS[user?.role ?? ""] ?? user?.role}</p>
              </div>
              <ChevronDown className={`w-3 h-3 text-sidebar-foreground/40 transition-transform ${userMenuOpen ? "rotate-180" : ""}`} />
            </button>

            {userMenuOpen && (
              <div className="absolute bottom-full right-0 left-0 bg-card border border-border rounded-t-lg shadow-lg overflow-hidden z-50">
                <button
                  type="button"
                  onClick={() => { setUserMenuOpen(false); setPwDialogOpen(true); }}
                  className="w-full flex items-center gap-2 px-3 py-2.5 text-xs hover:bg-muted/20 transition-colors"
                >
                  <KeyRound className="w-3.5 h-3.5 text-muted-foreground" />
                  تغيير كلمة المرور
                </button>
                <button
                  type="button"
                  onClick={() => { setUserMenuOpen(false); logout(); }}
                  className="w-full flex items-center gap-2 px-3 py-2.5 text-xs text-red-400 hover:bg-red-900/10 transition-colors border-t border-border"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  تسجيل الخروج
                </button>
              </div>
            )}
          </div>
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
            {can("dashboard") && <Link href="/">لوحة</Link>}
            {can("orders") && <Link href="/orders">طلبات</Link>}
            {can("inventory") && <Link href="/inventory">مخزون</Link>}
            {can("orders") && <Link href="/orders/new" className="text-primary">+ جديد</Link>}
            <button type="button" onClick={logout} className="text-red-400">خروج</button>
          </div>
        </header>

        <div className="flex-1 overflow-auto">
          <div className="mx-auto max-w-6xl p-4 md:p-6">
            {children}
          </div>
        </div>
      </main>

      {/* Change Password Dialog */}
      <Dialog open={pwDialogOpen} onOpenChange={setPwDialogOpen}>
        <DialogContent className="bg-card border-border max-w-sm" dir="rtl">
          <DialogHeader>
            <DialogTitle>تغيير كلمة المرور</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div>
              <Label className="text-xs mb-1.5 block">كلمة المرور الحالية</Label>
              <Input type="password" className="h-9 text-sm bg-background" value={currentPw} onChange={e => setCurrentPw(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs mb-1.5 block">كلمة المرور الجديدة</Label>
              <Input type="password" className="h-9 text-sm bg-background" value={newPw} onChange={e => setNewPw(e.target.value)} placeholder="6 أحرف على الأقل" />
            </div>
            <div className="flex gap-2">
              <Button className="flex-1 h-9 text-sm font-bold" onClick={handleChangePassword} disabled={savingPw}>
                {savingPw ? "جاري الحفظ..." : "حفظ"}
              </Button>
              <Button variant="outline" className="h-9 text-sm border-border" onClick={() => setPwDialogOpen(false)}>إلغاء</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
