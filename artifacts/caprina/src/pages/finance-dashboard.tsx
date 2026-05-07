import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown, DollarSign, Package, Truck, AlertCircle } from "lucide-react";
import { useState } from "react";
import { format, startOfMonth } from "date-fns";

const fmt = (n: number) =>
  new Intl.NumberFormat("ar-EG", { style: "currency", currency: "EGP", maximumFractionDigits: 0 }).format(n);

export default function FinanceDashboard() {
  const [from, setFrom] = useState(format(startOfMonth(new Date()), "yyyy-MM-dd"));
  const [to,   setTo]   = useState(format(new Date(), "yyyy-MM-dd"));

  const { data: summary, isLoading } = useQuery({
    queryKey: ["finance-summary", from, to],
    queryFn: () => apiClient.get(`/finance/summary?from=${from}&to=${to}`).then(r => r.data),
  });

  const kpis = [
    { label: "إجمالي الإيراد",   value: summary?.revenue ?? 0,           icon: DollarSign,  color: "text-emerald-500", bg: "bg-emerald-500/10" },
    { label: "تكلفة البضاعة",    value: summary?.cogs ?? 0,              icon: Package,     color: "text-orange-500",  bg: "bg-orange-500/10"  },
    { label: "مصاريف الشحن",     value: summary?.shippingSpend ?? 0,      icon: Truck,       color: "text-sky-500",     bg: "bg-sky-500/10"     },
    { label: "المصروفات التشغيلية", value: summary?.operatingExpenses ?? 0, icon: AlertCircle, color: "text-rose-500",    bg: "bg-rose-500/10"    },
  ];

  return (
    <div className="space-y-6 animate-in fade-in duration-500" dir="rtl">
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
                <Icon className={`w-4.5 h-4.5 ${k.color}`} />
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
    </div>
  );
}
