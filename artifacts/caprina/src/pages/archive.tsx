import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Archive, RotateCcw, AlertTriangle, Package, Search, Trash2, CheckSquare, Square } from "lucide-react";
import { ordersApi, apiFetch } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  pending:          { label: "معلق",        color: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200" },
  warehouse_ready:  { label: "قيد الشحن في المخزن", color: "bg-teal-100 text-teal-800 dark:bg-teal-900 dark:text-teal-200" },
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
  const { isAdmin } = useAuth();
  const [search, setSearch] = useState("");
  const [restoring, setRestoring] = useState<number | null>(null);

  // ── تحديد ──────────────────────────────────────────────────────────────
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [showDeleteSelectedDialog, setShowDeleteSelectedDialog] = useState(false);
  const [deletingSelected, setDeletingSelected] = useState(false);

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

  // ── جمّع الطلبات بالفاتورة (invoiceNumber) ────────────────────────────
  const groupedFiltered = (() => {
    const groupMap = new Map<string, typeof orders>();
    for (const o of filtered) {
      const key = (o as any).invoiceNumber?.trim() || `solo-${o.id}`;
      if (!groupMap.has(key)) groupMap.set(key, []);
      groupMap.get(key)!.push(o);
    }
    return Array.from(groupMap.values()).map(grp => {
      const rep = { ...grp[0] } as any;
      if (grp.length > 1) {
        rep._groupIds    = grp.map(o => o.id);
        rep._groupCount  = grp.length;
        rep._products    = grp.map(o => `${o.product} ×${o.quantity}`).join(" ، ");
        rep.totalPrice   = grp.reduce((s, o) => s + o.totalPrice, 0);
      }
      return rep;
    });
  })();

  // ── تحديد الكل / إلغاء الكل ────────────────────────────────────────────
  const allGroupIds = groupedFiltered.flatMap(o => (o as any)._groupIds ?? [o.id]);
  const allFilteredSelected = groupedFiltered.length > 0 && allGroupIds.every(id => selectedIds.has(id));
  const someSelected = selectedIds.size > 0;

  const toggleSelectAll = () => {
    if (allFilteredSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(allGroupIds));
    }
  };

  const toggleOne = (o: any) => {
    const ids: number[] = (o as any)._groupIds ?? [o.id];
    setSelectedIds(prev => {
      const next = new Set(prev);
      const allSel = ids.every(id => next.has(id));
      if (allSel) ids.forEach(id => next.delete(id));
      else ids.forEach(id => next.add(id));
      return next;
    });
  };

  const isRowSelected = (o: any) => {
    const ids: number[] = (o as any)._groupIds ?? [o.id];
    return ids.every(id => selectedIds.has(id));
  };

  // ── استرجاع ────────────────────────────────────────────────────────────
  const handleRestore = async (o: any) => {
    const ids: number[] = (o as any)._groupIds ?? [o.id];
    setRestoring(ids[0]);
    try {
      for (const id of ids) await ordersApi.restore(id);
      await refetch();
      setSelectedIds(prev => { const n = new Set(prev); ids.forEach(id => n.delete(id)); return n; });
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      queryClient.invalidateQueries({ queryKey: ["orders-summary"] });
      const msg = ids.length > 1 ? `تم استرجاع الفاتورة (${ids.length} منتجات) للطلبات النشطة.` : `طلب ${o.customerName} تم نقله للطلبات النشطة.`;
      toast({ title: "تم استرجاع الطلب", description: msg });
    } catch (e: any) {
      toast({ title: "خطأ", description: e.message, variant: "destructive" });
    } finally {
      setRestoring(null);
    }
  };

  // ── حذف المحدد نهائياً ──────────────────────────────────────────────────
  const handleDeleteSelected = async () => {
    setDeletingSelected(true);
    try {
      const ids = Array.from(selectedIds);
      await apiFetch("/orders/archived/purge", {
        method: "DELETE",
        body: JSON.stringify({ ids }),
      });
      await refetch();
      setSelectedIds(new Set());
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      toast({ title: "✅ تم الحذف النهائي", description: `تم حذف ${ids.length} طلب نهائياً.` });
    } catch (e: any) {
      toast({ title: "خطأ", description: e.message, variant: "destructive" });
    } finally {
      setDeletingSelected(false);
      setShowDeleteSelectedDialog(false);
    }
  };

  return (
    <div className="space-y-5 animate-in fade-in duration-500" dir="rtl">

      {/* ── Header ── */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="p-2 rounded-lg bg-orange-100 dark:bg-orange-900/30">
          <Archive className="h-5 w-5 text-orange-600 dark:text-orange-400" />
        </div>
        <div>
          <h1 className="text-xl font-bold">الأرشيف</h1>
          <p className="text-sm text-muted-foreground">الطلبات المحذوفة (يمكن استرجاعها)</p>
        </div>
        <Badge variant="outline" className="mr-auto">{orders.length} طلب</Badge>

        {/* زر الحذف النهائي للمحدد — للأدمن فقط */}
        {isAdmin && someSelected && (
          <Button
            variant="destructive"
            size="sm"
            className="h-8 text-xs gap-1.5"
            onClick={() => setShowDeleteSelectedDialog(true)}
          >
            <Trash2 className="h-3.5 w-3.5" />
            حذف المحدد ({selectedIds.size})
          </Button>
        )}
      </div>

      {/* ── Search ── */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Search className="h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="بحث بالاسم أو المنتج أو الهاتف..."
              value={search}
              onChange={e => { setSearch(e.target.value); setSelectedIds(new Set()); }}
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
                    {/* checkbox تحديد الكل — للأدمن فقط */}
                    {isAdmin && (
                      <TableHead className="w-10">
                        <Checkbox
                          checked={allFilteredSelected}
                          onCheckedChange={toggleSelectAll}
                          aria-label="تحديد الكل"
                        />
                      </TableHead>
                    )}
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
                  {groupedFiltered.map(o => {
                    const statusInfo = STATUS_LABELS[o.status] ?? { label: o.status, color: "bg-gray-100 text-gray-600" };
                    const isSelected = isRowSelected(o);
                    const isGroup = !!(o as any)._groupCount && (o as any)._groupCount > 1;
                    return (
                      <TableRow
                        key={o.id}
                        className={`transition-opacity ${isSelected ? "bg-red-950/20 opacity-100" : "opacity-75 hover:opacity-100"}`}
                      >
                        {isAdmin && (
                          <TableCell>
                            <Checkbox
                              checked={isSelected}
                              onCheckedChange={() => toggleOne(o)}
                              aria-label={`تحديد طلب ${o.id}`}
                            />
                          </TableCell>
                        )}
                        <TableCell className="font-mono text-xs text-muted-foreground">
                          #{o.id}
                          {isGroup && (
                            <span className="mr-1 text-[9px] font-bold text-primary bg-primary/10 px-1.5 py-0.5 rounded-full">
                              {(o as any)._groupCount} منتجات
                            </span>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="font-medium text-sm">{o.customerName}</div>
                          {o.phone && <div className="text-xs text-muted-foreground">{o.phone}</div>}
                        </TableCell>
                        <TableCell className="text-sm max-w-[200px]">
                          <span className="truncate block">
                            {isGroup ? (o as any)._products : o.product}
                          </span>
                        </TableCell>
                        <TableCell>
                          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${statusInfo.color}`}>
                            {statusInfo.label}
                          </span>
                        </TableCell>
                        <TableCell className="font-medium text-sm">{formatCurrency(o.totalPrice)}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{formatDate(o.createdAt)}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{(o as any).deletedAt ? formatDate((o as any).deletedAt) : "—"}</TableCell>
                        <TableCell>
                          <Button
                            variant="outline" size="sm"
                            className="h-7 text-xs gap-1.5"
                            onClick={() => handleRestore(o)}
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

      {/* ── Dialog تأكيد حذف المحدد ── */}
      <AlertDialog open={showDeleteSelectedDialog} onOpenChange={setShowDeleteSelectedDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>⛔ حذف نهائي للطلبات المحددة</AlertDialogTitle>
            <AlertDialogDescription>
              سيتم حذف <strong>{selectedIds.size} طلب</strong> نهائياً بشكل لا يمكن التراجع عنه.
              هذه العملية غير قابلة للاسترجاع. هل أنت متأكد؟
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletingSelected}>إلغاء</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteSelected}
              disabled={deletingSelected}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {deletingSelected ? "جاري الحذف..." : `نعم، احذف ${selectedIds.size} طلب`}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </div>
  );
}
