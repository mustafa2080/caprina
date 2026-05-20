import { useState } from "react";
import { useParams, Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ArrowRight, Users, TrendingUp, ChevronDown, ChevronUp,
  Calendar, ShoppingBag, Phone, MapPin,
  Clock, CheckCircle2, Target, Package,
} from "lucide-react";
import { format } from "date-fns";
import { apiFetch } from "@/lib/api";

const fmt = (n: string | number) =>
  new Intl.NumberFormat("ar-EG", {
    style: "currency", currency: "EGP", maximumFractionDigits: 0,
  }).format(Number(n));

// ── شريط تقدم المبيعات نحو الهدف ───────────────────────────────────────────
function SalesProgressBar({ sales, target }: { sales: number; target: number }) {
  if (target <= 0) return null;
  const pct = Math.min((sales / target) * 100, 100);
  return (
    <div className="w-full bg-muted rounded-full h-2 overflow-hidden mt-2">
      <div
        className="h-2 rounded-full transition-all duration-700"
        style={{
          width: `${pct}%`,
          background: pct >= 75 ? "#10b981" : pct >= 40 ? "#f59e0b" : "#26A69A",
        }}
      />
    </div>
  );
}

// ── أنواع البيانات ──────────────────────────────────────────────────────────
type OrderItem = {
  id: number;
  productName: string;
  color: string | null;
  size: string | null;
  quantity: number;
  unitPrice: string | number;
  createdAt?: string;
  updatedAt?: string;
};

type SaleOrder = {
  id: number; soNumber: string; status: string;
  totalAmount: string; paidAmount: string;
  createdAt: string; expectedDate: string | null;
  items?: OrderItem[];
};

type Client = {
  id: number; name: string; phone: string | null; phone2: string | null;
  email: string | null; address: string | null; city: string | null; region: string | null;
  creditLimit: string; totalOrders: number; totalSales: string; totalPaid: string;
  notes: string | null; isActive: boolean; createdAt: string;
};

type ClientDetail = Client & { orders: SaleOrder[] };

// ── حالات الفواتير ──────────────────────────────────────────────────────────
const INV_STATUS: Record<string, { label: string; barColor: string; badgeColor: string; icon: React.ReactNode }> = {
  processing: {
    label: "قيد التجهيز",
    barColor: "bg-amber-500",
    badgeColor: "border-amber-700 bg-amber-900/20 text-amber-400",
    icon: <Clock className="w-2.5 h-2.5 inline ml-0.5" />,
  },
  delivered: {
    label: "تم التسليم",
    barColor: "bg-emerald-500",
    badgeColor: "border-emerald-700 bg-emerald-900/20 text-emerald-400",
    icon: <CheckCircle2 className="w-2.5 h-2.5 inline ml-0.5" />,
  },
};

// ── بطاقة فاتورة البيع مع جدول بنود قابل للعرض ─────────────────────────────
function InvoiceCard({ order }: { order: SaleOrder }) {
  const [, navigate] = useLocation();
  const [expanded, setExpanded] = useState(false);

  const { data: detail, isLoading: itemsLoading } = useQuery<{ items: OrderItem[] }>({
    queryKey: ["sale-order-detail", order.id],
    queryFn: () => apiFetch<any>(`/finance/sale-orders/${order.id}`),
    enabled: expanded,
    staleTime: 60_000,
  });

  const s = INV_STATUS[order.status] ?? {
    label: order.status, barColor: "bg-muted",
    badgeColor: "border-border text-muted-foreground", icon: null,
  };
  const total  = parseFloat(order.totalAmount ?? "0");
  const paid   = parseFloat(order.paidAmount  ?? "0");
  const unpaid = total - paid;
  const isDelivered = order.status === "delivered";
  const items  = detail?.items ?? [];
  const totalQty = items.reduce((s, i) => s + (i.quantity ?? 0), 0);

  return (
    <div className={`flex items-stretch gap-0 rounded-lg border transition-colors ${
      isDelivered ? "border-border bg-card/50" : "border-amber-500/30 bg-amber-900/5"
    }`}>
      <div className={`w-1 rounded-r-lg shrink-0 ${s.barColor}`} />
      <div className="flex-1 min-w-0">
        {/* رأس البطاقة */}
        <div className="flex items-center px-4 py-3.5 gap-3">
          <div className="flex-1 min-w-0">
            <p className="font-black text-sm">{order.soNumber}</p>
            <span className="flex items-center gap-1 mt-0.5 text-[10px] text-muted-foreground">
              <Calendar className="w-2.5 h-2.5" />
              {format(new Date(order.createdAt), "yyyy/MM/dd")}
            </span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Badge variant="outline" className={`text-[9px] font-bold border ${s.badgeColor}`}>
              {s.icon}{s.label}
            </Badge>
            <Button variant="ghost" size="icon"
              className="h-6 w-6 text-teal-400 hover:bg-teal-500/10"
              title="عرض في فواتير البيع"
              onClick={() => navigate("/finance/sales")}>
              <ShoppingBag className="w-3.5 h-3.5" />
            </Button>
            <Button variant="ghost" size="icon"
              className="h-6 w-6 text-muted-foreground hover:text-foreground"
              onClick={() => setExpanded(e => !e)}>
              {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </Button>
          </div>
        </div>

        {/* ملخص الأرقام */}
        <div className="flex items-center gap-3 px-4 pb-3 text-[11px] flex-wrap">
          <span className="flex items-center gap-1 font-bold text-primary">
            <ShoppingBag className="w-3 h-3 text-muted-foreground" />{fmt(total)}
          </span>
          {paid > 0 && (
            <span className="text-emerald-400 flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" />مدفوع: {fmt(paid)}
            </span>
          )}
          {unpaid > 0 && <span className="text-rose-400">متبقي: {fmt(unpaid)}</span>}
          {expanded && totalQty > 0 && (
            <span className="flex items-center gap-1 text-muted-foreground mr-auto">
              <Package className="w-3 h-3" />إجمالي القطع: <strong className="text-foreground">{totalQty}</strong>
            </span>
          )}
        </div>

        {/* جدول البنود */}
        {expanded && (
          <div className="border-t border-border/50">
            {itemsLoading ? (
              <p className="text-xs text-muted-foreground py-4 text-center animate-pulse">جاري تحميل البنود…</p>
            ) : items.length === 0 ? (
              <p className="text-xs text-muted-foreground py-4 text-center">لا توجد بنود مسجلة</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr style={{ background: "hsl(var(--muted)/0.4)", borderBottom: "1px solid hsl(var(--border)/0.5)" }}>
                      <th className="text-right px-3 py-2 font-semibold">المنتج</th>
                      <th className="text-right px-3 py-2 font-semibold">اللون</th>
                      <th className="text-right px-3 py-2 font-semibold">المقاس</th>
                      <th className="text-center px-3 py-2 font-semibold">الكمية</th>
                      <th className="text-right px-3 py-2 font-semibold">سعر الوحدة</th>
                      <th className="text-right px-3 py-2 font-semibold">الإجمالي</th>
                      <th className="text-right px-3 py-2 font-semibold">تاريخ الإضافة</th>
                      <th className="text-right px-3 py-2 font-semibold">آخر تعديل</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item, idx) => {
                      const lineTotal = (item.quantity ?? 0) * parseFloat(String(item.unitPrice ?? 0));
                      return (
                        <tr key={item.id ?? idx} style={{
                          borderBottom: "1px solid hsl(var(--border)/0.3)",
                          background: idx % 2 === 0 ? "transparent" : "hsl(var(--muted)/0.1)",
                        }}>
                          <td className="px-3 py-2 font-medium">{item.productName || "—"}</td>
                          <td className="px-3 py-2 text-muted-foreground">{item.color || "—"}</td>
                          <td className="px-3 py-2 text-muted-foreground">{item.size || "—"}</td>
                          <td className="px-3 py-2 text-center font-bold text-teal-400">{item.quantity}</td>
                          <td className="px-3 py-2">{fmt(item.unitPrice ?? 0)}</td>
                          <td className="px-3 py-2 font-bold text-primary">{fmt(lineTotal)}</td>
                          <td className="px-3 py-2 text-muted-foreground">
                            {item.createdAt
                              ? format(new Date(item.createdAt), "yyyy/MM/dd")
                              : format(new Date(order.createdAt), "yyyy/MM/dd")}
                          </td>
                          <td className="px-3 py-2 text-muted-foreground">
                            {item.updatedAt ? format(new Date(item.updatedAt), "yyyy/MM/dd") : "—"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr style={{ borderTop: "2px solid hsl(var(--border))", background: "hsl(var(--muted)/0.2)" }}>
                      <td colSpan={3} className="px-3 py-2 font-bold text-muted-foreground">الإجمالي</td>
                      <td className="px-3 py-2 text-center font-black text-teal-400">{totalQty}</td>
                      <td />
                      <td className="px-3 py-2 font-black text-primary">{fmt(total)}</td>
                      <td colSpan={2} />
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── الصفحة الرئيسية ──────────────────────────────────────────────────────────
export default function CommercialClientDetailPage() {
  const params   = useParams();
  const clientId = Number(params.id);

  const { data, isLoading } = useQuery<ClientDetail>({
    queryKey: ["client-detail", clientId],
    queryFn: () => apiFetch<ClientDetail>(`/finance/clients/${clientId}`),
    enabled: !isNaN(clientId),
  });

  if (isNaN(clientId))
    return <div className="p-8 text-center text-muted-foreground">معرّف غير صحيح</div>;

  const client      = data;
  const creditLimit = parseFloat(client?.creditLimit ?? "0");
  const totalSales  = parseFloat(client?.totalSales  ?? "0");
  const totalPaid   = parseFloat(client?.totalPaid   ?? "0");
  const remaining   = creditLimit > 0 ? creditLimit - totalSales : 0;
  const salesPct    = creditLimit > 0 ? Math.min((totalSales / creditLimit) * 100, 100) : 0;
  const unpaid      = totalSales - totalPaid;

  const allOrders        = data?.orders ?? [];
  const activeOrders     = allOrders.filter(o => o.status === "processing" || o.status === "delivered");
  const processingOrders = activeOrders.filter(o => o.status === "processing");
  const deliveredOrders  = activeOrders.filter(o => o.status === "delivered");

  return (
    <div className="max-w-3xl mx-auto space-y-5 animate-in fade-in duration-500" dir="rtl">

      {/* ─── Header ─── */}
      <div className="flex items-center gap-3">
        <Link href="/finance/clients">
          <Button variant="outline" size="icon" className="h-8 w-8 rounded-full border-border">
            <ArrowRight className="h-4 w-4" />
          </Button>
        </Link>
        <div className="w-10 h-10 rounded-full bg-teal-500/15 border border-teal-500/30 flex items-center justify-center shrink-0">
          <Users className="w-5 h-5 text-teal-400" />
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-bold truncate">{client?.name ?? "…"}</h1>
          <div className="flex items-center gap-3 mt-0.5 text-xs text-muted-foreground flex-wrap">
            {client?.phone && (
              <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{client.phone}</span>
            )}
            {(client?.city || client?.address) && (
              <span className="flex items-center gap-1">
                <MapPin className="w-3 h-3" />
                {[client.address, client.city, client.region].filter(Boolean).join("، ")}
              </span>
            )}
            <Badge variant="outline" className={`text-[9px] font-bold border ${
              client?.isActive
                ? "border-emerald-800 bg-emerald-900/30 text-emerald-400"
                : "border-border text-muted-foreground"
            }`}>
              {client?.isActive ? "نشط" : "موقف"}
            </Badge>
          </div>
        </div>
      </div>

      {/* ─── بطاقات الإحصائيات ─── */}
      {!isLoading && client && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Card className="border-teal-900/40 bg-teal-900/10 p-3 text-center">
              <p className="text-[10px] text-teal-400 mb-0.5">إجمالي المبيعات</p>
              <p className="text-lg font-black text-teal-400">{fmt(totalSales)}</p>
              <p className="text-[10px] text-muted-foreground">{activeOrders.length} فاتورة</p>
            </Card>
            <Card className="border-blue-900/40 bg-blue-900/10 p-3 text-center">
              <p className="text-[10px] text-blue-400 mb-0.5">المتبقي للهدف</p>
              <p className="text-lg font-black text-blue-400">{fmt(remaining > 0 ? remaining : 0)}</p>
              <p className="text-[10px] text-muted-foreground">من {fmt(creditLimit)}</p>
            </Card>
            <Card className="border-rose-900/40 bg-rose-900/10 p-3 text-center">
              <p className="text-[10px] text-rose-400 mb-0.5">المديونية المتبقية</p>
              <p className="text-lg font-black text-rose-400">{fmt(unpaid > 0 ? unpaid : 0)}</p>
              <p className="text-[10px] text-muted-foreground">مدفوع: {fmt(totalPaid)}</p>
            </Card>
            <Card className={`p-3 text-center border ${salesPct >= 75 ? "border-emerald-900/40 bg-emerald-900/10" : "border-primary/30 bg-primary/5"}`}>
              <p className="text-[10px] text-muted-foreground mb-0.5">نسبة التسليم</p>
              <p className={`text-xl font-black ${salesPct >= 75 ? "text-emerald-400" : "text-primary"}`}>
                {salesPct.toFixed(1)}%
              </p>
              <p className="text-[10px] flex items-center justify-center gap-0.5 text-muted-foreground">
                <Target className="w-3 h-3" /> من الهدف
              </p>
            </Card>
          </div>

          {/* شريط التقدم */}
          {creditLimit > 0 && (
            <Card className="p-4 border-border">
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="text-muted-foreground flex items-center gap-1">
                  <TrendingUp className="w-3.5 h-3.5" /> نسبة إنجاز الهدف
                </span>
                <span className="font-bold text-primary">{salesPct.toFixed(1)}%</span>
              </div>
              <SalesProgressBar sales={totalSales} target={creditLimit} />
              <div className="flex justify-between text-[10px] text-muted-foreground mt-1.5">
                <span>{fmt(totalSales)} تم تحقيقه</span>
                <span>الهدف: {fmt(creditLimit)}</span>
              </div>
            </Card>
          )}
        </>
      )}

      {/* ─── فواتير البيع ─── */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-bold text-sm flex items-center gap-2">
            <ShoppingBag className="w-4 h-4 text-muted-foreground" />
            فواتير البيع
            {activeOrders.length > 0 && (
              <Badge variant="outline" className="text-[9px]">{activeOrders.length}</Badge>
            )}
          </h2>
          <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-amber-500 inline-block" />قيد التجهيز: {processingOrders.length}
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />تم التسليم: {deliveredOrders.length}
            </span>
          </div>
        </div>

        {isLoading ? (
          <div className="py-12 text-center text-muted-foreground text-sm animate-pulse">جاري التحميل...</div>
        ) : activeOrders.length === 0 ? (
          <div className="py-16 text-center">
            <ShoppingBag className="w-12 h-12 mx-auto mb-3 text-muted-foreground opacity-20" />
            <p className="text-muted-foreground text-sm">لا توجد فواتير بيع بعد</p>
          </div>
        ) : (
          <div className="space-y-2">
            {processingOrders.length > 0 && (
              <>
                <p className="text-[10px] font-semibold text-amber-400 uppercase tracking-wider px-1">
                  قيد التجهيز — تحتاج متابعة
                </p>
                {processingOrders.map(o => <InvoiceCard key={o.id} order={o} />)}
                {deliveredOrders.length > 0 && <div className="border-t border-border my-3" />}
              </>
            )}
            {deliveredOrders.length > 0 && (
              <>
                {processingOrders.length > 0 && (
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-1">
                    تم التسليم — مكتمل
                  </p>
                )}
                {deliveredOrders.map(o => <InvoiceCard key={o.id} order={o} />)}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
