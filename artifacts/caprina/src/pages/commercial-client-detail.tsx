import { useState } from "react";
import { useParams, Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ArrowRight, Users, ShoppingBag, TrendingUp, TrendingDown,
  ChevronRight, Calendar, Package, Phone, MapPin,
  Clock, CheckCircle2, Target,
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { ar } from "date-fns/locale";
import { apiFetch } from "@/lib/api";

const fmt = (n: string | number) =>
  new Intl.NumberFormat("ar-EG", {
    style: "currency", currency: "EGP", maximumFractionDigits: 0,
  }).format(Number(n));

// ── شريط التقدم للفاتورة — زي DeliveryBar ──────────────────────────────────
function InvoiceProgressBar({
  paid, total,
}: { paid: number; total: number }) {
  if (total === 0) return null;
  const pct = Math.min((paid / total) * 100, 100);
  const unpaidPct = 100 - pct;
  return (
    <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden flex mt-2">
      <div className="h-1.5 bg-emerald-500" style={{ width: `${pct}%` }} />
      <div className="h-1.5 bg-red-500/40" style={{ width: `${unpaidPct}%` }} />
    </div>
  );
}

// ── أنواع البيانات ──────────────────────────────────────────────────────────
type SaleOrder = {
  id: number; soNumber: string; status: string; paymentStatus: string;
  totalAmount: string; paidAmount: string;
  createdAt: string; closedAt?: string | null;
  itemCount?: number;
};

type Client = {
  id: number; name: string; phone: string | null; phone2: string | null;
  email: string | null; address: string | null; city: string | null; region: string | null;
  creditLimit: string; totalOrders: number; totalSales: string; totalPaid: string;
  notes: string | null; isActive: boolean; createdAt: string;
};

type ClientDetail = Client & { orders: SaleOrder[]; deliveryRate?: number };

// ── بطاقة الفاتورة — زي ManifestCard بالظبط ────────────────────────────────
function InvoiceCard({ order, isLatest }: { order: SaleOrder; isLatest: boolean }) {
  const [, navigate] = useLocation();
  const total  = parseFloat(order.totalAmount ?? "0");
  const paid   = order.paymentStatus === "paid" ? total : parseFloat(order.paidAmount ?? "0");
  const unpaid = order.paymentStatus === "paid" ? 0 : Math.max(0, total - paid);
  const isProcessing = ["draft", "confirmed", "processing"].includes(order.status);
  const statusLabel = order.status === "draft" ? "مسودة" : order.status === "confirmed" ? "مؤكد" : "قيد التجهيز";

  return (
    <div
      className={`group flex items-stretch gap-0 hover:bg-muted/10 transition-colors cursor-pointer rounded-lg border ${
        isProcessing ? "border-amber-500/30 bg-amber-900/5" : "border-border bg-card/50"
      }`}
      onClick={() => navigate("/finance/sales")}
    >
      {/* شريط اللون الجانبي */}
      <div className={`w-1 rounded-r-lg shrink-0 ${isProcessing ? "bg-amber-500" : "bg-emerald-500"}`} />

      <div className="flex-1 px-4 py-3.5">
        {/* رأس البطاقة */}
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-black text-sm">{order.soNumber}</span>
              {isLatest && isProcessing && (
                <Badge variant="outline" className="text-[9px] border-amber-500/50 bg-amber-900/20 text-amber-400">الأحدث</Badge>
              )}
            </div>
            <div className="flex items-center gap-2 mt-0.5 text-[10px] text-muted-foreground flex-wrap">
              <span className="flex items-center gap-1">
                <Calendar className="w-2.5 h-2.5" />
                {format(new Date(order.createdAt), "yyyy/MM/dd")}
              </span>
              {order.status === "delivered" && order.closedAt ? (
                <span className="flex items-center gap-1 text-emerald-600">
                  <CheckCircle2 className="w-2.5 h-2.5" />
                  سُلِّم {format(new Date(order.closedAt), "yyyy/MM/dd")}
                </span>
              ) : (
                <span className="text-amber-500">
                  منذ {formatDistanceToNow(new Date(order.createdAt), { locale: ar, addSuffix: false })}
                </span>
              )}
            </div>
          </div>

          {/* Badge الحالة + سهم */}
          <div className="flex items-center gap-2 shrink-0">
            <Badge
              variant="outline"
              className={`text-[9px] font-bold border ${
                isProcessing
                  ? "border-amber-700 bg-amber-900/20 text-amber-400"
                  : "border-emerald-700 bg-emerald-900/20 text-emerald-400"
              }`}
            >
              {isProcessing
                ? <><Clock className="w-2.5 h-2.5 inline ml-0.5" />{statusLabel}</>
                : <><CheckCircle2 className="w-2.5 h-2.5 inline ml-0.5" />تم التسليم</>}
            </Badge>
            <ChevronRight className="w-3.5 h-3.5 text-muted-foreground group-hover:text-foreground transition-colors" />
          </div>
        </div>

        {/* أرقام الفاتورة */}
        <div className="flex items-center gap-3 mt-2 text-[11px] flex-wrap">
          {order.itemCount != null && (
            <span className="flex items-center gap-1">
              <Package className="w-3 h-3 text-muted-foreground" />
              <span className="font-bold">{order.itemCount}</span>
              <span className="text-muted-foreground">صنف</span>
            </span>
          )}
          <span className="flex items-center gap-1 text-emerald-400">
            <CheckCircle2 className="w-3 h-3" />
            <span className="font-bold">{fmt(paid)}</span> مدفوع
          </span>
          {unpaid > 0 && (
            <span className="flex items-center gap-1 text-red-400">
              <Clock className="w-3 h-3" />
              <span className="font-bold">{fmt(unpaid)}</span> متبقي
            </span>
          )}
          <span className="flex items-center gap-1 text-primary font-bold mr-auto">
            {fmt(total)}
          </span>
        </div>

        {/* شريط الدفع */}
        {total > 0 && <InvoiceProgressBar paid={paid} total={total} />}
      </div>
    </div>
  );
}

// ── الصفحة الرئيسية — نسخة من ShippingCompanyDetailPage بمنطق العملاء ───────
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
  // ✅ totalSales و totalPaid بيجوا live من الـ API (محسوبين من الفواتير الفعلية)
  const totalSales  = parseFloat(client?.totalSales  ?? "0");
  const totalPaid   = parseFloat(client?.totalPaid   ?? "0");
  const allOrders        = data?.orders ?? [];
  // المديونية = إجمالي المبيعات - إجمالي المدفوع (محسوبين live من الـ API)
  const unpaid = Math.max(0, totalSales - totalPaid);
  // ✅ نسبة التسليم الحقيقية من الـ API (delivered ÷ total)
  const deliveryRate = data?.deliveryRate ?? 0;
  // نسبة تحقيق الهدف (المبيعات ÷ creditLimit)
  const salesPct    = Math.min((totalSales / (creditLimit > 0 ? creditLimit : 1_000_000)) * 100, 100);
  const remaining   = Math.max(0, creditLimit - totalSales);

  const processingOrders = allOrders.filter(o => ["draft", "confirmed", "processing"].includes(o.status));
  const deliveredOrders  = allOrders.filter(o => ["delivered", "closed"].includes(o.status));
  const latestProcessingId = processingOrders[0]?.id;

  return (
    <div className="max-w-3xl mx-auto space-y-5 animate-in fade-in duration-500" dir="rtl">

      {/* ─── Header — زي ShippingCompanyDetailPage ─── */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link href="/finance/clients">
            <Button variant="outline" size="icon" className="h-8 w-8 rounded-full border-border">
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
          <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center shrink-0">
            <Users className="w-5 h-5 text-muted-foreground" />
          </div>
          <div>
            <h1 className="text-xl font-bold">{client?.name ?? "…"}</h1>
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
        {/* بدون زر "بيان جديد" — مش محتاجينه هنا */}
      </div>

      {/* ─── Stats Cards — زي شركات الشحن بس بأرقام العميل ─── */}
      {!isLoading && client && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Card className="border-border bg-card p-3 text-center">
            <p className="text-[10px] text-muted-foreground mb-0.5">إجمالي الفواتير</p>
            <p className="text-2xl font-black">{allOrders.length}</p>
            <p className="text-[10px] text-muted-foreground">{processingOrders.length} جارية · {deliveredOrders.length} مكتملة</p>
          </Card>
          <Card className="border-teal-900/40 bg-teal-900/10 p-3 text-center">
            <p className="text-[10px] text-teal-400 mb-0.5">إجمالي المبيعات</p>
            <p className="text-xl font-black text-teal-400">{fmt(totalSales)}</p>
            <p className="text-[10px] text-teal-600">{salesPct.toFixed(1)}% من الهدف</p>
          </Card>
          <Card className="border-red-900/40 bg-red-900/10 p-3 text-center">
            <p className="text-[10px] text-red-400 mb-0.5">المديونية</p>
            <p className="text-xl font-black text-red-400">{fmt(unpaid)}</p>
            <p className="text-[10px] text-muted-foreground">مدفوع: {fmt(totalPaid)}</p>
          </Card>
          <Card className={`p-3 text-center border ${salesPct >= 75 ? "border-emerald-900/40 bg-emerald-900/10" : salesPct >= 50 ? "border-amber-900/40 bg-amber-900/10" : "border-primary/30 bg-primary/5"}`}>
            <p className="text-[10px] text-muted-foreground mb-0.5">تحقيق الهدف</p>
            <p className={`text-2xl font-black ${salesPct >= 75 ? "text-emerald-400" : salesPct >= 50 ? "text-amber-400" : "text-primary"}`}>
              {salesPct.toFixed(1)}%
            </p>
            {/* Progress bar للهدف */}
            <div className="w-full bg-muted/30 rounded-full h-1.5 mt-1.5 overflow-hidden">
              <div
                className={`h-1.5 rounded-full transition-all ${salesPct >= 75 ? "bg-emerald-500" : salesPct >= 50 ? "bg-amber-500" : "bg-primary"}`}
                style={{ width: `${Math.min(salesPct, 100)}%` }}
              />
            </div>
            <p className="text-[10px] flex items-center justify-center gap-0.5 text-muted-foreground mt-1">
              {salesPct >= 75
                ? <TrendingUp className="w-3 h-3 text-emerald-400" />
                : salesPct >= 50
                  ? <TrendingUp className="w-3 h-3 text-amber-400" />
                  : <Target className="w-3 h-3" />}
              {creditLimit > 0 ? `هدف ${fmt(creditLimit)}` : `هدف ${fmt(1_000_000)}`}
            </p>
          </Card>
        </div>
      )}

      {/* ─── فواتير البيع — زي Manifests Timeline ─── */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-bold text-sm flex items-center gap-2">
            <ShoppingBag className="w-4 h-4 text-muted-foreground" />
            فواتير البيع
            {allOrders.length > 0 && (
              <Badge variant="outline" className="text-[9px]">
                {processingOrders.length + deliveredOrders.length}
              </Badge>
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
        ) : (processingOrders.length + deliveredOrders.length) === 0 ? (
          <div className="py-16 text-center">
            <ShoppingBag className="w-12 h-12 mx-auto mb-3 text-muted-foreground opacity-20" />
            <p className="text-muted-foreground text-sm">لا توجد فواتير بيع بعد</p>
          </div>
        ) : (
          <div className="space-y-2">
            {/* قيد التجهيز */}
            {processingOrders.length > 0 && (
              <>
                <p className="text-[10px] font-semibold text-amber-400 uppercase tracking-wider px-1">
                  قيد التجهيز — تحتاج متابعة
                </p>
                {processingOrders.map(o => (
                  <InvoiceCard key={o.id} order={o} isLatest={o.id === latestProcessingId} />
                ))}
                {deliveredOrders.length > 0 && <div className="border-t border-border my-3" />}
              </>
            )}
            {/* تم التسليم */}
            {deliveredOrders.length > 0 && (
              <>
                {processingOrders.length > 0 && (
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-1">
                    تم التسليم — مكتمل
                  </p>
                )}
                {deliveredOrders.map(o => (
                  <InvoiceCard key={o.id} order={o} isLatest={false} />
                ))}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
