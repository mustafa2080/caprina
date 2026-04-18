import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Archive, RotateCcw, AlertTriangle, Package, Search } from "lucide-react";
import { ordersApi } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  pending:          { label: "معلق",        color: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200" },
  in_shipping:      { label: "قيد الشحن",   color: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200" },
  received:         { label: "تم الاستلام", color: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200" },
  partial_received: { label: "استلام جزئي", color: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200" },
  returned:         { label: "مُرتجع",       color: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200" },
  cancelled:        { label: "ملغي",         color: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400" },
};

const formatDate = (d: string) =>
  new Date(d).toLocaleDateString("ar-EG", { year: "numeric", month: "short", day: "numeric" });

const formatCurrency = (n: number) =>
  new Intl.NumberFormat("ar-EG", { style: "currency", currency: "EGP", maximumFractionDigits: 0 }).format(n);

export default function ArchivePage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [restoring, setRestoring] = useState<number | null>(null);

  const { data: orders = [], isLoading, refetch } = useQuery({
    queryKey: ["archived-orders"],
    queryFn: ordersApi.archived,
  });

  const filtered = orders.filter(o =>
    !search ||
    o.customerName?.toLowerCase().includes(search.toLowerCase()) ||
    o.product?.toLowerCase().includes(search.toLowerCase()) ||
    o.phone?.includes(search)
  );

  const handleRestore = async (id: number, name: string) => {
    setRestoring(id);
    try {
      await ordersApi.restore(id);
      await refetch();
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      queryClient.invalidateQueries({ queryKey: ["orders-summary"] });
      toast({ title: "تم استرجاع الطلب", description: `طلب ${name} تم نقله للطلبات النشطة.` });
    } catch (e: any) {
      toast({ title: "خطأ", description: e.message, variant: "destructive" });
    } finally {
      setRestoring(null);
    }
  };

  return (
    <div className="space-y-5 animate-in fade-in duration-500" dir="rtl">
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-orange-100 dark:bg-orange-900/30">
          <Archive className="h-5 w-5 text-orange-600 dark:text-orange-400" />
        </div>
        <div>
          <h1 className="text-xl font-bold">الأرشيف</h1>
          <p className="text-sm text-muted-foreground">الطلبات المحذوفة (يمكن استرجاعها)</p>
        </div>
        <Badge variant="outline" className="mr-auto">
          {orders.length} طلب
        </Badge>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Search className="h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="بحث بالاسم أو المنتج أو الهاتف..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="max-w-sm h-8 text-sm"
            />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center h-40 text-muted-foreground">
              <div className="text-center space-y-2">
                <Archive className="h-8 w-8 mx-auto animate-pulse" />
                <p className="text-sm">جاري التحميل...</p>
              </div>
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-muted-foreground gap-3">
              <Package className="h-10 w-10 opacity-30" />
              <p className="text-sm">{search ? "لا توجد نتائج" : "الأرشيف فارغ"}</p>
              {!search && <p className="text-xs opacity-70">الطلبات المحذوفة ستظهر هنا وبإمكانك استرجاعها</p>}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>#</TableHead>
                    <TableHead>العميل</TableHead>
                    <TableHead>المنتج</TableHead>
                    <TableHead>الحالة</TableHead>
                    <TableHead>المبلغ</TableHead>
                    <TableHead>تاريخ الإنشاء</TableHead>
                    <TableHead>تاريخ الحذف</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map(o => {
                    const statusInfo = STATUS_LABELS[o.status] ?? { label: o.status, color: "bg-gray-100 text-gray-600" };
                    return (
                      <TableRow key={o.id} className="opacity-75 hover:opacity-100 transition-opacity">
                        <TableCell className="font-mono text-xs text-muted-foreground">#{o.id}</TableCell>
                        <TableCell>
                          <div className="font-medium text-sm">{o.customerName}</div>
                          {o.phone && <div className="text-xs text-muted-foreground">{o.phone}</div>}
                        </TableCell>
                        <TableCell className="text-sm">{o.product}</TableCell>
                        <TableCell>
                          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${statusInfo.color}`}>
                            {statusInfo.label}
                          </span>
                        </TableCell>
                        <TableCell className="font-medium text-sm">{formatCurrency(o.totalPrice)}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{formatDate(o.createdAt)}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{o.deletedAt ? formatDate(o.deletedAt) : "—"}</TableCell>
                        <TableCell>
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 text-xs gap-1.5"
                            onClick={() => handleRestore(o.id, o.customerName)}
                            disabled={restoring === o.id}
                          >
                            <RotateCcw className={`h-3 w-3 ${restoring === o.id ? "animate-spin" : ""}`} />
                            استرجاع
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {orders.length > 0 && (
        <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 text-sm text-amber-800 dark:text-amber-300">
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
          <p>الطلبات في الأرشيف مخفية من جميع التقارير والإحصائيات. يمكن استرجاعها في أي وقت.</p>
        </div>
      )}
    </div>
  );
}
