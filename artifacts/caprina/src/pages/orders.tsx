import { useState } from "react";
import { Link } from "wouter";
import { format } from "date-fns";
import { Search, Filter, Plus, Package } from "lucide-react";
import { useListOrders } from "@workspace/api-client-react";
import { useDebounce } from "@/hooks/use-debounce";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const statusLabels: Record<string, string> = {
  pending: "قيد الانتظار",
  processing: "جاري التجهيز",
  shipped: "تم الشحن",
  delivered: "تم التسليم",
  cancelled: "ملغي",
};

const statusColors: Record<string, string> = {
  pending: "bg-amber-50 text-amber-800 border-amber-200",
  processing: "bg-blue-50 text-blue-800 border-blue-200",
  shipped: "bg-purple-50 text-purple-800 border-purple-200",
  delivered: "bg-emerald-50 text-emerald-800 border-emerald-200",
  cancelled: "bg-red-50 text-red-800 border-red-200",
};

export default function Orders() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<string>("all");

  const debouncedSearch = useDebounce(search, 300);

  const { data: orders, isLoading } = useListOrders({
    search: debouncedSearch || undefined,
    status: status !== "all" ? status : undefined,
  });

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat("ar-SA", { style: "currency", currency: "SAR" }).format(amount);

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground">الطلبات</h1>
          <p className="text-muted-foreground mt-1 text-sm">إدارة وتتبع جميع الطلبات.</p>
        </div>
        <Link href="/orders/new">
          <Button className="w-full sm:w-auto shadow-sm gap-2 bg-foreground text-background hover:bg-foreground/90">
            <Plus className="w-4 h-4" />
            طلب جديد
          </Button>
        </Link>
      </div>

      <Card className="shadow-sm border-border overflow-hidden">
        <div className="p-4 border-b border-border bg-muted/20 flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="ابحث عن عميل أو منتج..."
              className="pr-9 bg-card"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              data-testid="input-search"
            />
          </div>
          <div className="w-full sm:w-52">
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="bg-card" data-testid="select-status">
                <div className="flex items-center gap-2">
                  <Filter className="w-4 h-4 text-muted-foreground" />
                  <SelectValue placeholder="تصفية الحالة" />
                </div>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">جميع الطلبات</SelectItem>
                <SelectItem value="pending">قيد الانتظار</SelectItem>
                <SelectItem value="processing">جاري التجهيز</SelectItem>
                <SelectItem value="shipped">تم الشحن</SelectItem>
                <SelectItem value="delivered">تم التسليم</SelectItem>
                <SelectItem value="cancelled">ملغي</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {isLoading ? (
          <div className="p-8 text-center text-muted-foreground text-sm">جاري تحميل الطلبات...</div>
        ) : orders && orders.length > 0 ? (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-muted/10">
                <TableRow>
                  <TableHead className="text-right">رقم الطلب</TableHead>
                  <TableHead className="text-right">التاريخ</TableHead>
                  <TableHead className="text-right">العميل</TableHead>
                  <TableHead className="text-right">المنتج</TableHead>
                  <TableHead className="text-right">الإجمالي</TableHead>
                  <TableHead className="text-center w-[130px]">الحالة</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orders.map((order) => (
                  <TableRow
                    key={order.id}
                    className="hover:bg-muted/40 cursor-pointer"
                    onClick={() => window.location.href = `/orders/${order.id}`}
                    data-testid={`row-order-${order.id}`}
                  >
                    <TableCell className="font-mono text-sm font-bold text-primary">
                      #{order.id.toString().padStart(4, "0")}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                      {format(new Date(order.createdAt), "yyyy/MM/dd")}
                    </TableCell>
                    <TableCell className="font-semibold text-sm">{order.customerName}</TableCell>
                    <TableCell className="text-sm">
                      {order.product}
                      <span className="text-muted-foreground mr-1 text-xs">×{order.quantity}</span>
                    </TableCell>
                    <TableCell className="font-bold text-sm text-primary">
                      {formatCurrency(order.totalPrice)}
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="outline" className={`text-[10px] font-semibold border ${statusColors[order.status] || ""}`}>
                        {statusLabels[order.status] || order.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
          <div className="p-12 text-center text-muted-foreground">
            <Package className="w-12 h-12 mx-auto mb-4 opacity-20" />
            <h3 className="text-lg font-bold text-foreground mb-1">لا توجد طلبات</h3>
            <p className="text-sm max-w-sm mx-auto">
              {search || status !== "all"
                ? "جرّب تغيير معايير البحث أو التصفية."
                : "لا توجد طلبات حتى الآن. أنشئ أول طلب للبدء."}
            </p>
            {!(search || status !== "all") && (
              <Link href="/orders/new">
                <Button variant="outline" className="mt-4" data-testid="button-create-first">إنشاء طلب</Button>
              </Link>
            )}
          </div>
        )}
      </Card>
    </div>
  );
}
