import { useState, useMemo, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { format } from "date-fns";
import { Package, Printer, ChevronDown, ChevronUp, AlertTriangle, RefreshCw, ListFilter, X, CheckCircle2, Sparkles, Users, Clock, BadgeDollarSign, Boxes, ChevronRight, CircleDashed } from "lucide-react";
import { ordersApi } from "@/lib/api";
import type { InventoryShortageItem, FeasibleOrder, FeasibleInvoicesResponse } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FaWhatsapp } from "react-icons/fa";
import { WhatsAppDialog } from "@/components/whatsapp-dialog";
import { type WhatsAppOrderData } from "@/lib/whatsapp";

type SortKey = "qty" | "orders" | "revenue" | "name" | "color" | "size";
type SortDir = "desc" | "asc";

const formatCurrency = (n: number) =>
  new Intl.NumberFormat("ar-EG", { style: "currency", currency: "EGP", maximumFractionDigits: 0 }).format(n);

// ── بطاقة ملخص علوية ──────────────────────────────────────────────────────────
function SummaryCard({ label, value, sub, color }: { label: string; value: string | number; sub?: string; color: string }) {
  return (
    <div
      className="relative overflow-hidden rounded-2xl p-4 flex flex-col gap-1"
      style={{
        background: `linear-gradient(145deg, ${color}22 0%, ${color}0a 100%)`,
        border: `1px solid ${color}40`,
        boxShadow: `0 4px 20px ${color}18`,
      }}
    >
      <p className="text-[11px] font-semibold tracking-wide uppercase opacity-60">{label}</p>
      <p className="text-3xl font-black" style={{ color }}>{value}</p>
      {sub && <p className="text-[10px] opacity-50">{sub}</p>}
    </div>
  );
}

// ── صف منتج قابل للتوسع ───────────────────────────────────────────────────────
function ShortageRow({ item, index }: { item: InventoryShortageItem; index: number }) {
  const [expanded, setExpanded] = useState(false);

  const urgencyColor = item.totalQty >= 10
    ? "rgb(239,68,68)"
    : item.totalQty >= 5
    ? "rgb(249,115,22)"
    : "rgb(234,179,8)";

  return (
    <>
      <tr
        className="border-b border-border/50 hover:bg-muted/10 cursor-pointer transition-colors"
        onClick={() => setExpanded(v => !v)}
      >
        <td className="py-3 px-4 text-center">
          <span className="text-xs font-bold text-muted-foreground">#{index + 1}</span>
        </td>
        <td className="py-3 px-4">
          <span className="font-bold text-sm text-foreground">{item.product}</span>
        </td>
        <td className="py-3 px-4 text-center text-sm font-semibold text-muted-foreground">
          {item.color || "—"}
        </td>
        <td className="py-3 px-4 text-center text-sm font-semibold text-muted-foreground">
          {item.size || "—"}
        </td>
        <td className="py-3 px-4 text-center">
          <span
            className="inline-flex items-center justify-center w-12 h-8 rounded-xl text-lg font-black"
            style={{
              color: urgencyColor,
              background: urgencyColor.replace("rgb(", "rgba(").replace(")", ",0.12)"),
            }}
          >
            {item.totalQty}
          </span>
        </td>
        <td className="py-3 px-4 text-center">
          <Badge variant="outline" className="text-xs font-bold">
            {item.orderCount} طلب
          </Badge>
        </td>
        <td className="py-3 px-4 text-center text-sm font-semibold text-muted-foreground">
          {item.customerCount} عميل
        </td>
        <td className="py-3 px-4 text-center text-sm font-bold text-primary">
          {formatCurrency(item.totalRevenue)}
        </td>
        <td className="py-3 px-4 text-center">
          <button className="p-1 rounded hover:bg-muted/30 transition-colors">
            {expanded
              ? <ChevronUp className="w-4 h-4 text-muted-foreground" />
              : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
          </button>
        </td>
      </tr>
      {expanded && (
        <tr className="bg-muted/5">
          <td colSpan={9} className="px-6 pb-3 pt-2">
            <div className="rounded-xl border border-border/40 overflow-hidden">
              <table className="w-full text-xs" dir="rtl">
                <thead>
                  <tr className="bg-muted/30 text-muted-foreground">
                    <th className="py-2 px-3 text-right font-semibold">العميل</th>
                    <th className="py-2 px-3 text-center font-semibold">الكمية</th>
                    <th className="py-2 px-3 text-center font-semibold">رقم الفاتورة</th>
                    <th className="py-2 px-3 text-center font-semibold">تاريخ الطلب</th>
                  </tr>
                </thead>
                <tbody>
                  {item.customers.map((c) => (
                    <tr key={c.id} className="border-t border-border/20 hover:bg-muted/10">
                      <td className="py-2 px-3">
                        <div>
                          <p className="font-bold text-foreground">{c.customerName}</p>
                          {c.phone && <p className="text-muted-foreground text-[10px]">{c.phone}</p>}
                        </div>
                      </td>
                      <td className="py-2 px-3 text-center font-bold text-foreground">{c.quantity}</td>
                      <td className="py-2 px-3 text-center text-muted-foreground font-mono text-[10px]">
                        {c.invoiceNumber ?? "—"}
                      </td>
                      <td className="py-2 px-3 text-center text-muted-foreground">
                        {format(new Date(c.createdAt), "yyyy/MM/dd")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// ✅ قسم الفواتير المتاحة — Greedy Revenue Maximization
// ══════════════════════════════════════════════════════════════════════════════
function FeasibleInvoicesSection({ data, isLoading }: { data: FeasibleInvoicesResponse | undefined; isLoading: boolean }) {
  const [subTab, setSubTab] = useState<"feasible" | "skipped">("feasible");
  const [search, setSearch] = useState("");
  const [waOrder, setWaOrder] = useState<WhatsAppOrderData | null>(null);
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();

  const updateOrder = useMutation({
    mutationFn: ({ id, data }: { id: number; data: { status: string } }) =>
      ordersApi.updateOrder(id, data as any),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["feasible-invoices"] });
      queryClient.invalidateQueries({ queryKey: ["inventory-shortage"] });
    },
  });

  const fc = formatCurrency;

  const openWhatsApp = (order: FeasibleOrder) => {
    const itemsText = (order.items ?? [])
      .map(it => `${it.product}${it.color ? ` - ${it.color}` : ""}${it.size ? ` / ${it.size}` : ""} ×${it.quantity}`)
      .join("، ");
    setWaOrder({
      id: order.id,
      customerName: order.customerName,
      product: itemsText,
      quantity: (order.items ?? []).reduce((s, it) => s + it.quantity, 0),
      totalPrice: (order.totalPrice ?? 0) + (order.shippingCost ?? 0),
      status: "pending",
      phone: order.phone ?? null,
    });
  };

  const handleWaSent = async () => {
    if (!waOrder) return;
    await updateOrder.mutateAsync({ id: waOrder.id, data: { status: "warehouse_ready" } });
    setWaOrder(null);
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3 text-muted-foreground">
        <RefreshCw className="w-7 h-7 animate-spin" />
        <span className="text-sm">جاري تحليل المخزون وحساب أفضل إيراد...</span>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-2 text-muted-foreground">
        <CircleDashed className="w-9 h-9" />
        <span className="text-sm">لا توجد بيانات</span>
      </div>
    );
  }

  const { feasibleOrders, skippedOrders, summary } = data;

  const filteredFeasible = feasibleOrders.filter(o =>
    !search || o.customerName.includes(search) || (o.items ?? []).some(it => it.product.includes(search)) || (o.invoiceNumber ?? "").includes(search)
  );
  const filteredSkipped = skippedOrders.filter(o =>
    !search || o.customerName.includes(search) || (o.items ?? []).some(it => it.product.includes(search)) || (o.invoiceNumber ?? "").includes(search)
  );

  // تراكم الإيراد لبار التقدم
  let cum = 0;
  const feasibleWithCum = filteredFeasible.map(o => {
    cum += (o.totalPrice ?? 0) + (o.shippingCost ?? 0);
    return { ...o, cum };
  });

  const coveragePct = summary.feasibleCount + summary.skippedCount > 0
    ? Math.round((summary.feasibleCount / (summary.feasibleCount + summary.skippedCount)) * 100)
    : 0;

  return (
    <div className="space-y-4" dir="rtl">

      {/* ── KPI Cards ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="rounded-2xl p-4 flex flex-col gap-1" style={{ background: "linear-gradient(145deg,rgba(16,185,129,.15),rgba(16,185,129,.05))", border: "1px solid rgba(16,185,129,.3)" }}>
          <div className="flex items-center gap-1.5 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
            <BadgeDollarSign className="w-4 h-4" /> أعلى إيراد ممكن
          </div>
          <p className="text-2xl font-black text-emerald-700 dark:text-emerald-300">{fc(summary.totalRevenue)}</p>
          <p className="text-[10px] text-emerald-600/60 dark:text-emerald-500">{summary.feasibleCount} فاتورة قابلة للتحضير</p>
        </div>

        <div className="rounded-2xl p-4 flex flex-col gap-1" style={{ background: "linear-gradient(145deg,rgba(59,130,246,.15),rgba(59,130,246,.05))", border: "1px solid rgba(59,130,246,.3)" }}>
          <div className="flex items-center gap-1.5 text-[11px] font-semibold text-blue-600 dark:text-blue-400">
            <Users className="w-4 h-4" /> العملاء الجاهزون
          </div>
          <p className="text-2xl font-black text-blue-700 dark:text-blue-300">{summary.feasibleCount}</p>
          <p className="text-[10px] text-blue-600/60 dark:text-blue-500">{summary.totalQty} قطعة إجمالي</p>
        </div>

        <div className="rounded-2xl p-4 flex flex-col gap-1" style={{ background: "linear-gradient(145deg,rgba(245,158,11,.15),rgba(245,158,11,.05))", border: "1px solid rgba(245,158,11,.3)" }}>
          <div className="flex items-center gap-1.5 text-[11px] font-semibold text-amber-600 dark:text-amber-400">
            <Clock className="w-4 h-4" /> إيراد معلّق
          </div>
          <p className="text-2xl font-black text-amber-700 dark:text-amber-300">{fc(summary.skippedRevenue ?? 0)}</p>
          <p className="text-[10px] text-amber-600/60 dark:text-amber-500">{summary.skippedCount} طلب ينتظر المخزون</p>
        </div>

        <div className="rounded-2xl p-4 flex flex-col gap-1" style={{ background: "linear-gradient(145deg,rgba(139,92,246,.15),rgba(139,92,246,.05))", border: "1px solid rgba(139,92,246,.3)" }}>
          <div className="flex items-center gap-1.5 text-[11px] font-semibold text-violet-600 dark:text-violet-400">
            <Sparkles className="w-4 h-4" /> نسبة التغطية
          </div>
          <p className="text-2xl font-black text-violet-700 dark:text-violet-300">{coveragePct}%</p>
          <p className="text-[10px] text-violet-600/60 dark:text-violet-500">من إجمالي الطلبات المعلقة</p>
        </div>
      </div>

      {/* ── Insight bar ── */}
      {summary.feasibleCount > 0 && (
        <div className="flex items-start gap-2 rounded-xl px-4 py-3 text-sm text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800/40">
          <Sparkles className="w-4 h-4 mt-0.5 shrink-0" />
          <span>
            الخوارزمية رتّبت الطلبات بأعلى إيراد أولاً وخصمت من المخزون تدريجياً —
            يمكن تحضير <strong>{summary.feasibleCount}</strong> فاتورة بإيراد إجمالي <strong>{fc(summary.totalRevenue)}</strong> من المخزون الحالي دون الحاجة لشراء إضافي.
          </span>
        </div>
      )}

      {/* ── Sub-tabs + Search ── */}
      <Card className="border-border overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 px-4 py-3 border-b border-border bg-muted/5">
          {/* Sub-tabs */}
          <div className="flex rounded-lg overflow-hidden border border-border text-xs font-bold">
            <button
              onClick={() => setSubTab("feasible")}
              className={`px-4 py-2 flex items-center gap-1.5 transition-colors ${subTab === "feasible" ? "bg-emerald-600 text-white" : "bg-card text-muted-foreground hover:bg-muted/50"}`}
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              جاهزة للتحضير ({summary.feasibleCount})
            </button>
            <button
              onClick={() => setSubTab("skipped")}
              className={`px-4 py-2 flex items-center gap-1.5 transition-colors ${subTab === "skipped" ? "bg-amber-500 text-white" : "bg-card text-muted-foreground hover:bg-muted/50"}`}
            >
              <AlertTriangle className="w-3.5 h-3.5" />
              تحتاج مخزون ({summary.skippedCount})
            </button>
          </div>
          {/* Search */}
          <div className="relative flex-1 max-w-sm">
            <input
              type="text"
              placeholder="بحث بالعميل / المنتج / الفاتورة..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full text-xs rounded-lg border border-border bg-background px-3 py-2 pr-3 focus:outline-none focus:ring-1 focus:ring-primary/30 placeholder:text-muted-foreground/60"
            />
            {search && (
              <button onClick={() => setSearch("")} className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground/60 hover:text-foreground">
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* ── قائمة الطلبات ── */}
        {subTab === "feasible" ? (
          feasibleWithCum.length === 0 ? (
            <div className="py-16 text-center text-muted-foreground">
              <CheckCircle2 className="w-10 h-10 mx-auto mb-2 text-emerald-400" />
              <p className="text-sm">لا توجد نتائج</p>
            </div>
          ) : (
            <div className="divide-y divide-border/40">
              {feasibleWithCum.map((order, idx) => {
                const revenue = (order.totalPrice ?? 0) + (order.shippingCost ?? 0);
                const pct = summary.totalRevenue > 0 ? Math.round((order.cum / summary.totalRevenue) * 100) : 0;
                return (
                  <div key={order.id} className="flex items-start gap-4 px-5 py-4 hover:bg-muted/20 transition-colors">
                    {/* الترتيب */}
                    <div className={`shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-black mt-0.5 ${idx < 3 ? "bg-emerald-500 text-white" : "bg-muted text-muted-foreground"}`}>
                      {idx + 1}
                    </div>
                    {/* التفاصيل */}
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <span className="font-black text-sm text-foreground">{order.customerName}</span>
                        {order.invoiceNumber && (
                          <button
                            onClick={() => navigate(`/invoices/${order.invoiceNumber}`)}
                            className="text-[10px] font-mono border border-primary/40 px-1.5 py-0.5 rounded bg-primary/10 text-primary hover:bg-primary/20 transition-colors cursor-pointer"
                          >
                            #{order.invoiceNumber}
                          </button>
                        )}
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/40">
                          ✅ جاهز للشحن
                        </span>
                      </div>
                      <div className="flex flex-col gap-1 mb-2">
                        {(order.items ?? []).map((it, i) => (
                          <div key={i} className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                            <span className="font-semibold text-foreground/80">{it.product}</span>
                            {it.color && <span className="bg-muted px-1.5 py-0.5 rounded text-[10px]">{it.color}</span>}
                            {it.size && <span className="bg-muted px-1.5 py-0.5 rounded text-[10px]">{it.size}</span>}
                            <span>× {it.quantity} قطعة</span>
                          </div>
                        ))}
                      </div>
                      {/* بار تراكم الإيراد */}
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                          <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${pct}%` }} />
                        </div>
                        <span className="text-[9px] text-muted-foreground shrink-0">{pct}% تراكمي</span>
                      </div>
                    </div>
                    {/* الإيراد + واتساب */}
                    <div className="shrink-0 flex flex-col items-end gap-2">
                      <span className="text-base font-black text-emerald-700 dark:text-emerald-400">{fc(revenue)}</span>
                      {order.phone ? (
                        <button
                          onClick={() => openWhatsApp(order)}
                          className="flex items-center gap-1.5 text-[11px] font-bold text-white bg-[#25D366] hover:bg-[#1DA851] px-3 py-1.5 rounded-lg transition-colors"
                        >
                          <FaWhatsapp className="w-3.5 h-3.5" />
                          واتساب
                        </button>
                      ) : (
                        <span className="text-[10px] text-muted-foreground/50">لا يوجد رقم</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )
        ) : (
          /* ── طلبات تحتاج مخزون ── */
          filteredSkipped.length === 0 ? (
            <div className="py-16 text-center text-muted-foreground">
              <CheckCircle2 className="w-10 h-10 mx-auto mb-2 text-emerald-400" />
              <p className="text-sm font-semibold">ما فيش طلبات معلّقة 🎉</p>
            </div>
          ) : (
            <div className="divide-y divide-border/40">
              {filteredSkipped.map((order) => {
                const revenue = (order.totalPrice ?? 0) + (order.shippingCost ?? 0);
                return (
                  <div key={order.id} className="flex items-start gap-4 px-5 py-4 hover:bg-muted/20 transition-colors">
                    <div className="shrink-0 w-7 h-7 rounded-full bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center mt-0.5">
                      <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <span className="font-black text-sm text-foreground">{order.customerName}</span>
                        {order.invoiceNumber && (
                          <span className="text-[10px] font-mono border border-border/60 px-1.5 py-0.5 rounded bg-muted/40 text-muted-foreground">
                            #{order.invoiceNumber}
                          </span>
                        )}
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800/40">
                          ⚠ {order.reasonAr}
                        </span>
                      </div>
                      <div className="flex flex-col gap-1">
                        {(order.items ?? []).map((it, i) => (
                          <div key={i} className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                            <span className="font-semibold text-foreground/80">{it.product}</span>
                            {it.color && <span className="bg-muted px-1.5 py-0.5 rounded text-[10px]">{it.color}</span>}
                            {it.size && <span className="bg-muted px-1.5 py-0.5 rounded text-[10px]">{it.size}</span>}
                            <span>× {it.quantity} قطعة</span>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="shrink-0 flex flex-col items-end gap-2">
                      <span className="text-base font-black text-amber-700 dark:text-amber-400">{fc(revenue)}</span>
                      {order.phone ? (
                        <button
                          onClick={() => openWhatsApp(order)}
                          className="flex items-center gap-1.5 text-[11px] font-bold text-white bg-[#25D366] hover:bg-[#1DA851] px-3 py-1.5 rounded-lg transition-colors"
                        >
                          <FaWhatsapp className="w-3.5 h-3.5" />
                          واتساب
                        </button>
                      ) : (
                        <span className="text-[10px] text-muted-foreground/50">لا يوجد رقم</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )
        )}

        {/* ── تقرير استخدام المخزون ── */}
        {summary.stockUsage.length > 0 && (
          <div className="border-t border-border bg-muted/20 px-5 py-3">
            <p className="text-[11px] font-semibold text-muted-foreground mb-2 flex items-center gap-1.5">
              <Boxes className="w-3.5 h-3.5" />
              الأصناف المستخدمة من المخزون في التحضير المقترح
            </p>
            <div className="flex flex-wrap gap-2">
              {summary.stockUsage.map((s, i) => (
                <div key={i} className="text-[10px] border border-border/60 rounded-lg px-2.5 py-1 bg-card flex items-center gap-1.5">
                  <span className="font-bold">{s.product}</span>
                  {s.color && <span className="text-muted-foreground">{s.color}</span>}
                  {s.size && <span className="text-muted-foreground">/{s.size}</span>}
                  <ChevronRight className="w-3 h-3 text-muted-foreground/50" />
                  <span className="text-red-500 font-black">-{s.used}</span>
                  <span className="text-muted-foreground">({s.remaining} متبقي)</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </Card>

      {/* ── WhatsApp Dialog ── */}
      {waOrder && (
        <WhatsAppDialog
          order={waOrder}
          open={!!waOrder}
          onOpenChange={(open) => { if (!open) setWaOrder(null); }}
          onSent={handleWaSent}
        />
      )}
    </div>
  );
}

// ── الصفحة الرئيسية ───────────────────────────────────────────────────────────
export default function InventoryShortagePage() {
  const [activeTab, setActiveTab] = useState<"shortage" | "feasible">("shortage");
  const [showFilter, setShowFilter] = useState(false);
  // فلتر لكل عمود
  const [fProduct, setFProduct]   = useState("");
  const [fColor, setFColor]       = useState("");
  const [fSize, setFSize]         = useState("");
  const [fQty, setFQty]           = useState("");
  const [fOrders, setFOrders]     = useState("");
  const [fCustomers, setFCustomers] = useState("");
  const [fRevenue, setFRevenue]   = useState("");
  const [sortKey, setSortKey]     = useState<SortKey>("qty");
  const [sortDir, setSortDir]     = useState<SortDir>("desc");
  const printRef = useRef<HTMLDivElement>(null);

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ["inventory-shortage"],
    queryFn: () => ordersApi.inventoryShortage(),
    staleTime: 30_000,
  });

  const { data: feasibleData, isLoading: feasibleLoading } = useQuery({
    queryKey: ["feasible-invoices"],
    queryFn: () => ordersApi.feasibleInvoices(),
    staleTime: 30_000,
    enabled: activeTab === "feasible",
  });

  // القيم الفريدة لكل عمود للـ dropdown
  const uniq = useMemo(() => {
    const items = data?.items ?? [];
    return {
      products:  Array.from(new Set(items.map(i => i.product))).sort((a,b) => a.localeCompare(b,"ar")),
      colors:    Array.from(new Set(items.map(i => i.color).filter((v): v is string => !!v))).sort((a,b) => a.localeCompare(b,"ar")),
      sizes:     Array.from(new Set(items.map(i => i.size).filter((v): v is string => !!v))).sort((a,b) => a.localeCompare(b,"ar")),
      qtys:      Array.from(new Set(items.map(i => String(i.totalQty)))).sort((a,b) => Number(a)-Number(b)),
      orders:    Array.from(new Set(items.map(i => String(i.orderCount)))).sort((a,b) => Number(a)-Number(b)),
      customers: Array.from(new Set(items.map(i => String(i.customerCount)))).sort((a,b) => Number(a)-Number(b)),
      revenues:  Array.from(new Set(items.map(i => formatCurrency(i.totalRevenue)))),
    };
  }, [data?.items]);

  const hasActiveFilter = fProduct || fColor || fSize || fQty || fOrders || fCustomers || fRevenue;

  const clearFilters = () => { setFProduct(""); setFColor(""); setFSize(""); setFQty(""); setFOrders(""); setFCustomers(""); setFRevenue(""); };

  const toggleFilter = () => {
    if (showFilter && hasActiveFilter) clearFilters();
    setShowFilter(v => !v);
  };

  const filtered = useMemo(() => {
    let items = data?.items ?? [];
    if (fProduct)   items = items.filter(i => i.product === fProduct);
    if (fColor)     items = items.filter(i => i.color === fColor);
    if (fSize)      items = items.filter(i => i.size === fSize);
    if (fQty)       items = items.filter(i => String(i.totalQty) === fQty);
    if (fOrders)    items = items.filter(i => String(i.orderCount) === fOrders);
    if (fCustomers) items = items.filter(i => String(i.customerCount) === fCustomers);
    if (fRevenue)   items = items.filter(i => formatCurrency(i.totalRevenue) === fRevenue);
    return [...items].sort((a, b) => {
      let d = 0;
      if (sortKey === "qty")     d = a.totalQty - b.totalQty;
      if (sortKey === "orders")  d = a.orderCount - b.orderCount;
      if (sortKey === "revenue") d = a.totalRevenue - b.totalRevenue;
      if (sortKey === "name")    d = a.product.localeCompare(b.product, "ar");
      if (sortKey === "color")   d = (a.color ?? "").localeCompare(b.color ?? "", "ar");
      if (sortKey === "size")    d = (a.size ?? "").localeCompare(b.size ?? "", "ar");
      return sortDir === "desc" ? -d : d;
    });
  }, [data?.items, fProduct, fColor, fSize, fQty, fOrders, fCustomers, fRevenue, sortKey, sortDir]);

  const toggleSort = (k: SortKey) => {
    if (sortKey === k) setSortDir(d => d === "desc" ? "asc" : "desc");
    else { setSortKey(k); setSortDir("desc"); }
  };

  const handlePrint = () => {
    const printContent = printRef.current;
    if (!printContent) return;
    const win = window.open("", "_blank", "width=900,height=700");
    if (!win) return;
    win.document.write(`<!DOCTYPE html><html dir="rtl" lang="ar"><head>
      <meta charset="UTF-8"/>
      <title>نواقص المخزن</title>
      <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: 'Segoe UI', Tahoma, Arial, sans-serif; padding: 28px; color: #111; background: #fff; direction: rtl; }
        h1 { font-size: 30px; font-weight: 900; margin-bottom: 6px; color: #1a1a1a; }
        .subtitle { font-size: 14px; color: #666; margin-bottom: 24px; }
        .summary { display: flex; gap: 18px; margin-bottom: 24px; flex-wrap: wrap; }
        .sum-card { background: #f8f9fa; border: 1px solid #e0e0e0; border-radius: 10px; padding: 14px 22px; min-width: 160px; }
        .sum-card .label { font-size: 13px; color: #888; text-transform: uppercase; letter-spacing: 0.06em; }
        .sum-card .val { font-size: 30px; font-weight: 900; color: #1a1a1a; }
        table { width: 100%; border-collapse: collapse; font-size: 18px; }
        thead tr { background: #f1f3f5; }
        th { padding: 14px 16px; text-align: right; font-weight: 700; color: #444; border-bottom: 2px solid #dee2e6; font-size: 16px; }
        td { padding: 13px 16px; border-bottom: 1px solid #eee; vertical-align: top; }
        .qty-badge { display: inline-block; min-width: 44px; text-align: center; font-weight: 900; font-size: 20px; padding: 3px 10px; border-radius: 8px; }
        .high { color: #dc2626; background: #fee2e2; }
        .med  { color: #ea580c; background: #ffedd5; }
        .low  { color: #ca8a04; background: #fef9c3; }
        @media print { body { padding: 16px; } }
      </style>
    </head><body>`);

    // ملخص
    const s = data?.summary;
    win.document.write(`<h1>🗂️ نواقص المخزن</h1>`);
    win.document.write(`<p class="subtitle">تاريخ الطباعة: ${format(new Date(), "yyyy/MM/dd — HH:mm")}</p>`);
    win.document.write(`<div class="summary">
      <div class="sum-card"><div class="label">إجمالي المنتجات</div><div class="val">${s?.totalDistinctProducts ?? 0}</div></div>
      <div class="sum-card"><div class="label">إجمالي الكميات</div><div class="val">${s?.totalQty ?? 0}</div></div>
      <div class="sum-card"><div class="label">الطلبات المعلقة</div><div class="val">${s?.totalPendingOrders ?? 0}</div></div>
    </div>`);

    // جدول
    win.document.write(`<table><thead><tr>
      <th>#</th><th>المنتج</th><th>اللون</th><th>المقاس</th><th>الكمية المطلوبة</th>
    </tr></thead><tbody>`);

    filtered.forEach((item, idx) => {
      const qClass = item.totalQty >= 10 ? "high" : item.totalQty >= 5 ? "med" : "low";
      win.document.write(`<tr>
        <td>${idx + 1}</td>
        <td><strong>${item.product}</strong></td>
        <td>${item.color || "—"}</td>
        <td>${item.size || "—"}</td>
        <td><span class="qty-badge ${qClass}">${item.totalQty}</span></td>
      </tr>`);
    });

    win.document.write(`</tbody></table></body></html>`);
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 400);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]" dir="rtl">
        <div className="flex flex-col items-center gap-3">
          <div className="w-7 h-7 rounded-full border-2 border-primary border-t-transparent animate-spin" />
          <p className="text-xs text-muted-foreground">جاري تحميل البيانات...</p>
        </div>
      </div>
    );
  }

  const summary = data?.summary;

  return (
    <div className="space-y-5 animate-in fade-in duration-500" dir="rtl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <AlertTriangle className="w-6 h-6 text-red-400" />
            نواقص المخزن
          </h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            جرد الطلبات قيد الانتظار — الكميات المطلوبة من كل منتج
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="gap-1.5 text-xs h-9" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? "animate-spin" : ""}`} />
            تحديث
          </Button>
          <Button
            size="sm"
            onClick={toggleFilter}
            className={`gap-1.5 text-xs h-9 transition-colors ${showFilter ? "bg-primary text-primary-foreground" : "bg-muted/40 text-foreground hover:bg-muted/70 border border-border"}`}
            variant="outline"
          >
            <ListFilter className="w-3.5 h-3.5" />
            {showFilter ? (hasActiveFilter ? "إلغاء الفلتر" : "إخفاء الفلتر") : "إنشاء فلتر"}
            {hasActiveFilter && !showFilter && (
              <span className="bg-primary text-primary-foreground text-[9px] font-black rounded-full w-4 h-4 flex items-center justify-center">
                {[fProduct,fColor,fSize,fQty,fOrders,fCustomers,fRevenue].filter(Boolean).length}
              </span>
            )}
          </Button>
          <Button size="sm" className="gap-1.5 text-xs h-9 bg-primary text-primary-foreground" onClick={handlePrint} disabled={!filtered.length}>
            <Printer className="w-3.5 h-3.5" />
            طباعة
          </Button>
        </div>
      </div>

      {/* ── Tab Switcher ── */}
      <div className="flex rounded-xl overflow-hidden border border-border w-fit text-sm font-bold shadow-sm">
        <button
          onClick={() => setActiveTab("shortage")}
          className={`flex items-center gap-2 px-5 py-2.5 transition-colors ${activeTab === "shortage" ? "bg-red-600 text-white" : "bg-card text-muted-foreground hover:bg-muted/50"}`}
        >
          <AlertTriangle className="w-4 h-4" />
          نواقص المخزن
        </button>
        <button
          onClick={() => setActiveTab("feasible")}
          className={`flex items-center gap-2 px-5 py-2.5 transition-colors ${activeTab === "feasible" ? "bg-emerald-600 text-white" : "bg-card text-muted-foreground hover:bg-muted/50"}`}
        >
          <Sparkles className="w-4 h-4" />
          الفواتير المتاحة
        </button>
      </div>

      {/* ── Feasible Tab ── */}
      {activeTab === "feasible" && (
        <FeasibleInvoicesSection data={feasibleData} isLoading={feasibleLoading} />
      )}

      {/* ── Shortage Tab ── */}
      {activeTab === "shortage" && <>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <SummaryCard label="منتجات مختلفة" value={summary?.totalDistinctProducts ?? 0} sub="منتج" color="rgb(239,68,68)" />
        <SummaryCard label="إجمالي الكميات" value={summary?.totalQty ?? 0} sub="قطعة مطلوبة" color="rgb(249,115,22)" />
        <SummaryCard label="طلبات معلقة" value={summary?.totalPendingOrders ?? 0} sub="طلب" color="rgb(234,179,8)" />
        <SummaryCard label="إجمالي الإيرادات" value={formatCurrency(summary?.totalRevenue ?? 0)} sub="قيمة الطلبات" color="rgb(59,130,246)" />
      </div>

      {/* Table */}
      <Card className="border-border overflow-hidden" ref={printRef}>
        {filtered.length === 0 && !hasActiveFilter ? (
          <div className="py-16 text-center">
            <Package className="w-12 h-12 mx-auto text-muted-foreground/30 mb-3" />
            <p className="text-muted-foreground font-semibold">لا توجد طلبات قيد الانتظار 🎉</p>
            <p className="text-xs text-muted-foreground mt-1">كل الطلبات تمت معالجتها</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm" dir="rtl">
              <thead>
                {/* ── Row 1: عناوين الأعمدة ── */}
                <tr className="border-b border-border bg-muted/10">
                  <th className="py-3 px-4 text-center text-xs text-muted-foreground font-semibold w-12">#</th>

                  {/* المنتج */}
                  <th className="py-3 px-4 text-right text-xs text-muted-foreground font-semibold">
                    <button onClick={() => toggleSort("name")} className="flex items-center gap-1 hover:text-foreground transition-colors">
                      المنتج
                      <span className="opacity-50">{sortKey==="name" ? (sortDir==="desc"?"↓":"↑") : "↕"}</span>
                    </button>
                  </th>

                  {/* اللون */}
                  <th className="py-3 px-4 text-center text-xs text-muted-foreground font-semibold">
                    <button onClick={() => toggleSort("color")} className="flex items-center gap-1 mx-auto hover:text-foreground transition-colors">
                      اللون
                      <span className="opacity-50">{sortKey==="color" ? (sortDir==="desc"?"↓":"↑") : "↕"}</span>
                    </button>
                  </th>

                  {/* المقاس */}
                  <th className="py-3 px-4 text-center text-xs text-muted-foreground font-semibold">
                    <button onClick={() => toggleSort("size")} className="flex items-center gap-1 mx-auto hover:text-foreground transition-colors">
                      المقاس
                      <span className="opacity-50">{sortKey==="size" ? (sortDir==="desc"?"↓":"↑") : "↕"}</span>
                    </button>
                  </th>

                  {/* الكمية */}
                  <th className="py-3 px-4 text-center text-xs text-muted-foreground font-semibold">
                    <button onClick={() => toggleSort("qty")} className="flex items-center gap-1 mx-auto hover:text-foreground transition-colors">
                      الكمية المطلوبة
                      <span className="opacity-50">{sortKey==="qty" ? (sortDir==="desc"?"↓":"↑") : "↕"}</span>
                    </button>
                  </th>

                  {/* الطلبات */}
                  <th className="py-3 px-4 text-center text-xs text-muted-foreground font-semibold">
                    <button onClick={() => toggleSort("orders")} className="flex items-center gap-1 mx-auto hover:text-foreground transition-colors">
                      عدد الطلبات
                      <span className="opacity-50">{sortKey==="orders" ? (sortDir==="desc"?"↓":"↑") : "↕"}</span>
                    </button>
                  </th>

                  {/* العملاء */}
                  <th className="py-3 px-4 text-center text-xs text-muted-foreground font-semibold">العملاء</th>

                  {/* القيمة */}
                  <th className="py-3 px-4 text-center text-xs text-muted-foreground font-semibold">
                    <button onClick={() => toggleSort("revenue")} className="flex items-center gap-1 mx-auto hover:text-foreground transition-colors">
                      قيمة الطلبات
                      <span className="opacity-50">{sortKey==="revenue" ? (sortDir==="desc"?"↓":"↑") : "↕"}</span>
                    </button>
                  </th>

                  <th className="py-3 px-4 w-10"></th>
                </tr>

                {/* ── Row 2: فلاتر الأعمدة (Excel-style) ── */}
                {showFilter && (
                  <tr className="border-b-2 border-primary/30 bg-primary/5">
                    <td className="px-2 py-1.5 text-center">
                      {hasActiveFilter && (
                        <button onClick={clearFilters} title="مسح كل الفلاتر"
                          className="w-6 h-6 flex items-center justify-center rounded-md bg-red-100 dark:bg-red-900/30 text-red-500 hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors mx-auto">
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </td>

                    {/* فلتر المنتج */}
                    <td className="px-2 py-1.5">
                      <select value={fProduct} onChange={e => setFProduct(e.target.value)}
                        className={`w-full h-7 text-xs rounded-lg border px-2 focus:outline-none focus:ring-1 focus:ring-primary transition-colors ${fProduct ? "border-primary bg-primary/5 font-bold" : "border-border/50 bg-background/80"}`}>
                        <option value="">كل المنتجات</option>
                        {uniq.products.map(p => <option key={p} value={p}>{p}</option>)}
                      </select>
                    </td>

                    {/* فلتر اللون */}
                    <td className="px-2 py-1.5">
                      <select value={fColor} onChange={e => setFColor(e.target.value)}
                        className={`w-full h-7 text-xs rounded-lg border px-2 focus:outline-none focus:ring-1 focus:ring-primary transition-colors ${fColor ? "border-primary bg-primary/5 font-bold" : "border-border/50 bg-background/80"}`}>
                        <option value="">كل الألوان</option>
                        {uniq.colors.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </td>

                    {/* فلتر المقاس */}
                    <td className="px-2 py-1.5">
                      <select value={fSize} onChange={e => setFSize(e.target.value)}
                        className={`w-full h-7 text-xs rounded-lg border px-2 focus:outline-none focus:ring-1 focus:ring-primary transition-colors ${fSize ? "border-primary bg-primary/5 font-bold" : "border-border/50 bg-background/80"}`}>
                        <option value="">كل المقاسات</option>
                        {uniq.sizes.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </td>

                    {/* فلتر الكمية */}
                    <td className="px-2 py-1.5">
                      <select value={fQty} onChange={e => setFQty(e.target.value)}
                        className={`w-full h-7 text-xs rounded-lg border px-2 focus:outline-none focus:ring-1 focus:ring-primary transition-colors ${fQty ? "border-primary bg-primary/5 font-bold" : "border-border/50 bg-background/80"}`}>
                        <option value="">كل الكميات</option>
                        {uniq.qtys.map(v => <option key={v} value={v}>{v} قطعة</option>)}
                      </select>
                    </td>

                    {/* فلتر الطلبات */}
                    <td className="px-2 py-1.5">
                      <select value={fOrders} onChange={e => setFOrders(e.target.value)}
                        className={`w-full h-7 text-xs rounded-lg border px-2 focus:outline-none focus:ring-1 focus:ring-primary transition-colors ${fOrders ? "border-primary bg-primary/5 font-bold" : "border-border/50 bg-background/80"}`}>
                        <option value="">كل الطلبات</option>
                        {uniq.orders.map(v => <option key={v} value={v}>{v} طلب</option>)}
                      </select>
                    </td>

                    {/* فلتر العملاء */}
                    <td className="px-2 py-1.5">
                      <select value={fCustomers} onChange={e => setFCustomers(e.target.value)}
                        className={`w-full h-7 text-xs rounded-lg border px-2 focus:outline-none focus:ring-1 focus:ring-primary transition-colors ${fCustomers ? "border-primary bg-primary/5 font-bold" : "border-border/50 bg-background/80"}`}>
                        <option value="">كل العملاء</option>
                        {uniq.customers.map(v => <option key={v} value={v}>{v} عميل</option>)}
                      </select>
                    </td>

                    {/* فلتر القيمة */}
                    <td className="px-2 py-1.5">
                      <select value={fRevenue} onChange={e => setFRevenue(e.target.value)}
                        className={`w-full h-7 text-xs rounded-lg border px-2 focus:outline-none focus:ring-1 focus:ring-primary transition-colors ${fRevenue ? "border-primary bg-primary/5 font-bold" : "border-border/50 bg-background/80"}`}>
                        <option value="">كل القيم</option>
                        {uniq.revenues.map(v => <option key={v} value={v}>{v}</option>)}
                      </select>
                    </td>

                    <td></td>
                  </tr>
                )}
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr><td colSpan={9} className="py-12 text-center text-sm text-muted-foreground">لا توجد نتائج مطابقة للفلتر</td></tr>
                ) : (
                  filtered.map((item, idx) => (
                    <ShortageRow key={`${item.product}||${item.color ?? ""}||${item.size ?? ""}`} item={item} index={idx} />
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {filtered.length > 0 && (
        <p className="text-xs text-muted-foreground text-center">
          {filtered.length} طلب • {filtered.reduce((s,i) => s+i.totalQty, 0)} قطعة — اضغط على أي صف لعرض تفاصيل العملاء
        </p>
      )}
      </> /* end shortage tab */}
    </div>
  );
}
