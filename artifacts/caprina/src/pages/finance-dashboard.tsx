import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { TrendingUp, TrendingDown, DollarSign, Package, Truck, AlertCircle, Wallet, ShoppingCart, Building2, Receipt, FileText, ArrowLeft } from "lucide-react";
import { useState } from "react";
import { format, startOfMonth } from "date-fns";
import { Link } from "wouter";
import { useAuth } from "@/contexts/AuthContext";

const fmt = (n: number) =>
  new Intl.NumberFormat("ar-EG", { style: "currency", currency: "EGP", maximumFractionDigits: 0 }).format(n);

// ─── بطاقات الأقسام للأدمن ───────────────────────────────────────────────────
const FINANCE_MODULES = [
  {
    href:    "/finance/cash",
    label:   "الخزنة",
    desc:    "الخزنة الرئيسية والفروع والحركات النقدية",
    icon:    Wallet,
    color:   "text-yellow-500",
    bg:      "bg-yellow-500/10",
    border:  "border-yellow-500/20",
  },
  {
    href:    "/finance/purchases",
    label:   "أوامر الشراء",
    desc:    "إنشاء ومتابعة أوامر الشراء من الموردين",
    icon:    ShoppingCart,
    color:   "text-violet-500",
    bg:      "bg-violet-500/10",
    border:  "border-violet-500/20",
  },
  {
    href:    "/finance/suppliers",
    label:   "الموردون",
    desc:    "بيانات الموردين وأرصدتهم وشروط الدفع",
    icon:    Building2,
    color:   "text-blue-500",
    bg:      "bg-blue-500/10",
    border:  "border-blue-500/20",
  },
  {
    href:    "/finance/expenses",
    label:   "المصروفات",
    desc:    "تسجيل ومتابعة المصروفات التشغيلية",
    icon:    Receipt,
    color:   "text-rose-500",
    bg:      "bg-rose-500/10",
    border:  "border-rose-500/20",
  },
  {
    href:    "/finance/shipping-invoices",
    label:   "فواتير الشحن",
    desc:    "مراجعة وتسوية فواتير شركات الشحن",
    icon:    FileText,
    color:   "text-sky-500",
    bg:      "bg-sky-500/10",
    border:  "border-sky-500/20",
  },
];

export default function FinanceDashboard() {
  const { user } = useAuth();
  const isAdmin  = user?.role === "admin";

  const [from, setFrom] = useState(format(startOfMonth(new Date()), "yyyy-MM-dd"));
  const [to,   setTo]   = useState(format(new Date(), "yyyy-MM-dd"));

  const { data: summary, isLoading } = useQuery({
    queryKey: ["finance-summary", from, to],
    queryFn: async () => {
      const res = await fetch(`/api/finance/summary?from=${from}&to=${to}`, { credentials: "include" });
      if (!res.ok) throw new Error("فشل تحميل البيانات");
      return res.json();
    },
  });

  // رصيد الخزنة للأدمن
  const { data: cashData } = useQuery({
    queryKey: ["/api/cash-registers"],
    queryFn: async () => {
      const res = await fetch("/api/cash-registers", { credentials: "include" });
      if (!res.ok) throw new Error();
      return res.json();
    },
    enabled: isAdmin,
  });

  const kpis = [
    { label: "إجمالي الإيراد",      value: summary?.revenue ?? 0,            icon: DollarSign,  color: "text-emerald-500", bg: "bg-emerald-500/10" },
    { label: "تكلفة البضاعة",       value: summary?.cogs ?? 0,               icon: Package,     color: "text-orange-500",  bg: "bg-orange-500/10"  },
    { label: "مصاريف الشحن",        value: summary?.shippingSpend ?? 0,       icon: Truck,       color: "text-sky-500",     bg: "bg-sky-500/10"     },
    { label: "المصروفات التشغيلية", value: summary?.operatingExpenses ?? 0,   icon: AlertCircle, color: "text-rose-500",    bg: "bg-rose-500/10"    },
  ];

  return (
    <div className="space-y-6 animate-in fade-in duration-500" dir="rtl">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">لوحة الماليات</h1>
          <p className="text-muted-foreground text-sm">ملخص مالي شامل للفترة المحددة</p>
        </div>
        <div className="flex gap-2 items-center text-sm">
          <label className="text-muted-foreground">من</label>
          <input type="date" className="border border-border rounded-md px-2 py-1.5 text-sm bg-card" value={from} onChange={e => setFrom(e.target.value)} />
          <label className="text-muted-foreground">إلى</label>
          <input type="date" className="border border-border rounded-md px-2 py-1.5 text-sm bg-card" value={to} onChange={e => setTo(e.target.value)} />
        </div>
      </div>

      {/* ── للأدمن فقط: إجمالي الخزنة ── */}
      {isAdmin && cashData && (
        <Link href="/finance/cash">
          <div className="rounded-2xl bg-gradient-to-l from-yellow-500 to-amber-500 text-white p-5 shadow-md cursor-pointer hover:opacity-95 transition-opacity">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm opacity-80 mb-1 flex items-center gap-1.5">
                  <Wallet className="w-4 h-4" /> إجمالي الكاش (كل الخزن)
                </p>
                <p className="text-4xl font-black">
                  {Number(cashData.totalBalance).toLocaleString("ar-EG", { minimumFractionDigits: 2 })} ج.م
                </p>
                <p className="text-xs opacity-70 mt-1">{cashData.registers?.length ?? 0} خزنة نشطة — اضغط للتفاصيل</p>
              </div>
              <ArrowLeft className="w-6 h-6 opacity-60" />
            </div>
          </div>
        </Link>
      )}

      {/* Net Profit Banner */}
      <Card className={`p-5 border-2 ${(summary?.netProfit ?? 0) >= 0 ? "border-emerald-500/40 bg-emerald-500/5" : "border-rose-500/40 bg-rose-500/5"}`}>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground font-medium">صافي الربح</p>
            <p className={`text-3xl font-black mt-1 ${(summary?.netProfit ?? 0) >= 0 ? "text-emerald-500" : "text-rose-500"}`}>
              {isLoading ? "..." : fmt(summary?.netProfit ?? 0)}
            </p>
            <p className="text-xs text-muted-foreground mt-1">هامش الربح: {summary?.netMargin ?? 0}%</p>
          </div>
          {(summary?.netProfit ?? 0) >= 0
            ? <TrendingUp className="w-12 h-12 text-emerald-500/40" />
            : <TrendingDown className="w-12 h-12 text-rose-500/40" />}
        </div>
        {(summary?.unpaidShippingDues ?? 0) > 0 && (
          <div className="mt-3 flex items-center gap-2 text-xs text-amber-600 bg-amber-50 dark:bg-amber-900/20 rounded-md px-3 py-1.5">
            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
            مستحقات شركات الشحن غير المسددة: <strong>{fmt(summary.unpaidShippingDues)}</strong>
          </div>
        )}
      </Card>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {kpis.map((k) => {
          const Icon = k.icon;
          return (
            <Card key={k.label} className="p-4 border-border">
              <div className={`w-9 h-9 rounded-lg ${k.bg} flex items-center justify-center mb-3`}>
                <Icon className={`w-4 h-4 ${k.color}`} />
              </div>
              <p className="text-xs text-muted-foreground">{k.label}</p>
              <p className={`text-lg font-bold mt-0.5 ${k.color}`}>
                {isLoading ? "..." : fmt(k.value)}
              </p>
            </Card>
          );
        })}
      </div>

      {/* Gross Profit Row */}
      <Card className="p-4 border-border">
        <p className="text-xs text-muted-foreground mb-2">مجمل الربح (إيراد − تكلفة − شحن)</p>
        <p className="text-xl font-bold text-blue-500">{isLoading ? "..." : fmt(summary?.grossProfit ?? 0)}</p>
      </Card>

      {/* ── للأدمن فقط: الأقسام المالية ── */}
      {isAdmin && (
        <div>
          <h2 className="text-base font-semibold mb-3 text-muted-foreground">الأقسام المالية</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {FINANCE_MODULES.map((mod) => {
              const Icon = mod.icon;
              return (
                <Link key={mod.href} href={mod.href}>
                  <Card className={`p-4 border ${mod.border} hover:shadow-md hover:-translate-y-0.5 transition-all cursor-pointer group`}>
                    <div className="flex items-start gap-3">
                      <div className={`w-10 h-10 rounded-xl ${mod.bg} flex items-center justify-center shrink-0 mt-0.5`}>
                        <Icon className={`w-5 h-5 ${mod.color}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm">{mod.label}</p>
                        <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{mod.desc}</p>
                      </div>
                      <ArrowLeft className="w-4 h-4 text-muted-foreground/40 group-hover:text-muted-foreground shrink-0 mt-1 transition-colors" />
                    </div>
                  </Card>
                </Link>
              );
            })}
          </div>
        </div>
      )}

    </div>
  );
}
