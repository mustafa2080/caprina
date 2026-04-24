import { useState } from "react";
import { Link } from "wouter";
import { format } from "date-fns";
import { Search, Filter, Plus, Package, CalendarDays, X, RotateCcw, MessageCircle, Trash2, CheckSquare, RefreshCw, Warehouse } from "lucide-react";
import { useListOrders, useUpdateOrder, getListOrdersQueryKey } from "@workspace/api-client-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
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
import { ordersApi } from "@/lib/api";

const statusLabels: Record<string, string> = {
  pending: "قيد الانتظار",
  in_shipping: "قيد الشحن",
  received: "استلم",
  delayed: "مؤجل",
  returned: "مرتجع",
  partial_received: "استلم جزئي",
};

const statusClasses: Record<string, string> = {
  pending:          "bg-amber-50   dark:bg-amber-900/30   text-amber-700   dark:text-amber-400   border-amber-300   dark:border-amber-800",
  in_shipping:      "bg-sky-50     dark:bg-sky-900/30     text-sky-700     dark:text-sky-400     border-sky-300     dark:border-sky-800",
  received:         "bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 border-emerald-300 dark:border-emerald-800",
  delayed:          "bg-blue-50    dark:bg-blue-900/30    text-blue-700    dark:text-blue-400    border-blue-300    dark:border-blue-800",
  returned:         "bg-red-50     dark:bg-red-900/30     text-red-700     dark:text-red-400     border-red-300     dark:border-red-800",
  partial_received: "bg-purple-50  dark:bg-purple-900/30  text-purple-700  dark:text-purple-400  border-purple-300  dark:border-purple-800",
};

const STATUS_OPTIONS = [
  { value: "pending",          label: "قيد الانتظار",  color: "text-amber-500" },
  { value: "in_shipping",      label: "قيد الشحن",     color: "text-sky-500" },
  { value: "received",         label: "استلم",          color: "text-emerald-500" },
  { value: "delayed",          label: "مؤجل",           color: "text-blue-500" },
  { value: "returned",         label: "مرتجع",          color: "text-red-500" },
  { value: "partial_received", label: "استلم جزئي",    color: "text-purple-500" },
];

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat("ar-EG", { style: "currency", currency: "EGP", maximumFractionDigits: 0 }).format(amount);

export default function Orders() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<string>("all");
  const [dateFrom, setDateFrom] = useState("");
  const debouncedSearch = useDebounce(search, 300);
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user } = useAuth();
  const updateOrder = useUpdateOrder();
  const [waOrder, setWaOrder] = useState<WhatsAppOrderData | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [bulkSelectMode, setBulkSelectMode] = useState(false);
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);
  const [isBulkUpdating, setIsBulkUpdating] = useState(false);
  const [pendingBulkStatus, setPendingBulkStatus] = useState<string | null>(null);

  const { data: orders, isLoading } = useListOrders(
    { search: debouncedSearch || undefined, status: status !== "all" ? status : undefined },
    { query: { staleTime: 15_000, gcTime: 60_000 } }
  );

  // IDs of orders already in a shipping manifest (to detect "still in warehouse")
  const { data: inManifestData } = useQuery({
    queryKey: ["orders-in-manifest-ids"],
    queryFn: () => ordersApi.inManifestIds(),
    staleTime: 30_000,
  });
  const inManifestSet = new Set(inManifestData?.ids ?? []);

  const filtered = orders?.filter(o => {
    if (!dateFrom) return true;
    return new Date(o.createdAt) >= new Date(dateFrom);
  }) ?? [];

  const hasActiveFilter = search || status !== "all" || dateFrom;

  const clearFilters = () => { setSearch(""); setStatus("all"); setDateFrom(""); };

  const toggleSelect = (id: number) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    setSelectedIds(selectedIds.size === filtered.length ? new Set() : new Set(filtered.map(o => o.id)));
  };

  const exitBulkMode = () => { setBulkSelectMode(false); setSelectedIds(new Set()); };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    setIsBulkDeleting(true);
    try {
      const token = localStorage.getItem("caprina_token");
      const res = await fetch("/api/orders/bulk", {
        method: "DELETE",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ ids: Array.from(selectedIds) }),
      });
      const data = await res.json();
      await queryClient.refetchQueries({ queryKey: getListOrdersQueryKey() });
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
    queryClient.invalidateQueries({ queryKey: getListOrdersQueryKey() });
    const label = statusLabels[newStatus] ?? newStatus;
    const failedMsg = failed > 0 ? ` (${failed} فشل)` : "";
    toast({ title: `تم تحديث ${done} طلب ✅`, description: `تم تغيير الحالة إلى «${label}»${failedMsg}` });
    setPendingBulkStatus(null);
    exitBulkMode();
    setIsBulkUpdating(false);
  };

  const handleWhatsApp = (e: React.MouseEvent, order: NonNullable<typeof orders>[0]) => {
    e.stopPropagation();
    setWaOrder({ id: order.id, customerName: order.customerName, product: order.product, quantity: order.quantity, totalPrice: order.totalPrice, status: order.status, phone: order.phone });
  };

  const handleWaSent = (orderId: number, currentStatus: string) => {
    if (currentStatus === "pending") {
      updateOrder.mutate(
        { id: orderId, data: { status: "in_shipping" } },
        { onSuccess: () => { queryClient.invalidateQueries({ queryKey: getListOrdersQueryKey() }); toast({ title: "تم إرسال واتساب ✅", description: `تم تحويل الطلب #${orderId.toString().padStart(4,"0")} لـ «قيد الشحن»` }); } }
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
          {bulkSelectMode ? (
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
                <DropdownMenuContent align="end" className="w-44" dir="rtl">
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
              <Button
                size="sm"
                className="gap-1 text-xs h-9 bg-destructive text-destructive-foreground hover:bg-destructive/90"
                disabled={selectedIds.size === 0}
                onClick={() => setShowBulkDeleteConfirm(true)}
              >
                <Trash2 className="w-3.5 h-3.5" />
                حذف {selectedIds.size > 0 ? `(${selectedIds.size})` : ""}
              </Button>
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
          )}
        </div>
      </div>

      <Card className="border-border overflow-hidden">
        <div className="p-3 border-b border-border bg-muted/10 flex flex-col gap-2">
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input placeholder="ابحث بالاسم، المنتج، أو الهاتف..." className="pr-9 bg-card text-sm h-9" value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="w-full sm:w-48 bg-card h-9 text-sm">
                <div className="flex items-center gap-2"><Filter className="w-3.5 h-3.5 text-muted-foreground" /><SelectValue /></div>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">جميع الطلبات</SelectItem>
                <SelectItem value="pending">قيد الانتظار</SelectItem>
                <SelectItem value="in_shipping">قيد الشحن</SelectItem>
                <SelectItem value="received">استلم</SelectItem>
                <SelectItem value="delayed">مؤجل</SelectItem>
                <SelectItem value="returned">مرتجع</SelectItem>
                <SelectItem value="partial_received">استلم جزئي</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative">
              <CalendarDays className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
              <Input type="date" className="pr-9 bg-card text-sm h-8 w-48 text-xs" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
            </div>
            {hasActiveFilter && (
              <Button variant="ghost" size="sm" className="h-8 text-xs gap-1 text-muted-foreground" onClick={clearFilters}>
                <X className="w-3 h-3" />مسح الفلاتر
              </Button>
            )}
            {bulkSelectMode && filtered.length > 0 && (
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
                const canWhatsApp = !bulkSelectMode && (order.status === "pending" || order.status === "in_shipping" || order.status === "delayed");
                const retReason = (order as any).returnReason as string | null;
                const retNote   = (order as any).returnNote   as string | null;
                const isSelected = selectedIds.has(order.id);
                return (
                  <div
                    key={order.id}
                    className={`flex items-center gap-3 px-4 py-3 hover:bg-muted/10 active:bg-muted/20 cursor-pointer ${isSelected ? "bg-primary/5" : ""}`}
                    onClick={() => bulkSelectMode ? toggleSelect(order.id) : (window.location.href = `/orders/${order.id}`)}
                  >
                    {bulkSelectMode && (
                      <Checkbox checked={isSelected} onCheckedChange={() => toggleSelect(order.id)} onClick={e => e.stopPropagation()} className="shrink-0" />
                    )}
                    <div className="w-9 h-9 rounded-full bg-muted flex items-center justify-center text-xs font-bold text-foreground shrink-0">
                      {order.customerName.charAt(0)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-bold text-sm truncate">{order.customerName}</p>
                        <span className="font-bold text-xs text-primary shrink-0">{formatCurrency(order.totalPrice)}</span>
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[10px] text-muted-foreground font-mono">#{order.id.toString().padStart(4,"0")}</span>
                        <span className="text-[10px] text-muted-foreground truncate">{order.product} ×{order.quantity}</span>
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant="outline" className={`text-[9px] font-bold border ${statusClasses[order.status] || ""}`}>
                          {statusLabels[order.status] || order.status}
                        </Badge>
                        {order.status === "in_shipping" && !inManifestSet.has(order.id) && (
                          <span className="inline-flex items-center gap-0.5 text-[9px] font-bold text-orange-600 dark:text-orange-400">
                            <Warehouse className="w-2.5 h-2.5" />ما زال في المخزن
                          </span>
                        )}
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
                    {bulkSelectMode && (
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
                    <TableHead className="text-center text-xs w-36">الحالة</TableHead>
                    <TableHead className="text-center text-xs w-10"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((order) => {
                    const retReason  = (order as any).returnReason as string | null;
                    const retNote    = (order as any).returnNote   as string | null;
                    const canWhatsApp = !bulkSelectMode && (order.status === "pending" || order.status === "in_shipping" || order.status === "delayed");
                    const isSelected  = selectedIds.has(order.id);
                    return (
                      <TableRow
                        key={order.id}
                        className={`border-border hover:bg-muted/20 cursor-pointer ${isSelected ? "bg-primary/5" : ""}`}
                        onClick={() => bulkSelectMode ? toggleSelect(order.id) : (window.location.href = `/orders/${order.id}`)}
                      >
                        {bulkSelectMode && (
                          <TableCell className="text-center p-2">
                            <Checkbox checked={isSelected} onCheckedChange={() => toggleSelect(order.id)} onClick={e => e.stopPropagation()} />
                          </TableCell>
                        )}
                        <TableCell className="font-mono text-xs text-primary font-bold">#{order.id.toString().padStart(4,"0")}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{format(new Date(order.createdAt), "yyyy/MM/dd")}</TableCell>
                        <TableCell className="text-sm font-semibold">{order.customerName}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{order.phone || "—"}</TableCell>
                        <TableCell className="text-xs">{order.product}<span className="text-muted-foreground mr-1">×{order.quantity}</span></TableCell>
                        <TableCell className="text-xs font-bold text-primary">{formatCurrency(order.totalPrice)}</TableCell>
                        <TableCell className="text-center">
                          <Badge variant="outline" className={`text-[9px] font-bold border ${statusClasses[order.status] || ""}`}>
                            {statusLabels[order.status] || order.status}
                          </Badge>
                          {order.status === "in_shipping" && !inManifestSet.has(order.id) && (
                            <div className="flex items-center justify-center gap-0.5 mt-1">
                              <Warehouse className="w-2.5 h-2.5 text-orange-500 shrink-0" />
                              <span className="text-[9px] font-bold text-orange-600 dark:text-orange-400 leading-none">ما زال في المخزن</span>
                            </div>
                          )}
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

      <WhatsAppDialog open={!!waOrder} onOpenChange={open => { if (!open) setWaOrder(null); }} order={waOrder} onSent={() => waOrder && handleWaSent(waOrder.id, waOrder.status)} />

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
