import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import {
  TrendingUp, TrendingDown, DollarSign, Package, Truck,
  AlertCircle, Wallet, ShoppingCart, Building2, Receipt,
  FileText, ArrowLeft, CheckCircle2, Info, RefreshCw,
  Clock, BarChart3, ArrowUpRight, ArrowDownRight, Minus,
} from "lucide-react";
import { useState } from "react";
import { format, startOfMonth } from "date-fns";
import { Link } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { apiFetch } from "@/lib/api";

const fmt = (n: number) =>
  new Intl.NumberFormat("ar-EG", { style: "currency", currency: "EGP", maximumFractionDigits: 0 }).format(n);

const fmtNum = (n: number) =>
  new Intl.NumberFormat("ar-EG", { maximumFractionDigits: 0 }).format(n);

// ─── أيقونة اتجاه المقارنة ────────────────────────────────────────────────
function DeltaBadge({ value, inverse = false }: { value: number | null; inverse?: boolean }) {
  if (value === null) return <span className="text-xs text-muted-foreground">—</span>;
  const positive = inverse ? value < 0 : value > 0;
  const neutral  = value === 0;
  const color    = neutral ? "text-muted-foreground" : positive ? "text-emerald-500" : "text-rose-500";
  const Icon     = neutral ? Minus : positive ? ArrowUpRight : ArrowDownRight;
  return (
    <span className={`inline-flex items-center gap-0.5 text-xs font-semibold ${color}`}>
      <Icon className="w-3 h-3" />
      {Math.abs(value)}%
    </span>
  );
}

// ─── بطاقات الأقسام ───────────────────────────────────────────────────────
const FINANCE_MODULES = [
  { href: "/finance/cash",              label: "الخزنة",         desc: "الخزنة الرئيسية والفروع والحركات النقدية",     icon: Wallet,       color: "text-yellow-500",  bg: "bg-yellow-500/10",  border: "border-yellow-500/20"  },
  { href: "/finance/purchases",         label: "أوامر الشراء",   desc: "إنشاء ومتابعة أوامر الشراء من الموردين",       icon: ShoppingCart, color: "text-violet-500",  bg: "bg-violet-500/10",  border: "border-violet-500/20"  },
  { href: "/finance/suppliers",         label: "الموردون",       desc: "بيانات الموردين وأرصدتهم وشروط الدفع",         icon: Building2,    color: "text-blue-500",    bg: "bg-blue-500/10",    border: "border-blue-500/20"    },
  { href: "/finance/expenses",          label: "المصروفات",      desc: "تسجيل ومتابعة المصروفات التشغيلية",             icon: Receipt,      color: "text-rose-500",    bg: "bg-rose-500/10",    border: "border-rose-500/20"    },
  { href: "/finance/shipping-invoices", label: "فواتير الشحن",   desc: "مراجعة وتسوية فواتير شركات الشحن",             icon: FileText,     color: "text-sky-500",     bg: "bg-sky-500/10",     border: "border-sky-500/20"     },
];

// ─── ألوان التنبيهات ──────────────────────────────────────────────────────
const ALERT_STYLE: Record<string, { bg: string; border: string; iconColor: string; Icon: React.ElementType }> = {
  danger:  { bg: "bg-rose-500/8",    border: "border-rose-500/30",    iconColor: "text-rose-500",    Icon: AlertCircle    },
  warning: { bg: "bg-amber-500/8",   border: "border-amber-500/30",   iconColor: "text-amber-500",   Icon: Info           },
  info:    { bg: "bg-sky-500/8",     border: "border-sky-500/30",     iconColor: "text-sky-500",     Icon: Info           },
  success: { bg: "bg-emerald-500/8", border: "border-emerald-500/30", iconColor: "text-emerald-500", Icon: CheckCircle2   },
};

export default function FinanceDashboard() {
  const { user } = useAuth();
  const isAdmin  = user?.role === "admin";

  const [from, setFrom] = useState(format(startOfMonth(new Date()), "yyyy-MM-dd"));
  const [to,   setTo]   = useState(format(new Date(), "yyyy-MM-dd"));

  // ── API: analytics (P&L + alerts + cashflow) ─────────────────────────────
  const { data: analytics, isLoading } = useQuery({
    queryKey: ["finance-analytics", from, to],
    queryFn: () => apiFetch<any>(`/finance/analytics?from=${from}&to=${to}`),
  });

  // ── API: رصيد الخزنة ─────────────────────────────────────────────────────
  const { data: cashData } = useQuery({
    queryKey: ["/api/cash-registers"],
    queryFn: () => apiFetch<any>("/cash-registers"),
    enabled: isAdmin,
  });

  const cur  = analytics?.current;
  const prev = analytics?.previous;
  const cmp  = analytics?.comparison;
  const cf   = analytics?.cashFlow;
  const alts = analytics?.alerts ?? [];
  const topExp = analytics?.topExpenseCategories ?? [];

  // ── P&L rows ──────────────────────────────────────────────────────────────
  const plRows = [
    { label: "إجمالي الإيراد",       value: cur?.revenue    ?? 0, prevVal: prev?.revenue    ?? 0, delta: cmp?.revenue,    icon: DollarSign,  color: "text-emerald-500", sign: "+" },
    { label: "تكلفة البضاعة المباعة",value: cur?.cogs       ?? 0, prevVal: prev?.cogs       ?? 0, delta: null,            icon: Package,     color: "text-orange-400",  sign: "−" },
    { label: "مصاريف الشحن",         value: cur?.shipping   ?? 0, prevVal: prev?.shipping   ?? 0, delta: null,            icon: Truck,       color: "text-sky-400",     sign: "−" },
    { label: "المصروفات التشغيلية",  value: cur?.expenses   ?? 0, prevVal: prev?.expenses   ?? 0, delta: cmp?.expenses,   icon: Receipt,     color: "text-rose-400",    sign: "−" },
  ];

  return (
    <div className="space-y-5 animate-in fade-in duration-500" dir="rtl">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <BarChart3 className="w-6 h-6 text-primary" /> لوحة الماليات
          </h1>
          <p className="text-muted-foreground text-sm">تقرير الأداء المالي الشامل</p>
        </div>
        <div className="flex gap-2 items-center text-sm flex-wrap">
          <label className="text-muted-foreground">من</label>
          <input type="date" className="border border-border rounded-md px-2 py-1.5 text-sm bg-card"
            value={from} onChange={e => setFrom(e.target.value)} />
          <label className="text-muted-foreground">إلى</label>
          <input type="date" className="border border-border rounded-md px-2 py-1.5 text-sm bg-card"
            value={to} onChange={e => setTo(e.target.value)} />
        </div>
      </div>

      {/* ── رصيد الخزنة (أدمن) ───────────────────────────────────────────────── */}
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

      {/* ── Smart Alerts ──────────────────────────────────────────────────────── */}
      {alts.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-sm font-semibold text-muted-foreground flex items-center gap-1.5">
            <AlertCircle className="w-4 h-4" /> تنبيهات ذكية ({alts.length})
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {alts.map((a: any, i: number) => {
              const s = ALERT_STYLE[a.type] ?? ALERT_STYLE.info;
              const Icon = s.Icon;
              return (
                <div key={i} className={`flex items-start gap-2.5 rounded-xl border ${s.border} ${s.bg} px-3.5 py-3`}>
                  <Icon className={`w-4 h-4 mt-0.5 shrink-0 ${s.iconColor}`} />
                  <div>
                    <p className="text-sm font-semibold">{a.message}</p>
                    {a.detail && <p className="text-xs text-muted-foreground mt-0.5">{a.detail}</p>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── P&L Statement ─────────────────────────────────────────────────────── */}
      <Card className="border-border overflow-hidden">
        <div className="px-5 py-4 border-b border-border bg-muted/30 flex items-center justify-between">
          <h2 className="text-sm font-bold flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-primary" /> قائمة الأرباح والخسائر
          </h2>
          <span className="text-xs text-muted-foreground">مقارنة بالفترة السابقة</span>
        </div>
        <div className="divide-y divide-border">
          {plRows.map((row) => {
            const Icon = row.icon;
            return (
              <div key={row.label} className="flex items-center justify-between px-5 py-3.5 hover:bg-muted/20 transition-colors">
                <div className="flex items-center gap-2.5">
                  <Icon className={`w-4 h-4 ${row.color}`} />
                  <div>
                    <p className="text-sm font-medium">{row.label}</p>
                    {row.prevVal > 0 && (
                      <p className="text-xs text-muted-foreground">السابق: {fmt(row.prevVal)}</p>
                    )}
                  </div>
                </div>
                <div className="text-end">
                  <p className={`text-sm font-bold ${row.color}`}>
                    {row.sign} {isLoading ? "..." : fmt(row.value)}
                  </p>
                  {row.delta !== null && row.delta !== undefined && (
                    <DeltaBadge value={row.delta} inverse={row.sign === "−"} />
                  )}
                </div>
              </div>
            );
          })}

          {/* مجمل الربح */}
          <div className="flex items-center justify-between px-5 py-3.5 bg-blue-500/5">
            <p className="text-sm font-semibold text-blue-500">مجمل الربح</p>
            <div className="text-end">
              <p className="text-sm font-bold text-blue-500">
                {isLoading ? "..." : fmt(cur?.grossProfit ?? 0)}
              </p>
              <p className="text-xs text-muted-foreground">
                هامش {cur?.grossMargin ?? 0}%
              </p>
            </div>
          </div>

          {/* صافي الربح */}
          <div className={`flex items-center justify-between px-5 py-4 ${(cur?.netProfit ?? 0) >= 0 ? "bg-emerald-500/8" : "bg-rose-500/8"}`}>
            <div className="flex items-center gap-2">
              {(cur?.netProfit ?? 0) >= 0
                ? <TrendingUp className="w-5 h-5 text-emerald-500" />
                : <TrendingDown className="w-5 h-5 text-rose-500" />}
              <p className="font-bold">صافي الربح</p>
            </div>
            <div className="text-end">
              <p className={`text-xl font-black ${(cur?.netProfit ?? 0) >= 0 ? "text-emerald-500" : "text-rose-500"}`}>
                {isLoading ? "..." : fmt(cur?.netProfit ?? 0)}
              </p>
              <div className="flex items-center gap-1.5 justify-end mt-0.5">
                <span className="text-xs text-muted-foreground">هامش {cur?.netMargin ?? 0}%</span>
                {cmp?.netProfit !== undefined && <DeltaBadge value={cmp.netProfit} />}
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* ── مؤشرات الطلبات ────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "إجمالي الطلبات",   value: fmtNum(cur?.totalOrders    ?? 0), sub: null,                                      color: "text-foreground",   bg: "bg-muted/40",           Icon: Package      },
          { label: "طلبات مسلَّمة",    value: fmtNum(cur?.deliveredOrders ?? 0), sub: `نسبة ${cur?.deliveryRate ?? 0}%`,          color: "text-emerald-500",  bg: "bg-emerald-500/10",     Icon: CheckCircle2 },
          { label: "طلبات مرتجعة",     value: fmtNum(cur?.returnedOrders  ?? 0), sub: `نسبة ${cur?.returnRate ?? 0}%`,            color: "text-rose-500",     bg: "bg-rose-500/10",        Icon: RefreshCw    },
          { label: "قيد الشحن الآن",   value: fmtNum(cf?.inShippingOrders ?? 0), sub: `متوقع: ${fmt(cf?.expectedIncoming ?? 0)}`, color: "text-sky-500",      bg: "bg-sky-500/10",         Icon: Truck        },
        ].map(({ label, value, sub, color, bg, Icon }) => (
          <Card key={label} className="p-4 border-border">
            <div className={`w-9 h-9 rounded-lg ${bg} flex items-center justify-center mb-2.5`}>
              <Icon className={`w-4 h-4 ${color}`} />
            </div>
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className={`text-xl font-bold mt-0.5 ${color}`}>{isLoading ? "..." : value}</p>
            {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
          </Card>
        ))}
      </div>

      {/* ── Cash Flow Banner ──────────────────────────────────────────────────── */}
      {cf && (cf.expectedIncoming > 0 || cf.unpaidShippingDues > 0) && (
        <Card className="border-border p-4">
          <h2 className="text-sm font-semibold flex items-center gap-1.5 mb-3">
            <Clock className="w-4 h-4 text-muted-foreground" /> توقعات التدفق النقدي
          </h2>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl bg-emerald-500/8 border border-emerald-500/20 p-3">
              <p className="text-xs text-muted-foreground">متوقع يدخل (طلبات قيد الشحن)</p>
              <p className="text-lg font-bold text-emerald-500 mt-1">{fmt(cf.expectedIncoming)}</p>
              <p className="text-xs text-muted-foreground">{fmtNum(cf.inShippingOrders)} طلب</p>
            </div>
            <div className="rounded-xl bg-rose-500/8 border border-rose-500/20 p-3">
              <p className="text-xs text-muted-foreground">مستحقات شحن غير مسددة</p>
              <p className="text-lg font-bold text-rose-500 mt-1">{fmt(cf.unpaidShippingDues)}</p>
              <p className="text-xs text-muted-foreground">
                {cf.unpaidShippingCount} فاتورة
                {cf.overdueInvoicesCount > 0 && (
                  <span className="text-rose-500 font-semibold"> ({cf.overdueInvoicesCount} متأخرة!)</span>
                )}
              </p>
            </div>
          </div>
        </Card>
      )}

      {/* ── أعلى فئات المصروفات ──────────────────────────────────────────────── */}
      {topExp.length > 0 && (
        <Card className="border-border p-4">
          <h2 className="text-sm font-semibold flex items-center gap-1.5 mb-3">
            <Receipt className="w-4 h-4 text-muted-foreground" /> توزيع المصروفات
          </h2>
          <div className="space-y-2">
            {topExp.map((e: any) => {
              const pct = cur?.expenses > 0 ? Math.round((e.total / cur.expenses) * 100) : 0;
              return (
                <div key={e.category}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-muted-foreground capitalize">{e.category}</span>
                    <span className="font-medium">{fmt(e.total)} ({pct}%)</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                    <div className="h-full rounded-full bg-rose-400 transition-all duration-500" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* ── الأقسام المالية (أدمن) ────────────────────────────────────────────── */}
      {isAdmin && (
        <div>
          <h2 className="text-sm font-semibold mb-3 text-muted-foreground">الأقسام المالية</h2>
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
