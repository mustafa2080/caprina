import { Link, useLocation } from "wouter";
import { useState, useMemo } from "react";
import { firstLogoBase64 } from "@/lib/first-logo";
import { LayoutDashboard, Package, Plus, Boxes, Truck, FileText, Upload, Activity, BarChart3, Users, Shield, LogOut, ChevronDown, KeyRound, Warehouse, Megaphone, UserCheck, UserCog, Sun, Moon, Brain, Archive, Clock, MessageCircle, Menu, X, Download, DollarSign, ShoppingCart, ShoppingBag, Receipt, Building2, Wallet, ChevronLeft, Crown } from "lucide-react";import { BrandFull } from "@/components/brand-logo";
import { BrandSettingsDialog } from "@/components/brand-settings-dialog";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { authApi, appSettingsApi } from "@/lib/api";
import { useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface LayoutProps {
  children: React.ReactNode;
}

// permission = صلاحية الوصول للصفحة (هل الرول عنده حق يدخلها)
// section   = صلاحية ظهور القسم في الـ sidebar (per-user toggle)
const ALL_NAV = [
  // ── لوحة التحكم ────────────────────────────────────────────────────────
  { href: "/",                  label: "لوحة التحكم",        icon: LayoutDashboard, exact: true, permission: "dashboard",               section: "section_dashboard",          iconColor: "text-blue-400",       group: "dashboard"    },
  // ── الطلبات ─────────────────────────────────────────────────────────────
  { href: "/orders",            label: "الطلبات",             icon: Package,                     permission: "orders",                  section: "section_orders",             iconColor: "text-orange-400",     group: "orders"       },
  { href: "/orders/new",        label: "طلب جديد",            icon: Plus,                        permission: "orders",                  section: "section_new_order",          iconColor: "text-emerald-400",    group: "orders"       },
  { href: "/invoices",          label: "الفواتير",             icon: FileText,                    permission: "invoices",                section: "section_invoices",           iconColor: "text-yellow-400",     group: "orders"       },
  { href: "/shipping-followup", label: "متابعة الشحن",        icon: Clock,                       permission: "orders",                  section: "section_shipping_followup",  iconColor: "text-cyan-400",       group: "orders"       },
  // ── الشحن والتوصيل ──────────────────────────────────────────────────────
  { href: "/shipping",          label: "شركات الشحن",         icon: Truck,                       permission: "shipping",                section: "section_shipping",           iconColor: "text-sky-400",        group: "shipping"     },
  // ── المنتجات (المخزون) ──────────────────────────────────────────────────
  { href: "/inventory",         label: "المنتجات",            icon: Boxes,                       permission: "inventory",               section: "section_inventory",          iconColor: "text-violet-400",     group: "inventory"    },
  { href: "/warehouses",        label: "المخازن",             icon: Warehouse,                   permission: "inventory",               section: "section_warehouses",         iconColor: "text-indigo-400",     group: "inventory"    },
  { href: "/movements",         label: "حركات المخزون",       icon: Activity,                    permission: "movements",               section: "section_movements",          iconColor: "text-purple-400",     group: "inventory"    },
  // ── التحليلات ───────────────────────────────────────────────────────────
  { href: "/product-performance",label: "أداء المنتجات",     icon: BarChart3,                   permission: "view_product_performance",section: "section_product_performance", iconColor: "text-pink-400",      group: "analytics"    },
  { href: "/smart",             label: "التحليل الذكي",       icon: Brain,                       permission: "analytics",               section: "section_smart_analytics",    iconColor: "text-fuchsia-400",    group: "analytics"    },
  { href: "/ads-analytics",     label: "تحليل الإعلانات",    icon: Megaphone,                   permission: "analytics",               section: "section_ads_analytics",      iconColor: "text-rose-400",       group: "analytics"    },
  { href: "/team-performance",  label: "تحليل العمليات الذكي",icon: UserCheck,                  permission: "analytics",               section: "section_team_performance",   iconColor: "text-teal-400",       group: "analytics"    },
  { href: "/sessions-report",   label: "تقارير الجلسات",      icon: Clock,                       permission: "users",                   section: "section_sessions_report",    iconColor: "text-slate-400",      group: "analytics"    },
  // ── الفريق والإدارة ─────────────────────────────────────────────────────
  { href: "/team",              label: "إدارة الفريق",        icon: UserCog,                     permission: "analytics",               section: "section_team_management",    iconColor: "text-lime-400",       group: "team",         exact: true },
  { href: "/team-performance",  label: "أداء الفريق",         icon: UserCheck,                   permission: "analytics",               section: "section_team_management",    iconColor: "text-lime-300",       group: "team"         },
  { href: "/users",             label: "إدارة المستخدمين",   icon: Users,                       permission: "users",                   section: "section_users",              iconColor: "text-green-400",      group: "team"         },
  { href: "/audit-logs",        label: "سجل العمليات",        icon: Shield,                      permission: "audit",                   section: "section_audit",              iconColor: "text-red-400",        group: "team"         },
  // ── الأدوات ─────────────────────────────────────────────────────────────
  { href: "/import",            label: "استيراد Excel",       icon: Upload,                      permission: "import",                  section: "section_import",             iconColor: "text-amber-400",      group: "tools"        },
  { href: "/export",            label: "تصدير البيانات",      icon: Download,                    permission: "import",                  section: "section_export_data",        iconColor: "text-orange-300",     group: "tools"        },
  { href: "/archive",           label: "الأرشيف",             icon: Archive,                     permission: "orders",                  section: "section_archive",            iconColor: "text-stone-400",      group: "tools"        },
  // ── الإعدادات والدعم ────────────────────────────────────────────────────
  { href: "/whatsapp",          label: "إعدادات واتساب",     icon: MessageCircle,               permission: "whatsapp",                section: "section_whatsapp",           iconColor: "text-emerald-500",    group: "settings"     },
  { href: "/audit-logs",        label: "سجل التعديلات",       icon: Shield,                      permission: "audit",                   section: "section_audit",              iconColor: "text-red-400",        group: "settings"     },
];

// ── الماليات — قسم منفصل في الـ sidebar ──────────────────────────────────────
const FINANCE_NAV = [
  { href: "/finance",                   label: "لوحة الماليات",     icon: DollarSign,   iconColor: "text-emerald-400"  },
  { href: "/finance/cash",              label: "الخزنة",             icon: Wallet,       iconColor: "text-yellow-400"   },
  { href: "/finance/cash/archive",      label: "أرشيف الخزن",       icon: Archive,      iconColor: "text-stone-400"    },
  { href: "/finance/cash/analytics",    label: "تحليل الماليات الذكي", icon: Brain,     iconColor: "text-fuchsia-400"  },
  { href: "/finance/expenses",          label: "المصروفات",          icon: Receipt,      iconColor: "text-rose-400"     },
  { href: "/finance/suppliers",         label: "الموردون",           icon: Building2,    iconColor: "text-blue-400"     },
  { href: "/finance/clients",           label: "العملاء التجاريون",  icon: UserCheck,    iconColor: "text-cyan-400"     },
  { href: "/finance/purchases",         label: "فواتير الشراء",      icon: ShoppingCart, iconColor: "text-violet-400"   },
  { href: "/finance/sales",             label: "فواتير البيع",       icon: ShoppingBag,  iconColor: "text-teal-400"     },
  { href: "/finance/shipping-invoices", label: "فواتير الشحن",       icon: Truck,        iconColor: "text-sky-400"      },
];

const ROLE_LABELS: Record<string, string> = {
  admin: "مدير", employee: "موظف مبيعات", warehouse: "مسؤول مخزون",
};

// ── مكونات مساعدة للـ Sidebar ─────────────────────────────────────────────
function NavItem({ item, location, sub = false }: { item: any; location: string; sub?: boolean }) {
  const isActive = item.exact
    ? location === item.href
    : location === item.href || location.startsWith(item.href + "/") || (item.href !== "/" && location.startsWith(item.href));
  const Icon = item.icon;
  return (
    <Link href={item.href}
      className={cn(
        "flex items-center gap-3 px-3 py-1.5 rounded-md text-xs font-semibold transition-all group",
        sub && "mr-2",
        isActive ? "bg-primary text-primary-foreground" : "text-sidebar-foreground/55 hover:text-sidebar-foreground hover:bg-foreground/5"
      )}>
      <Icon className={cn("w-3.5 h-3.5 shrink-0", isActive ? "text-primary-foreground" : item.iconColor)} />
      <span className="flex-1">{item.label}</span>
    </Link>
  );
}

function NavGroup({ label, icon: Icon, iconColor, location, prefixes, children, isOpen, onToggle }: {
  label: string; icon: any; iconColor: string;
  location: string; prefixes: string[];
  children: React.ReactNode;
  isOpen: boolean; onToggle: () => void;
}) {
  const isGroupActive = prefixes.some(p => location === p || location.startsWith(p + "/") || location.startsWith(p));
  return (
    <div className="pt-0.5">
      <button type="button" onClick={onToggle}
        className={cn(
          "w-full flex items-center gap-3 px-3 py-2 rounded-md text-xs font-semibold transition-all",
          isGroupActive ? "text-sidebar-foreground bg-foreground/5" : "text-sidebar-foreground/55 hover:text-sidebar-foreground hover:bg-foreground/5"
        )}>
        <Icon className={cn("w-3.5 h-3.5 shrink-0", iconColor)} />
        <span className="flex-1 text-right">{label}</span>
        <ChevronLeft className={cn("w-3 h-3 transition-transform text-sidebar-foreground/40", isOpen ? "-rotate-90" : "")} />
      </button>
      {isOpen && (
        <div className="mt-0.5 mr-2 border-r border-sidebar-border/50 pr-1 space-y-0.5 pb-1">
          {children}
        </div>
      )}
    </div>
  );
}

export default function Layout({ children }: LayoutProps) {
  const [location] = useLocation();
  const { user, logout, can, isAdmin } = useAuth();
  const { theme, toggleTheme, setTheme } = useTheme();
  const { toast } = useToast();
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [financeOpen, setFinanceOpen] = useState(false);
  const [openGroup, setOpenGroup] = useState<string | null>(null);
  const toggleGroup = (key: string) => setOpenGroup(prev => prev === key ? null : key);
  const [pwDialogOpen, setPwDialogOpen] = useState(false);
  const [brandSettingsOpen, setBrandSettingsOpen] = useState(false);
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [savingPw, setSavingPw] = useState(false);

  // ─── Sidebar sections visibility — reactive على user.permissions ──────────
  // useMemo يعتمد على can اللي بيتغير مع user — فـ visibleNav بيتحدث تلقائياً
  const visibleNav = useMemo(() => {
    return ALL_NAV.filter((item) => {
      // يظهر في الـ sidebar فقط لو عنده صلاحية القائمة (section)
      // صلاحية الوصول (permission) وحدها لا تكفي للظهور في القائمة
      if (item.section) return can(item.section);
      // لو مفيش section محدد — يكفي صلاحية الوصول
      return can(item.permission);
    });
  }, [can]);

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
    <div className="flex h-screen bg-background" dir="rtl">
      {/* Sidebar */}
      <aside className="w-60 xl:w-64 2xl:w-72 border-l border-sidebar-border bg-sidebar shrink-0 hidden md:flex md:flex-col">

        {/* ── Header الـ Sidebar ── */}
        <div className="shrink-0 border-b border-sidebar-border/60">

          {/* ── First Logo ── */}
          <div
            style={{
              position: "relative",
              width: "100%",
              background: "linear-gradient(180deg, #0a0a0a 0%, #111 100%)",
              borderBottom: "1px solid hsl(var(--primary)/0.4)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "0px",
            }}
          >
            {/* glow bg */}
            <div style={{
              position: "absolute", inset: 0, pointerEvents: "none",
              background: "radial-gradient(ellipse 100% 100% at 50% 50%, hsl(var(--primary)/0.1) 0%, transparent 70%)",
            }} />
            {/* bottom line */}
            <div style={{
              position: "absolute", bottom: 0, left: "10%", right: "10%",
              height: "1px", pointerEvents: "none",
              background: "linear-gradient(90deg, transparent, hsl(var(--primary)/0.7), transparent)",
            }} />
            <img
              src={firstLogoBase64}
              alt="Caprina Logo"
              style={{
                display: "block",
                width: "100%",
                height: "auto",
                maxHeight: "120px",
                objectFit: "contain",
                position: "relative",
                zIndex: 1,
                filter: "drop-shadow(0 0 18px hsl(var(--primary)/0.7)) drop-shadow(0 2px 6px rgba(0,0,0,0.9))",
              }}
            />
          </div>

          {/* Brand — hero area */}
          <div
            className="px-4 pt-2 pb-4 flex flex-row items-center justify-between relative overflow-hidden"
            style={{ background: "linear-gradient(160deg, hsl(var(--primary)/0.12) 0%, hsl(var(--primary)/0.04) 100%)" }}
          >
            {/* subtle glow behind logo */}
            <div className="absolute inset-0 pointer-events-none" style={{ background: "radial-gradient(ellipse 70% 60% at 50% 0%, hsl(var(--primary)/0.18) 0%, transparent 80%)" }} />

            {/* اللوجو + الاسم على اليمين */}
            <div className="relative z-10 cursor-pointer" onClick={() => setBrandSettingsOpen(true)}>
              <BrandFull
                logoSize="md"
                layout="row"
                nameClass="text-base font-extrabold text-sidebar-foreground tracking-wide"
                taglineClass="text-[0px] opacity-0 h-0 overflow-hidden"
              />
            </div>

            {/* ── Company Name — في النص ── */}
            <div className="relative z-10 flex flex-col items-center justify-center select-none">
              <span
                className="text-sm font-black tracking-[0.25em] uppercase leading-none"
                style={{
                  background: "linear-gradient(135deg, hsl(var(--primary)) 0%, #fff 50%, hsl(var(--primary)) 100%)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  backgroundClip: "text",
                  filter: "drop-shadow(0 0 8px hsl(var(--primary)/0.8))",
                }}
              >
                CAPRINA
              </span>
              <span className="block h-px w-full mt-0.5" style={{background:"linear-gradient(90deg,transparent,hsl(var(--primary)/0.8),transparent)"}} />
            </div>

            {/* ── Theme Toggle — في النص محاذي مع اللوجو ── */}
            <button
              type="button"
              onClick={toggleTheme}
              title={theme === "dark" ? "التبديل للوضع النهاري" : "التبديل للوضع الليلي"}
              className="relative z-20 w-9 h-9 rounded-full flex items-center justify-center transition-all duration-300 hover:scale-110 active:scale-95 shrink-0"
              style={{
                background: theme === "dark"
                  ? "linear-gradient(135deg,#1e293b,#0f172a)"
                  : "linear-gradient(135deg,#fef3c7,#fde68a)",
                border: theme === "dark"
                  ? "1px solid rgba(148,163,184,0.2)"
                  : "1px solid rgba(251,191,36,0.5)",
                boxShadow: theme === "dark"
                  ? "0 0 12px rgba(148,163,184,0.15), inset 0 1px 0 rgba(255,255,255,0.05)"
                  : "0 0 14px rgba(251,191,36,0.4), inset 0 1px 0 rgba(255,255,255,0.6)",
              }}
            >
              {theme === "dark" ? (
                <Sun className="w-4 h-4 text-amber-300" style={{ filter: "drop-shadow(0 0 4px rgba(251,191,36,0.8))" }} />
              ) : (
                <Moon className="w-4 h-4 text-indigo-600" style={{ filter: "drop-shadow(0 0 3px rgba(99,102,241,0.5))" }} />
              )}
            </button>

            {/* thin accent line */}
            <div className="absolute bottom-0 left-6 right-6 h-px" style={{ background: "linear-gradient(90deg, transparent, hsl(var(--primary)/0.4), transparent)" }} />
          </div>

          {/* User card */}
          <div className="px-3 py-3">
            <button
              type="button"
              onClick={() => setUserMenuOpen(v => !v)}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl transition-all hover:bg-foreground/5"
              style={{ background: "hsl(var(--muted)/0.4)", border: "1px solid hsl(var(--border)/0.5)" }}
            >
              {/* Avatar */}
              <div className="relative shrink-0">
                {(user as any)?.avatar ? (
                  <img src={(user as any).avatar} className="w-8 h-8 rounded-full object-cover border-2 border-primary/30" alt={user?.displayName} />
                ) : (
                  <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold"
                    style={{ background: "linear-gradient(135deg,hsl(var(--primary)/0.8),hsl(var(--primary)/0.4))", color: "hsl(var(--primary-foreground))", border: "2px solid hsl(var(--primary)/0.3)" }}>
                    {user?.displayName?.charAt(0)?.toUpperCase() ?? "?"}
                  </div>
                )}
                    <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-400 border-2 border-[#111] z-10" style={{boxShadow:"0 0 8px rgba(52,211,153,0.9)"}}>
                      <span className="absolute inset-0 rounded-full bg-emerald-400 animate-ping" style={{opacity:0.75}} />
                    </span>
              </div>
              <div className="flex-1 min-w-0 text-right">
                <p className="text-xs font-bold text-sidebar-foreground truncate">{user?.displayName}</p>
                <p className="text-[10px] text-sidebar-foreground/45 truncate">{ROLE_LABELS[user?.role ?? ""] ?? user?.role}</p>
              </div>
              <ChevronDown className={cn("w-3.5 h-3.5 text-sidebar-foreground/30 shrink-0 transition-transform", userMenuOpen && "rotate-180")} />
            </button>

            {/* User menu popup */}
            {userMenuOpen && (
              <div className="mt-1 rounded-xl border overflow-hidden shadow-xl z-50"
                style={{ background: "hsl(var(--card))", borderColor: "hsl(var(--border))" }}>
                <button type="button" onClick={() => { toggleTheme(); setUserMenuOpen(false); }}
                  className="w-full flex items-center justify-between gap-2 px-3 py-2.5 text-xs hover:bg-muted/30 transition-colors">
                  <div className="flex items-center gap-2">
                    {theme === "dark" ? <Sun className="w-3.5 h-3.5 text-amber-400" /> : <Moon className="w-3.5 h-3.5 text-muted-foreground" />}
                    {theme === "dark" ? "الوضع الفاتح" : "الوضع الداكن"}
                  </div>
                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-muted/40 text-muted-foreground">{theme === "dark" ? "Light" : "Dark"}</span>
                </button>
                <button type="button" onClick={() => { setUserMenuOpen(false); setPwDialogOpen(true); }}
                  className="w-full flex items-center gap-2 px-3 py-2.5 text-xs hover:bg-muted/30 transition-colors">
                  <KeyRound className="w-3.5 h-3.5 text-muted-foreground" />
                  تغيير كلمة المرور
                </button>
                <button type="button" onClick={() => { setUserMenuOpen(false); logout(); }}
                  className="w-full flex items-center gap-2 px-3 py-2.5 text-xs text-red-400 hover:bg-red-900/10 transition-colors border-t"
                  style={{ borderColor: "hsl(var(--border))" }}>
                  <LogOut className="w-3.5 h-3.5" />
                  تسجيل الخروج
                </button>
              </div>
            )}
          </div>
        </div>

        <nav className="px-2 py-3 flex-1 space-y-0.5 overflow-y-auto">

          {/* ── لوحة التحكم ── */}
          {visibleNav.filter(i => i.group === "dashboard").map(item => <NavItem key={item.href} item={item} location={location} />)}

          {/* ── الطلبات ── */}
          {visibleNav.some(i => i.group === "orders") && (
            <NavGroup label="الطلبات" icon={Package} iconColor="text-orange-400" location={location} prefixes={["/orders","/invoices","/shipping-followup"]} isOpen={openGroup === "orders"} onToggle={() => toggleGroup("orders")}>
              {visibleNav.filter(i => i.group === "orders").map(item => <NavItem key={item.href+item.label} item={item} location={location} sub />)}
            </NavGroup>
          )}

          {/* ── الشحن والتوصيل ── */}
          {visibleNav.some(i => i.group === "shipping") && (
            <NavGroup label="الشحن والتوصيل" icon={Truck} iconColor="text-sky-400" location={location} prefixes={["/shipping"]} isOpen={openGroup === "shipping"} onToggle={() => toggleGroup("shipping")}>
              {visibleNav.filter(i => i.group === "shipping").map(item => <NavItem key={item.href} item={item} location={location} sub />)}
            </NavGroup>
          )}

          {/* ── المنتجات والمخزون ── */}
          {visibleNav.some(i => i.group === "inventory") && (
            <NavGroup label="المنتجات والمخزون" icon={Boxes} iconColor="text-violet-400" location={location} prefixes={["/inventory","/warehouses","/movements"]} isOpen={openGroup === "inventory"} onToggle={() => toggleGroup("inventory")}>
              {visibleNav.filter(i => i.group === "inventory").map(item => <NavItem key={item.href} item={item} location={location} sub />)}
            </NavGroup>
          )}

          {/* ── التحليلات ── */}
          {visibleNav.some(i => i.group === "analytics") && (
            <NavGroup label="التحليلات" icon={BarChart3} iconColor="text-pink-400" location={location} prefixes={["/product-performance","/smart","/ads-analytics","/team-performance","/sessions-report"]} isOpen={openGroup === "analytics"} onToggle={() => toggleGroup("analytics")}>
              {visibleNav.filter(i => i.group === "analytics").map(item => <NavItem key={item.href+item.label} item={item} location={location} sub />)}
            </NavGroup>
          )}

          {/* ── الماليات ── */}
          {(isAdmin || can("finance")) && (
            <NavGroup label="الماليات" icon={DollarSign} iconColor="text-emerald-400" location={location} prefixes={["/finance"]} isOpen={openGroup === "finance"} onToggle={() => toggleGroup("finance")}>
              {FINANCE_NAV.map((item) => {
                const isActive = location === item.href;
                const Icon = item.icon;
                return (
                  <Link key={item.href} href={item.href}
                    className={cn("flex items-center gap-3 px-3 py-1.5 rounded-md text-xs font-semibold transition-all mr-2 group",
                      isActive ? "bg-primary text-primary-foreground" : "text-sidebar-foreground/55 hover:text-sidebar-foreground hover:bg-foreground/5")}>
                    <Icon className={cn("w-3.5 h-3.5 shrink-0", isActive ? "text-primary-foreground" : item.iconColor)} />
                    <span className="flex-1">{item.label}</span>
                  </Link>
                );
              })}
            </NavGroup>
          )}

          {/* ── الفريق والإدارة ── */}
          {visibleNav.some(i => i.group === "team") && (
            <NavGroup label="الفريق والإدارة" icon={Users} iconColor="text-green-400" location={location} prefixes={["/team","/team-performance","/users","/audit-logs"]} isOpen={openGroup === "team"} onToggle={() => toggleGroup("team")}>
              {visibleNav.filter(i => i.group === "team").map(item => <NavItem key={item.href+item.label} item={item} location={location} sub />)}
            </NavGroup>
          )}

          {/* ── الأدوات ── */}
          {visibleNav.some(i => i.group === "tools") && (
            <NavGroup label="الأدوات" icon={Upload} iconColor="text-amber-400" location={location} prefixes={["/import","/export","/archive"]} isOpen={openGroup === "tools"} onToggle={() => toggleGroup("tools")}>
              {visibleNav.filter(i => i.group === "tools").map(item => <NavItem key={item.href} item={item} location={location} sub />)}
            </NavGroup>
          )}

          {/* ── الإعدادات والدعم ── */}
          {visibleNav.some(i => i.group === "settings") && (
            <NavGroup label="الإعدادات والدعم" icon={MessageCircle} iconColor="text-emerald-500" location={location} prefixes={["/whatsapp","/audit-logs"]} isOpen={openGroup === "settings"} onToggle={() => toggleGroup("settings")}>
              {visibleNav.filter(i => i.group === "settings").map(item => <NavItem key={item.href+item.label} item={item} location={location} sub />)}
            </NavGroup>
          )}
        </nav>

        {/* User info */}
        <div className="border-t border-sidebar-border">
          <div className="relative">
            <button
              type="button"
              onClick={() => setUserMenuOpen(v => !v)}
              className="w-full flex items-center gap-2 p-3 hover:bg-foreground/5 transition-colors text-right"
            >
              <div className="relative shrink-0">
                {(user as any)?.avatar ? (
                  <img src={(user as any).avatar} className="w-7 h-7 rounded-full object-cover border-2 border-primary/30" alt={user?.displayName} />
                ) : (
                  <div className="w-7 h-7 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center text-xs font-bold text-primary">
                    {user?.displayName?.charAt(0) ?? "?"}
                  </div>
                )}
                    <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-400 border-2 border-[#111] z-10" style={{boxShadow:"0 0 8px rgba(52,211,153,0.9)"}}>
                      <span className="absolute inset-0 rounded-full bg-emerald-400 animate-ping" style={{opacity:0.75}} />
                    </span>
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
                  onClick={() => { toggleTheme(); setUserMenuOpen(false); }}
                  className="w-full flex items-center justify-between gap-2 px-3 py-2.5 text-xs hover:bg-muted/20 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    {theme === "dark" ? <Sun className="w-3.5 h-3.5 text-amber-400" /> : <Moon className="w-3.5 h-3.5 text-muted-foreground" />}
                    {theme === "dark" ? "الوضع الفاتح" : "الوضع الداكن"}
                  </div>
                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-muted/40 text-muted-foreground">
                    {theme === "dark" ? "Light" : "Dark"}
                  </span>
                </button>
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
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Mobile header */}
        <header className="border-b border-sidebar-border bg-sidebar md:hidden shrink-0">
          <div className="flex items-center justify-between px-4 h-12">
            <BrandFull logoSize="sm" layout="row" nameClass="text-sm text-sidebar-foreground" />
            <div className="flex items-center gap-2">
              <button type="button" onClick={toggleTheme} className="text-sidebar-foreground/50 hover:text-sidebar-foreground transition-colors p-1">
                {theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
              </button>
              {can("orders") && (
                <Link href="/orders/new">
                  <span className="flex items-center gap-1 bg-primary text-primary-foreground px-2.5 py-1 rounded-md text-[11px] font-bold">
                    <Plus className="w-3 h-3" />جديد
                  </span>
                </Link>
              )}
              {/* Hamburger */}
              <button
                type="button"
                onClick={() => setMobileMenuOpen(true)}
                className="text-sidebar-foreground/70 hover:text-sidebar-foreground transition-colors p-1"
              >
                <Menu className="w-5 h-5" />
              </button>
            </div>
          </div>
        </header>

        {/* Mobile Drawer Overlay */}
        {mobileMenuOpen && (
          <div className="fixed inset-0 z-50 md:hidden" dir="rtl">
            {/* Backdrop */}
            <div
              className="absolute inset-0 bg-black/50 backdrop-blur-sm"
              onClick={() => setMobileMenuOpen(false)}
            />
            {/* Drawer panel - slides from right */}
            <div className="absolute top-0 right-0 h-full w-72 bg-sidebar border-l border-sidebar-border flex flex-col shadow-2xl animate-in slide-in-from-right duration-200">
              {/* Drawer header */}
              <div className="flex items-center justify-between p-4 border-b border-sidebar-border">
                <BrandFull logoSize="sm" layout="row" nameClass="text-sm text-sidebar-foreground" onLogoClick={() => { setBrandSettingsOpen(true); setMobileMenuOpen(false); }} />
                <button
                  type="button"
                  onClick={() => setMobileMenuOpen(false)}
                  className="text-sidebar-foreground/50 hover:text-sidebar-foreground p-1 rounded-md hover:bg-foreground/5"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Nav links */}
              <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-0.5">
                {visibleNav.map((item) => {
                  const isActive = item.exact ? location === item.href : (location === item.href || location.startsWith(item.href + "/") || (item.href !== "/" && location.startsWith(item.href)));
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setMobileMenuOpen(false)}
                      className={cn(
                        "flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-semibold transition-all",
                        isActive
                          ? "bg-primary text-primary-foreground"
                          : "text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-foreground/5"
                      )}
                    >
                      <Icon className={cn("w-4 h-4 shrink-0", isActive ? "text-primary-foreground" : item.iconColor)} />
                      {item.label}
                    </Link>
                  );
                })}

                {/* ── قسم الماليات في الموبايل ─────────────────────────── */}
                {(isAdmin || can("finance")) && (
                  <div className="pt-1">
                    <button
                      type="button"
                      onClick={() => setFinanceOpen(v => !v)}
                      className={cn(
                        "w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-semibold transition-all",
                        location.startsWith("/finance")
                          ? "bg-emerald-500/15 text-emerald-400"
                          : "text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-foreground/5"
                      )}
                    >
                      <DollarSign className="w-4 h-4 shrink-0 text-emerald-400" />
                      <span className="flex-1 text-right">الماليات</span>
                      <ChevronLeft className={cn("w-3.5 h-3.5 transition-transform", financeOpen ? "-rotate-90" : "")} />
                    </button>
                    {financeOpen && (
                      <div className="mt-0.5 mr-2 border-r border-emerald-500/20 pr-1 space-y-0.5">
                        {FINANCE_NAV.map((item) => {
                          const isActive = location === item.href || location.startsWith(item.href + "/");
                          const Icon = item.icon;
                          return (
                            <Link
                              key={item.href}
                              href={item.href}
                              onClick={() => setMobileMenuOpen(false)}
                              className={cn(
                                "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-semibold transition-all",
                                isActive
                                  ? "bg-primary text-primary-foreground"
                                  : "text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-foreground/5"
                              )}
                            >
                              <Icon className={cn("w-4 h-4 shrink-0", isActive ? "text-primary-foreground" : item.iconColor)} />
                              {item.label}
                            </Link>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </nav>

              {/* Theme toggle */}
              <div className="px-3 pb-2 flex justify-center">
                <button
                  type="button"
                  onClick={toggleTheme}
                  title={theme === "dark" ? "التبديل للوضع النهاري" : "التبديل للوضع الليلي"}
                  className="w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300 hover:scale-110 active:scale-95"
                  style={{
                    background: theme === "dark"
                      ? "linear-gradient(135deg,#1e293b,#0f172a)"
                      : "linear-gradient(135deg,#fef3c7,#fde68a)",
                    border: theme === "dark"
                      ? "1px solid rgba(148,163,184,0.2)"
                      : "1px solid rgba(251,191,36,0.5)",
                    boxShadow: theme === "dark"
                      ? "0 0 12px rgba(148,163,184,0.15)"
                      : "0 0 14px rgba(251,191,36,0.4)",
                  }}
                >
                  {theme === "dark" ? (
                    <Sun className="w-5 h-5 text-amber-300" style={{ filter: "drop-shadow(0 0 4px rgba(251,191,36,0.8))" }} />
                  ) : (
                    <Moon className="w-5 h-5 text-indigo-600" style={{ filter: "drop-shadow(0 0 3px rgba(99,102,241,0.5))" }} />
                  )}
                </button>
              </div>

              {/* User + logout */}
              <div className="border-t border-sidebar-border p-3 space-y-1">
                <div className="flex items-center gap-2 px-1 py-1">
                  <div className="relative shrink-0">
                    {(user as any)?.avatar ? (
                      <img src={(user as any).avatar} className="w-8 h-8 rounded-full object-cover border-2 border-primary/30" alt={user?.displayName} />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center text-xs font-bold text-primary">
                        {user?.displayName?.charAt(0) ?? "?"}
                      </div>
                    )}
                    <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-400 border-2 border-[#111] z-10" style={{boxShadow:"0 0 6px rgba(52,211,153,0.8)"}}>
                      <span className="absolute inset-0 rounded-full bg-emerald-400 animate-ping" style={{opacity:0.7}} />
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-sidebar-foreground truncate">{user?.displayName}</p>
                    <p className="text-[10px] text-sidebar-foreground/40">{ROLE_LABELS[user?.role ?? ""] ?? user?.role}</p>
                  </div>
                </div>
                <button type="button" onClick={() => { setMobileMenuOpen(false); setPwDialogOpen(true); }} className="w-full flex items-center gap-2 px-3 py-2 text-xs rounded-md hover:bg-foreground/5 transition-colors text-sidebar-foreground/70">
                  <KeyRound className="w-3.5 h-3.5" />تغيير كلمة المرور
                </button>
                <button type="button" onClick={() => { setMobileMenuOpen(false); logout(); }} className="w-full flex items-center gap-2 px-3 py-2 text-xs rounded-md text-red-400 hover:bg-red-500/10 transition-colors">
                  <LogOut className="w-3.5 h-3.5" />تسجيل الخروج
                </button>
              </div>
            </div>
          </div>
        )}

        <div id="main-scroll-area" className="flex-1 overflow-auto">
          <div className="w-full p-3 sm:p-4 md:p-5 xl:p-6 2xl:p-8">
            {children}
          </div>
        </div>
      </main>

      {/* Brand Settings Dialog */}
      <BrandSettingsDialog open={brandSettingsOpen} onClose={() => setBrandSettingsOpen(false)} />

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
