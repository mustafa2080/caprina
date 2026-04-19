import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Megaphone, TrendingUp, TrendingDown, DollarSign, Target, BarChart3, Package } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { teamAnalyticsApi, type CampaignStats } from "@/lib/api";

const fmt = (n: number) =>
  new Intl.NumberFormat("ar-EG", { style: "currency", currency: "EGP", maximumFractionDigits: 0 }).format(n);
const fmtNum = (n: number) => new Intl.NumberFormat("ar-EG").format(n);
const fmtPct = (n: number) => `${n}%`;

const SOURCE_META: Record<string, { label: string; color: string; bg: string; emoji: string }> = {
  facebook:  { label: "فيسبوك",   color: "text-blue-700    dark:text-blue-400",    bg: "bg-blue-50    dark:bg-blue-900/30",    emoji: "📘" },
  tiktok:    { label: "تيك توك",  color: "text-pink-700    dark:text-pink-400",    bg: "bg-pink-50    dark:bg-pink-900/30",    emoji: "🎵" },
  instagram: { label: "إنستجرام", color: "text-purple-700  dark:text-purple-400",  bg: "bg-purple-50  dark:bg-purple-900/30",  emoji: "📷" },
  organic:   { label: "عضوي",     color: "text-emerald-700 dark:text-emerald-400", bg: "bg-emerald-50 dark:bg-emerald-900/20", emoji: "🌱" },
  whatsapp:  { label: "واتساب",   color: "text-green-700   dark:text-green-400",   bg: "bg-green-50   dark:bg-green-900/20",   emoji: "💬" },
  other:     { label: "أخرى",     color: "text-zinc-600    dark:text-zinc-400",    bg: "bg-zinc-100   dark:bg-zinc-800/40",    emoji: "📌" },
};

function SourceBadge({ source }: { source: string }) {
  const meta = SOURCE_META[source] ?? SOURCE_META.other;
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${meta.bg} ${meta.color}`}>
      {meta.emoji} {meta.label}
    </span>
  );
}

function CampaignCard({ stat, maxRevenue }: { stat: CampaignStats; maxRevenue: number }) {
  const meta = SOURCE_META[stat.adSource] ?? SOURCE_META.other;
  const roiPositive = stat.roi >= 0;

  return (
    <Card className="border-border bg-card">
      <CardHeader className="pb-2 pt-4 px-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <SourceBadge source={stat.adSource} />
            {stat.adCampaign && (
              <p className="text-sm font-bold mt-1 truncate">{stat.adCampaign}</p>
            )}
            {!stat.adCampaign && (
              <p className="text-xs text-muted-foreground mt-1">بدون اسم حملة</p>
            )}
          </div>
          <Badge
            variant="outline"
            className={`text-[10px] font-bold shrink-0 ${stat.profit >= 0 ? "border-emerald-800 text-emerald-400" : "border-red-800 text-red-400"}`}
          >
            {stat.profit >= 0 ? "+" : ""}{fmt(stat.profit)}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="px-4 pb-4 space-y-3">
        <div>
          <div className="flex justify-between text-[10px] text-muted-foreground mb-1">
            <span>إيرادات: {fmt(stat.revenue)}</span>
            <span>{fmtPct(Math.round(maxRevenue > 0 ? (stat.revenue / maxRevenue) * 100 : 0))}</span>
          </div>
          <Progress value={maxRevenue > 0 ? (stat.revenue / maxRevenue) * 100 : 0} className="h-1.5" />
        </div>

        <div className="grid grid-cols-4 gap-1 text-center">
          <div className="bg-muted/20 rounded p-1.5">
            <p className="text-xs font-bold">{fmtNum(stat.total)}</p>
            <p className="text-[8px] text-muted-foreground">طلبات</p>
          </div>
          <div className="bg-emerald-900/20 rounded p-1.5">
            <p className="text-xs font-bold text-emerald-400">{fmtNum(stat.delivered)}</p>
            <p className="text-[8px] text-muted-foreground">مُسلَّم</p>
          </div>
          <div className="bg-red-900/20 rounded p-1.5">
            <p className="text-xs font-bold text-red-400">{fmtNum(stat.returned)}</p>
            <p className="text-[8px] text-muted-foreground">مرتجع</p>
          </div>
          <div className="bg-amber-900/20 rounded p-1.5">
            <p className="text-xs font-bold text-amber-400">{fmtPct(stat.deliveryRate)}</p>
            <p className="text-[8px] text-muted-foreground">تسليم</p>
          </div>
        </div>

        <div className="flex items-center justify-between text-xs border-t border-border pt-2">
          <span className="text-muted-foreground">تكلفة: <span className="text-foreground">{fmt(stat.cost)}</span></span>
          <span className={`font-bold flex items-center gap-1 ${roiPositive ? "text-emerald-400" : "text-red-400"}`}>
            {roiPositive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
            ROI {roiPositive ? "+" : ""}{fmtPct(stat.roi)}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

function SourceSummary({ campaigns }: { campaigns: CampaignStats[] }) {
  const bySource: Record<string, { total: number; revenue: number; profit: number; delivered: number }> = {};
  for (const c of campaigns) {
    if (!bySource[c.adSource]) bySource[c.adSource] = { total: 0, revenue: 0, profit: 0, delivered: 0 };
    bySource[c.adSource].total += c.total;
    bySource[c.adSource].revenue += c.revenue;
    bySource[c.adSource].profit += c.profit;
    bySource[c.adSource].delivered += c.delivered;
  }
  const maxRev = Math.max(...Object.values(bySource).map(v => v.revenue), 1);

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
      {Object.entries(bySource).map(([src, stats]) => {
        const meta = SOURCE_META[src] ?? SOURCE_META.other;
        return (
          <Card key={src} className="border-border bg-card text-center">
            <CardContent className="px-3 py-3 space-y-1.5">
              <span className="text-2xl">{meta.emoji}</span>
              <p className={`text-xs font-bold ${meta.color}`}>{meta.label}</p>
              <p className="text-sm font-bold">{fmtNum(stats.total)}</p>
              <p className="text-[10px] text-muted-foreground">طلب</p>
              <p className={`text-xs font-bold ${stats.profit >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                {fmt(stats.profit)}
              </p>
              <div className="w-full bg-muted/30 rounded-full h-1 overflow-hidden">
                <div className={`h-full rounded-full ${meta.color.replace("text-", "bg-").replace("-400", "-500")}`}
                  style={{ width: `${(stats.revenue / maxRev) * 100}%` }} />
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

export default function AdsAnalyticsPage() {
  const { can } = useAuth();
  const [, navigate] = useLocation();
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [filterSource, setFilterSource] = useState("");

  const { data: campaigns = [], isLoading } = useQuery({
    queryKey: ["campaigns", dateFrom, dateTo],
    queryFn: () => teamAnalyticsApi.campaigns(dateFrom || undefined, dateTo || undefined),
    enabled: can("analytics"),
  });

  if (!can("analytics")) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3 text-muted-foreground">
        <Megaphone className="w-10 h-10 opacity-20" />
        <p className="text-sm font-bold">هذه الصفحة للمديرين فقط</p>
        <button onClick={() => navigate("/")} className="text-xs text-primary hover:underline">العودة للرئيسية</button>
      </div>
    );
  }

  const filtered = filterSource ? campaigns.filter(c => c.adSource === filterSource) : campaigns;
  const maxRevenue = Math.max(...filtered.map(c => c.revenue), 1);

  const totals = campaigns.reduce(
    (acc, c) => ({
      orders: acc.orders + c.total,
      revenue: acc.revenue + c.revenue,
      cost: acc.cost + c.cost,
      profit: acc.profit + c.profit,
      delivered: acc.delivered + c.delivered,
    }),
    { orders: 0, revenue: 0, cost: 0, profit: 0, delivered: 0 }
  );
  const totalRoi = totals.cost > 0 ? Math.round((totals.profit / totals.cost) * 100) : 0;

  return (
    <div className="space-y-5 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <Megaphone className="w-5 h-5 text-primary" />
            تحليل الإعلانات والحملات
          </h1>
          <p className="text-muted-foreground text-xs mt-0.5">قياس أداء كل حملة وحساب العائد على الإنفاق الإعلاني</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="space-y-0.5">
            <Label className="text-[10px] text-muted-foreground">من</Label>
            <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="h-7 text-xs w-32" />
          </div>
          <div className="space-y-0.5">
            <Label className="text-[10px] text-muted-foreground">إلى</Label>
            <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="h-7 text-xs w-32" />
          </div>
          <div className="space-y-0.5">
            <Label className="text-[10px] text-muted-foreground">المصدر</Label>
            <select
              className="h-7 text-xs bg-card border border-input rounded-md px-2"
              value={filterSource}
              onChange={e => setFilterSource(e.target.value)}
            >
              <option value="">الكل</option>
              {Object.entries(SOURCE_META).map(([k, v]) => (
                <option key={k} value={k}>{v.emoji} {v.label}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { label: "إجمالي الطلبات", value: fmtNum(totals.orders), icon: Package, color: "text-primary" },
          { label: "إيرادات", value: fmt(totals.revenue), icon: DollarSign, color: "text-blue-400" },
          { label: "تكاليف", value: fmt(totals.cost), icon: TrendingDown, color: "text-amber-400" },
          { label: "صافي الربح", value: fmt(totals.profit), icon: TrendingUp, color: totals.profit >= 0 ? "text-emerald-400" : "text-red-400" },
          { label: "ROI الإجمالي", value: `${totalRoi >= 0 ? "+" : ""}${fmtPct(totalRoi)}`, icon: Target, color: totalRoi >= 0 ? "text-emerald-400" : "text-red-400" },
        ].map(card => (
          <Card key={card.label} className="border-border bg-card">
            <CardContent className="px-4 py-3 flex items-center gap-3">
              <card.icon className={`w-4 h-4 shrink-0 ${card.color}`} />
              <div>
                <p className="text-sm font-bold">{card.value}</p>
                <p className="text-[10px] text-muted-foreground">{card.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Source breakdown */}
      {campaigns.length > 0 && !filterSource && (
        <div>
          <h2 className="text-sm font-bold mb-3 text-muted-foreground">ملخص حسب المصدر</h2>
          <SourceSummary campaigns={campaigns} />
        </div>
      )}

      {isLoading && <p className="text-center text-muted-foreground text-sm py-12">جاري التحميل...</p>}

      {!isLoading && filtered.length === 0 && (
        <div className="text-center py-16 text-muted-foreground">
          <Megaphone className="w-10 h-10 mx-auto mb-3 opacity-20" />
          <p className="text-sm">لا توجد بيانات إعلانية بعد.</p>
          <p className="text-xs mt-1">أضف مصدر الإعلان عند إنشاء الطلبيات لتتبع أداء حملاتك.</p>
        </div>
      )}

      {/* Campaign cards */}
      {filtered.length > 0 && (
        <div>
          <h2 className="text-sm font-bold mb-3 text-muted-foreground">الحملات ({fmtNum(filtered.length)})</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filtered.map((c, i) => (
              <CampaignCard key={`${c.adSource}-${c.adCampaign ?? i}`} stat={c} maxRevenue={maxRevenue} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
