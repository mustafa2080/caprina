import { useQuery } from "@tanstack/react-query";
import { useState, useMemo, useRef, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { analyticsApi, ordersApi, zonesApi, type AdSourceStat, type SmartProduct, type DeadStockItem, type ReturnReasonItem, type HighReturnProduct, type StockPredictorItem, type ZoneInsight, type ZoneReturnReasonItem } from "@/lib/api";
import { apiFetch } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Brain, Star, Archive, RotateCcw, TrendingDown, TrendingUp,
  AlertTriangle, Clock, Package, ArrowUpRight, Zap, ChevronDown, Globe,
  X, Download, ExternalLink, MapPin, ChevronLeft,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { FaFacebook, FaTiktok, FaInstagram, FaWhatsapp } from "react-icons/fa";
import { PiPlantFill } from "react-icons/pi";
import { FiMoreHorizontal } from "react-icons/fi";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, Cell, PieChart, Pie, Sector,
} from "recharts";
import { format, subMonths, startOfMonth, endOfMonth } from "date-fns";

const fc = (n: number) =>
  new Intl.NumberFormat("ar-EG", { style: "currency", currency: "EGP", maximumFractionDigits: 0 }).format(n);
const fn = (n: number) => new Intl.NumberFormat("ar-EG").format(Math.round(n));

// ─── Source meta ─────────────────────────────────────────────────────────────
const SOURCE_META: Record<string, { label: string; color: string; bg: string; border: string; icon: React.ElementType; iconColor: string }> = {
  facebook:  { label: "فيسبوك",   icon: FaFacebook, iconColor: "#1877F2", color: "text-blue-700 dark:text-blue-400",    bg: "bg-blue-50 dark:bg-blue-900/30",     border: "border-blue-300 dark:border-blue-700" },
  tiktok:    { label: "تيك توك",  icon: FaTiktok,   iconColor: "#010101", color: "text-zinc-800 dark:text-zinc-200",    bg: "bg-zinc-50 dark:bg-zinc-900/30",     border: "border-zinc-300 dark:border-zinc-700" },
  instagram: { label: "إنستجرام", icon: FaInstagram,iconColor: "#E1306C", color: "text-pink-700 dark:text-pink-400",    bg: "bg-pink-50 dark:bg-pink-900/30",     border: "border-pink-300 dark:border-pink-700" },
  organic:   { label: "ويبسايت",  icon: Globe, iconColor: "#6366f1", color: "text-indigo-700 dark:text-indigo-400", bg: "bg-indigo-50 dark:bg-indigo-900/20", border: "border-indigo-300 dark:border-indigo-700" },
  unknown:   { label: "عضوي",     icon: Globe, iconColor: "#94a3b8", color: "text-slate-600 dark:text-slate-400",  bg: "bg-slate-50 dark:bg-slate-900/20",   border: "border-slate-300 dark:border-slate-700" },
  whatsapp:  { label: "واتساب",   icon: FaWhatsapp, iconColor: "#25D366", color: "text-green-700 dark:text-green-400",  bg: "bg-green-50 dark:bg-green-900/20",   border: "border-green-300 dark:border-green-700" },
  other:     { label: "أخرى",     icon: FiMoreHorizontal, iconColor: "#888",color: "text-zinc-600 dark:text-zinc-400",    bg: "bg-zinc-100 dark:bg-zinc-800/40",    border: "border-zinc-300 dark:border-zinc-700" },
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

// ─── Source Orders Modal ──────────────────────────────────────────────────────
const STATUS_AR: Record<string, string> = {
  pending: "قيد الانتظار", warehouse_ready: "قيد الشحن بالمخزن",
  in_shipping: "قيد الشحن", received: "استلم",
  delayed: "مؤجل", returned: "مرتجع", partial_received: "استلم جزئي",
};
const STATUS_COLOR: Record<string, string> = {
  pending: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400",
  warehouse_ready: "bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-400",
  in_shipping: "bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-400",
  received: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400",
  delayed: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400",
  returned: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400",
  partial_received: "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-400",
};
const fc2 = (n: number | null | undefined) =>
  new Intl.NumberFormat("ar-EG", { style: "currency", currency: "EGP", maximumFractionDigits: 0 }).format(Number(n) || 0);

function exportToExcel(orders: any[], sourceLabel: string) {
  // بناء CSV احترافي لرفعه على ميتا / فيسبوك
  const cols = [
    { key: "phone",       header: "phone_number" },
    { key: "customerName",header: "first_name" },
    { key: "city",        header: "city" },
    { key: "product",     header: "product" },
    { key: "color",       header: "color" },
    { key: "size",        header: "size" },
    { key: "quantity",    header: "quantity" },
    { key: "totalPrice",  header: "order_value" },
    { key: "status",      header: "status" },
    { key: "adCampaign",  header: "ad_campaign" },
    { key: "invoiceNumber",header: "invoice_number" },
    { key: "createdAt",   header: "created_at" },
    { key: "notes",       header: "notes" },
  ];
  const header = cols.map(c => c.header).join(",");
  const rows = orders.map(o => cols.map(c => {
    let v = o[c.key] ?? "";
    if (c.key === "status") v = STATUS_AR[v] ?? v;
    if (c.key === "phone") v = String(v).replace(/\D/g, ""); // أرقام فقط للميتا
    if (c.key === "createdAt") v = new Date(v).toLocaleDateString("ar-EG");
    if (c.key === "totalPrice") v = Number(v).toFixed(2);
    return `"${String(v).replace(/"/g, '""')}"`;
  }).join(","));
  const csv = "\uFEFF" + [header, ...rows].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `orders-${sourceLabel}-${new Date().toISOString().slice(0,10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function SourceOrdersModal({ source, onClose }: { source: string; onClose: () => void }) {
  const meta = getMeta(source);
  const [search, setSearch] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["orders-by-source", source],
    queryFn: () => ordersApi.bySource(source),
    staleTime: 60_000,
  });

  const orders = data?.orders ?? [];
  const filtered = useMemo(() => {
    if (!search.trim()) return orders;
    const q = search.toLowerCase();
    return orders.filter((o: any) =>
      (o.customerName ?? "").toLowerCase().includes(q) ||
      (o.phone ?? "").includes(q) ||
      (o.product ?? "").toLowerCase().includes(q) ||
      (o.city ?? "").toLowerCase().includes(q)
    );
  }, [orders, search]);

  // إغلاق بـ Escape
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" dir="rtl">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      {/* Panel */}
      <div className="relative z-10 w-full max-w-5xl max-h-[90vh] flex flex-col bg-background border border-border rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border bg-muted/20">
          <div className="flex items-center gap-3">
            <meta.icon style={{ color: meta.iconColor, fontSize: "1.8rem" }} />
            <div>
              <h2 className="font-black text-lg">{meta.label}</h2>
              <p className="text-xs text-muted-foreground">
                {isLoading ? "جاري التحميل..." : `${filtered.length} طلب`}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => exportToExcel(filtered, meta.label)}
              disabled={!filtered.length}
              className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-40 transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              تصدير CSV للميتا
            </button>
            <button onClick={onClose} className="p-2 rounded-lg hover:bg-muted/50 transition-colors">
              <X className="w-5 h-5 text-muted-foreground" />
            </button>
          </div>
        </div>

        {/* Search */}
        <div className="px-5 py-3 border-b border-border/50">
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="ابحث بالاسم أو الهاتف أو المنتج أو المدينة..."
            className="w-full h-9 px-3 text-sm bg-muted/30 border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>

        {/* Table */}
        <div className="flex-1 overflow-auto">
          {isLoading ? (
            <div className="flex items-center justify-center h-48">
              <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-muted-foreground gap-2">
              <Package className="w-10 h-10 opacity-20" />
              <p className="text-sm">{search ? "لا توجد نتائج" : "لا توجد طلبات لهذه المنصة"}</p>
            </div>
          ) : (
            <table className="w-full text-xs" dir="rtl">
              <thead className="sticky top-0 bg-muted/80 backdrop-blur-sm">
                <tr className="border-b border-border">
                  <th className="py-2.5 px-3 text-right font-semibold text-muted-foreground">#</th>
                  <th className="py-2.5 px-3 text-right font-semibold text-muted-foreground">العميل</th>
                  <th className="py-2.5 px-3 text-right font-semibold text-muted-foreground">الهاتف</th>
                  <th className="py-2.5 px-3 text-right font-semibold text-muted-foreground">المدينة</th>
                  <th className="py-2.5 px-3 text-right font-semibold text-muted-foreground">المنتج</th>
                  <th className="py-2.5 px-3 text-center font-semibold text-muted-foreground">الكمية</th>
                  <th className="py-2.5 px-3 text-center font-semibold text-muted-foreground">الإجمالي</th>
                  <th className="py-2.5 px-3 text-right font-semibold text-muted-foreground">الحملة</th>
                  <th className="py-2.5 px-3 text-center font-semibold text-muted-foreground">الحالة</th>
                  <th className="py-2.5 px-3 text-center font-semibold text-muted-foreground">التاريخ</th>
                  <th className="py-2.5 px-3 w-8"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((o: any) => (
                  <tr key={o.id} className="border-b border-border/40 hover:bg-muted/10 transition-colors">
                    <td className="py-2 px-3 font-mono text-muted-foreground">#{String(o.id).padStart(4,"0")}</td>
                    <td className="py-2 px-3 font-semibold">{o.customerName}</td>
                    <td className="py-2 px-3 text-muted-foreground font-mono">{o.phone ?? "—"}</td>
                    <td className="py-2 px-3 text-muted-foreground">{o.city ?? "—"}</td>
                    <td className="py-2 px-3">
                      <span className="font-semibold">{o.product}</span>
                      {(o.color || o.size) && (
                        <span className="text-primary/70 mr-1">{[o.color, o.size].filter(Boolean).join("/")}</span>
                      )}
                    </td>
                    <td className="py-2 px-3 text-center font-bold">{o.quantity}</td>
                    <td className="py-2 px-3 text-center font-bold text-primary">{fc2((o.totalPrice ?? 0) + (o.shippingCost ?? 0))}</td>
                    <td className="py-2 px-3 text-muted-foreground max-w-[120px] truncate">{o.adCampaign ?? "—"}</td>
                    <td className="py-2 px-3 text-center">
                      <span className={`inline-flex px-1.5 py-0.5 rounded-md text-[10px] font-bold ${STATUS_COLOR[o.status] ?? "bg-muted text-muted-foreground"}`}>
                        {STATUS_AR[o.status] ?? o.status}
                      </span>
                    </td>
                    <td className="py-2 px-3 text-center text-muted-foreground whitespace-nowrap">
                      {new Date(o.createdAt).toLocaleDateString("ar-EG")}
                    </td>
                    <td className="py-2 px-3 text-center">
                      <a href={`/orders/${o.id}`} target="_blank" rel="noopener noreferrer"
                        className="text-muted-foreground hover:text-primary transition-colors">
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Footer summary */}
        {!isLoading && filtered.length > 0 && (() => {
          const delivered = filtered.filter((o: any) => o.status === "received").length;
          const returned = filtered.filter((o: any) => o.status === "returned").length;
          const totalRev = filtered.reduce((s: number, o: any) => s + (Number(o.totalPrice) || 0) + (Number(o.shippingCost) || 0), 0);
          return (
            <div className="border-t border-border px-5 py-3 flex flex-wrap gap-4 items-center bg-muted/10 text-xs">
              <span className="text-muted-foreground">إجمالي: <span className="font-black text-foreground">{filtered.length}</span> طلب</span>
              <span className="text-muted-foreground">مُسلَّم: <span className="font-black text-emerald-500">{delivered}</span></span>
              <span className="text-muted-foreground">مرتجع: <span className="font-black text-red-400">{returned}</span></span>
              <span className="text-muted-foreground">إجمالي الإيرادات: <span className="font-black text-primary">{fc2(totalRev)}</span></span>
              <span className="text-muted-foreground mr-auto">معدل التسليم: <span className="font-black text-emerald-500">{filtered.length > 0 ? Math.round(delivered / filtered.length * 100) : 0}%</span></span>
            </div>
          );
        })()}
      </div>
    </div>
  );
}

// ─── 1. Ad Attribution ────────────────────────────────────────────────────────
function AdAttributionSection({ bestSource, breakdown, showProfit }: { bestSource: AdSourceStat | null; breakdown: AdSourceStat[]; showProfit: boolean }) {
  const maxVal = Math.max(...breakdown.map(s => showProfit ? Math.abs(s.profit) : s.revenue), 1);
  const best = bestSource ? getMeta(bestSource.source) : null;
  const [activeSource, setActiveSource] = useState<string | null>(null);

  return (
    <div>
      <SectionHeader icon={Zap} title="أفضل منصة إعلانية" subtitle={showProfit ? "صافي الربح الحقيقي لكل قناة تسويقية — اضغط على منصة لعرض طلباتها" : "إيرادات كل قناة تسويقية — اضغط على منصة لعرض طلباتها"} color="text-amber-500 dark:text-amber-400" />

      {bestSource && best && (
        <button
          onClick={() => setActiveSource(bestSource.source)}
          className={`w-full mb-4 rounded-xl border-2 ${best.border} ${best.bg} p-4 flex flex-col sm:flex-row sm:items-center gap-4 text-right hover:opacity-90 transition-opacity cursor-pointer`}
        >
          <div className="flex items-center gap-3 flex-1">
            <best.icon style={{ color: best.iconColor, fontSize: "2.5rem" }} />
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
        </button>
      )}

      <div className="space-y-2">
        {breakdown.map((s) => {
          const meta = getMeta(s.source);
          const barPct = Math.max(0, Math.round(((showProfit ? Math.abs(s.profit) : s.revenue) / maxVal) * 100));
          return (
            <button
              key={s.source}
              onClick={() => setActiveSource(s.source)}
              className="w-full flex items-center gap-3 py-2.5 px-3 rounded-lg bg-card border border-border hover:border-primary/40 hover:bg-muted/10 transition-colors cursor-pointer text-right"
            >
              <meta.icon style={{ color: meta.iconColor, fontSize: "1.4rem", flexShrink: 0 }} />
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
                  <span className="text-[10px] text-primary/70 mr-auto">← اضغط لعرض الطلبات</span>
                </div>
              </div>
            </button>
          );
        })}
        {breakdown.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-6">لا توجد بيانات إعلانية بعد</p>
        )}
      </div>

      {/* Modal */}
      {activeSource && (
        <SourceOrdersModal source={activeSource} onClose={() => setActiveSource(null)} />
      )}
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
              <div className="relative shrink-0">
                {p.image ? (
                  <img src={p.image} alt={p.name} className="w-9 h-9 rounded-full object-cover border-2 border-amber-400/60" />
                ) : (
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-black bg-gradient-to-br from-amber-400 to-orange-500 text-black`}>
                    {p.name.charAt(0)}
                  </div>
                )}
                <div className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-black border border-background ${
                  i === 0 ? "bg-amber-500 text-black" : i === 1 ? "bg-zinc-400 text-black" : i === 2 ? "bg-amber-700 text-white" : "bg-muted text-muted-foreground"
                }`}>{i + 1}</div>
              </div>
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
              <div className="relative shrink-0">
                {p.image ? (
                  <img src={p.image} alt={p.name} className="w-9 h-9 rounded-full object-cover border-2 border-amber-500/60" />
                ) : (
                  <div className="w-9 h-9 rounded-full flex items-center justify-center bg-amber-100 dark:bg-amber-900/30">
                    <Archive className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                  </div>
                )}
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
// ─── ألوان دائمة لأسباب المرتجعات (مفتاحها reason value أو label للـ other_note) ──
const REASON_DONUT_COLORS = [
  "#f43f5e", // rose
  "#f59e0b", // amber
  "#3b82f6", // blue
  "#10b981", // emerald
  "#8b5cf6", // violet
  "#06b6d4", // cyan
  "#ec4899", // pink
  "#84cc16", // lime
  "#f97316", // orange
  "#64748b", // slate
];

// ─── Active (hover) shape لدونات أسباب المرتجعات ────────────────────────────
function ReasonActiveShape(props: any) {
  const { cx, cy, innerRadius, outerRadius, startAngle, endAngle, fill, payload, percent, value } = props;
  return (
    <g tabIndex={-1} style={{ outline: "none" }}>
      <Sector
        cx={cx} cy={cy}
        innerRadius={outerRadius + 5}
        outerRadius={outerRadius + 9}
        startAngle={startAngle}
        endAngle={endAngle}
        fill={fill}
        opacity={0.2}
        cornerRadius={6}
      />
      <Sector
        cx={cx} cy={cy}
        innerRadius={innerRadius - 4}
        outerRadius={outerRadius + 7}
        startAngle={startAngle}
        endAngle={endAngle}
        fill={fill}
        cornerRadius={6}
        tabIndex={-1}
        style={{ outline: "none" }}
      />
      <text x={cx} y={cy - 14} textAnchor="middle" fill="hsl(var(--foreground))" fontSize={26} fontWeight={900} style={{ pointerEvents: "none", userSelect: "none" }}>
        {value}
      </text>
      <text x={cx} y={cy + 10} textAnchor="middle" fill="hsl(var(--muted-foreground))" fontSize={10} style={{ pointerEvents: "none", userSelect: "none" }}>
        <tspan x={cx}>{String(payload.label).length > 18 ? String(payload.label).slice(0, 18) + "…" : payload.label}</tspan>
      </text>
      <text x={cx} y={cy + 26} textAnchor="middle" fill={fill} fontSize={14} fontWeight={800} style={{ pointerEvents: "none", userSelect: "none" }}>
        {`${(percent * 100).toFixed(0)}%`}
      </text>
    </g>
  );
}

// ─── Donut أسباب المرتجعات ───────────────────────────────────────────────────
function ReturnReasonsDonut({ items, total }: { items: ReturnReasonItem[]; total: number }) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [selected, setSelected] = useState<string | null>(null);

  const colored = useMemo(() => items.map((r, i) => ({
    ...r,
    color: REASON_DONUT_COLORS[i % REASON_DONUT_COLORS.length],
  })), [items]);

  return (
    <div className="space-y-5">
      <div className="relative" style={{ height: 240 }}>
        {activeIndex === null && (
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none z-10">
            <p className="text-4xl font-black text-foreground leading-none">{fn(total)}</p>
            <p className="text-xs text-muted-foreground mt-1">إجمالي المرتجعات</p>
          </div>
        )}
        <ResponsiveContainer width="100%" height="100%">
          <PieChart tabIndex={-1} style={{ outline: "none" }}>
            <Pie
              data={colored}
              cx="50%"
              cy="50%"
              innerRadius="52%"
              outerRadius="78%"
              paddingAngle={3}
              dataKey="count"
              nameKey="label"
              stroke="none"
              cornerRadius={5}
              startAngle={90}
              endAngle={-270}
              labelLine={false}
              activeIndex={activeIndex ?? undefined}
              activeShape={ReasonActiveShape}
              animationBegin={0}
              animationDuration={600}
              animationEasing="ease-out"
              onMouseEnter={(_, index) => setActiveIndex(index)}
              onMouseLeave={() => setActiveIndex(null)}
              onClick={(entry: any) => setSelected(v => v === entry.reason ? null : entry.reason)}
              style={{ cursor: "pointer", outline: "none" }}
            >
              {colored.map((d, i) => (
                <Cell key={i} fill={d.color} opacity={selected && selected !== d.reason ? 0.35 : 1} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
      </div>

      {/* Legend */}
      <div className="flex flex-col gap-1.5 max-h-72 overflow-y-auto pr-1">
        {colored.map((item) => {
          const isSelected = selected === item.reason;
          return (
            <button
              key={item.reason}
              type="button"
              onClick={() => setSelected(v => v === item.reason ? null : item.reason)}
              className="w-full flex items-center gap-3 rounded-lg px-2 py-1 transition-all text-right"
              style={{
                background: isSelected ? item.color + "1a" : "transparent",
                border: isSelected ? `1px solid ${item.color}55` : "1px solid transparent",
              }}
            >
              <span className="w-3 h-3 rounded-full shrink-0" style={{ background: item.color }} />
              <span className="text-xs font-semibold text-foreground flex-1 truncate" title={item.label}>{item.label}</span>
              <span className="text-xs font-bold px-2 py-0.5 rounded-md shrink-0" style={{ background: item.color + "1a", color: item.color }}>
                {item.count}
              </span>
              <span className="text-xs font-black w-9 text-right shrink-0" style={{ color: item.color }}>
                {item.pct}%
              </span>
            </button>
          );
        })}
        {colored.length === 0 && (
          <div className="text-center py-6 text-muted-foreground text-xs">
            <RotateCcw className="w-6 h-6 mx-auto mb-2 opacity-30" />
            لا توجد مرتجعات مسجلة
          </div>
        )}
      </div>
    </div>
  );
}

function ReturnInsightsSection({
  byReason, highReturnProducts, totalReturnRate, totalReturns,
}: { byReason: ReturnReasonItem[]; highReturnProducts: HighReturnProduct[]; totalReturnRate: number; totalReturns: number }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
      {/* Reasons donut */}
      <div>
        <SectionHeader icon={RotateCcw} title="أسباب المرتجعات" subtitle={`${fn(totalReturns)} مرتجع • نسبة ${totalReturnRate}% من الطلبات`} color="text-red-600 dark:text-red-400" />
        <ReturnReasonsDonut items={byReason} total={totalReturns} />
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

// ─── 5. Cash Flow Chart (آخر 6 شهور) ────────────────────────────────────────
function CashFlowSection() {
  const [chartView, setChartView] = useState<"area" | "bar">("area");
  const [dropOpen,  setDropOpen]  = useState(false);
  const dropRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!dropOpen) return;
    const h = (e: MouseEvent) => {
      if (dropRef.current && !dropRef.current.contains(e.target as Node)) setDropOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [dropOpen]);

  const { data: orders = [] } = useQuery<any[]>({
    queryKey: ["sale-orders-cashflow"],
    queryFn: () => apiFetch<any[]>("/finance/sale-orders"),
    staleTime: 60000,
  });

  const { chartData, totalSales, bestMonth } = useMemo(() => {
    // بناء آخر 6 شهور
    const months: Record<string, number> = {};
    for (let i = 5; i >= 0; i--) {
      const d = subMonths(new Date(), i);
      months[format(d, "MMM yy")] = 0;
    }
    orders.forEach(o => {
      const d = new Date(o.createdAt);
      const key = format(d, "MMM yy");
      if (key in months) months[key] += parseFloat(o.totalAmount ?? "0");
    });
    const data = Object.entries(months).map(([date, value]) => ({ date, value }));
    const total = data.reduce((s, r) => s + r.value, 0);
    const best  = data.reduce((a, b) => b.value > a.value ? b : a, data[0]);
    return { chartData: data, totalSales: total, bestMonth: best };
  }, [orders]);

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <SectionHeader icon={TrendingUp} title="التدفق المالي" subtitle="المبيعات — آخر 6 شهور" color="text-primary" />
        {/* Dropdown نوع الرسم */}
        <div className="relative" ref={dropRef}>
          <button
            onClick={() => setDropOpen(o => !o)}
            className="flex items-center gap-1.5 h-7 px-2.5 rounded-lg border border-border bg-muted/10 hover:bg-muted/30 transition-colors text-[11px] font-medium text-muted-foreground hover:text-foreground"
          >
            {chartView === "area" ? (
              <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
                <polyline points="1,11 4,7 7,9 10,4 13,2" stroke="currentColor" strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
                <polygon points="1,11 4,7 7,9 10,4 13,2 13,13 1,13" fill="currentColor" opacity="0.2"/>
              </svg>
            ) : (
              <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
                <rect x="1" y="6" width="3" height="7" rx="1" fill="currentColor" opacity="0.6"/>
                <rect x="5.5" y="3" width="3" height="10" rx="1" fill="currentColor"/>
                <rect x="10" y="1" width="3" height="12" rx="1" fill="currentColor" opacity="0.6"/>
              </svg>
            )}
            {chartView === "area" ? "خطي" : "بياني"}
            <ChevronDown className="w-3 h-3" />
          </button>

          {dropOpen && (
            <div className="absolute left-0 top-full mt-1.5 w-36 bg-card border border-border rounded-xl shadow-xl z-50 overflow-hidden">
              {[
                { key: "area", label: "خطي تدرجي", icon: (
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <polyline points="1,11 4,7 7,9 10,4 13,2" stroke="currentColor" strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
                    <polygon points="1,11 4,7 7,9 10,4 13,2 13,13 1,13" fill="currentColor" opacity="0.2"/>
                  </svg>
                )},
                { key: "bar", label: "أعمدة", icon: (
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <rect x="1" y="6" width="3" height="7" rx="1" fill="currentColor" opacity="0.6"/>
                    <rect x="5.5" y="3" width="3" height="10" rx="1" fill="currentColor"/>
                    <rect x="10" y="1" width="3" height="12" rx="1" fill="currentColor" opacity="0.6"/>
                  </svg>
                )},
              ].map(opt => (
                <button key={opt.key}
                  onClick={() => { setChartView(opt.key as "area"|"bar"); setDropOpen(false); }}
                  className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-[12px] transition-colors
                    ${chartView === opt.key ? "bg-primary/10 text-primary font-bold" : "text-muted-foreground hover:bg-muted/20 hover:text-foreground"}`}>
                  {opt.icon}
                  {opt.label}
                  {chartView === opt.key && <span className="mr-auto text-primary">✓</span>}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* KPI صغير */}
      <div className="flex items-end gap-4 mb-3">
        <div>
          <p className="text-2xl font-black text-primary">{fc(totalSales)}</p>
          <p className="text-[11px] text-primary">إجمالي آخر 6 شهور</p>
        </div>
        {bestMonth && bestMonth.value > 0 && (
          <div className="mb-0.5">
            <p className="text-xs text-muted-foreground">أفضل شهر</p>
            <p className="text-sm font-bold">{bestMonth.date} — {fc(bestMonth.value)}</p>
          </div>
        )}
      </div>

      <ResponsiveContainer width="100%" height={180}>
        {chartView === "area" ? (
          <AreaChart data={chartData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="cfGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor="hsl(43,74%,50%)" stopOpacity={0.35} />
                <stop offset="95%" stopColor="hsl(43,74%,50%)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis dataKey="date" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false}
              tickFormatter={v => v >= 1000 ? `${(v/1000).toFixed(0)}K` : String(v)} />
            <Tooltip
              contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 11 }}
              formatter={(v: any) => [fc(v), "المبيعات"]}
            />
            <Area type="monotone" dataKey="value" stroke="hsl(43,74%,50%)" strokeWidth={2.5}
              fill="url(#cfGrad)"
              dot={{ fill: "hsl(43,74%,50%)", r: 4, strokeWidth: 2, stroke: "hsl(var(--card))" }}
              activeDot={{ r: 6, strokeWidth: 2, stroke: "hsl(var(--card))" }} />
          </AreaChart>
        ) : (
          <BarChart data={chartData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
            <XAxis dataKey="date" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false}
              tickFormatter={v => v >= 1000 ? `${(v/1000).toFixed(0)}K` : String(v)} />
            <Tooltip
              contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 11 }}
              formatter={(v: any) => [fc(v), "المبيعات"]}
              cursor={{ fill: "hsl(var(--muted))", opacity: 0.2 }}
            />
            <Bar dataKey="value" radius={[5, 5, 0, 0]}>
              {chartData.map((entry, i) => (
                <Cell key={i}
                  fill="hsl(43,74%,50%)"
                  opacity={entry === bestMonth ? 1 : 0.45 + (i / chartData.length) * 0.4}
                />
              ))}
            </Bar>
          </BarChart>
        )}
      </ResponsiveContainer>
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
              <p className="font-black text-sm">{getMeta(data.adAttribution.bestSource.source).label}</p>
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

// ══════════════════════════════════════════════════════════════════════════
// ─── Zones Analytics (تحليلات المناطق الذكية) — منقولة من صفحة المناطق ─────
// ══════════════════════════════════════════════════════════════════════════
// ملاحظة: REASON_DONUT_COLORS / ReasonActiveShape / ReasonsDonut معرّفين بالفعل
// أعلاه في قسم "Return Insights" ونعيد استخدامهم هنا لعرض أسباب مرتجعات المنطقة.

// ─── رسالة تحليلية ذكية مبنية على أعلى سبب مرتجع في المنطقة ─────────────────
const REASON_SMART_ADVICE: Record<string, string> = {
  no_answer: "نسبة كبيرة من العملاء هنا ما بيردوش. جرّب تأكيد الطلب بمكالمة أو رسالة واتساب قبل الشحن مباشرة.",
  unavailable: "العميل بيبقى مغلق أو مش متاح وقت التوصيل. اتفق مع المندوب على ميعاد بديل أو اتصل قبل التوصيل بساعة.",
  postponed: "طلبات كتير بتتأجل من العميل نفسه. حاول تحدد ميعاد التسليم مع العميل من البداية بدل ما يتفاجئ.",
  no_knowledge: "العميل مش عارف إن فيه شحنة جايله. تأكد إن رسالة التأكيد بعد الطلب بتوصل فعليًا (واتساب/SMS).",
  cancel_request: "نسبة إلغاء عالية من العميل نفسه بعد الطلب. راجع وضوح السعر والمواصفات وقت البيع.",
  refused_paid: "العميل بيرفض بعد ما يشوف المنتج وبيدفع مصاريف الشحن. المشكلة غالبًا في المنتج نفسه أو الوصف — راجع الصور والمواصفات.",
  refused_unpaid: "رفض استلام مرتفع بدون دفع مصاريف الشحن، يعني في احتمال طلبات وهمية أو عدم جدية. فكّر في تفعيل تأكيد مسبق بالدفع الجزئي.",
  damaged: "نسبة شحنات تالفة عالية في المنطقة دي. راجع التغليف أو شركة الشحن المسؤولة عن التوصيل هنا.",
  unclear_address: "عناوين غير واضحة بتسبب مرتجعات. اطلب من فريق البيع تأكيد العنوان بالتفصيل وقت تسجيل الطلب.",
  out_of_coverage: "المنطقة دي فيها عناوين خارج نطاق التغطية الفعلي لشركة الشحن. فكّر تغيّر شركة الشحن لهذه المنطقة أو توضح حدود التغطية.",
  time_mismatch: "توقيت المندوب مش مناسب لعملاء المنطقة دي. جرّب تنسيق مواعيد توصيل بديلة (مساءً مثلاً).",
  other: "أغلب المرتجعات هنا بسبب غير مصنف. راجع ملاحظات المرتجعات يدويًا لفهم السبب الحقيقي.",
};

function zoneSmartAdvice(zone: ZoneInsight): string {
  if (zone.returnedCount === 0) return "لا توجد مرتجعات مسجلة في هذه المنطقة حتى الآن. أداء ممتاز، استمر في نفس الأسلوب.";
  if (!zone.topReason) return "توجد مرتجعات لكن بدون سبب محدد. تأكد إن فريق الشحن بيسجل سبب المرتجع دايمًا.";
  const advice = REASON_SMART_ADVICE[zone.topReason.reason];
  if (advice) return advice;
  return `أعلى سبب مرتجع هنا هو "${zone.topReason.label}" بنسبة ${zone.topReason.pct}%. راجع تفاصيل هذا السبب لتحسين الأداء.`;
}

function zoneVerdict(zone: ZoneInsight): { label: string; color: string; icon: React.ElementType } {
  if (zone.closedCount < 3) return { label: "بيانات غير كافية", color: "text-muted-foreground", icon: Package };
  if (zone.returnRate >= 40) return { label: "ركّز هنا — مرتجعات عالية جدًا", color: "text-red-600 dark:text-red-400", icon: AlertTriangle };
  if (zone.returnRate >= 20) return { label: "راقب هذه المنطقة", color: "text-amber-600 dark:text-amber-400", icon: TrendingDown };
  return { label: "أداء جيد", color: "text-emerald-600 dark:text-emerald-400", icon: TrendingUp };
}

// ─── كارت ملخص منطقة في القايمة المرتبة ─────────────────────────────────────
function ZoneSummaryCard({ zone, onOpen }: { zone: ZoneInsight; onOpen: () => void }) {
  const verdict = zoneVerdict(zone);
  const VerdictIcon = verdict.icon;
  return (
    <button
      type="button"
      onClick={onOpen}
      className="w-full text-right p-4 rounded-xl border border-border/60 hover:border-primary/40 bg-card hover:shadow-md hover:shadow-primary/5 transition-all group"
    >
      <div className="flex items-center justify-between gap-3 mb-3">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
            <MapPin className="w-4 h-4" />
          </div>
          <h3 className="font-bold text-sm truncate">{zone.zoneName}</h3>
        </div>
        <ChevronLeft className="w-4 h-4 text-muted-foreground shrink-0 group-hover:-translate-x-1 transition-transform" />
      </div>

      <div className={`flex items-center gap-1.5 mb-3 text-xs font-bold ${verdict.color}`}>
        <VerdictIcon className="w-3.5 h-3.5" />
        {verdict.label}
      </div>

      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="rounded-lg bg-muted/40 py-2">
          <p className="text-[10px] text-muted-foreground mb-0.5">الإيراد</p>
          <p className="text-xs font-black">{fc(zone.revenue)}</p>
        </div>
        <div className="rounded-lg bg-emerald-50 dark:bg-emerald-900/20 py-2">
          <p className="text-[10px] text-muted-foreground mb-0.5">نسبة التسليم</p>
          <p className="text-xs font-black text-emerald-600 dark:text-emerald-400">{zone.deliveryRate}%</p>
        </div>
        <div className="rounded-lg bg-red-50 dark:bg-red-900/20 py-2">
          <p className="text-[10px] text-muted-foreground mb-0.5">نسبة المرتجعات</p>
          <p className="text-xs font-black text-red-600 dark:text-red-400">{zone.returnRate}%</p>
        </div>
      </div>
    </button>
  );
}

// ─── تفاصيل منطقة واحدة (دونات + رسالة ذكية) ────────────────────────────────
function ZoneDetailView({ zone, onBack }: { zone: ZoneInsight; onBack: () => void }) {
  const verdict = zoneVerdict(zone);
  const VerdictIcon = verdict.icon;
  return (
    <div className="space-y-5">
      <button onClick={onBack} className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors">
        <ChevronLeft className="w-3.5 h-3.5 rotate-180" /> رجوع لكل المناطق
      </button>

      <div className="flex flex-wrap items-center gap-3 justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
            <MapPin className="w-5 h-5" />
          </div>
          <div>
            <h2 className="font-black text-base">{zone.zoneName}</h2>
            <p className="text-xs text-muted-foreground">{fn(zone.ordersCount)} طلب إجمالاً</p>
          </div>
        </div>
        <Badge className={`gap-1.5 border-0 font-bold text-xs px-3 py-1.5 ${verdict.color} bg-current/10`}>
          <VerdictIcon className="w-3.5 h-3.5" /> {verdict.label}
        </Badge>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="rounded-xl border border-border/60 bg-card p-3 text-center">
          <p className="text-[10px] text-muted-foreground mb-1">الإيراد</p>
          <p className="text-sm font-black">{fc(zone.revenue)}</p>
        </div>
        <div className="rounded-xl border border-emerald-200 dark:border-emerald-800/50 bg-emerald-50 dark:bg-emerald-900/20 p-3 text-center">
          <p className="text-[10px] text-muted-foreground mb-1">نسبة التسليم</p>
          <p className="text-sm font-black text-emerald-600 dark:text-emerald-400">{zone.deliveryRate}%</p>
        </div>
        <div className="rounded-xl border border-red-200 dark:border-red-800/50 bg-red-50 dark:bg-red-900/20 p-3 text-center">
          <p className="text-[10px] text-muted-foreground mb-1">نسبة المرتجعات</p>
          <p className="text-sm font-black text-red-600 dark:text-red-400">{zone.returnRate}%</p>
        </div>
        <div className="rounded-xl border border-border/60 bg-card p-3 text-center">
          <p className="text-[10px] text-muted-foreground mb-1">عدد المرتجعات</p>
          <p className="text-sm font-black">{fn(zone.returnedCount)}</p>
        </div>
      </div>

      {/* رسالة تحليلية ذكية */}
      <div className={`flex items-start gap-3 rounded-xl border p-4 ${verdict.color} bg-current/5 border-current/20`}>
        <VerdictIcon className="w-5 h-5 shrink-0 mt-0.5" />
        <p className="text-xs font-semibold leading-relaxed text-foreground">{zoneSmartAdvice(zone)}</p>
      </div>

      {/* دونات أسباب المرتجعات */}
      <div>
        <h3 className="font-black text-sm mb-4 flex items-center gap-2">
          <RotateCcw className="w-4 h-4 text-red-600 dark:text-red-400" /> أسباب المرتجعات في {zone.zoneName}
        </h3>
        <ReturnReasonsDonut items={zone.byReason} total={zone.returnedCount} />
      </div>
    </div>
  );
}

// ─── دونات المناطق (مش الأسباب) — قسمة حسب الإيراد أو عدد الطلبات ───────────
const ZONE_DONUT_COLORS = [
  "#3b82f6", "#10b981", "#f59e0b", "#8b5cf6", "#f43f5e",
  "#06b6d4", "#ec4899", "#84cc16", "#f97316", "#64748b",
  "#14b8a6", "#a855f7",
];

function ZoneActiveShape(props: any) {
  const { cx, cy, innerRadius, outerRadius, startAngle, endAngle, fill, payload, percent } = props;
  const name = String(payload.zoneName ?? "غير محدد");
  const maxChars = Math.max(6, Math.floor((innerRadius * 1.7) / 7));
  return (
    <g tabIndex={-1} style={{ outline: "none" }}>
      <Sector
        cx={cx} cy={cy} innerRadius={outerRadius + 6} outerRadius={outerRadius + 10}
        startAngle={startAngle} endAngle={endAngle} fill={fill} opacity={0.18} cornerRadius={6}
        style={{ transition: "all 300ms cubic-bezier(0.34, 1.56, 0.64, 1)" }}
      />
      <Sector
        cx={cx} cy={cy} innerRadius={innerRadius - 3} outerRadius={outerRadius + 6}
        startAngle={startAngle} endAngle={endAngle} fill={fill} cornerRadius={6} tabIndex={-1}
        style={{ outline: "none", filter: "drop-shadow(0 2px 8px rgba(0,0,0,0.25))", transition: "all 300ms cubic-bezier(0.34, 1.56, 0.64, 1)" }}
      />
      <text x={cx} y={cy - 8} textAnchor="middle" fill={fill} fontSize={12} fontWeight={800} style={{ pointerEvents: "none", userSelect: "none" }}>
        <tspan x={cx}>{name.length > maxChars ? name.slice(0, maxChars) + "…" : name}</tspan>
      </text>
      <text x={cx} y={cy + 16} textAnchor="middle" fill="hsl(var(--foreground))" fontSize={20} fontWeight={900} style={{ pointerEvents: "none", userSelect: "none" }}>{`${(percent * 100).toFixed(0)}%`}</text>
    </g>
  );
}

type ZoneMetric = "revenue" | "orders" | "deliveryRate" | "returnRate";

function ZonesOverview({ zones, onOpenZone }: { zones: ZoneInsight[]; onOpenZone: (zoneId: string | null) => void }) {
  const [metric, setMetric] = useState<ZoneMetric>("revenue");
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  const withData = useMemo(() => zones.filter(z => z.ordersCount > 0), [zones]);

  const isPieMetric = metric === "revenue" || metric === "orders";

  const colored = useMemo(() => withData
    .map((z, i) => ({ ...z, color: ZONE_DONUT_COLORS[i % ZONE_DONUT_COLORS.length] }))
    .sort((a, b) => {
      if (metric === "revenue") return b.revenue - a.revenue;
      if (metric === "orders") return b.ordersCount - a.ordersCount;
      if (metric === "deliveryRate") return b.deliveryRate - a.deliveryRate;
      return b.returnRate - a.returnRate; // returnRate: الأعلى مرتجعًا في الأول عشان يشد الانتباه
    }),
    [withData, metric]
  );

  const totalMetric = colored.reduce((s, z) => s + (metric === "revenue" ? z.revenue : z.ordersCount), 0);
  const sortedList = colored;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div>
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <h3 className="font-black text-sm flex items-center gap-2">
            <MapPin className="w-4 h-4 text-primary" /> ترتيب المناطق
          </h3>
          <div className="flex items-center gap-1 bg-muted/50 rounded-lg p-1 flex-wrap">
            <button
              onClick={() => setMetric("revenue")}
              className={`text-[11px] font-bold px-2.5 py-1 rounded-md transition-colors ${metric === "revenue" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
            >
              الإيراد
            </button>
            <button
              onClick={() => setMetric("orders")}
              className={`text-[11px] font-bold px-2.5 py-1 rounded-md transition-colors ${metric === "orders" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
            >
              عدد الطلبات
            </button>
            <button
              onClick={() => setMetric("deliveryRate")}
              className={`text-[11px] font-bold px-2.5 py-1 rounded-md transition-colors ${metric === "deliveryRate" ? "bg-emerald-600 text-white" : "text-muted-foreground hover:text-foreground"}`}
            >
              أعلى تسليم
            </button>
            <button
              onClick={() => setMetric("returnRate")}
              className={`text-[11px] font-bold px-2.5 py-1 rounded-md transition-colors ${metric === "returnRate" ? "bg-red-600 text-white" : "text-muted-foreground hover:text-foreground"}`}
            >
              أعلى مرتجع
            </button>
          </div>
        </div>

        {!isPieMetric ? (
          <div className="rounded-2xl border border-border/60 bg-gradient-to-b from-muted/20 to-transparent p-3 space-y-2 max-h-[340px] overflow-y-auto">
            {colored.length === 0 ? (
              <div className="flex flex-col items-center justify-center text-muted-foreground gap-2 py-10">
                <Package className="w-8 h-8 opacity-25" />
                <p className="text-xs font-semibold">لا توجد بيانات كافية بعد</p>
              </div>
            ) : (
              colored.map((z, i) => {
                const value = metric === "deliveryRate" ? z.deliveryRate : z.returnRate;
                const isGood = metric === "deliveryRate";
                return (
                  <button
                    key={z.zoneId ?? "__none__"} type="button"
                    onClick={() => onOpenZone(z.zoneId)}
                    className="w-full flex items-center gap-3 rounded-lg px-2.5 py-2 hover:bg-muted/40 transition-all text-right"
                  >
                    <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black shrink-0 ${i === 0 ? (isGood ? "bg-emerald-500 text-white" : "bg-red-500 text-white") : "bg-muted text-muted-foreground"}`}>
                      {i + 1}
                    </span>
                    <span className="text-xs font-bold text-foreground flex-1 truncate" title={z.zoneName ?? "غير محدد"}>{z.zoneName ?? "غير محدد"}</span>
                    <span className="text-[10px] text-muted-foreground shrink-0">{fn(z.ordersCount)} طلب</span>
                    <span className={`text-sm font-black w-14 text-left shrink-0 tabular-nums ${isGood ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>
                      {value}%
                    </span>
                  </button>
                );
              })
            )}
          </div>
        ) : (
        <div className="relative rounded-2xl border border-border/60 bg-gradient-to-b from-muted/20 to-transparent p-2" style={{ height: 260 }}>
          {colored.length === 0 ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-muted-foreground gap-2">
              <Package className="w-8 h-8 opacity-25" />
              <p className="text-xs font-semibold">لا توجد بيانات كافية بعد</p>
            </div>
          ) : (
            <>
              <div
                className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none z-10 transition-opacity duration-300"
                style={{ opacity: activeIndex === null ? 1 : 0 }}
              >
                <div className="flex flex-col items-center justify-center px-4" style={{ maxWidth: "56%" }}>
                  <p className="font-black text-foreground leading-none tabular-nums text-center break-words" style={{ fontSize: "clamp(15px, 3.4vw, 26px)" }}>
                    {metric === "revenue" ? fc(totalMetric) : fn(totalMetric)}
                  </p>
                  <p className="text-[10px] font-semibold text-muted-foreground mt-1.5 tracking-wide whitespace-nowrap">
                    {metric === "revenue" ? "إجمالي الإيراد" : "إجمالي الطلبات"}
                  </p>
                </div>
              </div>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart tabIndex={-1} style={{ outline: "none" }}>
                  <Pie
                    key={metric}
                    data={colored} cx="50%" cy="50%" innerRadius="55%" outerRadius="78%" paddingAngle={colored.length > 1 ? 3 : 0}
                    dataKey={metric === "revenue" ? "revenue" : "ordersCount"} nameKey="zoneName" stroke="none" cornerRadius={5}
                    startAngle={90} endAngle={-270} labelLine={false}
                    activeIndex={activeIndex ?? undefined} activeShape={ZoneActiveShape}
                    isAnimationActive animationBegin={0} animationDuration={500} animationEasing="ease-in-out"
                    onMouseEnter={(_, index) => setActiveIndex(index)} onMouseLeave={() => setActiveIndex(null)}
                    onClick={(entry: any) => onOpenZone(entry.zoneId)}
                    style={{ cursor: "pointer", outline: "none", transition: "opacity 200ms ease" }}
                  >
                    {colored.map((d, i) => (
                      <Cell
                        key={i} fill={d.color} stroke="hsl(var(--card))" strokeWidth={2}
                        style={{ transition: "filter 200ms ease, opacity 200ms ease" }}
                        opacity={activeIndex === null || activeIndex === i ? 1 : 0.35}
                      />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            </>
          )}
        </div>
        )}

        {isPieMetric && colored.length > 0 && (
          <div className="flex flex-col gap-1 max-h-56 overflow-y-auto pr-1 mt-3">
            {colored.map((z, i) => {
              const value = metric === "revenue" ? z.revenue : z.ordersCount;
              const pct = totalMetric > 0 ? Math.round((value / totalMetric) * 100) : 0;
              const isActive = activeIndex === i;
              return (
                <button
                  key={z.zoneId ?? "__none__"} type="button"
                  onClick={() => onOpenZone(z.zoneId)}
                  onMouseEnter={() => setActiveIndex(i)} onMouseLeave={() => setActiveIndex(null)}
                  className={`w-full flex items-center gap-3 rounded-lg px-2.5 py-1.5 transition-all text-right ${isActive ? "bg-muted/60" : "hover:bg-muted/30"}`}
                >
                  <span className="w-2.5 h-2.5 rounded-full shrink-0 ring-2 ring-transparent transition-shadow" style={{ background: z.color, boxShadow: isActive ? `0 0 0 3px ${z.color}33` : "none" }} />
                  <span className="text-xs font-bold text-foreground flex-1 truncate" title={z.zoneName ?? "غير محدد"}>{z.zoneName ?? "غير محدد"}</span>
                  <span className="text-xs font-bold px-2 py-0.5 rounded-md shrink-0 tabular-nums" style={{ background: z.color + "1a", color: z.color }}>
                    {metric === "revenue" ? fc(value) : fn(value)}
                  </span>
                  <span className="text-xs font-black w-9 text-right shrink-0 tabular-nums" style={{ color: z.color }}>{pct}%</span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div>
        <h3 className="font-black text-sm mb-4 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400" /> تفاصيل كل منطقة (اضغط لعرض أسباب المرتجعات)
        </h3>
        <div className="space-y-2.5 max-h-[560px] overflow-y-auto pr-1">
          {sortedList.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground text-xs">لا توجد بيانات كافية بعد</div>
          ) : (
            sortedList.map(zone => (
              <ZoneSummaryCard key={zone.zoneId ?? "__none__"} zone={zone} onOpen={() => onOpenZone(zone.zoneId)} />
            ))
          )}
        </div>
      </div>
    </div>
  );
}

// ─── تبويب تحليلات المناطق كامل (فلتر تاريخ + دونات/قايمة أو تفاصيل منطقة) ──
function ZonesAnalyticsCard() {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [selectedZoneId, setSelectedZoneId] = useState<string | null | undefined>(undefined);

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ["zones-insights", from, to],
    queryFn: () => zonesApi.insights({ from: from || undefined, to: to || undefined }),
  });

  const selectedZone = useMemo(() => {
    if (selectedZoneId === undefined || !data) return null;
    return data.zones.find(z => z.zoneId === selectedZoneId) ?? null;
  }, [selectedZoneId, data]);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 flex-wrap justify-between">
        <SectionHeader icon={MapPin} title="تحليلات المناطق" subtitle="أداء المبيعات والمرتجعات لكل منطقة جغرافية" />
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 text-sm bg-muted/30 border border-border rounded-xl px-3 py-1.5">
            <span className="text-muted-foreground text-xs">من</span>
            <input type="date" className="bg-transparent text-sm outline-none w-32" value={from} onChange={e => setFrom(e.target.value)} />
            <span className="text-muted-foreground text-xs">إلى</span>
            <input type="date" className="bg-transparent text-sm outline-none w-32" value={to} onChange={e => setTo(e.target.value)} />
          </div>
          <button
            onClick={() => refetch()} disabled={isFetching}
            className="flex items-center gap-1.5 h-9 px-3 rounded-lg border border-border bg-muted/10 hover:bg-muted/30 text-xs font-semibold transition-colors disabled:opacity-50"
          >
            <RotateCcw className={`w-3.5 h-3.5 ${isFetching ? "animate-spin" : ""}`} /> تحديث
          </button>
          <Link href="/zones">
            <button className="flex items-center gap-1.5 h-9 px-3 rounded-lg border border-primary/30 text-primary hover:bg-primary/5 text-xs font-semibold transition-colors">
              إدارة المناطق <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </Link>
        </div>
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground text-sm">جاري تحميل التحليلات...</div>
      ) : !data ? null : selectedZone ? (
        <ZoneDetailView zone={selectedZone} onBack={() => setSelectedZoneId(undefined)} />
      ) : (
        <ZonesOverview zones={data.zones} onOpenZone={(id) => setSelectedZoneId(id)} />
      )}
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

  if (!isAdmin && !can("analytics.smart")) {
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

          {/* Zones Analytics */}
          <Card className="border-border bg-card">
            <CardContent className="p-5">
              <ZonesAnalyticsCard />
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

          {/* Cash Flow */}
          <Card className="border-border bg-card">
            <CardContent className="p-5">
              <CashFlowSection />
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

