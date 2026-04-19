import { useQuery } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { analyticsApi, type AdSourceStat, type SmartProduct, type DeadStockItem, type ReturnReasonItem, type HighReturnProduct, type StockPredictorItem } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Brain, Star, Archive, RotateCcw, TrendingDown,
  AlertTriangle, Clock, Package, ArrowUpRight, Zap,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

const fc = (n: number) =>
  new Intl.NumberFormat("ar-EG", { style: "currency", currency: "EGP", maximumFractionDigits: 0 }).format(n);
const fn = (n: number) => new Intl.NumberFormat("ar-EG").format(Math.round(n));

// ─── Source meta ─────────────────────────────────────────────────────────────
const SOURCE_META: Record<string, { label: string; color: string; bg: string; border: string; emoji: string }> = {
  facebook:  { label: "فيسبوك",   emoji: "📘", color: "text-blue-700 dark:text-blue-400",    bg: "bg-blue-50 dark:bg-blue-900/30",     border: "border-blue-300 dark:border-blue-700" },
  tiktok:    { label: "تيك توك",  emoji: "🎵", color: "text-pink-700 dark:text-pink-400",    bg: "bg-pink-50 dark:bg-pink-900/30",     border: "border-pink-300 dark:border-pink-700" },
  instagram: { label: "إنستجرام", emoji: "📷", color: "text-purple-700 dark:text-purple-400",bg: "bg-purple-50 dark:bg-purple-900/30", border: "border-purple-300 dark:border-purple-700" },
  organic:   { label: "عضوي",     emoji: "🌱", color: "text-emerald-700 dark:text-emerald-400",bg: "bg-emerald-50 dark:bg-emerald-900/20",border: "border-emerald-300 dark:border-emerald-700" },
  whatsapp:  { label: "واتساب",   emoji: "💬", color: "text-green-700 dark:text-green-400",  bg: "bg-green-50 dark:bg-green-900/20",   border: "border-green-300 dark:border-green-700" },
  other:     { label: "أخرى",     emoji: "📌", color: "text-zinc-600 dark:text-zinc-400",    bg: "bg-zinc-100 dark:bg-zinc-800/40",    border: "border-zinc-300 dark:border-zinc-700" },
};
function getMeta(src: string) { return SOURCE_META[src] ?? SOURCE_META.other; }

// ─── Section header ───────────────────────────────────────────────────────────
function SectionHeader({ icon: Icon, title, subtitle, color = "text-primary" }: {
  icon: React.ElementType; title: string; subtitle?: string; color?: string;
}) {
  return (
    <div className="flex items-center gap-3 mb-4">
      <div className={`w-9 h-9 rounded-xl flex items-center justify-center bg-primary/10 ${color} shrink-0`}>
        <Icon className="w-5 h-5" />
      </div>
      <div>
        <h2 className="font-black text-base">{title}</h2>
        {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
      </div>
    </div>
  );
}

// ─── Skeleton loader ──────────────────────────────────────────────────────────
function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse bg-muted/60 rounded ${className}`} />;
}

// ─── 1. Ad Attribution ────────────────────────────────────────────────────────
function AdAttributionSection({ bestSource, breakdown, showProfit }: { bestSource: AdSourceStat | null; breakdown: AdSourceStat[]; showProfit: boolean }) {
  const maxVal = Math.max(...breakdown.map(s => showProfit ? Math.abs(s.profit) : s.revenue), 1);
  const best = bestSource ? getMeta(bestSource.source) : null;

  return (
    <div>
      <SectionHeader icon={Zap} title="أفضل منصة إعلانية" subtitle={showProfit ? "صافي الربح الحقيقي لكل قناة تسويقية" : "إيرادات كل قناة تسويقية"} color="text-amber-500 dark:text-amber-400" />

      {bestSource && best && (
        <div className={`mb-4 rounded-xl border-2 ${best.border} ${best.bg} p-4 flex flex-col sm:flex-row sm:items-center gap-4`}>
          <div className="flex items-center gap-3 flex-1">
            <span className="text-4xl">{best.emoji}</span>
            <div>
              <p className="text-xs text-muted-foreground font-bold uppercase tracking-wider">{showProfit ? "الأعلى ربحاً" : "الأعلى مبيعاً"}</p>
              <p className={`text-2xl font-black ${best.color}`}>{best.label}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{fn(bestSource.orders)} طلب • {bestSource.returnRate}% مرتجع</p>
            </div>
          </div>
          <div className="flex gap-4 sm:text-right">
            {showProfit && (
              <div>
                <p className="text-[10px] text-muted-foreground">صافي الربح</p>
                <p className={`text-xl font-black ${bestSource.profit >= 0 ? "text-emerald-500 dark:text-emerald-400" : "text-red-500 dark:text-red-400"}`}>{fc(bestSource.profit)}</p>
              </div>
            )}
            <div>
              <p className="text-[10px] text-muted-foreground">الإيرادات</p>
              <p className="text-lg font-bold text-primary">{fc(bestSource.revenue)}</p>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {breakdown.map((s) => {
          const meta = getMeta(s.source);
          const barPct = Math.max(0, Math.round(((showProfit ? Math.abs(s.profit) : s.revenue) / maxVal) * 100));
          return (
            <div key={s.source} className="flex items-center gap-3 py-2.5 px-3 rounded-lg bg-card border border-border">
              <span className="text-xl shrink-0">{meta.emoji}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                  <span className={`text-xs font-bold ${meta.color}`}>{meta.label}</span>
                  {showProfit ? (
                    <span className={`text-xs font-black ${s.profit >= 0 ? "text-emerald-500 dark:text-emerald-400" : "text-red-500 dark:text-red-400"}`}>{fc(s.profit)}</span>
                  ) : (
                    <span className="text-xs font-black text-primary">{fc(s.revenue)}</span>
                  )}
                </div>
                <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-700 ${showProfit && s.profit < 0 ? "bg-red-500 dark:bg-red-400" : "bg-primary"}`}
                    style={{ width: `${barPct}%` }}
                  />
                </div>
                <div className="flex gap-3 mt-1">
                  <span className="text-[10px] text-muted-foreground">{fn(s.orders)} طلب</span>
                  <span className="text-[10px] text-muted-foreground">{s.returnRate}% مرتجع</span>
                  {showProfit && <span className="text-[10px] text-muted-foreground">إيرادات: {fc(s.revenue)}</span>}
                </div>
              </div>
            </div>
          );
        })}
        {breakdown.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-6">لا توجد بيانات إعلانية بعد</p>
        )}
      </div>
    </div>
  );
}

// ─── 2. Stars vs Dead Stock ───────────────────────────────────────────────────
function StarsSection({ stars, deadStock, showProfit }: { stars: SmartProduct[]; deadStock: DeadStockItem[]; showProfit: boolean }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
      {/* Stars */}
      <div>
        <SectionHeader icon={Star} title="المنتجات النجوم" subtitle={showProfit ? "أعلى 5 منتجات بصافي ربح" : "أعلى 5 منتجات مبيعاً"} color="text-amber-500 dark:text-amber-400" />
        <div className="space-y-2">
          {stars.map((p, i) => (
            <div key={p.name} className="flex items-center gap-3 p-3 rounded-lg bg-card border border-border">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-black shrink-0 ${
                i === 0 ? "bg-amber-500 text-black" : i === 1 ? "bg-zinc-400 text-black" : i === 2 ? "bg-amber-700 text-white" : "bg-muted text-muted-foreground"
              }`}>{i + 1}</div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-xs truncate">{p.name}</p>
                <p className="text-[10px] text-muted-foreground">
                  {fn(p.quantity)} وحدة{showProfit ? ` • ${p.margin}% هامش` : ""}
                </p>
              </div>
              <div className="text-left shrink-0">
                {showProfit ? (
                  <p className="text-xs font-black text-emerald-500 dark:text-emerald-400">{fc(p.profit)}</p>
                ) : (
                  <p className="text-xs font-black text-primary">{fn(p.quantity)} وحدة</p>
                )}
                <p className="text-[9px] text-muted-foreground">{p.returnRate}% مرتجع</p>
              </div>
            </div>
          ))}
          {stars.length === 0 && (
            <div className="text-center py-8 text-muted-foreground text-xs">
              <Star className="w-6 h-6 mx-auto mb-2 opacity-30" />
              لا توجد منتجات رابحة بعد
            </div>
          )}
        </div>
      </div>

      {/* Dead Stock */}
      <div>
        <SectionHeader icon={Archive} title="المخزون الراكد" subtitle="منتجات بمبيعات أقل من 5 وحدة / 30 يوم" color="text-orange-600 dark:text-orange-400" />
        <div className="space-y-2">
          {deadStock.map((p) => (
            <div key={p.name} className="flex items-center gap-3 p-3 rounded-lg bg-card border border-amber-200 dark:border-amber-900/40">
              <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 bg-amber-100 dark:bg-amber-900/30">
                <Archive className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-xs truncate">{p.name}</p>
                <p className="text-[10px] text-muted-foreground">
                  {fn(p.availableQty)} وحدة • {fn(p.last30DaysSales)} مبيع/30يوم
                  {p.daysSinceLastSale !== null && ` • آخر بيع ${p.daysSinceLastSale}يوم`}
                </p>
              </div>
              <div className="text-left shrink-0">
                <p className="text-xs font-bold text-amber-600 dark:text-amber-400">{fc(p.frozenCapital)}</p>
                <p className="text-[9px] text-muted-foreground">رأس مال مجمد</p>
              </div>
            </div>
          ))}
          {deadStock.length === 0 && (
            <div className="text-center py-8 text-muted-foreground text-xs">
              <Archive className="w-6 h-6 mx-auto mb-2 opacity-30" />
              لا يوجد مخزون راكد
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── 3. Return Insights ───────────────────────────────────────────────────────
function ReturnInsightsSection({
  byReason, highReturnProducts, totalReturnRate, totalReturns,
}: { byReason: ReturnReasonItem[]; highReturnProducts: HighReturnProduct[]; totalReturnRate: number; totalReturns: number }) {
  const topReasons = byReason.slice(0, 4);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
      {/* Reasons chart */}
      <div>
        <SectionHeader icon={RotateCcw} title="أسباب المرتجعات" subtitle={`${fn(totalReturns)} مرتجع • نسبة ${totalReturnRate}% من الطلبات`} color="text-red-600 dark:text-red-400" />
        <div className="space-y-3">
          {topReasons.map((r, i) => {
            const colors = [
              "bg-red-500 dark:bg-red-400",
              "bg-orange-500 dark:bg-orange-400",
              "bg-amber-500 dark:bg-amber-400",
              "bg-zinc-500 dark:bg-zinc-400",
            ];
            return (
              <div key={r.reason}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-semibold">{r.label}</span>
                  <span className="text-xs font-black">{r.count} ({r.pct}%)</span>
                </div>
                <div className="h-2.5 bg-muted rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-700 ${colors[i] ?? colors[3]}`}
                    style={{ width: `${r.pct}%` }}
                  />
                </div>
              </div>
            );
          })}
          {topReasons.length === 0 && (
            <div className="text-center py-6 text-muted-foreground text-xs">
              <RotateCcw className="w-6 h-6 mx-auto mb-2 opacity-30" />
              لا توجد مرتجعات مسجلة
            </div>
          )}
        </div>
      </div>

      {/* High return products */}
      <div>
        <SectionHeader icon={AlertTriangle} title="تحذير: نسبة مرتجع عالية" subtitle="منتجات تجاوزت 50% مرتجع" color="text-red-600 dark:text-red-400" />
        <div className="space-y-2">
          {highReturnProducts.map((p) => (
            <div key={p.name} className="flex items-center gap-3 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/50">
              <AlertTriangle className="w-4 h-4 text-red-600 dark:text-red-400 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-xs truncate">{p.name}</p>
                <p className="text-[10px] text-red-600 dark:text-red-400">{p.returnCount} من {p.orderCount} طلب</p>
              </div>
              <div className="shrink-0">
                <Badge className="bg-red-500 dark:bg-red-600 text-white border-0 font-black text-xs px-2">
                  ⚠️ {p.returnRate}%
                </Badge>
              </div>
            </div>
          ))}
          {highReturnProducts.length === 0 && (
            <div className="flex items-center gap-3 p-4 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800/50">
              <div className="w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center">
                <TrendingDown className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div>
                <p className="text-xs font-bold text-emerald-700 dark:text-emerald-400">لا يوجد منتج تجاوز 50% مرتجع</p>
                <p className="text-[10px] text-muted-foreground">معدلات المرتجعات تحت السيطرة</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── 4. Stock Predictor ───────────────────────────────────────────────────────
function StockPredictorSection({ items }: { items: StockPredictorItem[] }) {
  function urgencyColor(days: number | null) {
    if (days === null) return { bg: "bg-zinc-50 dark:bg-zinc-800/30", border: "border-zinc-200 dark:border-zinc-700", badge: "bg-zinc-200 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300", text: "نامي" };
    if (days <= 3)  return { bg: "bg-red-50 dark:bg-red-900/20",     border: "border-red-300 dark:border-red-800/60",     badge: "bg-red-500 text-white",    text: `${days} أيام فقط!` };
    if (days <= 7)  return { bg: "bg-orange-50 dark:bg-orange-900/20",border: "border-orange-300 dark:border-orange-800/60",badge: "bg-orange-500 text-white", text: `${days} أيام` };
    return { bg: "bg-amber-50 dark:bg-amber-900/20", border: "border-amber-300 dark:border-amber-800/60", badge: "bg-amber-500 text-white", text: `${days} يوم` };
  }

  return (
    <div>
      <SectionHeader icon={Clock} title="التنبؤ بالمخزون" subtitle="منتجات ستنتهي خلال 14 يوم بناءً على معدل البيع" color="text-sky-600 dark:text-sky-400" />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {items.map((item) => {
          const u = urgencyColor(item.daysUntilStockout);
          return (
            <div key={item.name} className={`flex items-center gap-3 p-3 rounded-lg border ${u.bg} ${u.border}`}>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <Package className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                  <p className="font-semibold text-xs truncate">{item.name}</p>
                </div>
                <p className="text-[10px] text-muted-foreground">
                  باقي {fn(item.availableQty)} وحدة • {item.velocityPerDay} وحدة/يوم
                </p>
              </div>
              <div className="text-left shrink-0 space-y-1">
                <span className={`inline-block text-[11px] font-black px-2 py-0.5 rounded-full ${u.badge}`}>
                  {u.text}
                </span>
                {item.frozenCapital > 0 && (
                  <p className="text-[9px] text-muted-foreground text-left">{fc(item.frozenCapital)}</p>
                )}
              </div>
            </div>
          );
        })}
        {items.length === 0 && (
          <div className="col-span-2 text-center py-8 text-muted-foreground text-xs">
            <Clock className="w-6 h-6 mx-auto mb-2 opacity-30" />
            لا توجد منتجات على وشك النفاد خلال 14 يوم
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Summary Stats Bar ─────────────────────────────────────────────────────────
function SummaryBar({ data, showProfit }: { data: {
  adAttribution: { bestSource: AdSourceStat | null; breakdown: AdSourceStat[] };
  stars: SmartProduct[];
  deadStock: DeadStockItem[];
  returnInsights: { totalReturnRate: number; highReturnProducts: HighReturnProduct[]; totalReturns: number; byReason: ReturnReasonItem[] };
  stockPredictor: StockPredictorItem[];
}; showProfit: boolean }) {
  const totalFrozen = data.deadStock.reduce((s, i) => s + i.frozenCapital, 0);
  const critical = data.stockPredictor.filter(i => (i.daysUntilStockout ?? 99) <= 3).length;
  const highReturn = data.returnInsights.highReturnProducts.length;

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
      <Card className="border-border bg-card">
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-1">
            <Zap className="w-4 h-4 text-amber-500" />
            <span className="text-[10px] font-bold text-muted-foreground uppercase">أفضل منصة</span>
          </div>
          {data.adAttribution.bestSource ? (
            <>
              <p className="font-black text-sm">{getMeta(data.adAttribution.bestSource.source).emoji} {getMeta(data.adAttribution.bestSource.source).label}</p>
              {showProfit && <p className="text-[10px] text-emerald-500 dark:text-emerald-400 font-bold">{fc(data.adAttribution.bestSource.profit)}</p>}
              {!showProfit && <p className="text-[10px] text-primary font-bold">{fc(data.adAttribution.bestSource.revenue)}</p>}
            </>
          ) : (
            <p className="text-xs text-muted-foreground">لا بيانات</p>
          )}
        </CardContent>
      </Card>

      <Card className="border-border bg-card">
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-1">
            <Star className="w-4 h-4 text-amber-500" />
            <span className="text-[10px] font-bold text-muted-foreground uppercase">نجوم / راكد</span>
          </div>
          <p className="font-black text-sm">{data.stars.length} نجوم • {data.deadStock.length} راكد</p>
          {totalFrozen > 0 && <p className="text-[10px] text-amber-600 dark:text-amber-400 font-bold">{fc(totalFrozen)} مجمد</p>}
        </CardContent>
      </Card>

      <Card className={`border-border bg-card ${highReturn > 0 ? "border-red-300 dark:border-red-800" : ""}`}>
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-1">
            <RotateCcw className={`w-4 h-4 ${highReturn > 0 ? "text-red-500" : "text-muted-foreground"}`} />
            <span className="text-[10px] font-bold text-muted-foreground uppercase">المرتجعات</span>
          </div>
          <p className="font-black text-sm">{data.returnInsights.totalReturnRate}% معدل إرجاع</p>
          {highReturn > 0 && <p className="text-[10px] text-red-500 font-bold">⚠️ {highReturn} منتج تجاوز 50%</p>}
        </CardContent>
      </Card>

      <Card className={`border-border bg-card ${critical > 0 ? "border-red-300 dark:border-red-800" : ""}`}>
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-1">
            <Clock className={`w-4 h-4 ${critical > 0 ? "text-red-500" : "text-sky-500"}`} />
            <span className="text-[10px] font-bold text-muted-foreground uppercase">المخزون الحرج</span>
          </div>
          <p className="font-black text-sm">{data.stockPredictor.length} منتج</p>
          {critical > 0 ? (
            <p className="text-[10px] text-red-500 font-bold">🚨 {critical} سينفد خلال 3 أيام</p>
          ) : (
            <p className="text-[10px] text-muted-foreground">ستنفد خلال 14 يوم</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function SmartAnalytics() {
  const { isAdmin, canViewFinancials, can } = useAuth();
  const [, navigate] = useLocation();
  const { data, isLoading } = useQuery({
    queryKey: ["smart-insights"],
    queryFn: analyticsApi.smartInsights,
    staleTime: 60000,
  });

  if (!can("analytics")) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3 text-muted-foreground">
        <Brain className="w-10 h-10 opacity-20" />
        <p className="text-sm font-bold">هذه الصفحة للمديرين فقط</p>
        <button onClick={() => navigate("/")} className="text-xs text-primary hover:underline">العودة للرئيسية</button>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Brain className="w-6 h-6 text-primary" />
            <h1 className="text-2xl font-black">التحليل الذكي</h1>
          </div>
          <p className="text-muted-foreground text-sm">قرارات مبنية على البيانات — إعلانات، منتجات، مرتجعات، مخزون</p>
        </div>
        <Link href="/ads-analytics">
          <button className="flex items-center gap-2 text-xs text-primary border border-primary/30 hover:bg-primary/5 px-3 py-1.5 rounded-lg transition-colors">
            <ArrowUpRight className="w-3.5 h-3.5" />تفاصيل الحملات
          </button>
        </Link>
      </div>

      {isLoading && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-20" />)}
          </div>
          <Skeleton className="h-48" />
          <div className="grid grid-cols-2 gap-4">
            <Skeleton className="h-64" />
            <Skeleton className="h-64" />
          </div>
        </div>
      )}

      {data && (
        <>
          <SummaryBar data={data} showProfit={canViewFinancials} />

          {/* Ad Attribution */}
          <Card className="border-border bg-card">
            <CardContent className="p-5">
              <AdAttributionSection bestSource={data.adAttribution.bestSource} breakdown={data.adAttribution.breakdown} showProfit={canViewFinancials} />
            </CardContent>
          </Card>

          {/* Stars vs Dead Stock */}
          <Card className="border-border bg-card">
            <CardContent className="p-5">
              <StarsSection stars={data.stars} deadStock={data.deadStock} showProfit={canViewFinancials} />
            </CardContent>
          </Card>

          {/* Return Insights */}
          <Card className="border-border bg-card">
            <CardContent className="p-5">
              <ReturnInsightsSection
                byReason={data.returnInsights.byReason}
                highReturnProducts={data.returnInsights.highReturnProducts}
                totalReturnRate={data.returnInsights.totalReturnRate}
                totalReturns={data.returnInsights.totalReturns}
              />
            </CardContent>
          </Card>

          {/* Stock Predictor */}
          <Card className="border-border bg-card">
            <CardContent className="p-5">
              <StockPredictorSection items={data.stockPredictor} />
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

