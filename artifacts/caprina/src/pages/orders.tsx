import { useState } from "react";
import { Link } from "wouter";
import { format } from "date-fns";
import { Search, Filter, Plus, Package, CalendarDays, X } from "lucide-react";
import { useListOrders } from "@workspace/api-client-react";
import { useDebounce } from "@/hooks/use-debounce";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const statusLabels: Record<string, string> = {
  pending: "قيد الانتظار",
  received: "استلم",
  delayed: "مؤجل",
  returned: "مرتجع",
  partial_received: "استلم جزئي",
};

const statusClasses: Record<string, string> = {
  pending: "bg-amber-900/30 text-amber-400 border-amber-800",
  received: "bg-emerald-900/30 text-emerald-400 border-emerald-800",
  delayed: "bg-blue-900/30 text-blue-400 border-blue-800",
  returned: "bg-red-900/30 text-red-400 border-red-800",
  partial_received: "bg-purple-900/30 text-purple-400 border-purple-800",
};

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat("ar-EG", { style: "currency", currency: "EGP", maximumFractionDigits: 0 }).format(amount);

export default function Orders() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<string>("all");
  const [dateFrom, setDateFrom] = useState("");
  const debouncedSearch = useDebounce(search, 300);

  const { data: orders, isLoading } = useListOrders({
    search: debouncedSearch || undefined,
    status: status !== "all" ? status : undefined,
  });

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
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-border hover:bg-transparent">
                  <TableHead className="text-right text-xs">#</TableHead>
                  <TableHead className="text-right text-xs">التاريخ</TableHead>
                  <TableHead className="text-right text-xs">العميل</TableHead>
                  <TableHead className="text-right text-xs">الهاتف</TableHead>
                  <TableHead className="text-right text-xs">المنتج</TableHead>
                  <TableHead className="text-right text-xs">الإجمالي</TableHead>
                  <TableHead className="text-center text-xs w-32">الحالة</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((order) => (
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
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
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
    </div>
  );
}
