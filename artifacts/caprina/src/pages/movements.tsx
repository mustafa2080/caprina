import { useState, useMemo } from "react";
import { format } from "date-fns";
import { arEG } from "date-fns/locale";
import {
  ArrowDownCircle, ArrowUpCircle, BarChart3, CalendarDays,
  Filter, Package, Plus, RotateCcw, X, TrendingDown, TrendingUp, Activity, Printer,
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { movementsApi, productsApi, type MovementType, type MovementReason, type InventoryMovement } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";

// ─── Label helpers ────────────────────────────────────────────────────────────

const REASON_LABELS: Record<MovementReason, string> = {
  sale:         "بيع",
  partial_sale: "بيع جزئي",
  return:       "مرتجع",
  manual_in:    "إضافة يدوية",
  manual_out:   "خصم يدوي",
  adjustment:   "تسوية",
};

const REASON_COLORS: Record<MovementReason, string> = {
  sale:         "bg-emerald-100 text-emerald-700 border-emerald-300 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800",
  partial_sale: "bg-purple-100 text-purple-700 border-purple-300 dark:bg-purple-900/30 dark:text-purple-400 dark:border-purple-800",
  return:       "bg-red-100 text-red-700 border-red-300 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800",
  manual_in:    "bg-sky-100 text-sky-700 border-sky-300 dark:bg-sky-900/30 dark:text-sky-400 dark:border-sky-800",
  manual_out:   "bg-orange-100 text-orange-700 border-orange-300 dark:bg-orange-900/30 dark:text-orange-400 dark:border-orange-800",
  adjustment:   "bg-muted text-muted-foreground border-border",
};

const formatQty = (type: MovementType, qty: number) =>
  type === "IN" ? `+${qty}` : `-${qty}`;

const formatNum = (n: number) =>
  new Intl.NumberFormat("ar-EG").format(n);

// ─── Component ────────────────────────────────────────────────────────────────

export default function Movements() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Filters
  const [filterType, setFilterType] = useState<string>("all");
  const [filterReason, setFilterReason] = useState<string>("all");
  const [filterProduct, setFilterProduct] = useState<string>("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  // Manual movement dialog
  const [showDialog, setShowDialog] = useState(false);
  const [form, setForm] = useState({
    product: "",
    color: "",
    size: "",
    quantity: "1",
    type: "IN" as MovementType,
    reason: "manual_in" as MovementReason,
    notes: "",
    productId: "",
    variantId: "",
  });

  const filters = useMemo(() => ({
    type: filterType !== "all" ? filterType as MovementType : undefined,
    reason: filterReason !== "all" ? filterReason as MovementReason : undefined,
    productId: filterProduct !== "all" ? parseInt(filterProduct) : undefined,
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
  }), [filterType, filterReason, filterProduct, dateFrom, dateTo]);

  const { data: movements = [], isLoading } = useQuery({
    queryKey: ["movements", filters],
    queryFn: () => movementsApi.list(filters),
  });

  const { data: totals } = useQuery({
    queryKey: ["movements-totals", filters],
    queryFn: () => movementsApi.totals(filters),
  });

  const { data: products = [] } = useQuery({
    queryKey: ["products"],
    queryFn: productsApi.list,
  });

  const createMutation = useMutation({
    mutationFn: movementsApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["movements"] });
      queryClient.invalidateQueries({ queryKey: ["movements-totals"] });
      setShowDialog(false);
      resetForm();
      toast({ title: "تم التسجيل", description: "تم تسجيل الحركة بنجاح." });
    },
    onError: () => toast({ title: "خطأ", description: "فشل تسجيل الحركة.", variant: "destructive" }),
  });

  const resetForm = () => setForm({ product: "", color: "", size: "", quantity: "1", type: "IN", reason: "manual_in", notes: "", productId: "", variantId: "" });

  const hasFilter = filterType !== "all" || filterReason !== "all" || filterProduct !== "all" || dateFrom || dateTo;

  const clearFilters = () => {
    setFilterType("all");
    setFilterReason("all");
    setFilterProduct("all");
    setDateFrom("");
    setDateTo("");
  };

  const handleCreate = () => {
    if (!form.product.trim()) { toast({ title: "خطأ", description: "أدخل اسم المنتج.", variant: "destructive" }); return; }
    const qty = parseInt(form.quantity);
    if (!qty || qty < 1) { toast({ title: "خطأ", description: "أدخل كمية صحيحة.", variant: "destructive" }); return; }

    createMutation.mutate({
      product: form.product.trim(),
      color: form.color.trim() || null,
      size: form.size.trim() || null,
      quantity: qty,
      type: form.type,
      reason: form.reason,
      notes: form.notes.trim() || null,
      productId: form.productId ? parseInt(form.productId) : null,
      variantId: form.variantId ? parseInt(form.variantId) : null,
    });
  };

  // Auto-set reason when type changes
  const handleTypeChange = (t: MovementType) => {
    setForm(f => ({ ...f, type: t, reason: t === "IN" ? "manual_in" : "manual_out" }));
  };

  // ─── Print ────────────────────────────────────────────────────────────────
  const handlePrint = () => {
    const printDate = new Date().toLocaleDateString("ar-EG", { year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit" });

    // وصف الفلاتر النشطة
    const activeFilters: string[] = [];
    if (filterType !== "all")    activeFilters.push(`النوع: ${filterType === "IN" ? "دخول" : "خروج"}`);
    if (filterReason !== "all")  activeFilters.push(`السبب: ${REASON_LABELS[filterReason as MovementReason] ?? filterReason}`);
    if (filterProduct !== "all") {
      const pName = products.find(p => String(p.id) === filterProduct)?.name ?? filterProduct;
      activeFilters.push(`المنتج: ${pName}`);
    }
    if (dateFrom) activeFilters.push(`من: ${dateFrom}`);
    if (dateTo)   activeFilters.push(`إلى: ${dateTo}`);

    const filtersRow = activeFilters.length > 0
      ? `<div class="filters">🔍 فلاتر مطبقة: ${activeFilters.join(" &nbsp;|&nbsp; ")}</div>`
      : `<div class="filters">عرض: كل الحركات</div>`;

    const rows = movements.map(m => {
      const isIn = m.type === "IN";
      const dateStr = format(new Date(m.createdAt), "yyyy/MM/dd HH:mm", { locale: arEG });
      return `
        <tr>
          <td>${dateStr}</td>
          <td style="text-align:center;font-weight:bold;color:${isIn ? "#16a34a" : "#dc2626"}">${isIn ? "⬆ دخول" : "⬇ خروج"}</td>
          <td style="font-weight:600">${m.product}</td>
          <td style="text-align:center">${[m.color, m.size].filter(Boolean).join(" / ") || "—"}</td>
          <td style="text-align:center;font-weight:bold;color:${isIn ? "#16a34a" : "#dc2626"}">${isIn ? "+" : "-"}${m.quantity}</td>
          <td style="text-align:center">${REASON_LABELS[m.reason] ?? m.reason}</td>
          <td style="text-align:center">${m.orderId ? `#${String(m.orderId).padStart(4, "0")}` : "—"}</td>
          <td style="text-align:center">${(m as any).warehouseName ?? "—"}</td>
          <td style="color:#6b7280">${m.notes ?? "—"}</td>
        </tr>`;
    }).join("");

    const win = window.open("", "_blank", "width=1000,height=750");
    if (!win) return;
    win.document.write(`<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="UTF-8"/>
  <title>حركات المخزون</title>
  <style>
    * { margin:0; padding:0; box-sizing:border-box; }
    body { font-family:'Segoe UI',Tahoma,Arial,sans-serif; padding:24px; color:#111; font-size:12px; }

    /* ── Header ── */
    .header { display:flex; justify-content:space-between; align-items:flex-start;
              border-bottom:3px solid #1a1a2e; padding-bottom:14px; margin-bottom:14px; }
    .header h1 { font-size:20px; font-weight:900; color:#1a1a2e; }
    .header .meta { text-align:left; font-size:11px; color:#6b7280; }

    /* ── Filters pill ── */
    .filters { background:#f3f4f6; border:1px solid #e5e7eb; border-radius:6px;
               padding:7px 12px; font-size:11px; color:#374151; margin-bottom:14px; }

    /* ── KPIs ── */
    .kpis { display:grid; grid-template-columns:repeat(3,1fr); gap:10px; margin-bottom:16px; }
    .kpi { border:1px solid #e5e7eb; border-radius:8px; padding:10px 14px; text-align:center; }
    .kpi .val { font-size:22px; font-weight:900; }
    .kpi .lbl { font-size:10px; color:#6b7280; margin-top:2px; }
    .kpi.in  { border-color:#86efac; background:#f0fdf4; }
    .kpi.out { border-color:#fca5a5; background:#fef2f2; }
    .kpi.bal { border-color:#93c5fd; background:#eff6ff; }

    /* ── Table ── */
    table { width:100%; border-collapse:collapse; }
    thead tr { background:#1a1a2e; }
    thead th { color:#fff; font-size:11px; padding:8px 10px; text-align:right; font-weight:700; }
    tbody td { padding:7px 10px; font-size:11px; border-bottom:1px solid #f3f4f6; }
    tbody tr:nth-child(even) td { background:#f9fafb; }
    tbody tr:last-child td { border-bottom:none; }

    /* ── Footer ── */
    .footer { margin-top:18px; font-size:10px; color:#9ca3af; text-align:center;
              border-top:1px solid #e5e7eb; padding-top:10px; }

    @media print {
      body { padding:10px; }
      .no-print { display:none; }
    }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <h1>📦 تقرير حركات المخزون</h1>
      <p style="font-size:11px;color:#6b7280;margin-top:4px">كابرينا — نظام إدارة المخزون</p>
    </div>
    <div class="meta">
      <div>تاريخ الطباعة: ${printDate}</div>
      <div style="margin-top:4px">إجمالي السجلات: <strong>${movements.length} حركة</strong></div>
    </div>
  </div>

  ${filtersRow}

  <div class="kpis">
    <div class="kpi in">
      <div class="val" style="color:#16a34a">+${formatNum(totals?.totalIn ?? 0)}</div>
      <div class="lbl">إجمالي الداخل</div>
    </div>
    <div class="kpi out">
      <div class="val" style="color:#dc2626">-${formatNum(totals?.totalOut ?? 0)}</div>
      <div class="lbl">إجمالي الخارج</div>
    </div>
    <div class="kpi bal">
      <div class="val" style="color:${(totals?.balance ?? 0) >= 0 ? "#2563eb" : "#ea580c"}">${formatNum(totals?.balance ?? 0)}</div>
      <div class="lbl">الرصيد الصافي</div>
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th>التاريخ والوقت</th>
        <th style="text-align:center">النوع</th>
        <th>المنتج</th>
        <th style="text-align:center">اللون / المقاس</th>
        <th style="text-align:center">الكمية</th>
        <th style="text-align:center">السبب</th>
        <th style="text-align:center">رقم الطلب</th>
        <th style="text-align:center">المخزن</th>
        <th>ملاحظات</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>

  <div class="footer">كابرينا — تقرير حركات المخزون | ${printDate}</div>
  <script>window.onload = () => { window.print(); }</script>
</body>
</html>`);
    win.document.close();
  };

  return (
    <div className="space-y-5 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Activity className="w-6 h-6 text-primary" />
            حركات المخزون
          </h1>
          <p className="text-muted-foreground text-sm mt-0.5">سجل كامل لكل دخول وخروج في المخزن</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            className="gap-2 text-sm font-bold h-9"
            onClick={handlePrint}
            disabled={movements.length === 0}
            title="طباعة الحركات الظاهرة حالياً"
          >
            <Printer className="w-4 h-4" />
            <span className="hidden sm:inline">طباعة</span>
            {hasFilter && <span className="text-[9px] bg-primary text-primary-foreground rounded-full px-1.5 py-0.5 font-bold">مفلترة</span>}
          </Button>
          <Button className="gap-2 bg-primary text-primary-foreground font-bold text-sm" onClick={() => setShowDialog(true)}>
            <Plus className="w-4 h-4" />حركة يدوية
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="border-emerald-200 dark:border-emerald-900 bg-emerald-50 dark:bg-emerald-900/10">
          <CardContent className="p-4 flex items-center gap-3">
            <ArrowDownCircle className="w-8 h-8 text-emerald-600 dark:text-emerald-500 shrink-0" />
            <div>
              <p className="text-[10px] text-emerald-700 dark:text-emerald-400 uppercase tracking-widest font-bold">إجمالي الداخل</p>
              <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-300">{formatNum(totals?.totalIn ?? 0)}</p>
              <p className="text-[10px] text-muted-foreground">وحدة</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-900/10">
          <CardContent className="p-4 flex items-center gap-3">
            <ArrowUpCircle className="w-8 h-8 text-red-500 shrink-0" />
            <div>
              <p className="text-[10px] text-red-700 dark:text-red-400 uppercase tracking-widest font-bold">إجمالي الخارج</p>
              <p className="text-2xl font-bold text-red-700 dark:text-red-300">{formatNum(totals?.totalOut ?? 0)}</p>
              <p className="text-[10px] text-muted-foreground">وحدة</p>
            </div>
          </CardContent>
        </Card>

        <Card className={(totals?.balance ?? 0) >= 0 ? "border-sky-200 dark:border-sky-900 bg-sky-50 dark:bg-sky-900/10" : "border-orange-200 dark:border-orange-900 bg-orange-50 dark:bg-orange-900/10"}>
          <CardContent className="p-4 flex items-center gap-3">
            <BarChart3 className={`w-8 h-8 ${(totals?.balance ?? 0) >= 0 ? "text-sky-500" : "text-orange-500"} shrink-0`} />
            <div>
              <p className={`text-[10px] ${(totals?.balance ?? 0) >= 0 ? "text-sky-700 dark:text-sky-400" : "text-orange-700 dark:text-orange-400"} uppercase tracking-widest font-bold`}>الرصيد</p>
              <p className={`text-2xl font-bold ${(totals?.balance ?? 0) >= 0 ? "text-sky-700 dark:text-sky-300" : "text-orange-700 dark:text-orange-300"}`}>
                {formatNum(totals?.balance ?? 0)}
              </p>
              <p className="text-[10px] text-muted-foreground">وحدة</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card className="border-border">
        <CardContent className="p-3">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="h-8 text-xs bg-card border-border">
                <div className="flex items-center gap-1.5"><Filter className="w-3 h-3 text-muted-foreground" /><SelectValue placeholder="النوع" /></div>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">كل الأنواع</SelectItem>
                <SelectItem value="IN">دخول (IN)</SelectItem>
                <SelectItem value="OUT">خروج (OUT)</SelectItem>
              </SelectContent>
            </Select>

            <Select value={filterReason} onValueChange={setFilterReason}>
              <SelectTrigger className="h-8 text-xs bg-card border-border"><SelectValue placeholder="السبب" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">كل الأسباب</SelectItem>
                <SelectItem value="sale">بيع</SelectItem>
                <SelectItem value="partial_sale">بيع جزئي</SelectItem>
                <SelectItem value="return">مرتجع</SelectItem>
                <SelectItem value="manual_in">إضافة يدوية</SelectItem>
                <SelectItem value="manual_out">خصم يدوي</SelectItem>
                <SelectItem value="adjustment">تسوية</SelectItem>
              </SelectContent>
            </Select>

            <Select value={filterProduct} onValueChange={setFilterProduct}>
              <SelectTrigger className="h-8 text-xs bg-card border-border">
                <div className="flex items-center gap-1.5"><Package className="w-3 h-3 text-muted-foreground" /><SelectValue placeholder="المنتج" /></div>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">كل المنتجات</SelectItem>
                {products.map(p => <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>)}
              </SelectContent>
            </Select>

            <div className="relative">
              <CalendarDays className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground pointer-events-none" />
              <Input type="date" className="h-8 text-xs pr-7 bg-card border-border" value={dateFrom} onChange={e => setDateFrom(e.target.value)} placeholder="من" />
            </div>

            <div className="relative">
              <CalendarDays className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground pointer-events-none" />
              <Input type="date" className="h-8 text-xs pr-7 bg-card border-border" value={dateTo} onChange={e => setDateTo(e.target.value)} placeholder="إلى" />
            </div>
          </div>

          {hasFilter && (
            <div className="mt-2 flex justify-end">
              <Button variant="ghost" size="sm" className="h-7 text-xs gap-1 text-muted-foreground" onClick={clearFilters}>
                <X className="w-3 h-3" />مسح الفلاتر
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Timeline Table */}
      <Card className="border-border overflow-hidden">
        <CardHeader className="py-3 px-4 border-b border-border">
          <CardTitle className="text-sm font-bold flex items-center gap-2">
            <Activity className="w-3.5 h-3.5 text-muted-foreground" />
            جدول الحركات
            {!isLoading && <Badge variant="outline" className="text-[9px] font-normal border-border text-muted-foreground mr-1">{movements.length} حركة</Badge>}
          </CardTitle>
        </CardHeader>

        {isLoading ? (
          <div className="p-8 text-center text-muted-foreground text-sm">جاري التحميل...</div>
        ) : movements.length === 0 ? (
          <div className="p-12 text-center">
            <Activity className="w-10 h-10 mx-auto mb-3 text-muted-foreground opacity-20" />
            <p className="font-bold">لا توجد حركات</p>
            <p className="text-sm text-muted-foreground mt-1">لم يتم تسجيل أي حركة مخزون حتى الآن.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-border hover:bg-transparent">
                  <TableHead className="text-right text-xs w-40">التاريخ</TableHead>
                  <TableHead className="text-center text-xs w-20">النوع</TableHead>
                  <TableHead className="text-right text-xs">المنتج</TableHead>
                  <TableHead className="text-right text-xs">اللون / المقاس</TableHead>
                  <TableHead className="text-center text-xs">الكمية</TableHead>
                  <TableHead className="text-center text-xs">السبب</TableHead>
                  <TableHead className="text-center text-xs">طلب</TableHead>
                  <TableHead className="text-center text-xs">المخزن</TableHead>
                  <TableHead className="text-right text-xs">ملاحظات</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {movements.map((m: InventoryMovement) => (
                  <TableRow key={m.id} className="border-border hover:bg-muted/20">
                    <TableCell className="text-xs text-muted-foreground">
                      {format(new Date(m.createdAt), "yyyy/MM/dd HH:mm", { locale: arEG })}
                    </TableCell>
                    <TableCell className="text-center">
                      {m.type === "IN" ? (
                        <div className="flex items-center justify-center gap-1">
                          <TrendingDown className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                          <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400">دخول</span>
                        </div>
                      ) : (
                        <div className="flex items-center justify-center gap-1">
                          <TrendingUp className="w-3.5 h-3.5 text-red-600 dark:text-red-400" />
                          <span className="text-[10px] font-bold text-red-600 dark:text-red-400">خروج</span>
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-sm font-semibold">{m.product}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {m.color || m.size ? (
                        <div className="flex items-center gap-1">
                          {m.color && <Badge variant="outline" className="text-[9px] border-border">{m.color}</Badge>}
                          {m.size && <Badge variant="outline" className="text-[9px] border-primary/40 text-primary">{m.size}</Badge>}
                        </div>
                      ) : "—"}
                    </TableCell>
                    <TableCell className="text-center">
                      <span className={`font-bold text-sm ${m.type === "IN" ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>
                        {formatQty(m.type, m.quantity)}
                      </span>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="outline" className={`text-[9px] font-bold border ${REASON_COLORS[m.reason]}`}>
                        {REASON_LABELS[m.reason]}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      {m.orderId ? (
                        <a href={`/orders/${m.orderId}`} onClick={e => e.stopPropagation()}
                          className="text-[10px] font-mono text-primary hover:underline">
                          #{String(m.orderId).padStart(4, "0")}
                        </a>
                      ) : "—"}
                    </TableCell>
                    <TableCell className="text-center text-xs text-muted-foreground">
                      {(m as any).warehouseName ?? "—"}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground max-w-[140px] truncate">
                      {m.notes || "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>

      {/* Manual Movement Dialog */}
      <Dialog open={showDialog} onOpenChange={v => { setShowDialog(v); if (!v) resetForm(); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="w-4 h-4 text-primary" />
              تسجيل حركة يدوية
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3 py-1">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs mb-1.5 block">النوع *</Label>
                <Select value={form.type} onValueChange={v => handleTypeChange(v as MovementType)}>
                  <SelectTrigger className="h-9 text-sm bg-background">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="IN">دخول (IN)</SelectItem>
                    <SelectItem value="OUT">خروج (OUT)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs mb-1.5 block">السبب *</Label>
                <Select value={form.reason} onValueChange={v => setForm(f => ({ ...f, reason: v as MovementReason }))}>
                  <SelectTrigger className="h-9 text-sm bg-background"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {form.type === "IN" ? (
                      <>
                        <SelectItem value="manual_in">إضافة يدوية</SelectItem>
                        <SelectItem value="return">مرتجع</SelectItem>
                        <SelectItem value="adjustment">تسوية</SelectItem>
                      </>
                    ) : (
                      <>
                        <SelectItem value="manual_out">خصم يدوي</SelectItem>
                        <SelectItem value="sale">بيع</SelectItem>
                        <SelectItem value="adjustment">تسوية</SelectItem>
                      </>
                    )}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label className="text-xs mb-1.5 block">المنتج *</Label>
              <Select value={form.productId || "manual"} onValueChange={v => {
                if (v === "manual") {
                  setForm(f => ({ ...f, productId: "", product: "" }));
                } else {
                  const p = products.find(p => String(p.id) === v);
                  setForm(f => ({ ...f, productId: v, product: p?.name ?? "" }));
                }
              }}>
                <SelectTrigger className="h-9 text-sm bg-background"><SelectValue placeholder="اختر أو اكتب..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="manual">كتابة يدوية</SelectItem>
                  {products.map(p => <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
              {(!form.productId || form.productId === "manual") && (
                <Input className="h-9 text-sm mt-1.5 bg-background" placeholder="اسم المنتج..." value={form.product} onChange={e => setForm(f => ({ ...f, product: e.target.value }))} />
              )}
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div>
                <Label className="text-xs mb-1.5 block">اللون</Label>
                <Input className="h-9 text-sm bg-background" placeholder="أسود..." value={form.color} onChange={e => setForm(f => ({ ...f, color: e.target.value }))} />
              </div>
              <div>
                <Label className="text-xs mb-1.5 block">المقاس</Label>
                <Input className="h-9 text-sm bg-background" placeholder="M, L..." value={form.size} onChange={e => setForm(f => ({ ...f, size: e.target.value }))} />
              </div>
              <div>
                <Label className="text-xs mb-1.5 block">الكمية *</Label>
                <Input type="number" min="1" className="h-9 text-sm bg-background" value={form.quantity} onChange={e => setForm(f => ({ ...f, quantity: e.target.value }))} />
              </div>
            </div>

            <div>
              <Label className="text-xs mb-1.5 block">ملاحظات</Label>
              <Textarea className="min-h-[60px] text-sm resize-none bg-background" placeholder="سبب إضافي..." value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => { setShowDialog(false); resetForm(); }}>إلغاء</Button>
            <Button size="sm" onClick={handleCreate} disabled={createMutation.isPending} className="gap-1">
              <Plus className="w-3.5 h-3.5" />{createMutation.isPending ? "جاري..." : "تسجيل"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
