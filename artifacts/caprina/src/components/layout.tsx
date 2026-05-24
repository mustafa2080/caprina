import { Link, useLocation } from "wouter";
import { useState, useMemo } from "react";
import { firstLogoBase64 } from "@/lib/first-logo";
import { LayoutDashboard, Package, Plus, Boxes, Truck, FileText, Upload, Activity, BarChart3, Users, Shield, LogOut, ChevronDown, KeyRound, Warehouse, Megaphone, UserCheck, UserCog, Sun, Moon, Brain, Archive, Clock, MessageCircle, Menu, X, Download, DollarSign, ShoppingCart, ShoppingBag, Receipt, Building2, Wallet, ChevronLeft, Crown, Settings, PanelRightClose, PanelRightOpen } from "lucide-react";
import { BrandFull, BrandLogoMark } from "@/components/brand-logo";
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

// ── أيقونة واتساب الحقيقية ────────────────────────────────────────────────────
function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
    </svg>
  );
}

interface LayoutProps {
  children: React.ReactNode;
}

const ALL_NAV = [
  { href: "/",                  label: "لوحة التحكم",        icon: LayoutDashboard, exact: true, permission: "dashboard",               section: "section_dashboard",          iconColor: "text-blue-400",       group: "dashboard"    },
  { href: "/orders",            label: "الطلبات",             icon: Package,                     permission: "orders",                  section: "section_orders",             iconColor: "text-orange-400",     group: "orders"       },
  { href: "/orders/new",        label: "طلب جديد",            icon: Plus,                        permission: "orders",                  section: "section_new_order",          iconColor: "text-emerald-400",    group: "orders"       },
  { href: "/invoices",          label: "الفواتير",             icon: FileText,                    permission: "invoices",                section: "section_invoices",           iconColor: "text-yellow-400",     group: "orders"       },
  { href: "/shipping-followup", label: "متابعة الشحن",        icon: Clock,                       permission: "orders",                  section: "section_shipping_followup",  iconColor: "text-cyan-400",       group: "orders"       },
  { href: "/shipping",          label: "شركات الشحن",         icon: Truck,                       permission: "shipping",                section: "section_shipping",           iconColor: "text-sky-400",        group: "shipping"     },
  { href: "/inventory",         label: "المنتجات",            icon: Boxes,                       permission: "inventory",               section: "section_inventory",          iconColor: "text-violet-400",     group: "inventory"    },
  { href: "/warehouses",        label: "المخازن",             icon: Warehouse,                   permission: "inventory",               section: "section_warehouses",         iconColor: "text-indigo-400",     group: "inventory"    },
  { href: "/movements",         label: "حركات المخزون",       icon: Activity,                    permission: "movements",               section: "section_movements",          iconColor: "text-purple-400",     group: "inventory"    },
  { href: "/product-performance",label: "أداء المنتجات",     icon: BarChart3,                   permission: "view_product_performance",section: "section_product_performance", iconColor: "text-pink-400",      group: "analytics"    },
  { href: "/smart",             label: "التحليل الذكي",       icon: Brain,                       permission: "analytics",               section: "section_smart_analytics",    iconColor: "text-fuchsia-400",    group: "analytics"    },
  { href: "/ads-analytics",     label: "تحليل الإعلانات",    icon: Megaphone,                   permission: "analytics",               section: "section_ads_analytics",      iconColor: "text-rose-400",       group: "analytics"    },
  { href: "/finance/cash/analytics", label: "تحليل الماليات الذكي", icon: Brain,                  permission: "analytics",               section: "section_smart_analytics",    iconColor: "text-teal-400",       group: "analytics"    },
  { href: "/sessions-report",   label: "تقارير الجلسات",      icon: Clock,                       permission: "users",                   section: "section_sessions_report",    iconColor: "text-slate-400",      group: "analytics"    },
  { href: "/team",              label: "إدارة الفريق",        icon: UserCog,                     permission: "analytics",               section: "section_team_management",    iconColor: "text-lime-400",       group: "team",         exact: true },
  { href: "/team-performance",  label: "أداء الفريق",         icon: UserCheck,                   permission: "analytics",               section: "section_team_management",    iconColor: "text-lime-300",       group: "team"         },
  { href: "/users",             label: "إدارة المستخدمين",   icon: Users,                       permission: "users",                   section: "section_users",              iconColor: "text-green-400",      group: "team"         },
  { href: "/audit-logs",        label: "سجل العمليات",        icon: Shield,                      permission: "audit",                   section: "section_audit",              iconColor: "text-red-400",        group: "team"         },
  { href: "/import",            label: "استيراد Excel",       icon: Upload,                      permission: "import",                  section: "section_import",             iconColor: "text-amber-400",      group: "tools"        },
  { href: "/export",            label: "تصدير البيانات",      icon: Download,                    permission: "import",                  section: "section_export_data",        iconColor: "text-orange-300",     group: "tools"        },
  { href: "/archive",           label: "الأرشيف",             icon: Archive,                     permission: "orders",                  section: "section_archive",            iconColor: "text-stone-400",      group: "tools"        },
  { href: "/whatsapp",          label: "إعدادات واتساب",     icon: WhatsAppIcon,                permission: "whatsapp",                section: "section_whatsapp",           iconColor: "text-[#25D366]",      group: "settings"     },
  { href: "/audit-logs",        label: "سجل التعديلات",       icon: Shield,                      permission: "audit",                   section: "section_audit",              iconColor: "text-red-400",        group: "settings"     },
];

const FINANCE_NAV = [
  { href: "/finance",                   label: "لوحة الماليات",     icon: DollarSign,   iconColor: "text-emerald-400"  },
  { href: "/finance/cash",              label: "الخزنة",             icon: Wallet,       iconColor: "text-yellow-400"   },
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

function NavItem({ item, location, sub = false, collapsed = false }: { item: any; location: string; sub?: boolean; collapsed?: boolean }) {
  const isActive = item.exact
    ? location === item.href
    : location === item.href || location.startsWith(item.href + "/") || (item.href !== "/" && location.startsWith(item.href));
  const Icon = item.icon;
  const rgb = resolveRgb(item.iconColor ?? "text-blue-400");
  return (
    <Link href={item.href}
      title={collapsed ? item.label : undefined}
      className={cn(
        "flex items-center gap-3 rounded-lg text-[11.5px] font-semibold transition-all duration-300 group",
        collapsed ? "px-0 py-2 justify-center" : "px-3 py-2",
        sub && !collapsed && "mr-2",
        isActive ? "text-white" : "text-sidebar-foreground/60 hover:text-sidebar-foreground/90 hover:bg-white/[0.04]"
      )}
      style={isActive ? {
        background: collapsed ? `rgba(${rgb},0.15)` : `linear-gradient(135deg, rgba(${rgb},0.18) 0%, rgba(${rgb},0.07) 100%)`,
        border: `1px solid rgba(${rgb},0.25)`,
        boxShadow: `0 1px 8px rgba(${rgb},0.15), inset 0 1px 0 rgba(255,255,255,0.06)`,
      } : { border: "1px solid transparent" }}
    >
      <div className="shrink-0 flex items-center justify-center" style={{
        width: "28px", height: "28px", borderRadius: "8px",
        background: isActive ? `linear-gradient(145deg, rgba(${rgb},0.85) 0%, rgba(${rgb},0.45) 100%)` : `linear-gradient(145deg, rgba(${rgb},0.15) 0%, rgba(${rgb},0.06) 100%)`,
        border: isActive ? `1px solid rgba(${rgb},0.5)` : `1px solid rgba(${rgb},0.12)`,
        boxShadow: isActive ? `0 3px 10px rgba(${rgb},0.35), inset 0 1px 0 rgba(255,255,255,0.15)` : `0 1px 4px rgba(${rgb},0.1)`,
      }}>
        <Icon style={{ width: "13px", height: "13px", color: isActive ? "rgba(255,255,255,0.95)" : `rgba(${rgb},0.75)` }} />
      </div>
      {!collapsed && <span className="flex-1 text-right overflow-hidden whitespace-nowrap">{item.label}</span>}
    </Link>
  );
}

function resolveRgb(iconColor: string): string {
  if (iconColor.includes("orange"))  return "251,146,60";
  if (iconColor.includes("sky"))     return "56,189,248";
  if (iconColor.includes("violet"))  return "167,139,250";
  if (iconColor.includes("pink"))    return "244,114,182";
  if (iconColor.includes("fuchsia")) return "232,121,249";
  if (iconColor.includes("emerald")) return "52,211,153";
  if (iconColor.includes("teal"))    return "45,212,191";
  if (iconColor.includes("cyan"))    return "34,211,238";
  if (iconColor.includes("lime"))    return "163,230,53";
  if (iconColor.includes("green"))   return "74,222,128";
  if (iconColor.includes("amber"))   return "251,191,36";
  if (iconColor.includes("yellow"))  return "250,204,21";
  if (iconColor.includes("red"))     return "248,113,113";
  if (iconColor.includes("rose"))    return "251,113,133";
  if (iconColor.includes("blue"))    return "96,165,250";
  if (iconColor.includes("indigo"))  return "129,140,248";
  if (iconColor.includes("purple"))  return "192,132,252";
  if (iconColor.includes("slate"))   return "148,163,184";
  if (iconColor.includes("stone"))   return "168,162,158";
  return "251,191,36";
}

function NavGroup({ label, icon: Icon, iconColor, location, prefixes, children, isOpen, onToggle, collapsed = false }: {
  label: string; icon: any; iconColor: string;
  location: string; prefixes: string[];
  children: React.ReactNode;
  isOpen: boolean; onToggle: () => void;
  collapsed?: boolean;
}) {
  const isActive = prefixes.some(p => location === p || location.startsWith(p + "/") || location.startsWith(p));
  const rgb = resolveRgb(iconColor);

  if (collapsed) {
    return (
      <div className="pt-1 flex justify-center">
        <Link href={prefixes[0]} title={label}
          className={cn("flex items-center justify-center rounded-xl transition-all duration-200")}
          style={{
            width: "42px", height: "42px",
            background: isActive
              ? `linear-gradient(145deg, rgba(${rgb},0.9) 0%, rgba(${rgb},0.55) 60%, rgba(${rgb},0.3) 100%)`
              : `linear-gradient(145deg, rgba(${rgb},0.18) 0%, rgba(${rgb},0.08) 100%)`,
            border: isActive ? `1px solid rgba(${rgb},0.6)` : `1px solid rgba(${rgb},0.15)`,
            boxShadow: isActive
              ? `0 4px 14px rgba(${rgb},0.45), 0 1px 4px rgba(${rgb},0.3), inset 0 1px 0 rgba(255,255,255,0.2)`
              : `0 2px 6px rgba(${rgb},0.12), inset 0 1px 0 rgba(255,255,255,0.06)`,
          }}
        >
          <Icon style={{
            width: "20px", height: "20px",
            color: isActive ? "rgba(255,255,255,0.95)" : `rgba(${rgb},0.7)`,
            filter: isActive ? "drop-shadow(0 1px 3px rgba(0,0,0,0.3))" : "none",
          }} />
        </Link>
      </div>
    );
  }

  return (
    <div className="pt-1">
      <button type="button" onClick={onToggle}
        className={cn("w-full flex items-center gap-3 px-2.5 py-2.5 rounded-xl text-[13px] font-bold transition-all duration-200 group",
          isActive ? "text-white" : "text-sidebar-foreground/50 hover:text-sidebar-foreground/80 hover:bg-white/[0.03]")}
        style={isActive ? {
          background: `linear-gradient(135deg, rgba(${rgb},0.1) 0%, rgba(${rgb},0.04) 100%)`,
          border: `1px solid rgba(${rgb},0.2)`,
          boxShadow: `0 1px 6px rgba(${rgb},0.12)`,
        } : { border: "1px solid transparent" }}
      >
        <div className="shrink-0 flex items-center justify-center transition-all duration-200" style={{
          width: "42px", height: "42px", borderRadius: "13px",
          background: isActive
            ? `linear-gradient(145deg, rgba(${rgb},0.9) 0%, rgba(${rgb},0.55) 60%, rgba(${rgb},0.3) 100%)`
            : `linear-gradient(145deg, rgba(${rgb},0.18) 0%, rgba(${rgb},0.08) 100%)`,
          border: isActive ? `1px solid rgba(${rgb},0.6)` : `1px solid rgba(${rgb},0.15)`,
          boxShadow: isActive
            ? `0 4px 14px rgba(${rgb},0.45), 0 1px 4px rgba(${rgb},0.3), inset 0 1px 0 rgba(255,255,255,0.2)`
            : `0 2px 6px rgba(${rgb},0.12), inset 0 1px 0 rgba(255,255,255,0.06)`,
        }}>
          <Icon style={{
            width: isActive ? "22px" : "20px", height: isActive ? "22px" : "20px",
            color: isActive ? "rgba(255,255,255,0.95)" : `rgba(${rgb},0.7)`,
            filter: isActive ? "drop-shadow(0 1px 3px rgba(0,0,0,0.3))" : "none",
            transition: "all 0.2s ease",
          }} />
        </div>
        <span className="flex-1 text-right font-semibold transition-colors duration-200 overflow-hidden whitespace-nowrap" style={{ fontSize: "13.5px", letterSpacing: "0.01em" }}>
          {label}
        </span>
        <ChevronLeft
          className={cn("shrink-0 transition-transform duration-200", isOpen ? "-rotate-90" : "")}
          style={{ width: "13px", height: "13px", color: isActive ? `rgba(${rgb},0.6)` : "rgba(100,116,139,0.35)" }}
        />
      </button>
      {isOpen && (
        <div className="mt-1 mr-3 pr-1.5 space-y-px pb-1" style={{ borderRight: `2px solid rgba(${rgb},0.2)` }}>
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
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const toggleGroup = (key: string) => setOpenGroup(prev => prev === key ? null : key);
  const [pwDialogOpen, setPwDialogOpen] = useState(false);
  const [brandSettingsOpen, setBrandSettingsOpen] = useState(false);
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [savingPw, setSavingPw] = useState(false);

  const visibleNav = useMemo(() => {
    return ALL_NAV.filter((item) => {
      if (item.section) return can(item.section);
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
    <div className="flex h-screen bg-background overflow-hidden" dir="rtl">

      {/* ── Sidebar wrapper (desktop) ── */}
      <div
        className="hidden md:flex shrink-0 relative"
        style={{
          width: sidebarCollapsed ? "68px" : "240px",
          transition: "width 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
        }}
      >
        {/* زر Toggle على الحافة اليسرى للـ sidebar (في RTL يكون على يسار الصفحة = الحافة الخارجية للـ main) */}
        <button
          type="button"
          onClick={() => setSidebarCollapsed(v => !v)}
          title={sidebarCollapsed ? "توسيع القائمة" : "تصغير القائمة"}
          style={{
            position: "absolute",
            top: "50%",
            left: "-13px",
            transform: "translateY(-50%)",
            zIndex: 50,
            width: "26px",
            height: "26px",
            borderRadius: "50%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "hsl(var(--sidebar))",
            border: "2px solid hsl(var(--sidebar-border))",
            boxShadow: "-2px 0 8px rgba(0,0,0,0.25)",
            cursor: "pointer",
            transition: "background 0.2s ease",
          }}
          onMouseEnter={e => (e.currentTarget.style.background = "hsl(var(--primary))")}
          onMouseLeave={e => (e.currentTarget.style.background = "hsl(var(--sidebar))")}
        >
          <ChevronLeft style={{
            width: "13px", height: "13px",
            color: "hsl(var(--sidebar-foreground))",
            transform: sidebarCollapsed ? "rotate(180deg)" : "rotate(0deg)",
            transition: "transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
          }} />
        </button>

        {/* الـ Sidebar الفعلي */}
        <aside className="border-l border-sidebar-border bg-sidebar flex flex-col h-full w-full overflow-hidden">

          {/* Header */}
          <div className="shrink-0 border-b border-sidebar-border/60">
            {sidebarCollapsed && (
              <div className="flex flex-col items-center gap-2 py-3 px-1">
                {/* First Logo مصغّر */}
                <div style={{
                  width: "44px", height: "44px", borderRadius: "12px", overflow: "hidden",
                  background: "linear-gradient(180deg, #0a0a0a 0%, #111 100%)",
                  border: "1px solid hsl(var(--primary)/0.4)",
                  boxShadow: "0 0 10px hsl(var(--primary)/0.3)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  <img src={firstLogoBase64} alt="Logo" style={{
                    width: "100%", height: "100%", objectFit: "contain",
                    filter: "drop-shadow(0 0 6px hsl(var(--primary)/0.6))",
                  }} />
                </div>
                {/* Brand Logo */}
                <BrandLogoMark size="sm" onClick={() => setBrandSettingsOpen(true)} />
                {/* Theme toggle */}
                <button type="button" onClick={toggleTheme} title={theme === "dark" ? "الوضع النهاري" : "الوضع الليلي"}
                  className="w-8 h-8 rounded-full flex items-center justify-center transition-all duration-300 hover:scale-110 active:scale-95"
                  style={{
                    background: theme === "dark" ? "linear-gradient(135deg,#1e293b,#0f172a)" : "linear-gradient(135deg,#fef3c7,#fde68a)",
                    border: theme === "dark" ? "1px solid rgba(148,163,184,0.2)" : "1px solid rgba(251,191,36,0.5)",
                    boxShadow: theme === "dark" ? "0 0 8px rgba(148,163,184,0.15)" : "0 0 10px rgba(251,191,36,0.4)",
                  }}>
                  {theme === "dark" ? <Sun className="w-3.5 h-3.5 text-amber-300" /> : <Moon className="w-3.5 h-3.5 text-indigo-600" />}
                </button>
              </div>
            )}
            {!sidebarCollapsed && (<>
              {/* First Logo */}
              <div style={{
                position: "relative", width: "100%",
                background: "linear-gradient(180deg, #0a0a0a 0%, #111 100%)",
                borderBottom: "1px solid hsl(var(--primary)/0.4)",
                display: "flex", alignItems: "center", justifyContent: "center", padding: "0px",
              }}>
                <div style={{ position: "absolute", inset: 0, pointerEvents: "none", background: "radial-gradient(ellipse 100% 100% at 50% 50%, hsl(var(--primary)/0.1) 0%, transparent 70%)" }} />
                <div style={{ position: "absolute", bottom: 0, left: "10%", right: "10%", height: "1px", pointerEvents: "none", background: "linear-gradient(90deg, transparent, hsl(var(--primary)/0.7), transparent)" }} />
                <img src={firstLogoBase64} alt="Caprina Logo" style={{
                  display: "block", width: "100%", height: "auto", maxHeight: "120px",
                  objectFit: "contain", position: "relative", zIndex: 1,
                  filter: "drop-shadow(0 0 18px hsl(var(--primary)/0.7)) drop-shadow(0 2px 6px rgba(0,0,0,0.9))",
                }} />
              </div>

              {/* Brand hero */}
              <div className="px-4 pt-2 pb-4 flex flex-row items-center justify-between relative overflow-hidden"
                style={{ background: "linear-gradient(160deg, hsl(var(--primary)/0.12) 0%, hsl(var(--primary)/0.04) 100%)" }}>
                <div className="absolute inset-0 pointer-events-none" style={{ background: "radial-gradient(ellipse 70% 60% at 50% 0%, hsl(var(--primary)/0.18) 0%, transparent 80%)" }} />
                <div className="relative z-10 cursor-pointer" onClick={() => setBrandSettingsOpen(true)}>
                  <div className="brand-name-glow flex flex-col items-center gap-0">
                    <BrandFull logoSize="md" layout="row" nameClass="text-base font-black tracking-[0.2em] uppercase brand-name-text" taglineClass="text-[0px] opacity-0 h-0 overflow-hidden" />
                    <span className="block h-[2px] rounded-full" style={{
                      width: "5.5rem", alignSelf: "center", marginTop: "2px", marginRight: "2.5rem",
                      background: "linear-gradient(90deg, transparent 0%, hsl(var(--primary)) 20%, #fff 50%, hsl(var(--primary)) 80%, transparent 100%)",
                      boxShadow: "0 0 6px hsl(var(--primary)/0.9), 0 0 14px hsl(var(--primary)/0.5)",
                    }} />
                    <style>{".brand-name-text{background:linear-gradient(135deg,hsl(var(--primary)) 0%,#fff 50%,hsl(var(--primary)) 100%);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;filter:drop-shadow(0 0 8px hsl(var(--primary)/0.8))}"}</style>
                  </div>
                </div>
                <button type="button" onClick={toggleTheme} title={theme === "dark" ? "الوضع النهاري" : "الوضع الليلي"}
                  className="relative z-20 w-9 h-9 rounded-full flex items-center justify-center transition-all duration-300 hover:scale-110 active:scale-95 shrink-0"
                  style={{
                    background: theme === "dark" ? "linear-gradient(135deg,#1e293b,#0f172a)" : "linear-gradient(135deg,#fef3c7,#fde68a)",
                    border: theme === "dark" ? "1px solid rgba(148,163,184,0.2)" : "1px solid rgba(251,191,36,0.5)",
                    boxShadow: theme === "dark" ? "0 0 12px rgba(148,163,184,0.15)" : "0 0 14px rgba(251,191,36,0.4)",
                  }}>
                  {theme === "dark" ? <Sun className="w-4 h-4 text-amber-300" /> : <Moon className="w-4 h-4 text-indigo-600" />}
                </button>
                <div className="absolute bottom-0 left-6 right-6 h-px" style={{ background: "linear-gradient(90deg, transparent, hsl(var(--primary)/0.4), transparent)" }} />
              </div>

              {/* User card */}
              <div className="px-3 py-3">
                <button type="button" onClick={() => setUserMenuOpen(v => !v)}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl transition-all hover:bg-foreground/5"
                  style={{ background: "hsl(var(--muted)/0.4)", border: "1px solid hsl(var(--border)/0.5)" }}>
                  <div className="relative shrink-0">
                    {(user as any)?.avatar
                      ? <img src={(user as any).avatar} className="w-8 h-8 rounded-full object-cover border-2 border-primary/30" alt={user?.displayName} />
                      : <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold"
                          style={{ background: "linear-gradient(135deg,hsl(var(--primary)/0.8),hsl(var(--primary)/0.4))", color: "hsl(var(--primary-foreground))", border: "2px solid hsl(var(--primary)/0.3)" }}>
                          {user?.displayName?.charAt(0)?.toUpperCase() ?? "?"}
                        </div>}
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
                {userMenuOpen && (
                  <div className="mt-1 rounded-xl border overflow-hidden shadow-xl z-50" style={{ background: "hsl(var(--card))", borderColor: "hsl(var(--border))" }}>
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
                      <KeyRound className="w-3.5 h-3.5 text-muted-foreground" />تغيير كلمة المرور
                    </button>
                    <button type="button" onClick={() => { setUserMenuOpen(false); logout(); }}
                      className="w-full flex items-center gap-2 px-3 py-2.5 text-xs text-red-400 hover:bg-red-900/10 transition-colors border-t" style={{ borderColor: "hsl(var(--border))" }}>
                      <LogOut className="w-3.5 h-3.5" />تسجيل الخروج
                    </button>
                  </div>
                )}
              </div>
            </>)}
          </div>

          {/* Nav */}
          <nav className={cn("py-3 flex-1 space-y-0.5 overflow-y-auto", sidebarCollapsed ? "px-1" : "px-2")}>
            {visibleNav.filter(i => i.group === "dashboard").map(item => <NavItem key={item.href} item={item} location={location} collapsed={sidebarCollapsed} />)}

            {visibleNav.some(i => i.group === "orders") && (
              <NavGroup label="الطلبات" icon={Package} iconColor="text-orange-400" location={location} prefixes={["/orders","/invoices","/shipping-followup"]} isOpen={openGroup === "orders"} onToggle={() => toggleGroup("orders")} collapsed={sidebarCollapsed}>
                {visibleNav.filter(i => i.group === "orders").map(item => <NavItem key={item.href+item.label} item={item} location={location} sub />)}
              </NavGroup>
            )}

            {visibleNav.some(i => i.group === "shipping") && (
              <NavGroup label="الشحن والتوصيل" icon={Truck} iconColor="text-sky-400" location={location} prefixes={["/shipping"]} isOpen={openGroup === "shipping"} onToggle={() => toggleGroup("shipping")} collapsed={sidebarCollapsed}>
                {visibleNav.filter(i => i.group === "shipping").map(item => <NavItem key={item.href} item={item} location={location} sub />)}
              </NavGroup>
            )}

            {visibleNav.some(i => i.group === "inventory") && (
              <NavGroup label="المنتجات والمخزون" icon={Boxes} iconColor="text-violet-400" location={location} prefixes={["/inventory","/warehouses","/movements"]} isOpen={openGroup === "inventory"} onToggle={() => toggleGroup("inventory")} collapsed={sidebarCollapsed}>
                {visibleNav.filter(i => i.group === "inventory").map(item => <NavItem key={item.href} item={item} location={location} sub />)}
              </NavGroup>
            )}

            {visibleNav.some(i => i.group === "analytics") && (
              <NavGroup label="التحليلات" icon={BarChart3} iconColor="text-pink-400" location={location} prefixes={["/product-performance","/smart","/ads-analytics","/team-performance","/sessions-report"]} isOpen={openGroup === "analytics"} onToggle={() => toggleGroup("analytics")} collapsed={sidebarCollapsed}>
                {visibleNav.filter(i => i.group === "analytics").map(item => <NavItem key={item.href+item.label} item={item} location={location} sub />)}
              </NavGroup>
            )}

            {(isAdmin || can("finance")) && (
              <NavGroup label="الماليات" icon={DollarSign} iconColor="text-emerald-400" location={location} prefixes={["/finance"]} isOpen={openGroup === "finance"} onToggle={() => toggleGroup("finance")} collapsed={sidebarCollapsed}>
                {FINANCE_NAV.map((item) => {
                  const isActive = location === item.href;
                  const Icon = item.icon;
                  const rgb2 = resolveRgb(item.iconColor ?? "text-blue-400");
                  return (
                    <Link key={item.href} href={item.href}
                      className={cn("flex items-center gap-3 px-3 py-2 rounded-lg text-[11.5px] font-semibold transition-all duration-200 mr-2 group",
                        isActive ? "text-white" : "text-sidebar-foreground/60 hover:text-sidebar-foreground/90 hover:bg-white/[0.04]")}
                      style={isActive ? {
                        background: `linear-gradient(135deg, rgba(${rgb2},0.18) 0%, rgba(${rgb2},0.07) 100%)`,
                        border: `1px solid rgba(${rgb2},0.25)`,
                        boxShadow: `0 1px 8px rgba(${rgb2},0.15)`,
                      } : { border: "1px solid transparent" }}>
                      <div className="shrink-0 flex items-center justify-center" style={{
                        width: "28px", height: "28px", borderRadius: "8px",
                        background: isActive ? `linear-gradient(145deg, rgba(${rgb2},0.85) 0%, rgba(${rgb2},0.45) 100%)` : `linear-gradient(145deg, rgba(${rgb2},0.15) 0%, rgba(${rgb2},0.06) 100%)`,
                        border: isActive ? `1px solid rgba(${rgb2},0.5)` : `1px solid rgba(${rgb2},0.12)`,
                        boxShadow: isActive ? `0 3px 10px rgba(${rgb2},0.35)` : `0 1px 4px rgba(${rgb2},0.1)`,
                      }}>
                        <Icon style={{ width: "13px", height: "13px", color: isActive ? "rgba(255,255,255,0.95)" : `rgba(${rgb2},0.75)` }} />
                      </div>
                      <span className="flex-1 text-right">{item.label}</span>
                    </Link>
                  );
                })}
              </NavGroup>
            )}

            {visibleNav.some(i => i.group === "team") && (
              <NavGroup label="الفريق والإدارة" icon={Users} iconColor="text-green-400" location={location} prefixes={["/team","/team-performance","/users","/audit-logs"]} isOpen={openGroup === "team"} onToggle={() => toggleGroup("team")} collapsed={sidebarCollapsed}>
                {visibleNav.filter(i => i.group === "team").map(item => <NavItem key={item.href+item.label} item={item} location={location} sub />)}
              </NavGroup>
            )}

            {visibleNav.some(i => i.group === "tools") && (
              <NavGroup label="الأدوات" icon={Upload} iconColor="text-amber-400" location={location} prefixes={["/import","/export","/archive"]} isOpen={openGroup === "tools"} onToggle={() => toggleGroup("tools")} collapsed={sidebarCollapsed}>
                {visibleNav.filter(i => i.group === "tools").map(item => <NavItem key={item.href} item={item} location={location} sub />)}
              </NavGroup>
            )}

            {visibleNav.some(i => i.group === "settings") && (
              <NavGroup label="الإعدادات والدعم" icon={Settings} iconColor="text-emerald-500" location={location} prefixes={["/whatsapp","/audit-logs"]} isOpen={openGroup === "settings"} onToggle={() => toggleGroup("settings")} collapsed={sidebarCollapsed}>
                {visibleNav.filter(i => i.group === "settings").map(item => <NavItem key={item.href+item.label} item={item} location={location} sub />)}
              </NavGroup>
            )}
          </nav>

          {/* User info footer */}
          {sidebarCollapsed && (
            <div className="shrink-0 border-t border-sidebar-border py-3 flex flex-col items-center gap-2 px-1">
              {/* Theme toggle */}
              <button type="button" onClick={toggleTheme} title={theme === "dark" ? "الوضع النهاري" : "الوضع الليلي"}
                className="w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300 hover:scale-110 active:scale-95"
                style={{
                  background: theme === "dark" ? "linear-gradient(135deg,#1e293b,#0f172a)" : "linear-gradient(135deg,#fef3c7,#fde68a)",
                  border: theme === "dark" ? "1px solid rgba(148,163,184,0.25)" : "1px solid rgba(251,191,36,0.6)",
                  boxShadow: theme === "dark" ? "0 0 8px rgba(148,163,184,0.2)" : "0 0 10px rgba(251,191,36,0.4)",
                }}>
                {theme === "dark" ? <Sun className="w-4 h-4 text-amber-300" /> : <Moon className="w-4 h-4 text-indigo-600" />}
              </button>
              {/* User avatar */}
              <button type="button" onClick={() => setUserMenuOpen(v => !v)} title={user?.displayName}
                className="relative w-10 h-10 rounded-full flex items-center justify-center hover:ring-2 hover:ring-primary/40 transition-all">
                {(user as any)?.avatar
                  ? <img src={(user as any).avatar} className="w-10 h-10 rounded-full object-cover border-2 border-primary/30" alt={user?.displayName} />
                  : <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold"
                      style={{ background: "linear-gradient(135deg,hsl(var(--primary)/0.8),hsl(var(--primary)/0.4))", color: "hsl(var(--primary-foreground))", border: "2px solid hsl(var(--primary)/0.3)" }}>
                      {user?.displayName?.charAt(0)?.toUpperCase() ?? "?"}
                    </div>}
                <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-400 border-2 border-sidebar z-10" style={{boxShadow:"0 0 6px rgba(52,211,153,0.9)"}}>
                  <span className="absolute inset-0 rounded-full bg-emerald-400 animate-ping" style={{opacity:0.7}} />
                </span>
              </button>
              {userMenuOpen && (
                <div className="absolute bottom-16 right-1 left-1 bg-card border border-border rounded-xl shadow-xl overflow-hidden z-50">
                  <button type="button" onClick={() => { toggleTheme(); setUserMenuOpen(false); }}
                    className="w-full flex items-center gap-2 px-3 py-2.5 text-xs hover:bg-muted/20 transition-colors">
                    {theme === "dark" ? <Sun className="w-3.5 h-3.5 text-amber-400" /> : <Moon className="w-3.5 h-3.5 text-muted-foreground" />}
                    {theme === "dark" ? "الوضع الفاتح" : "الوضع الداكن"}
                  </button>
                  <button type="button" onClick={() => { setUserMenuOpen(false); setPwDialogOpen(true); }}
                    className="w-full flex items-center gap-2 px-3 py-2.5 text-xs hover:bg-muted/20 transition-colors">
                    <KeyRound className="w-3.5 h-3.5 text-muted-foreground" />تغيير كلمة المرور
                  </button>
                  <button type="button" onClick={() => { setUserMenuOpen(false); logout(); }}
                    className="w-full flex items-center gap-2 px-3 py-2.5 text-xs text-red-400 hover:bg-red-900/10 transition-colors border-t border-border">
                    <LogOut className="w-3.5 h-3.5" />تسجيل الخروج
                  </button>
                </div>
              )}
            </div>
          )}
          {!sidebarCollapsed && (
            <div className="shrink-0 border-t border-sidebar-border">
              <div className="relative">
                <div className="flex items-center gap-1 px-2 py-2">
                  {/* زر theme */}
                  <button type="button" onClick={toggleTheme} title={theme === "dark" ? "الوضع النهاري" : "الوضع الليلي"}
                    className="shrink-0 w-8 h-8 rounded-full flex items-center justify-center transition-all duration-300 hover:scale-110 active:scale-95"
                    style={{
                      background: theme === "dark" ? "linear-gradient(135deg,#1e293b,#0f172a)" : "linear-gradient(135deg,#fef3c7,#fde68a)",
                      border: theme === "dark" ? "1px solid rgba(148,163,184,0.25)" : "1px solid rgba(251,191,36,0.6)",
                      boxShadow: theme === "dark" ? "0 0 8px rgba(148,163,184,0.15)" : "0 0 10px rgba(251,191,36,0.4)",
                    }}>
                    {theme === "dark" ? <Sun className="w-3.5 h-3.5 text-amber-300" /> : <Moon className="w-3.5 h-3.5 text-indigo-600" />}
                  </button>
                  {/* بيانات المدير */}
                  <button type="button" onClick={() => setUserMenuOpen(v => !v)}
                    className="flex-1 flex items-center gap-2 px-2 py-1 rounded-xl hover:bg-foreground/5 transition-colors text-right min-w-0">
                    <div className="relative shrink-0">
                      {(user as any)?.avatar
                        ? <img src={(user as any).avatar} className="w-7 h-7 rounded-full object-cover border-2 border-primary/30" alt={user?.displayName} />
                        : <div className="w-7 h-7 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center text-xs font-bold text-primary">
                            {user?.displayName?.charAt(0) ?? "?"}
                          </div>}
                      <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-400 border-2 border-[#111] z-10" style={{boxShadow:"0 0 8px rgba(52,211,153,0.9)"}}>
                        <span className="absolute inset-0 rounded-full bg-emerald-400 animate-ping" style={{opacity:0.75}} />
                      </span>
                    </div>
                    <div className="flex-1 min-w-0 text-right">
                      <p className="text-xs font-bold text-sidebar-foreground truncate">{user?.displayName}</p>
                      <p className="text-[9px] text-sidebar-foreground/40">{ROLE_LABELS[user?.role ?? ""] ?? user?.role}</p>
                    </div>
                    <ChevronDown className={`w-3 h-3 text-sidebar-foreground/40 transition-transform shrink-0 ${userMenuOpen ? "rotate-180" : ""}`} />
                  </button>
                </div>
                {userMenuOpen && (
                  <div className="absolute bottom-full right-0 left-0 bg-card border border-border rounded-t-lg shadow-lg overflow-hidden z-50">
                    <button type="button" onClick={() => { toggleTheme(); setUserMenuOpen(false); }}
                      className="w-full flex items-center justify-between gap-2 px-3 py-2.5 text-xs hover:bg-muted/20 transition-colors">
                      <div className="flex items-center gap-2">
                        {theme === "dark" ? <Sun className="w-3.5 h-3.5 text-amber-400" /> : <Moon className="w-3.5 h-3.5 text-muted-foreground" />}
                        {theme === "dark" ? "الوضع الفاتح" : "الوضع الداكن"}
                      </div>
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-muted/40 text-muted-foreground">{theme === "dark" ? "Light" : "Dark"}</span>
                    </button>
                    <button type="button" onClick={() => { setUserMenuOpen(false); setPwDialogOpen(true); }}
                      className="w-full flex items-center gap-2 px-3 py-2.5 text-xs hover:bg-muted/20 transition-colors">
                      <KeyRound className="w-3.5 h-3.5 text-muted-foreground" />تغيير كلمة المرور
                    </button>
                    <button type="button" onClick={() => { setUserMenuOpen(false); logout(); }}
                      className="w-full flex items-center gap-2 px-3 py-2.5 text-xs text-red-400 hover:bg-red-900/10 transition-colors border-t border-border">
                      <LogOut className="w-3.5 h-3.5" />تسجيل الخروج
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </aside>
      </div>

      {/* ── Main content ── */}
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
              <button type="button" onClick={() => setMobileMenuOpen(true)} className="text-sidebar-foreground/70 hover:text-sidebar-foreground transition-colors p-1">
                <Menu className="w-5 h-5" />
              </button>
            </div>
          </div>
        </header>

        {/* Mobile Drawer */}
        {mobileMenuOpen && (
          <div className="fixed inset-0 z-50 md:hidden" dir="rtl">
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setMobileMenuOpen(false)} />
            <div className="absolute top-0 right-0 h-full w-72 bg-sidebar border-l border-sidebar-border flex flex-col shadow-2xl animate-in slide-in-from-right duration-200">
              <div className="flex items-center justify-between p-4 border-b border-sidebar-border">
                <BrandFull logoSize="sm" layout="row" nameClass="text-sm text-sidebar-foreground" onLogoClick={() => { setBrandSettingsOpen(true); setMobileMenuOpen(false); }} />
                <button type="button" onClick={() => setMobileMenuOpen(false)} className="text-sidebar-foreground/50 hover:text-sidebar-foreground p-1 rounded-md hover:bg-foreground/5">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-0.5">
                {visibleNav.map((item) => {
                  const isActive = item.exact ? location === item.href : (location === item.href || location.startsWith(item.href + "/") || (item.href !== "/" && location.startsWith(item.href)));
                  const Icon = item.icon;
                  return (
                    <Link key={item.href} href={item.href} onClick={() => setMobileMenuOpen(false)}
                      className={cn("flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-semibold transition-all",
                        isActive ? "bg-primary text-primary-foreground" : "text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-foreground/5")}>
                      <Icon className={cn("w-4 h-4 shrink-0", isActive ? "text-primary-foreground" : item.iconColor)} />
                      {item.label}
                    </Link>
                  );
                })}
                {(isAdmin || can("finance")) && (
                  <div className="pt-1">
                    <button type="button" onClick={() => setFinanceOpen(v => !v)}
                      className={cn("w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-semibold transition-all",
                        location.startsWith("/finance") ? "bg-emerald-500/15 text-emerald-400" : "text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-foreground/5")}>
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
                            <Link key={item.href} href={item.href} onClick={() => setMobileMenuOpen(false)}
                              className={cn("flex items-center gap-3 px-3 py-2 rounded-md text-sm font-semibold transition-all",
                                isActive ? "bg-primary text-primary-foreground" : "text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-foreground/5")}>
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
              <div className="px-3 pb-2 flex justify-center">
                <button type="button" onClick={toggleTheme} className="w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300 hover:scale-110"
                  style={{ background: theme === "dark" ? "linear-gradient(135deg,#1e293b,#0f172a)" : "linear-gradient(135deg,#fef3c7,#fde68a)", border: theme === "dark" ? "1px solid rgba(148,163,184,0.2)" : "1px solid rgba(251,191,36,0.5)" }}>
                  {theme === "dark" ? <Sun className="w-5 h-5 text-amber-300" /> : <Moon className="w-5 h-5 text-indigo-600" />}
                </button>
              </div>
              <div className="border-t border-sidebar-border p-3 space-y-1">
                <div className="flex items-center gap-2 px-1 py-1">
                  <div className="relative shrink-0">
                    {(user as any)?.avatar
                      ? <img src={(user as any).avatar} className="w-8 h-8 rounded-full object-cover border-2 border-primary/30" alt={user?.displayName} />
                      : <div className="w-8 h-8 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center text-xs font-bold text-primary">{user?.displayName?.charAt(0) ?? "?"}</div>}
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

        {/* Page content — flex-1 + overflow-auto هنا هو الـ scroll container الوحيد */}
        <div id="main-scroll-area" className="flex-1 overflow-y-auto overflow-x-hidden">
          <div className="w-full p-3 sm:p-4 md:p-5 xl:p-6 2xl:p-8">
            {children}
          </div>
        </div>
      </main>

      <BrandSettingsDialog open={brandSettingsOpen} onClose={() => setBrandSettingsOpen(false)} />

      <Dialog open={pwDialogOpen} onOpenChange={setPwDialogOpen}>
        <DialogContent className="bg-card border-border max-w-sm" dir="rtl">
          <DialogHeader><DialogTitle>تغيير كلمة المرور</DialogTitle></DialogHeader>
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
