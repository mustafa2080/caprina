import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown, RefreshCw, BarChart3, AlertTriangle, Target } from "lucide-react";
import { analyticsApi, type ProductPerformance } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";

const fc = (n: number) =>
  new Intl.NumberFormat("ar-EG", { style: "currency", currency: "EGP", maximumFractionDigits: 0 }).format(n);
const pct = (n: number) => `${n}%`;

type SortMode = "profit" | "loss" | "returns";

const SORT_LABELS: Record<SortMode, string> = {
  profit: "أعلى ربح",
  loss: "أعلى خسارة",
  returns: "أعلى مرتجعات",
};

function ProfitBar({ value, max }: { value: number; max: number }) {
  if (max === 0) return null;
  const pct = Math.min(100, Math.abs(value) / Math.abs(max) * 100);
  const isNeg = value < 0;
  return (
    <div className="h-1 w-full bg-muted rounded-full overflow-hidden">
      <div
        className={`h-full rounded-full transition-all ${isNeg ? "bg-red-500" : "bg-primary"}`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

function ProductRow({ p, maxProfit, maxLoss, sort }: {
  p: ProductPerformance; maxProfit: number; maxLoss: number; sort: SortMode;
}) {
  const isLosing = p.netProfit < 0;
  const barMax = sort === "loss" ? maxLoss : maxProfit;

  return (
    <div className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 py-3 border-b border-border last:border-0">
      <div className="min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-sm font-bold text-foreground truncate">{p.name}</span>
          {p.returnRate >= 30 && (
            <Badge variant="outline" className="text-[9px] border-red-400 text-red-700 dark:border-red-800 dark:text-red-400 shrink-0">
              {p.returnRate}% مرتجع
            </Badge>
          )}
          {isLosing && (
            <Badge variant="outline" className="text-[9px] border-red-400 text-red-700 dark:border-red-800 dark:text-red-400 shrink-0">خاسر</Badge>
          )}
          {p.margin >= 40 && !isLosing && (
            <Badge variant="outline" className="text-[9px] border-primary text-primary shrink-0">هامش ممتاز</Badge>
          )}
        </div>
        <div className="flex items-center gap-3 text-[10px] text-muted-foreground mb-2">
          <span>{p.totalOrders} طلب</span>
          <span>·</span>
          <span>{p.totalSalesQty} وحدة مباعة</span>
          {p.returnCount > 0 && <><span>·</span><span className="text-red-600 dark:text-red-400">{p.returnCount} مرتجع</span></>}
          <span>·</span>
          <span>هامش {pct(p.margin)}</span>
          <span>·</span>
          <span>ROI {pct(p.roi)}</span>
        </div>
        <ProfitBar value={p.netProfit} max={barMax} />
      </div>

      <div className="text-left shrink-0 flex flex-col items-end justify-center gap-0.5">
        <p className={`text-base font-black ${isLosing ? "text-red-600 dark:text-red-400" : "text-primary"}`}>
          {fc(p.netProfit)}
        </p>
        <p className="text-[9px] text-muted-foreground">إيرادات {fc(p.totalRevenue)}</p>
        {p.returnCostLoss > 0 && (
          <p className="text-[9px] text-red-600/70 dark:text-red-400/70">خسارة مرتجع {fc(p.returnCostLoss)}</p>
        )}
      </div>
    </div>
  );
}

export default function ProductPerformancePage() {
  const { isAdmin, canViewFinancials } = useAuth();
  const [, navigate] = useLocation();
  const [sort, setSort] = useState<SortMode>("profit");

  if (!canViewFinancials) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3 text-muted-foreground">
        <BarChart3 className="w-10 h-10 opacity-20" />
        <p className="text-sm font-bold">هذه الصفحة للمديرين فقط</p>
        <button onClick={() => navigate("/")} className="text-xs text-primary hover:underline">العودة للرئيسية</button>
      </div>
    );
  }

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["product-performance"],
    queryFn: analyticsApi.productPerformance,
    staleTime: 30_000,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground text-sm">
        جارٍ تحميل التحليل...
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex items-center justify-center h-64 text-red-600 dark:text-red-400 text-sm">
        خطأ في تحميل البيانات
      </div>
    );
  }

  const list = sort === "profit" ? data.byProfit : sort === "loss" ? data.byLoss : data.byReturns;
  const maxProfit = Math.max(...data.byProfit.map(p => p.netProfit), 1);
  const maxLoss = Math.max(...(data.byLoss.map(p => Math.abs(p.netProfit))), 1);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-foreground">أداء المنتجات</h1>
          <p className="text-xs text-muted-foreground mt-0.5">تحليل مالي شامل لكل منتج</p>
        </div>
        <button
          onClick={() => refetch()}
          className="text-muted-foreground hover:text-foreground transition-colors p-1.5"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Summary KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="border-border bg-card">
          <CardContent className="p-4">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">إجمالي المنتجات</p>
            <p className="text-2xl font-black text-foreground">{data.summary.totalProducts}</p>
          </CardContent>
        </Card>
        <Card className="border-border bg-card">
          <CardContent className="p-4">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">منتجات رابحة</p>
            <p className="text-2xl font-black text-primary">{data.summary.profitableCount}</p>
          </CardContent>
        </Card>
        <Card className="border-border bg-card">
          <CardContent className="p-4">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">منتجات خاسرة</p>
            <p className="text-2xl font-black text-red-600 dark:text-red-400">{data.summary.losingCount}</p>
          </CardContent>
        </Card>
        <Card className="border-border bg-card">
          <CardContent className="p-4">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">مرتجعات عالية</p>
            <p className="text-2xl font-black text-amber-700 dark:text-amber-400">{data.summary.highReturnCount}</p>
          </CardContent>
        </Card>
      </div>

      {/* Sort tabs + table */}
      <Card className="border-border bg-card">
        <CardHeader className="pb-3 border-b border-border">
          <div className="flex items-center justify-between gap-3">
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-primary" />
              تصنيف المنتجات
            </CardTitle>
            <div className="flex rounded-md border border-border overflow-hidden text-[11px] font-semibold">
              {(["profit", "loss", "returns"] as SortMode[]).map(m => (
                <button
                  key={m}
                  onClick={() => setSort(m)}
                  className={`px-3 py-1.5 transition-colors ${
                    sort === m
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-muted"
                  }`}
                >
                  {SORT_LABELS[m]}
                </button>
              ))}
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {list.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground text-sm">
              {sort === "loss" ? "لا توجد منتجات خاسرة" : sort === "returns" ? "لا توجد مرتجعات" : "لا توجد بيانات"}
            </div>
          ) : (
            <div className="px-4">
              {list.map(p => (
                <ProductRow
                  key={p.name}
                  p={p}
                  maxProfit={maxProfit}
                  maxLoss={maxLoss}
                  sort={sort}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Detailed table */}
      <Card className="border-border bg-card">
        <CardHeader className="pb-3 border-b border-border">
          <CardTitle className="text-sm font-bold flex items-center gap-2">
            <Target className="w-4 h-4 text-primary" />
            جدول تفصيلي — كل المنتجات
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="text-right px-4 py-2.5 font-semibold text-muted-foreground">المنتج</th>
                <th className="text-center px-3 py-2.5 font-semibold text-muted-foreground">طلبات</th>
                <th className="text-center px-3 py-2.5 font-semibold text-muted-foreground">مباع</th>
                <th className="text-center px-3 py-2.5 font-semibold text-muted-foreground">مرتجع%</th>
                <th className="text-left px-3 py-2.5 font-semibold text-muted-foreground">إيرادات</th>
                <th className="text-left px-3 py-2.5 font-semibold text-muted-foreground">تكاليف</th>
                <th className="text-left px-3 py-2.5 font-semibold text-muted-foreground">صافي الربح</th>
                <th className="text-center px-3 py-2.5 font-semibold text-muted-foreground">هامش</th>
                <th className="text-center px-3 py-2.5 font-semibold text-muted-foreground">ROI</th>
              </tr>
            </thead>
            <tbody>
              {data.products.map(p => {
                const isLosing = p.netProfit < 0;
                return (
                  <tr key={p.name} className="border-b border-border/50 hover:bg-muted/10 transition-colors">
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-1.5">
                        {isLosing
                          ? <TrendingDown className="w-3 h-3 text-red-600 dark:text-red-400 shrink-0" />
                          : <TrendingUp className="w-3 h-3 text-primary shrink-0" />
                        }
                        <span className="font-semibold text-foreground">{p.name}</span>
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-center text-muted-foreground">{p.totalOrders}</td>
                    <td className="px-3 py-2.5 text-center text-muted-foreground">{p.totalSalesQty}</td>
                    <td className="px-3 py-2.5 text-center">
                      <span className={p.returnRate >= 30 ? "text-red-600 dark:text-red-400 font-bold" : "text-muted-foreground"}>
                        {p.returnRate}%
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-left text-foreground">{fc(p.totalRevenue)}</td>
                    <td className="px-3 py-2.5 text-left text-muted-foreground">{fc(p.totalCost + p.totalShipping)}</td>
                    <td className="px-3 py-2.5 text-left">
                      <span className={`font-bold ${isLosing ? "text-red-600 dark:text-red-400" : "text-primary"}`}>
                        {fc(p.netProfit)}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      <span className={p.margin < 10 ? "text-amber-700 dark:text-amber-400" : p.margin >= 40 ? "text-primary font-bold" : "text-muted-foreground"}>
                        {p.margin}%
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      <span className={p.roi < 0 ? "text-red-600 dark:text-red-400" : "text-muted-foreground"}>
                        {p.roi}%
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
