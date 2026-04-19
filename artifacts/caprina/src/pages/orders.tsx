import { useState } from "react";
import { Link } from "wouter";
import { format } from "date-fns";
import { Search, Filter, Plus, Package, CalendarDays, X, RotateCcw, MessageCircle } from "lucide-react";
import { useListOrders, useUpdateOrder, getListOrdersQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useDebounce } from "@/hooks/use-debounce";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { returnReasonLabel } from "@/lib/order-constants";
import { type WhatsAppOrderData } from "@/lib/whatsapp";
import { WhatsAppDialog } from "@/components/whatsapp-dialog";
import { useToast } from "@/hooks/use-toast";

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

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat("ar-EG", { style: "currency", currency: "EGP", maximumFractionDigits: 0 }).format(amount);

export default function Orders() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<string>("all");
  const [dateFrom, setDateFrom] = useState("");
  const debouncedSearch = useDebounce(search, 300);
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const updateOrder = useUpdateOrder();
  const [waOrder, setWaOrder] = useState<WhatsAppOrderData | null>(null);

  const { data: orders, isLoading } = useListOrders(
    { search: debouncedSearch || undefined, status: status !== "all" ? status : undefined },
    { query: { staleTime: 15_000, gcTime: 60_000 } }
  );

  const handleWhatsApp = (e: React.MouseEvent, order: NonNullable<typeof orders>[0]) => {
    e.stopPropagation();
    setWaOrder({ id: order.id, customerName: order.customerName, product: order.product, quantity: order.quantity, totalPrice: order.totalPrice, status: order.status, phone: order.phone });
  };

  const handleWaSent = (orderId: number, currentStatus: string) => {
    if (currentStatus === "pending") {
      updateOrder.mutate(
        { id: orderId, data: { status: "in_shipping" } },
        {
          onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: getListOrdersQueryKey() });
            toast({ title: "تم إرسال واتساب ✅", description: `تم تحويل الطلب #${orderId.toString().padStart(4,"0")} لـ «قيد الشحن»` });
          },
        }
      );
    } else {
      toast({ title: "تم فتح واتساب ✅", description: "الرسالة جاهزة للإرسال" });
    }
  };

  const filtered = orders?.filter(o => {
    if (!dateFrom) return true;
    return new Date(o.createdAt) >= new Date(dateFrom);
  }) ?? [];

  const hasActiveFilter = search || status !== "all" || dateFrom;

  const clearFilters = () => {
    setSearch("");
    setStatus("all");
    setDateFrom("");
  };

  return (
    <div className="space-y-5 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">الطلبات</h1>
          <p className="text-muted-foreground text-sm mt-0.5">إدارة وتتبع جميع الطلبات</p>
        </div>
        <Link href="/orders/new">
          <Button className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90 font-bold text-sm">
            <Plus className="w-4 h-4" />طلب جديد
          </Button>
        </Link>
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
          <div className="flex items-center gap-2">
            <div className="relative">
              <CalendarDays className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
              <Input
                type="date"
                className="pr-9 bg-card text-sm h-8 w-48 text-xs"
                value={dateFrom}
                onChange={e => setDateFrom(e.target.value)}
                placeholder="من تاريخ"
              />
            </div>
            {hasActiveFilter && (
              <Button variant="ghost" size="sm" className="h-8 text-xs gap-1 text-muted-foreground" onClick={clearFilters}>
                <X className="w-3 h-3" />مسح الفلاتر
              </Button>
            )}
          </div>
        </div>

        {isLoading ? (
          <div className="p-8 text-center text-muted-foreground text-sm">جاري التحميل...</div>
        ) : filtered.length > 0 ? (
          <>
            {/* ── Mobile: card list ── */}
            <div className="sm:hidden divide-y divide-border">
              {filtered.map((order) => {
                const canWhatsApp = order.status === "pending" || order.status === "in_shipping" || order.status === "delayed";
                const retReason = (order as any).returnReason as string | null;
                const retNote = (order as any).returnNote as string | null;
                return (
                  <div
                    key={order.id}
                    className="flex items-center gap-3 px-4 py-3 hover:bg-muted/10 active:bg-muted/20 cursor-pointer"
                    onClick={() => window.location.href = `/orders/${order.id}`}
                  >
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
                        {order.status === "returned" && retReason && (
                          <span className="text-[9px] text-red-600 dark:text-red-400">{retReason === "other" && retNote ? retNote : returnReasonLabel(retReason)}</span>
                        )}
                        <span className="text-[9px] text-muted-foreground mr-auto">{format(new Date(order.createdAt), "MM/dd")}</span>
                      </div>
                    </div>
                    {canWhatsApp && (
                      <button
                        className="shrink-0 w-9 h-9 rounded-full text-green-500 hover:bg-green-500/10 flex items-center justify-center"
                        onClick={(e) => handleWhatsApp(e, order)}
                      >
                        <MessageCircle className="w-4.5 h-4.5" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>

            {/* ── Desktop: table ── */}
            <div className="hidden sm:block overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-border hover:bg-transparent">
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
                    const retReason = (order as any).returnReason as string | null;
                    const retNote = (order as any).returnNote as string | null;
                    const canWhatsApp = order.status === "pending" || order.status === "in_shipping" || order.status === "delayed";
                    return (
                      <TableRow key={order.id} className="border-border hover:bg-muted/20 cursor-pointer" onClick={() => window.location.href = `/orders/${order.id}`}>
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
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7 rounded-full text-green-500 hover:text-green-400 hover:bg-green-500/10"
                              title={`إرسال واتساب لـ ${order.customerName}`}
                              onClick={(e) => handleWhatsApp(e, order)}
                            >
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
            <p className="text-sm text-muted-foreground mt-1">
              {hasActiveFilter ? "جرّب تغيير معايير البحث." : "لا يوجد طلبات حتى الآن."}
            </p>
          </div>
        )}
      </Card>

      {filtered.length > 0 && (
        <p className="text-xs text-muted-foreground text-left">
          إجمالي {filtered.length} طلب
          {orders && filtered.length !== orders.length && ` (من ${orders.length})`}
        </p>
      )}

      <WhatsAppDialog
        open={!!waOrder}
        onOpenChange={open => { if (!open) setWaOrder(null); }}
        order={waOrder}
        onSent={() => waOrder && handleWaSent(waOrder.id, waOrder.status)}
      />
    </div>
  );
}
