import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { apiFetch } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Truck, CheckCircle, Clock, AlertCircle, ArrowRight, Package, RotateCcw, Wallet, Link as LinkIcon } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { Link } from "wouter";

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  pending:  { label: "في انتظار التسوية", color: "bg-amber-50 text-amber-700 border-amber-300 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-700" },
  verified: { label: "تم التحقق",         color: "bg-blue-50 text-blue-700 border-blue-300 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-700" },
  paid:     { label: "تم التحويل للخزنة", color: "bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-700" },
  disputed: { label: "متنازع عليها",      color: "bg-rose-50 text-rose-700 border-rose-300 dark:bg-rose-900/20 dark:text-rose-400 dark:border-rose-700" },
};

const fmt = (n: string | number) =>
  new Intl.NumberFormat("ar-EG", { style: "currency", currency: "EGP", maximumFractionDigits: 0 }).format(Number(n));

export default function FinanceShippingInvoices() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [statusFilter, setStatusFilter] = useState("all");

  // ── جيب الفواتير المالية (المرتبطة تلقائياً ببيانات الشحن المقفولة) ──────
  const { data: invoices = [], isLoading } = useQuery<any[]>({
    queryKey: ["finance-shipping-invoices"],
    queryFn: () => apiFetch<any[]>("/finance/shipping-invoices"),
  });

  // ── جيب شركات الشحن للأسماء ───────────────────────────────────────────────
  const { data: companies = [] } = useQuery<any[]>({
    queryKey: ["shipping"],
    queryFn: () => apiFetch<any[]>("/shipping-companies"),
  });

  // ── جيب الخزنة الرئيسية ──────────────────────────────────────────────────
  const { data: cashData } = useQuery<any>({
    queryKey: ["cash-registers"],
    queryFn: () => apiFetch<any>("/cash-registers"),
  });

  const mainRegister = cashData?.registers?.find((r: any) => r.type === "main");

  // ── تعيين حالة الفاتورة ───────────────────────────────────────────────────
  const updateStatus = useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) =>
      apiFetch<any>(`/finance/shipping-invoices/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["finance-shipping-invoices"] });
      qc.invalidateQueries({ queryKey: ["cash-registers"] });
      toast({ title: "✅ تم تحديث حالة الفاتورة" });
    },
    onError: (e: any) => toast({ title: "❌ خطأ", description: e.message, variant: "destructive" }),
  });

  // ── فلترة ────────────────────────────────────────────────────────────────
  const filtered = statusFilter === "all"
    ? invoices
    : invoices.filter(inv => inv.status === statusFilter);

  const totalPending = invoices
    .filter(i => i.status === "pending")
    .reduce((s, i) => s + Number(i.netDue) - Number(i.paidAmount ?? 0), 0);

  const totalPaid = invoices
    .filter(i => i.status === "paid")
    .reduce((s, i) => s + Number(i.netDue), 0);

  return (
    <div className="space-y-5 animate-in fade-in duration-500" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">فواتير شركات الشحن</h1>
          <p className="text-muted-foreground text-sm">
            الفواتير المالية المُنشأة تلقائياً عند إقفال بيانات الشحن
          </p>
        </div>
        <Link href="/shipping-companies">
          <Button variant="outline" className="gap-2 border-border">
            <LinkIcon className="w-4 h-4" />
            إدارة بيانات الشحن
          </Button>
        </Link>
      </div>

      {/* بطاقات الملخص */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Card className="p-4 border-amber-500/30 bg-amber-500/5">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-amber-500/15 flex items-center justify-center">
              <Clock className="w-4 h-4 text-amber-500" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">في انتظار التسوية</p>
              <p className="text-lg font-black text-amber-600 dark:text-amber-400">{fmt(totalPending)}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4 border-emerald-500/30 bg-emerald-500/5">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-emerald-500/15 flex items-center justify-center">
              <Wallet className="w-4 h-4 text-emerald-500" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">تم التحويل للخزنة</p>
              <p className="text-lg font-black text-emerald-600 dark:text-emerald-400">{fmt(totalPaid)}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4 border-border bg-card">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
              <Truck className="w-4 h-4 text-primary" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">رصيد الخزنة الرئيسية</p>
              <p className="text-lg font-black text-primary">
                {mainRegister ? fmt(mainRegister.balance) : <span className="text-xs text-muted-foreground">لا توجد خزنة رئيسية</span>}
              </p>
            </div>
          </div>
        </Card>
      </div>

      {/* تنبيه لو مفيش خزنة رئيسية */}
      {!mainRegister && totalPending > 0 && (
        <Card className="p-4 border-amber-500/30 bg-amber-500/5 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-bold text-amber-700 dark:text-amber-400">
              لا توجد خزنة رئيسية
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              يوجد {fmt(totalPending)} في انتظار التحويل. أنشئ خزنة رئيسية من قسم الخزنة وسيتم تحويل المبالغ إليها تلقائياً.
            </p>
            <Link href="/finance/cash">
              <Button size="sm" className="mt-2 h-7 text-xs gap-1">
                <ArrowRight className="w-3 h-3" />
                إنشاء خزنة رئيسية
              </Button>
            </Link>
          </div>
        </Card>
      )}

      {/* فلتر الحالة */}
      <div className="flex items-center gap-3">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-48 h-9 text-sm border-border">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">كل الفواتير ({invoices.length})</SelectItem>
            <SelectItem value="pending">في انتظار التسوية</SelectItem>
            <SelectItem value="paid">تم التحويل للخزنة</SelectItem>
            <SelectItem value="verified">تم التحقق</SelectItem>
            <SelectItem value="disputed">متنازع عليها</SelectItem>
          </SelectContent>
        </Select>
        <span className="text-xs text-muted-foreground">{filtered.length} فاتورة</span>
      </div>

      {/* قائمة الفواتير */}
      {isLoading ? (
        <div className="p-8 text-center text-muted-foreground">جاري التحميل...</div>
      ) : filtered.length === 0 ? (
        <Card className="p-10 text-center border-dashed border-border">
          <Truck className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
          <p className="text-muted-foreground text-sm">
            {statusFilter === "all"
              ? "لا توجد فواتير بعد. ستظهر هنا تلقائياً عند إقفال بيانات الشحن."
              : "لا توجد فواتير بهذه الحالة."}
          </p>
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map(inv => {
            const company = companies.find((c: any) => c.id === inv.shippingCompanyId);
            const st = STATUS_LABELS[inv.status] ?? { label: inv.status, color: "" };
            const remaining = Number(inv.netDue) - Number(inv.paidAmount ?? 0);

            return (
              <Card key={inv.id} className="p-4 border-border hover:border-primary/30 transition-colors">
                {/* Header */}
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-sky-500/10 flex items-center justify-center shrink-0">
                      <Truck className="w-5 h-5 text-sky-500" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-bold text-sm">{inv.invoiceNumber}</p>
                        {inv.manifestId && (
                          <Link href={`/shipping-companies`}>
                            <span className="text-[9px] text-sky-500 border border-sky-500/30 rounded px-1.5 py-0.5 cursor-pointer hover:bg-sky-500/10 flex items-center gap-1">
                              <LinkIcon className="w-2.5 h-2.5" />
                              بيان شحن مرتبط
                            </span>
                          </Link>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {company?.name ?? "—"} · {format(new Date(inv.invoiceDate), "yyyy/MM/dd")}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="outline" className={`text-[9px] border ${st.color}`}>
                      {st.label}
                    </Badge>
                    {inv.status === "pending" && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs border-blue-500/40 text-blue-600 hover:bg-blue-500/10"
                        onClick={() => updateStatus.mutate({ id: inv.id, status: "verified" })}
                        disabled={updateStatus.isPending}
                      >
                        <CheckCircle className="w-3 h-3 mr-1" />
                        تحقق
                      </Button>
                    )}
                  </div>
                </div>

                {/* الأرقام */}
                <div className="grid grid-cols-3 gap-3 mt-3 pt-3 border-t border-border">
                  <div>
                    <p className="text-[10px] text-muted-foreground mb-0.5">الإيراد الإجمالي</p>
                    <p className="text-sm font-bold text-emerald-500">{fmt(inv.grossRevenue)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground mb-0.5">رسوم الشحن + المرتجعات</p>
                    <p className="text-sm font-bold text-rose-500">
                      {fmt(Number(inv.shippingFees) + Number(inv.returnFees))}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground mb-0.5">صافي المستحق</p>
                    <p className="text-sm font-black text-primary">{fmt(inv.netDue)}</p>
                  </div>
                </div>

                {/* إحصائيات الطلبات */}
                <div className="flex flex-wrap gap-4 mt-2 text-[10px] text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Package className="w-3 h-3" />
                    إجمالي: {inv.totalOrders}
                  </span>
                  <span className="flex items-center gap-1 text-emerald-500">
                    <CheckCircle className="w-3 h-3" />
                    مسلّم: {inv.deliveredOrders}
                  </span>
                  <span className="flex items-center gap-1 text-rose-400">
                    <RotateCcw className="w-3 h-3" />
                    مرتجع: {inv.returnedOrders}
                  </span>
                </div>

                {/* حالة التحويل للخزنة */}
                {inv.status === "paid" && (
                  <div className="mt-2 pt-2 border-t border-border flex items-center gap-2">
                    <Wallet className="w-3.5 h-3.5 text-emerald-500" />
                    <p className="text-[10px] text-emerald-600 dark:text-emerald-400">
                      تم إضافة {fmt(inv.paidAmount ?? inv.netDue)} للخزنة الرئيسية
                      {inv.paidAt ? ` · ${format(new Date(inv.paidAt), "yyyy/MM/dd")}` : ""}
                    </p>
                  </div>
                )}
                {inv.status === "pending" && !mainRegister && (
                  <div className="mt-2 pt-2 border-t border-border flex items-center gap-2">
                    <Clock className="w-3.5 h-3.5 text-amber-500" />
                    <p className="text-[10px] text-amber-600 dark:text-amber-400">
                      في انتظار إنشاء الخزنة الرئيسية لتحويل {fmt(remaining)}
                    </p>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
