import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { createPortal } from "react-dom";
import { Link } from "wouter";
import { format } from "date-fns";
import { Search, Filter, Plus, Package, CalendarDays, X, RotateCcw, MessageCircle, Trash2, CheckSquare, RefreshCw, ChevronUp, ChevronDown } from "lucide-react";
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

// ── ColFilterBtn: فلتر Excel لكل عمود ─────────────────────────────────────
type ColKey = "id" | "date" | "customer" | "phone" | "product" | "total" | "creator" | "status";
type ColFilters = Record<ColKey, Set<string>>;

function ColFilterBtn({ col, colFilters, getColOptions, toggleColFilter, clearColFilter, sortCol, sortDir, onSort }: {
  col: ColKey;
  colFilters: ColFilters;
  getColOptions: (col: ColKey) => string[];
  toggleColFilter: (col: ColKey, val: string) => void;
  clearColFilter: (col: ColKey) => void;
  sortCol: ColKey | null;
  sortDir: "asc" | "desc";
  onSort: (col: ColKey, dir: "asc" | "desc") => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const sort = sortCol === col ? sortDir : "asc";
  const btnRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const active = colFilters[col].size > 0;

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (
        panelRef.current && !panelRef.current.contains(e.target as Node) &&
        btnRef.current && !btnRef.current.contains(e.target as Node)
      ) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const handleOpen = () => {
    if (!open && btnRef.current) {
      const r = btnRef.current.getBoundingClientRect();
      const panelW = 208;
      const left = Math.max(4, Math.min(r.left, window.innerWidth - panelW - 4));
      setPos({ top: r.bottom + 4, left });
    }
    setOpen(o => !o);
    setSearch("");
  };

  let opts = getColOptions(col);
  if (search) opts = opts.filter(v => v.toLowerCase().includes(search.toLowerCase()));
  if (sort === "desc") opts = [...opts].reverse();

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        onClick={handleOpen}
        title="فلتر"
        className={`inline-flex items-center justify-center w-5 h-5 rounded transition-all shrink-0 ${active ? "text-primary bg-primary/15" : "text-muted-foreground hover:text-foreground hover:bg-muted/40"}`}
      >
        {active ? (
          <svg viewBox="0 0 24 24" className="w-3 h-3" fill="currentColor">
            <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>
          </svg>
        )}
      </button>
      {open && typeof document !== "undefined" && createPortal(
        <div
          ref={panelRef}
          style={{ position: "fixed", top: pos.top, left: pos.left, zIndex: 9999 }}
          className="bg-background border border-border rounded-lg shadow-2xl text-[11px] w-52"
          dir="rtl"
        >
          <div className="flex gap-1 p-2 border-b border-border/50">
            <button type="button" onClick={() => { onSort(col, "asc"); setOpen(false); }}
              className={`flex-1 flex items-center justify-center gap-1 px-2 py-1 rounded border text-[10px] transition-all ${sort === "asc" && sortCol === col ? "border-primary bg-primary/10 text-primary font-bold" : "border-border text-muted-foreground hover:bg-muted/30"}`}>
              <ChevronUp className="w-2.5 h-2.5" />أ→ي
            </button>
            <button type="button" onClick={() => { onSort(col, "desc"); setOpen(false); }}
              className={`flex-1 flex items-center justify-center gap-1 px-2 py-1 rounded border text-[10px] transition-all ${sort === "desc" && sortCol === col ? "border-primary bg-primary/10 text-primary font-bold" : "border-border text-muted-foreground hover:bg-muted/30"}`}>
              <ChevronDown className="w-2.5 h-2.5" />ي→أ
            </button>
          </div>
          <div className="px-2 pt-2">
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="بحث في القيم..."
              className="w-full h-7 text-[10px] px-2 border border-border rounded bg-muted/30 focus:outline-none focus:ring-1 focus:ring-primary" />
          </div>
          <div className="max-h-52 overflow-y-auto px-1 py-1.5 flex flex-col gap-0.5">
            {opts.length === 0
              ? <p className="text-muted-foreground text-center py-3 text-[10px]">لا توجد قيم</p>
              : opts.map(val => (
                <label key={val} className="flex items-center gap-2 px-2 py-1 rounded hover:bg-muted/40 cursor-pointer">
                  <input type="checkbox" checked={colFilters[col].has(val)}
                    onChange={() => toggleColFilter(col, val)}
                    className="accent-primary w-3 h-3 shrink-0" />
                  <span className="truncate">{val}</span>
                </label>
              ))
            }
          </div>
          {active && (
            <div className="border-t border-border/50 px-2 py-1.5">
              <button type="button" onClick={() => { clearColFilter(col); setOpen(false); }}
                className="text-destructive text-[10px] hover:underline w-full text-right">
                مسح الفلتر
              </button>
            </div>
          )}
        </div>,
        document.body
      )}
    </>
  );
}

export default function Orders() {
  const [search, setSearch] = useState("");
  const [customerSearch, setCustomerSearch] = useState("");
  const [status, setStatus] = useState<string>("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [filterShippingCo, setFilterShippingCo] = useState("all");
  // ── Column Filters (Excel-style) ────────────────────────────────────────────
  const [colFilters, setColFilters] = useState<ColFilters>({
    id: new Set(), date: new Set(), customer: new Set(), phone: new Set(),
    product: new Set(), total: new Set(), creator: new Set(), status: new Set(),
  });
  const colFilterHasActive = Object.values(colFilters).some(s => s.size > 0);
  const [showColFilters, setShowColFilters] = useState(false);
  const [totalSearch, setTotalSearch] = useState("");
  const [sortCol, setSortCol] = useState<ColKey | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const handleSort = useCallback((col: ColKey, dir: "asc" | "desc") => {
    setSortCol(col);
    setSortDir(dir);
  }, []);
  const debouncedSearch = useDebounce(search, 300);
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

  const filtered = orders?.filter(o => {
    if (customerSearch && !o.customerName?.toLowerCase().includes(customerSearch.toLowerCase())) return false;
    if (totalSearch && !String(Math.round(o.totalPrice)).includes(totalSearch)) return false;
    return true;
  }) ?? [];

  // ── Col Filter helpers ──────────────────────────────────────────────────────
  const getColVal = useCallback((col: ColKey, o: (typeof filtered)[0]): string => {
    switch (col) {
      case "id":       return `#${o.id.toString().padStart(4,"0")}`;
      case "date":     return format(new Date(o.createdAt), "yyyy/MM/dd");
      case "customer": return o.customerName ?? "";
      case "phone":    return o.phone ?? "";
      case "product":  return o.product ?? "";
      case "total":    return String(Math.round(o.totalPrice));
      case "creator":  return (o as any).createdByName ?? "";
      case "status":   return statusLabels[o.status] ?? o.status;
      default:         return "";
    }
  }, []);

  const getColOptions = useCallback((col: ColKey): string[] => {
    const vals = [...new Set(filtered.map(o => getColVal(col, o)))].filter(Boolean);
    return vals.sort((a, b) => a.localeCompare(b, "ar"));
  }, [filtered, getColVal]);

  const toggleColFilter = useCallback((col: ColKey, val: string) => {
    setColFilters(prev => {
      const next = new Set(prev[col]);
      next.has(val) ? next.delete(val) : next.add(val);
      return { ...prev, [col]: next };
    });
  }, []);

  const clearColFilter = useCallback((col: ColKey) => {
    setColFilters(prev => ({ ...prev, [col]: new Set() }));
  }, []);

  const colFilteredRows = useMemo(() => {
    if (!colFilterHasActive) return filtered;
    return filtered.filter(o =>
      (Object.keys(colFilters) as ColKey[]).every(col => {
        const s = colFilters[col];
        if (s.size === 0) return true;
        return s.has(getColVal(col, o));
      })
    );
  }, [filtered, colFilters, colFilterHasActive, getColVal]);

  const displayRows = useMemo(() => {
    if (!sortCol) return colFilteredRows;
    return [...colFilteredRows].sort((a, b) => {
      const va = getColVal(sortCol, a);
      const vb = getColVal(sortCol, b);
      const cmp = va.localeCompare(vb, "ar", { numeric: true });
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [colFilteredRows, sortCol, sortDir, getColVal]);

  const hasActiveFilter = search || customerSearch || status !== "all" || dateFrom || dateTo;

  const clearFilters = () => {
    setSearch(""); setCustomerSearch(""); setStatus("all"); setDateFrom(""); setDateTo("");
    setFilterShippingCo("all");
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

  // عدد الفواتير المحددة (مش عدد الـ sub-IDs)
  const selectedInvoiceCount = filtered.filter(o => {
    const ids: number[] = (o as any)._groupIds?.length > 1 ? (o as any)._groupIds : [o.id];
    return ids.every(id => selectedIds.has(id));
  }).length;

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
      queryClient.invalidateQueries({ queryKey: ["archived-orders"] });
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
                    تغيير الحالة {selectedInvoiceCount > 0 ? `(${selectedInvoiceCount})` : ""}
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
                    حذف {selectedInvoiceCount > 0 ? `(${selectedInvoiceCount})` : ""}
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

          {/* ── الصف الأول: بحث عام + حالة ── */}
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
          </div>

          {/* ── الصف الثاني: تاريخ من + زر فلتر + مسح ── */}
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
            <button
              type="button"
              onClick={() => {
                if (showColFilters) {
                  setColFilters({ id: new Set(), date: new Set(), customer: new Set(), phone: new Set(), product: new Set(), total: new Set(), creator: new Set(), status: new Set() });
                  setSortCol(null);
                }
                setShowColFilters(v => !v);
              }}
              className={`h-8 flex items-center gap-1.5 px-3 rounded-lg border text-xs font-medium transition-all ${showColFilters ? "border-destructive/50 text-destructive bg-destructive/5 hover:bg-destructive/10" : "border-primary/40 text-primary bg-primary/5 hover:bg-primary/10"}`}
            >
              <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill={showColFilters ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>
              {showColFilters ? "إلغاء الفلتر" : "إنشاء فلتر"}
            </button>
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
                        <Checkbox checked={selectedIds.size === displayRows.length && displayRows.length > 0} onCheckedChange={toggleSelectAll} />
                      </TableHead>
                    )}
                    <TableHead className="text-right text-xs">
                      <div className="flex items-center gap-1">#{showColFilters && <ColFilterBtn col="id" colFilters={colFilters} getColOptions={getColOptions} toggleColFilter={toggleColFilter} clearColFilter={clearColFilter} sortCol={sortCol} sortDir={sortDir} onSort={handleSort} />}</div>
                    </TableHead>
                    <TableHead className="text-right text-xs">
                      <div className="flex items-center gap-1">التاريخ{showColFilters && <ColFilterBtn col="date" colFilters={colFilters} getColOptions={getColOptions} toggleColFilter={toggleColFilter} clearColFilter={clearColFilter} sortCol={sortCol} sortDir={sortDir} onSort={handleSort} />}</div>
                    </TableHead>
                    <TableHead className="text-right text-xs">
                      <div className="flex items-center gap-1">
                        {!showColFilters
                          ? <input
                              value={customerSearch}
                              onChange={e => setCustomerSearch(e.target.value)}
                              placeholder="العميل..."
                              className="w-24 h-5 text-[10px] px-1.5 border border-border rounded bg-muted/30 focus:outline-none focus:ring-1 focus:ring-primary"
                            />
                          : <span>العميل</span>
                        }
                        {showColFilters && <ColFilterBtn col="customer" colFilters={colFilters} getColOptions={getColOptions} toggleColFilter={toggleColFilter} clearColFilter={clearColFilter} sortCol={sortCol} sortDir={sortDir} onSort={handleSort} />}
                      </div>
                    </TableHead>
                    <TableHead className="text-right text-xs">
                      <div className="flex items-center gap-1">الهاتف{showColFilters && <ColFilterBtn col="phone" colFilters={colFilters} getColOptions={getColOptions} toggleColFilter={toggleColFilter} clearColFilter={clearColFilter} sortCol={sortCol} sortDir={sortDir} onSort={handleSort} />}</div>
                    </TableHead>
                    <TableHead className="text-right text-xs">
                      <div className="flex items-center gap-1">المنتج{showColFilters && <ColFilterBtn col="product" colFilters={colFilters} getColOptions={getColOptions} toggleColFilter={toggleColFilter} clearColFilter={clearColFilter} sortCol={sortCol} sortDir={sortDir} onSort={handleSort} />}</div>
                    </TableHead>
                    <TableHead className="text-right text-xs">
                      <div className="flex items-center gap-1">
                        {!showColFilters
                          ? <input
                              value={totalSearch}
                              onChange={e => setTotalSearch(e.target.value)}
                              placeholder="الإجمالي..."
                              className="w-20 h-5 text-[10px] px-1.5 border border-border rounded bg-muted/30 focus:outline-none focus:ring-1 focus:ring-primary"
                            />
                          : <span>الإجمالي</span>
                        }
                        {showColFilters && <ColFilterBtn col="total" colFilters={colFilters} getColOptions={getColOptions} toggleColFilter={toggleColFilter} clearColFilter={clearColFilter} sortCol={sortCol} sortDir={sortDir} onSort={handleSort} />}
                      </div>
                    </TableHead>
                    <TableHead className="text-right text-xs">
                      <div className="flex items-center gap-1">المنشئ{showColFilters && <ColFilterBtn col="creator" colFilters={colFilters} getColOptions={getColOptions} toggleColFilter={toggleColFilter} clearColFilter={clearColFilter} sortCol={sortCol} sortDir={sortDir} onSort={handleSort} />}</div>
                    </TableHead>
                    <TableHead className="text-center text-xs w-36">
                      <div className="flex items-center justify-center gap-1">الحالة{showColFilters && <ColFilterBtn col="status" colFilters={colFilters} getColOptions={getColOptions} toggleColFilter={toggleColFilter} clearColFilter={clearColFilter} sortCol={sortCol} sortDir={sortDir} onSort={handleSort} />}</div>
                    </TableHead>
                    <TableHead className="text-center text-xs w-10"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {displayRows.map((order, rowIndex) => {
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
          {bulkSelectMode && selectedIds.size > 0 && ` — محدد: ${selectedInvoiceCount}`}
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
              هتحذف {selectedInvoiceCount} طلب. الطلبات المسلّمة لن تُحذف إلا إذا كنت مدير. هذا الإجراء لا يمكن التراجع عنه.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={handleBulkDelete} disabled={isBulkDeleting}>
              {isBulkDeleting ? "جاري الحذف..." : `حذف ${selectedInvoiceCount} طلب`}
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
              هتغير حالة {selectedInvoiceCount} طلب إلى «{statusLabels[pendingBulkStatus ?? ""] ?? pendingBulkStatus}». هل أنت متأكد؟
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
