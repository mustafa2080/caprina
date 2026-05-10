import { useState, useRef } from "react";
import { Link } from "wouter";
import { format } from "date-fns";
import { Search, Filter, Plus, Package, CalendarDays, X, RotateCcw, MessageCircle, Trash2, CheckSquare, RefreshCw } from "lucide-react";
import { useUpdateOrder } from "@workspace/api-client-react";
import type { UpdateOrderBodyStatus } from "@workspace/api-zod";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { useDebounce } from "@/hooks/use-debounce";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { returnReasonLabel } from "@/lib/order-constants";
import { type WhatsAppOrderData } from "@/lib/whatsapp";
import { WhatsAppDialog } from "@/components/whatsapp-dialog";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { ordersApi, shippingApi } from "@/lib/api";

// Local type alias – includes warehouse_ready which older generated types may omit
type OrderStatusValue = "pending" | "warehouse_ready" | "in_shipping" | "received" | "delayed" | "returned" | "partial_received";

const statusLabels: Record<string, string> = {
  pending:          "قيد الانتظار",
  warehouse_ready:  "قيد الشحن في المخزن",
  in_shipping:      "قيد الشحن",
  received:         "استلم",
  delayed:          "مؤجل",
  returned:         "مرتجع",
  partial_received: "استلم جزئي",
};

const statusClasses: Record<string, string> = {
  pending:          "bg-amber-50   dark:bg-amber-900/30   text-amber-700   dark:text-amber-400   border-amber-300   dark:border-amber-800",
  warehouse_ready:  "bg-teal-50    dark:bg-teal-900/30    text-teal-700    dark:text-teal-400    border-teal-300    dark:border-teal-800",
  in_shipping:      "bg-sky-50     dark:bg-sky-900/30     text-sky-700     dark:text-sky-400     border-sky-300     dark:border-sky-800",
  received:         "bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 border-emerald-300 dark:border-emerald-800",
  delayed:          "bg-blue-50    dark:bg-blue-900/30    text-blue-700    dark:text-blue-400    border-blue-300    dark:border-blue-800",
  returned:         "bg-red-50     dark:bg-red-900/30     text-red-700     dark:text-red-400     border-red-300     dark:border-red-800",
  partial_received: "bg-purple-50  dark:bg-purple-900/30  text-purple-700  dark:text-purple-400  border-purple-300  dark:border-purple-800",
};

const STATUS_OPTIONS = [
  { value: "pending",          label: "قيد الانتظار",          color: "text-amber-500" },
  { value: "warehouse_ready",  label: "قيد الشحن في المخزن",   color: "text-teal-500" },
  { value: "in_shipping",      label: "قيد الشحن",              color: "text-sky-500" },
  { value: "received",         label: "استلم",                  color: "text-emerald-500" },
  { value: "delayed",          label: "مؤجل",                   color: "text-blue-500" },
  { value: "returned",         label: "مرتجع",                  color: "text-red-500" },
  { value: "partial_received", label: "استلم جزئي",             color: "text-purple-500" },
];

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat("ar-EG", { style: "currency", currency: "EGP", maximumFractionDigits: 0 }).format(amount);

export default function Orders() {
  const [search, setSearch] = useState("");
  const [customerSearch, setCustomerSearch] = useState("");
  const [status, setStatus] = useState<string>("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [filterProduct, setFilterProduct] = useState("");
  const [filterCity, setFilterCity] = useState("all");
  const [filterShippingCo, setFilterShippingCo] = useState("all");
  const [filterAmountMin, setFilterAmountMin] = useState("");
  const [filterAmountMax, setFilterAmountMax] = useState("");
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const debouncedSearch = useDebounce(search, 300);
  const debouncedProduct = useDebounce(filterProduct, 300);
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user, isAdmin } = useAuth();
  // canWriteOrders: أدمن أو عنده صلاحية orders_write
  const canWriteOrders = isAdmin || (user?.permissions?.includes("orders_write") ?? false);
  const updateOrder = useUpdateOrder();
  const [waOrder, setWaOrder] = useState<WhatsAppOrderData | null>(null);
  const waOrderRef = useRef<WhatsAppOrderData | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [bulkSelectMode, setBulkSelectMode] = useState(false);
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);
  const [isBulkUpdating, setIsBulkUpdating] = useState(false);
  const [pendingBulkStatus, setPendingBulkStatus] = useState<string | null>(null);

  const { data: orders, isLoading } = useQuery({
    queryKey: ["orders-list", debouncedSearch, status, dateFrom, dateTo, filterShippingCo],
    queryFn: () => ordersApi.list({
      search: debouncedSearch || undefined,
      status: status !== "all" ? status : undefined,
      dateFrom: dateFrom || undefined,
      dateTo: dateTo || undefined,
      shippingCompanyId: filterShippingCo !== "all" ? filterShippingCo : undefined,
    }),
    staleTime: 15_000,
    gcTime: 60_000,
  } as any);

  // IDs of orders already in a shipping manifest (to detect "still in warehouse")
  const { data: inManifestData } = useQuery({
    queryKey: ["orders-in-manifest-ids"],
    queryFn: () => ordersApi.inManifestIds(),
    staleTime: 0,
  });
  const inManifestSet = new Set(inManifestData?.ids ?? []);

  const { data: shippingCompanies } = useQuery({
    queryKey: ["shipping-companies"],
    queryFn: shippingApi.list,
    staleTime: 60_000,
  });

  const rawFiltered = orders?.filter(o => {
    if (customerSearch && !o.customerName?.toLowerCase().includes(customerSearch.toLowerCase())) return false;
    if (debouncedProduct && !o.product?.toLowerCase().includes(debouncedProduct.toLowerCase())) return false;
    if (filterCity !== "all" && (o as any).city !== filterCity) return false;
    if (filterAmountMin && o.totalPrice < parseFloat(filterAmountMin)) return false;
    if (filterAmountMax && o.totalPrice > parseFloat(filterAmountMax)) return false;
    return true;
  }) ?? [];

  const filtered = rawFiltered;

  const allCities = [...new Set(orders?.map(o => (o as any).city).filter(Boolean) ?? [])].sort((a,b) => a.localeCompare(b, "ar"));

  const advancedFiltersCount = [
    dateTo, filterProduct, filterCity !== "all", filterShippingCo !== "all", filterAmountMin, filterAmountMax
  ].filter(Boolean).length;

  const hasActiveFilter = search || customerSearch || status !== "all" || dateFrom || advancedFiltersCount > 0;

  const clearFilters = () => {
    setSearch(""); setCustomerSearch(""); setStatus("all"); setDateFrom(""); setDateTo("");
    setFilterProduct(""); setFilterCity("all"); setFilterShippingCo("all");
    setFilterAmountMin(""); setFilterAmountMax("");
  };

  const toggleSelect = (order: (typeof filtered)[0]) => {
    const ids: number[] = (order as any)._groupIds?.length > 1
      ? (order as any)._groupIds
      : [order.id];
    setSelectedIds(prev => {
      const next = new Set(prev);
      const allSelected = ids.every(id => next.has(id));
      if (allSelected) ids.forEach(id => next.delete(id));
      else ids.forEach(id => next.add(id));
      return next;
    });
  };

  const isGroupSelected = (order: (typeof filtered)[0]) => {
    const ids: number[] = (order as any)._groupIds?.length > 1
      ? (order as any)._groupIds
      : [order.id];
    return ids.every(id => selectedIds.has(id));
  };

  const toggleSelectAll = () => {
    const allIds = filtered.flatMap(o => (o as any)._groupIds?.length > 1 ? (o as any)._groupIds : [o.id]);
    setSelectedIds(selectedIds.size === allIds.length ? new Set() : new Set(allIds));
  };

  const exitBulkMode = () => { setBulkSelectMode(false); setSelectedIds(new Set()); };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;

    // ── تحقق من وجود طلبات في بيان مفتوح ─────────────────────────────────
    const lockedIds = Array.from(selectedIds).filter(id => inManifestSet.has(id));
    if (lockedIds.length > 0) {
      toast({
        title: "⛔ لا يمكن حذف بعض الطلبات",
        description: `${lockedIds.length} طلب مرتبط ببيان شحن مفتوح — لا يمكن حذفه إلا بعد إغلاق البيان من قسم شركات الشحن.`,
        variant: "destructive",
      });
      setShowBulkDeleteConfirm(false);
      return;
    }

    setIsBulkDeleting(true);
    try {
      const token = localStorage.getItem("caprina_token");
      const res = await fetch("/api/orders/bulk", {
        method: "DELETE",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ ids: Array.from(selectedIds) }),
      });
      const data = await res.json();
      await queryClient.refetchQueries({ queryKey: ["orders-list"] });
      const skippedMsg = data.skipped > 0 ? ` (${data.skipped} محظور — مسلّمة)` : "";
      toast({ title: `تم حذف ${data.deleted} طلب ✅`, description: `تم حذف الطلبات بنجاح${skippedMsg}` });
      exitBulkMode();
    } catch {
      toast({ title: "خطأ", description: "فشل حذف الطلبات", variant: "destructive" });
    } finally {
      setIsBulkDeleting(false);
      setShowBulkDeleteConfirm(false);
    }
  };

  const handleBulkStatusChange = async (newStatus: string) => {
    if (selectedIds.size === 0) return;

    // ── تحقق من وجود طلبات في بيان مفتوح ─────────────────────────────────
    const lockedIds = Array.from(selectedIds).filter(id => inManifestSet.has(id));
    if (lockedIds.length > 0) {
      toast({
        title: "⛔ لا يمكن تعديل حالة بعض الطلبات",
        description: `${lockedIds.length} طلب مرتبط ببيان شحن مفتوح — يجب تعديل حالته من داخل البيان في قسم شركات الشحن فقط.`,
        variant: "destructive",
      });
      setPendingBulkStatus(null);
      return;
    }
    setIsBulkUpdating(true);
    let done = 0;
    let failed = 0;
    const ids = Array.from(selectedIds);
    for (const id of ids) {
      try {
        await new Promise<void>((resolve, reject) => {
          updateOrder.mutate(
            { id, data: { status: newStatus as any } },
            { onSuccess: () => resolve(), onError: () => reject() }
          );
        });
        done++;
      } catch {
        failed++;
      }
    }
    queryClient.invalidateQueries({ queryKey: ["orders-list"] });
    const label = statusLabels[newStatus] ?? newStatus;
    const failedMsg = failed > 0 ? ` (${failed} فشل)` : "";
    toast({ title: `تم تحديث ${done} طلب ✅`, description: `تم تغيير الحالة إلى «${label}»${failedMsg}` });
    setPendingBulkStatus(null);
    exitBulkMode();
    setIsBulkUpdating(false);
  };

  const handleWhatsApp = (e: React.MouseEvent, order: NonNullable<typeof orders>[0]) => {
    e.stopPropagation();
    const wa: WhatsAppOrderData = { id: order.id, customerName: order.customerName, product: order.product, quantity: order.quantity, totalPrice: order.totalPrice, status: order.status, phone: order.phone };
    waOrderRef.current = wa;
    setWaOrder(wa);
  };

  const handleWaSent = (orderId: number, currentStatus: string) => {
    if (currentStatus === "pending") {
      updateOrder.mutate(
        { id: orderId, data: { status: "warehouse_ready" as UpdateOrderBodyStatus } },
        { onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["orders-list"] }); toast({ title: "تم إرسال واتساب ✅", description: `تم تحويل الطلب #${orderId.toString().padStart(4,"0")} لـ «قيد الشحن في المخزن»` }); } }
      );
    } else {
      toast({ title: "تم فتح واتساب ✅", description: "الرسالة جاهزة للإرسال" });
    }
  };

  return (
    <div className="space-y-5 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">الطلبات</h1>
          <p className="text-muted-foreground text-sm mt-0.5">إدارة وتتبع جميع الطلبات</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap justify-end">
          {canWriteOrders && (bulkSelectMode ? (
            <>
              <Button variant="outline" size="sm" className="gap-1 text-xs h-9" onClick={exitBulkMode}>
                <X className="w-3.5 h-3.5" />إلغاء
              </Button>

              {/* تغيير الحالة بالجملة */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1 text-xs h-9 border-primary/50 text-primary"
                    disabled={selectedIds.size === 0 || isBulkUpdating}
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isBulkUpdating ? "animate-spin" : ""}`} />
                    تغيير الحالة {selectedIds.size > 0 ? `(${selectedIds.size})` : ""}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-44" style={{ direction: "rtl" }}>
                  {STATUS_OPTIONS.map(opt => (
                    <DropdownMenuItem
                      key={opt.value}
                      className={`text-xs font-semibold gap-2 cursor-pointer ${opt.color}`}
                      onClick={() => setPendingBulkStatus(opt.value)}
                    >
                      <span className="w-2 h-2 rounded-full bg-current shrink-0" />
                      {opt.label}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>

              {/* حذف بالجملة */}
              {(() => {
                const lockedCount = Array.from(selectedIds).filter(id => inManifestSet.has(id)).length;
                return (
                  <Button
                    size="sm"
                    className="gap-1 text-xs h-9 bg-destructive text-destructive-foreground hover:bg-destructive/90 disabled:opacity-50"
                    disabled={selectedIds.size === 0 || lockedCount > 0}
                    title={lockedCount > 0 ? `${lockedCount} طلب مرتبط ببيان مفتوح — أغلق البيان أولاً` : undefined}
                    onClick={() => setShowBulkDeleteConfirm(true)}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    حذف {selectedIds.size > 0 ? `(${selectedIds.size})` : ""}
                    {lockedCount > 0 && <span className="text-[9px] bg-white/20 rounded px-1">⛔ {lockedCount} مرتبط ببيان شحن</span>}
                  </Button>
                );
              })()}
            </>
          ) : (
            <>
              <Button variant="outline" size="sm" className="gap-1 text-xs h-9" onClick={() => setBulkSelectMode(true)}>
                <CheckSquare className="w-3.5 h-3.5" />تحديد
              </Button>
              <Link href="/orders/new">
                <Button className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90 font-bold text-sm">
                  <Plus className="w-4 h-4" />طلب جديد
                </Button>
              </Link>
            </>
          ))}
        </div>
      </div>

      <Card className="border-border overflow-hidden">
        <div className="p-3 border-b border-border bg-muted/10 flex flex-col gap-2">
          {/* ── بحث اسم العميل realtime ── */}
          <div className="relative">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-primary/60" />
            <Input
              placeholder="ابحث باسم العميل..."
              className="pr-9 bg-card text-sm h-10 font-medium border-primary/30 focus-visible:ring-primary/40 placeholder:text-muted-foreground/60"
              value={customerSearch}
              onChange={e => setCustomerSearch(e.target.value)}
            />
            {customerSearch && (
              <>
                <button
                  className="absolute left-9 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  onClick={() => setCustomerSearch("")}
                >
                  <X className="w-3.5 h-3.5" />
                </button>
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-primary bg-primary/10 px-1.5 py-0.5 rounded-full">
                  {filtered.length}
                </span>
              </>
            )}
          </div>

          {/* ── الصف الأول: بحث عام + حالة + زر فلتر متقدم ── */}
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input placeholder="ابحث بالمنتج أو الهاتف..." className="pr-9 bg-card text-sm h-9" value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="w-full sm:w-48 bg-card h-9 text-sm">
                <div className="flex items-center gap-2"><Filter className="w-3.5 h-3.5 text-muted-foreground" /><SelectValue /></div>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">جميع الطلبات</SelectItem>
                <SelectItem value="pending">قيد الانتظار</SelectItem>
                <SelectItem value="warehouse_ready">قيد الشحن في المخزن</SelectItem>
                <SelectItem value="in_shipping">قيد الشحن</SelectItem>
                <SelectItem value="received">استلم</SelectItem>
                <SelectItem value="delayed">مؤجل</SelectItem>
                <SelectItem value="returned">مرتجع</SelectItem>
                <SelectItem value="partial_received">استلم جزئي</SelectItem>
              </SelectContent>
            </Select>
            <Button
              variant={showAdvancedFilters ? "default" : "outline"}
              size="sm"
              className="h-9 gap-1.5 text-xs font-bold shrink-0 px-3"
              onClick={() => setShowAdvancedFilters(v => !v)}
            >
              <Filter className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">فلتر متقدم</span>
              <span className="sm:hidden">فلتر</span>
              {advancedFiltersCount > 0 && (
                <span className="bg-primary-foreground text-primary rounded-full w-4 h-4 text-[9px] font-black flex items-center justify-center">
                  {advancedFiltersCount}
                </span>
              )}
            </Button>
          </div>

          {/* ── الصف الثاني: تاريخ من + مسح ── */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative">
              <CalendarDays className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
              <Input type="date" className="pr-9 bg-card text-sm h-8 w-40 text-xs" value={dateFrom} onChange={e => setDateFrom(e.target.value)} title="من تاريخ" />
            </div>
            <span className="text-xs text-muted-foreground">←</span>
            <div className="relative">
              <CalendarDays className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
              <Input type="date" className="pr-9 bg-card text-sm h-8 w-40 text-xs" value={dateTo} onChange={e => setDateTo(e.target.value)} title="إلى تاريخ" />
            </div>
            {hasActiveFilter && (
              <Button variant="ghost" size="sm" className="h-8 text-xs gap-1 text-muted-foreground" onClick={clearFilters}>
                <X className="w-3 h-3" />مسح الكل
              </Button>
            )}
            {bulkSelectMode && filtered.length > 0 && canWriteOrders && (
              <Button variant="ghost" size="sm" className="h-8 text-xs gap-1 mr-auto" onClick={toggleSelectAll}>
                {selectedIds.size === filtered.length ? "إلغاء تحديد الكل" : `تحديد الكل (${filtered.length})`}
              </Button>
            )}
          </div>

          {/* ── فلاتر متقدمة ── */}
          {showAdvancedFilters && (
            <div className="rounded-lg border border-border bg-card p-3 space-y-3 mt-1">
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide">فلاتر متقدمة للجرد والتحليل</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {/* فلتر المنتج */}
                <div>
                  <p className="text-[10px] text-muted-foreground mb-1 font-semibold">📦 المنتج</p>
                  <div className="relative">
                    <Search className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground pointer-events-none" />
                    <Input
                      placeholder="اسم المنتج..."
                      className="pr-7 h-8 text-xs bg-background"
                      value={filterProduct}
                      onChange={e => setFilterProduct(e.target.value)}
                    />
                  </div>
                </div>

                {/* فلتر المحافظة */}
                <div>
                  <p className="text-[10px] text-muted-foreground mb-1 font-semibold">📍 المحافظة</p>
                  <Select value={filterCity} onValueChange={setFilterCity}>
                    <SelectTrigger className="h-8 text-xs bg-background"><SelectValue placeholder="كل المحافظات" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">كل المحافظات</SelectItem>
                      {allCities.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>

                {/* فلتر شركة الشحن */}
                <div>
                  <p className="text-[10px] text-muted-foreground mb-1 font-semibold">🚚 شركة الشحن</p>
                  <Select value={filterShippingCo} onValueChange={setFilterShippingCo}>
                    <SelectTrigger className="h-8 text-xs bg-background"><SelectValue placeholder="كل الشركات" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">كل الشركات</SelectItem>
                      {shippingCompanies?.map(c => (
                        <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* فلتر نطاق المبلغ */}
                <div className="sm:col-span-2 lg:col-span-3">
                  <p className="text-[10px] text-muted-foreground mb-1 font-semibold">💰 نطاق المبلغ (ج.م)</p>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      placeholder="من"
                      className="h-8 text-xs bg-background w-28"
                      value={filterAmountMin}
                      onChange={e => setFilterAmountMin(e.target.value)}
                    />
                    <span className="text-xs text-muted-foreground">—</span>
                    <Input
                      type="number"
                      placeholder="إلى"
                      className="h-8 text-xs bg-background w-28"
                      value={filterAmountMax}
                      onChange={e => setFilterAmountMax(e.target.value)}
                    />
                    {(filterAmountMin || filterAmountMax) && (
                      <Button variant="ghost" size="sm" className="h-8 text-xs gap-1 text-muted-foreground px-2"
                        onClick={() => { setFilterAmountMin(""); setFilterAmountMax(""); }}>
                        <X className="w-3 h-3" />
                      </Button>
                    )}
                  </div>
                </div>
              </div>

              {/* إحصاء النتائج */}
              <div className="flex items-center justify-between pt-1 border-t border-border/50">
                <p className="text-[10px] text-muted-foreground">
                  {filtered.length} نتيجة
                  {filtered.length > 0 && (
                    <span className="mr-2 text-primary font-bold">
                      إجمالي: {new Intl.NumberFormat("ar-EG", { style: "currency", currency: "EGP", maximumFractionDigits: 0 }).format(filtered.reduce((s, o) => s + o.totalPrice, 0))}
                    </span>
                  )}
                </p>
                {advancedFiltersCount > 0 && (
                  <Button variant="ghost" size="sm" className="h-6 text-[10px] gap-1 text-muted-foreground"
                    onClick={() => { setFilterProduct(""); setFilterCity("all"); setFilterShippingCo("all"); setFilterAmountMin(""); setFilterAmountMax(""); setDateTo(""); }}>
                    <X className="w-2.5 h-2.5" />مسح الفلاتر المتقدمة
                  </Button>
                )}
              </div>
            </div>
          )}
        </div>

        {isLoading ? (
          <div className="p-8 text-center text-muted-foreground text-sm">جاري التحميل...</div>
        ) : filtered.length > 0 ? (
          <>
            {/* ── Mobile ── */}
            <div className="sm:hidden divide-y divide-border">
              {filtered.map((order) => {
                const isGroup = !!(order as any)._groupCount && (order as any)._groupCount > 1;
                const waStatuses = new Set(["pending","warehouse_ready","in_shipping","delayed"]);
                const groupStatuses: string[] = (order as any)._groupStatuses ?? [order.status];
                const canWhatsApp = canWriteOrders && !bulkSelectMode && groupStatuses.some(s => waStatuses.has(s));
                const retReason = (order as any).returnReason as string | null;
                const retNote   = (order as any).returnNote   as string | null;
                const isSelected = isGroupSelected(order);
                const groupCount = (order as any)._groupCount as number | undefined;
                const navTarget = isGroup && order.invoiceNumber
                  ? `/invoices/${encodeURIComponent(order.invoiceNumber)}`
                  : `/orders/${order.id}`;
                return (
                  <div
                    key={order.id}
                    className={`flex items-center gap-3 px-4 py-3 hover:bg-muted/10 active:bg-muted/20 cursor-pointer ${isSelected ? "bg-primary/5" : ""}`}
                    onClick={() => canWriteOrders && bulkSelectMode ? toggleSelect(order) : (window.location.href = navTarget)}
                  >
                    {canWriteOrders && bulkSelectMode && (
                      <Checkbox checked={isSelected} onCheckedChange={() => toggleSelect(order)} onClick={e => e.stopPropagation()} className="shrink-0" />
                    )}
                    <div className="w-9 h-9 rounded-full bg-muted flex items-center justify-center text-xs font-bold text-foreground shrink-0">
                      {order.customerName.charAt(0)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-bold text-sm truncate">{order.customerName}</p>
                        <span className="font-bold text-xs text-primary shrink-0">
                          {order.status === "partial_received" && (order as any)._receivedPrice != null
                            ? <>{formatCurrency((order as any)._receivedPrice)}<span className="line-through text-muted-foreground font-normal mr-1 text-[9px]">{formatCurrency(order.totalPrice)}</span></>
                            : formatCurrency(order.totalPrice)}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[10px] text-muted-foreground font-mono">#{order.id.toString().padStart(4,"0")}</span>
                        {isGroup && groupCount && (
                          <span className="text-[9px] font-bold text-primary bg-primary/10 px-1.5 py-0.5 rounded-full">{groupCount} منتجات</span>
                        )}
                        <span className="text-[10px] text-muted-foreground truncate">{order.product}</span>
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant="outline" className={`text-[9px] font-bold border ${statusClasses[order.status] || ""}`}>
                          {statusLabels[order.status] || order.status}
                        </Badge>
                        {order.status === "warehouse_ready" && (
                          <span className="inline-flex items-center gap-0.5 text-[9px] font-bold text-amber-500 dark:text-amber-400">🏠 ما زال في المخزن</span>
                        )}
                        {order.status === "returned" && (() => {
                          const rr = (order as any).returnReceived as 0 | 1 | null | undefined;
                          if (rr === 0) return <span className="inline-flex items-center gap-0.5 text-[9px] font-bold text-orange-500 dark:text-orange-400">⏳ عند شركة الشحن</span>;
                          return null;
                        })()}
                        {order.status === "partial_received" && (() => {
                          const rr = (order as any).returnReceived as 0 | 1 | null | undefined;
                          const pq = (order as any).partialQuantity as number | null | undefined;
                          const qty = (order as any).quantity as number | undefined;
                          return (
                            <span className="inline-flex flex-col gap-0 text-[9px] font-bold leading-tight">
                              {pq != null && qty != null && <span className="text-teal-600 dark:text-teal-400">✓ استُلم {pq} من {qty}</span>}
                              {rr === 0 && <span className="text-orange-500 dark:text-orange-400">🚚 الباقي عند الشحن</span>}
                              {rr === 1 && <span className="text-emerald-600 dark:text-emerald-400">↩ الباقي في المخزن</span>}
                            </span>
                          );
                        })()}
                        {order.status === "returned" && retReason && (
                          <span className="text-[9px] text-red-600 dark:text-red-400">{retReason === "other" && retNote ? retNote : returnReasonLabel(retReason)}</span>
                        )}
                        <span className="text-[9px] text-muted-foreground mr-auto">{format(new Date(order.createdAt), "MM/dd")}</span>
                      </div>
                    </div>
                    {canWhatsApp && (
                      <button className="shrink-0 w-9 h-9 rounded-full text-green-500 hover:bg-green-500/10 flex items-center justify-center" onClick={(e) => handleWhatsApp(e, order)}>
                        <MessageCircle className="w-4.5 h-4.5" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>

            {/* ── Desktop ── */}
            <div className="hidden sm:block overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-border hover:bg-transparent">
                    {canWriteOrders && bulkSelectMode && (
                      <TableHead className="w-10 text-center">
                        <Checkbox checked={selectedIds.size === filtered.length && filtered.length > 0} onCheckedChange={toggleSelectAll} />
                      </TableHead>
                    )}
                    <TableHead className="text-right text-xs">#</TableHead>
                    <TableHead className="text-right text-xs">التاريخ</TableHead>
                    <TableHead className="text-right text-xs">العميل</TableHead>
                    <TableHead className="text-right text-xs">الهاتف</TableHead>
                    <TableHead className="text-right text-xs">المنتج</TableHead>
                    <TableHead className="text-right text-xs">الإجمالي</TableHead>
                    <TableHead className="text-right text-xs">المنشئ</TableHead>
                    <TableHead className="text-center text-xs w-36">الحالة</TableHead>
                    <TableHead className="text-center text-xs w-10"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((order, rowIndex) => {
                    const retReason  = (order as any).returnReason as string | null;
                    const retNote    = (order as any).returnNote   as string | null;
                    const isGroup = !!(order as any)._groupCount && (order as any)._groupCount > 1;
                    const waStatuses = new Set(["pending","warehouse_ready","in_shipping","delayed"]);
                    const groupStatuses: string[] = (order as any)._groupStatuses ?? [order.status];
                    const canWhatsApp = canWriteOrders && !bulkSelectMode && groupStatuses.some(s => waStatuses.has(s));
                    const isSelected  = isGroupSelected(order);
                    const groupCount = (order as any)._groupCount as number | undefined;
                    const navTarget = isGroup && order.invoiceNumber
                      ? `/invoices/${encodeURIComponent(order.invoiceNumber)}`
                      : `/orders/${order.id}`;
                    return (
                      <TableRow
                        key={order.id}
                        className={`border-border hover:bg-muted/20 cursor-pointer ${isSelected ? "bg-primary/5" : ""}`}
                        style={{
                          animation: "rowFadeIn 0.3s ease both",
                          animationDelay: `${Math.min(rowIndex * 35, 600)}ms`,
                        }}
                        onClick={() => canWriteOrders && bulkSelectMode ? toggleSelect(order) : (window.location.href = navTarget)}
                      >
                        {canWriteOrders && bulkSelectMode && (
                          <TableCell className="text-center p-2">
                            <Checkbox checked={isSelected} onCheckedChange={() => toggleSelect(order)} onClick={e => e.stopPropagation()} />
                          </TableCell>
                        )}
                        <TableCell className="font-mono text-xs text-primary font-bold">
                          #{order.id.toString().padStart(4,"0")}
                          {isGroup && groupCount && (
                            <span className="mr-1 text-[9px] font-bold text-primary bg-primary/10 px-1.5 py-0.5 rounded-full">{groupCount} منتجات</span>
                          )}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">{format(new Date(order.createdAt), "yyyy/MM/dd")}</TableCell>
                        <TableCell className="text-sm font-semibold">{order.customerName}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{order.phone || "—"}</TableCell>
                        <TableCell className="text-xs max-w-[200px]">
                          <span className="truncate block">{order.product}</span>
                          {!isGroup && <span className="text-muted-foreground">×{order.quantity}</span>}
                        </TableCell>
                        <TableCell className="text-xs font-bold text-primary">
                          {order.status === "partial_received" && (order as any)._receivedPrice != null
                            ? <div><span>{formatCurrency((order as any)._receivedPrice)}</span><div className="line-through text-muted-foreground font-normal text-[9px]">{formatCurrency(order.totalPrice)}</div></div>
                            : formatCurrency(order.totalPrice)}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {(order as any).createdByName
                            ? <span className="inline-flex items-center gap-1 bg-muted px-1.5 py-0.5 rounded-full text-[10px] font-medium"><span>👤</span>{(order as any).createdByName}</span>
                            : <span className="text-muted-foreground/50">—</span>}
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge variant="outline" className={`text-[9px] font-bold border ${statusClasses[order.status] || ""}`}>
                            {statusLabels[order.status] || order.status}
                          </Badge>
                          {order.status === "warehouse_ready" && (
                            <div className="flex items-center justify-center gap-0.5 mt-1">
                              <span className="text-[9px] font-bold text-amber-500 dark:text-amber-400 leading-none">🏠 ما زال في المخزن</span>
                            </div>
                          )}
                          {order.status === "returned" && (() => {
                            const rr = (order as any).returnReceived as 0 | 1 | null | undefined;
                            if (rr === 0) return <div className="flex items-center justify-center gap-0.5 mt-1"><span className="text-[9px] font-bold text-orange-500 dark:text-orange-400 leading-none">⏳ عند شركة الشحن</span></div>;
                            return null;
                          })()}
                          {order.status === "partial_received" && (() => {
                            const rr = (order as any).returnReceived as 0 | 1 | null | undefined;
                            const pq = (order as any).partialQuantity as number | null | undefined;
                            const qty = (order as any).quantity as number | undefined;
                            return (
                              <div className="flex flex-col items-center gap-0 mt-1 text-[9px] font-bold leading-tight">
                                {pq != null && qty != null && <span className="text-teal-600 dark:text-teal-400">✓ استُلم {pq} من {qty}</span>}
                                {rr === 0 && <span className="text-orange-500 dark:text-orange-400">🚚 الباقي عند الشحن</span>}
                                {rr === 1 && <span className="text-emerald-600 dark:text-emerald-400">↩ الباقي في المخزن</span>}
                              </div>
                            );
                          })()}
                          {order.status === "returned" && retReason && (
                            <div className="flex items-center justify-center gap-0.5 mt-1">
                              <RotateCcw className="w-2.5 h-2.5 text-red-500 shrink-0" />
                              <span className="text-[9px] text-red-600 dark:text-red-400 leading-none">
                                {retReason === "other" && retNote ? retNote : returnReasonLabel(retReason)}
                              </span>
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="text-center p-1">
                          {canWhatsApp && (
                            <Button size="icon" variant="ghost" className="h-7 w-7 rounded-full text-green-500 hover:text-green-400 hover:bg-green-500/10" onClick={(e) => handleWhatsApp(e, order)}>
                              <MessageCircle className="w-4 h-4" />
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </>
        ) : (
          <div className="p-12 text-center">
            <Package className="w-10 h-10 mx-auto mb-3 text-muted-foreground opacity-20" />
            <p className="font-bold text-foreground">لا توجد طلبات</p>
            <p className="text-sm text-muted-foreground mt-1">{hasActiveFilter ? "جرّب تغيير معايير البحث." : "لا يوجد طلبات حتى الآن."}</p>
          </div>
        )}
      </Card>

      {filtered.length > 0 && (
        <p className="text-xs text-muted-foreground text-left">
          إجمالي {filtered.length} طلب
          {orders && filtered.length !== orders.length && ` (من ${orders.length})`}
          {bulkSelectMode && selectedIds.size > 0 && ` — محدد: ${selectedIds.size}`}
        </p>
      )}

      <WhatsAppDialog
        open={!!waOrder}
        onOpenChange={open => { if (!open) setWaOrder(null); }}
        order={waOrder}
        onSent={() => {
          const snap = waOrderRef.current;
          if (snap) handleWaSent(snap.id, snap.status);
        }}
      />

      {/* تأكيد الحذف بالجملة */}
      <AlertDialog open={showBulkDeleteConfirm} onOpenChange={setShowBulkDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>تأكيد حذف الطلبات</AlertDialogTitle>
            <AlertDialogDescription>
              هتحذف {selectedIds.size} طلب. الطلبات المسلّمة لن تُحذف إلا إذا كنت مدير. هذا الإجراء لا يمكن التراجع عنه.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={handleBulkDelete} disabled={isBulkDeleting}>
              {isBulkDeleting ? "جاري الحذف..." : `حذف ${selectedIds.size} طلب`}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* تأكيد تغيير الحالة بالجملة */}
      <AlertDialog open={!!pendingBulkStatus} onOpenChange={open => { if (!open) setPendingBulkStatus(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>تأكيد تغيير الحالة</AlertDialogTitle>
            <AlertDialogDescription>
              هتغير حالة {selectedIds.size} طلب إلى «{statusLabels[pendingBulkStatus ?? ""] ?? pendingBulkStatus}». هل أنت متأكد؟
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction onClick={() => pendingBulkStatus && handleBulkStatusChange(pendingBulkStatus)} disabled={isBulkUpdating}>
              {isBulkUpdating ? "جاري التحديث..." : "تأكيد"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
