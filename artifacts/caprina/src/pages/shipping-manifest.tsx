import { useState, useCallback, useMemo } from "react";
import * as XLSX from "xlsx";
import { useParams, Link } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  manifestsApi,
  apiFetch,
  type ShippingManifestDetail,
  type ManifestOrder,
  type DeliveryStatus,
} from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  ArrowRight,
  Truck,
  Package,
  TrendingUp,
  TrendingDown,
  AlertCircle,
  CheckCircle2,
  RotateCcw,
  Clock,
  Printer,
  Lock,
  Unlock,
  Trash2,
  Save,
  Receipt,
  Banknote,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Edit2,
  X,
  Check,
  FileText,
  Search,
  PackagePlus,
  FileSpreadsheet,
  Upload,
} from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { useAuth } from "@/contexts/AuthContext";
import { format } from "date-fns";

const formatCurrency = (n: number) =>
  new Intl.NumberFormat("ar-EG", {
    style: "currency",
    currency: "EGP",
    maximumFractionDigits: 0,
  }).format(n);

const DELIVERY_OPTIONS: { value: DeliveryStatus; label: string; color: string; bg: string }[] = [
  { value: "pending",          label: "قيد الانتظار",   color: "text-muted-foreground",                                          bg: "border-border" },
  { value: "delivered",        label: "مسلَّم ✓",        color: "text-emerald-700 dark:text-emerald-400",                         bg: "border-emerald-300 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-900/20" },
  { value: "postponed",        label: "مؤجل",            color: "text-orange-700  dark:text-orange-400",                          bg: "border-orange-300  dark:border-orange-700  bg-orange-50  dark:bg-orange-900/20" },
  { value: "partial_received", label: "استلم جزئي",     color: "text-teal-700    dark:text-teal-400",                            bg: "border-teal-300    dark:border-teal-700    bg-teal-50    dark:bg-teal-900/20" },
  { value: "returned",         label: "مرتجع",           color: "text-red-700     dark:text-red-400",                             bg: "border-red-300     dark:border-red-700     bg-red-50     dark:bg-red-900/20" },
];

const deliveryOpt = (v: DeliveryStatus) =>
  DELIVERY_OPTIONS.find((o) => o.value === v) ?? DELIVERY_OPTIONS[0];

function OrderDeliveryRow({
  order,
  manifestId,
  locked,
  onSaved,
}: {
  order: ManifestOrder;
  manifestId: number;
  locked: boolean;
  onSaved: () => void;
}) {
  const { toast } = useToast();
  const [editing, setEditing] = useState(false);
  const [status, setStatus] = useState<DeliveryStatus>(order.deliveryStatus);
  const [note, setNote] = useState(order.deliveryNote ?? "");
  const [partialQty, setPartialQty] = useState(
    order.partialQuantity?.toString() ?? ""
  );

  const mutation = useMutation({
    mutationFn: () =>
      manifestsApi.updateOrderDelivery(manifestId, order.id, {
        deliveryStatus: status,
        deliveryNote: note.trim() || null,
        partialQuantity:
          status === "partial_received" && partialQty
            ? parseInt(partialQty)
            : null,
      }),
    onSuccess: () => {
      toast({ title: "تم حفظ حالة التسليم" });
      setEditing(false);
      onSaved();
    },
    onError: (e: any) =>
      toast({ title: "خطأ", description: e.message, variant: "destructive" }),
  });

  const opt = deliveryOpt(order.deliveryStatus);
  const needsNote = status === "postponed" || status === "returned";
  const needsPartial = status === "partial_received";

  const hasChanges =
    status !== order.deliveryStatus ||
    note !== (order.deliveryNote ?? "") ||
    (status === "partial_received" &&
      partialQty !== (order.partialQuantity?.toString() ?? ""));

  return (
    <div className={`border-b border-border/50 transition-colors ${editing ? "bg-primary/5" : "hover:bg-muted/10"}`}>
      {/* Main row */}
      <div className="grid grid-cols-[1fr_1fr_60px_80px_120px_80px] gap-0 items-start px-3 py-2.5 text-xs">
        {/* Customer */}
        <div className="min-w-0 pr-1">
          <p className="font-semibold truncate">{order.customerName}</p>
          <p className="text-muted-foreground text-[10px] flex gap-1">
            <span className="font-mono">#{order.id.toString().padStart(4, "0")}</span>
            {order.phone && <span>· {order.phone}</span>}
          </p>
        </div>
        {/* Product */}
        <div className="min-w-0 pr-2">
          <p className="truncate">{order.product}</p>
          {(order.color || order.size) && (
            <p className="text-muted-foreground text-[10px]">
              {[order.color, order.size].filter(Boolean).join(" / ")}
            </p>
          )}
        </div>
        {/* Qty */}
        <div className="text-center font-bold">
          {order.deliveryStatus === "partial_received" && order.partialQuantity ? (
            <span>
              <span className="text-teal-400">{order.partialQuantity}</span>
              <span className="text-muted-foreground">/{order.quantity}</span>
            </span>
          ) : (
            order.quantity
          )}
        </div>
        {/* Price */}
        <div className="text-left font-bold">{formatCurrency(order.totalPrice)}</div>
        {/* Delivery Status Badge */}
        <div>
          <Badge
            variant="outline"
            className={`text-[9px] font-bold border ${opt.bg} ${opt.color}`}
          >
            {opt.label}
          </Badge>
          {order.deliveryNote && !editing && (
            <p className="text-[10px] text-muted-foreground mt-0.5 truncate max-w-[110px]">
              {order.deliveryNote}
            </p>
          )}
        </div>
        {/* Action */}
        <div className="flex justify-end">
          {!locked && (
            editing ? (
              <Button
                variant="ghost"
                size="sm"
                className="h-6 text-[10px] px-1.5 text-muted-foreground"
                onClick={() => {
                  setEditing(false);
                  setStatus(order.deliveryStatus);
                  setNote(order.deliveryNote ?? "");
                }}
              >
                <X className="w-3 h-3" />
              </Button>
            ) : (
              <Button
                variant="ghost"
                size="sm"
                className="h-6 text-[10px] px-1.5 text-primary hover:text-primary"
                onClick={() => setEditing(true)}
              >
                <Edit2 className="w-3 h-3 ml-0.5" />تقفيل
              </Button>
            )
          )}
          {locked && (
            <Link href={`/orders/${order.id}`}>
              <Button variant="ghost" size="sm" className="h-6 text-[10px] px-2 text-primary hover:text-primary">
                عرض
              </Button>
            </Link>
          )}
        </div>
      </div>

      {/* Editing panel */}
      {editing && (
        <div className="px-4 pb-3 flex flex-col gap-2 bg-primary/5 border-t border-primary/10">
          <div className="flex flex-wrap gap-2 items-end mt-2">
            <div>
              <Label className="text-[10px] mb-1 block text-muted-foreground">حالة التسليم</Label>
              <Select
                value={status}
                onValueChange={(v) => setStatus(v as DeliveryStatus)}
              >
                <SelectTrigger className="h-8 text-xs w-40 bg-background">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DELIVERY_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value} className="text-xs">
                      <span className={o.color}>{o.label}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {needsPartial && (
              <div>
                <Label className="text-[10px] mb-1 block text-muted-foreground">
                  الكمية المستلمة (من {order.quantity})
                </Label>
                <Input
                  type="number"
                  min={1}
                  max={order.quantity}
                  value={partialQty}
                  onChange={(e) => setPartialQty(e.target.value)}
                  className="h-8 text-xs w-28 bg-background"
                  placeholder="الكمية"
                />
              </div>
            )}
          </div>

          {(needsNote || needsPartial || status === "pending") && (
            <div>
              <Label className="text-[10px] mb-1 block text-muted-foreground">
                {needsNote ? "سبب / ملاحظة (مطلوب)" : "ملاحظة (اختياري)"}
              </Label>
              <Input
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className="h-8 text-xs bg-background"
                placeholder={
                  status === "postponed"
                    ? "مثال: العميل طلب التأجيل أسبوعاً..."
                    : status === "returned"
                    ? "مثال: العميل رفض الاستلام..."
                    : "ملاحظة..."
                }
              />
            </div>
          )}

          <div className="flex gap-2 justify-end">
            <Button
              size="sm"
              className="h-7 text-[11px] bg-primary text-primary-foreground hover:bg-primary/90 gap-1"
              onClick={() => mutation.mutate()}
              disabled={
                mutation.isPending ||
                !hasChanges ||
                (needsNote && !note.trim()) ||
                (needsPartial && (!partialQty || parseInt(partialQty) < 1))
              }
            >
              <Save className="w-3 h-3" />
              {mutation.isPending ? "جاري الحفظ..." : "حفظ"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function InvoicePriceEditor({
  manifestId,
  current,
  currentNotes,
  onSaved,
}: {
  manifestId: number;
  current: number | null;
  currentNotes: string | null;
  onSaved: () => void;
}) {
  const { toast } = useToast();
  const [editing, setEditing] = useState(false);
  const [price, setPrice] = useState(current?.toString() ?? "");
  const [notes, setNotes] = useState(currentNotes ?? "");

  const mutation = useMutation({
    mutationFn: () =>
      manifestsApi.update(manifestId, {
        invoicePrice: price ? parseFloat(price) : null,
        invoiceNotes: notes.trim() || null,
      }),
    onSuccess: () => {
      toast({ title: "تم حفظ سعر الفاتورة" });
      setEditing(false);
      onSaved();
    },
    onError: (e: any) =>
      toast({ title: "خطأ", description: e.message, variant: "destructive" }),
  });

  if (!editing) {
    return (
      <div className="flex items-center gap-2">
        <div>
          {current != null ? (
            <span className="text-lg font-black text-primary">
              {formatCurrency(current)}
            </span>
          ) : (
            <span className="text-sm text-muted-foreground">لم يُحدَّد بعد</span>
          )}
          {currentNotes && (
            <p className="text-[10px] text-muted-foreground">{currentNotes}</p>
          )}
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="h-6 text-[10px] gap-1 text-muted-foreground hover:text-foreground"
          onClick={() => {
            setPrice(current?.toString() ?? "");
            setNotes(currentNotes ?? "");
            setEditing(true);
          }}
        >
          <Edit2 className="w-3 h-3" />تعديل
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <Input
          type="number"
          step="0.01"
          min={0}
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          className="h-8 text-sm w-36 bg-background"
          placeholder="0.00"
          autoFocus
        />
        <span className="text-xs text-muted-foreground">ج.م</span>
        <Button
          size="sm"
          className="h-7 text-xs gap-1 bg-primary text-primary-foreground"
          onClick={() => mutation.mutate()}
          disabled={mutation.isPending}
        >
          <Check className="w-3 h-3" />حفظ
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 text-xs"
          onClick={() => setEditing(false)}
        >
          <X className="w-3 h-3" />
        </Button>
      </div>
      <Input
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        className="h-8 text-xs bg-background"
        placeholder="ملاحظات الفاتورة (اختياري)..."
      />
    </div>
  );
}

function SettlementCard({ manifest, onSaved }: { manifest: ShippingManifestDetail; onSaved: () => void }) {
  const { toast } = useToast();
  const s = manifest.stats;
  const invoicePrice = manifest.invoicePrice ?? 0;

  // تكلفة الشحن الفعلية = اليدوية لو موجودة، وإلا من الأوردرات
  const effectiveShippingCost = manifest.manualShippingCost ?? s.totalShippingCost;
  const hasManualCost = manifest.manualShippingCost != null;

  const deliveredTotal = s.deliveredGross;
  const netBeforeInvoice = deliveredTotal - effectiveShippingCost;
  const balance = invoicePrice > 0 ? invoicePrice - netBeforeInvoice : null;

  // editor state
  const [editingShipping, setEditingShipping] = useState(false);
  const [shippingVal, setShippingVal] = useState(manifest.manualShippingCost?.toString() ?? "");

  const shippingMutation = useMutation({
    mutationFn: (val: string) => {
      const parsed = val.trim() === "" ? null : parseFloat(val);
      if (parsed !== null && isNaN(parsed)) throw new Error("قيمة غير صحيحة");
      return manifestsApi.update(manifest.id, { manualShippingCost: parsed });
    },
    onSuccess: () => {
      toast({ title: "تم حفظ تكلفة الشحن" });
      setEditingShipping(false);
      onSaved();
    },
    onError: (e: any) =>
      toast({ title: "خطأ", description: e.message, variant: "destructive" }),
  });

  return (
    <Card className="border-primary/30 bg-primary/5 p-5">
      <div className="flex items-center gap-2 mb-4">
        <Receipt className="w-4 h-4 text-primary" />
        <h2 className="font-bold text-sm">بيان التسوية — الحساب مع شركة الشحن</h2>
        {manifest.status === "closed" && (
          <Badge variant="outline" className="text-[9px] border-emerald-500 bg-emerald-100 text-emerald-700 dark:border-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400 mr-auto">
            مُغلق
          </Badge>
        )}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
        <div className="bg-card rounded-md p-3 border border-border">
          <p className="text-[10px] text-muted-foreground mb-1">إجمالي المسلَّم</p>
          <p className="text-base font-black text-emerald-600 dark:text-emerald-400">{formatCurrency(deliveredTotal)}</p>
          <p className="text-[10px] text-emerald-700 dark:text-emerald-600">{s.delivered} طلبية</p>
        </div>
        <div className={`bg-card rounded-md p-3 border ${hasManualCost ? "border-amber-500/40" : effectiveShippingCost === 0 ? "border-dashed border-amber-500/40" : "border-border"}`}>
          <div className="flex items-center justify-between mb-1">
            <p className="text-[10px] text-muted-foreground">رسوم الشحن</p>
            {!editingShipping && (
              <button
                onClick={() => { setShippingVal(manifest.manualShippingCost?.toString() ?? ""); setEditingShipping(true); }}
                className="text-[9px] text-primary hover:underline"
              >
                {hasManualCost ? "تعديل" : "إضافة يدوي"}
              </button>
            )}
          </div>
          {editingShipping ? (
            <div className="flex items-center gap-1 mt-1">
              <Input
                type="number"
                min={0}
                step="0.01"
                value={shippingVal}
                onChange={e => setShippingVal(e.target.value)}
                className="h-7 text-xs w-28 bg-background"
                placeholder="0.00"
                autoFocus
              />
              <span className="text-[10px] text-muted-foreground">ج.م</span>
              <button onClick={() => shippingMutation.mutate(shippingVal)} disabled={shippingMutation.isPending}
                className="text-[10px] text-emerald-500 hover:text-emerald-400 font-bold px-1">
                <Check className="w-3.5 h-3.5" />
              </button>
              <button onClick={() => setEditingShipping(false)} className="text-[10px] text-muted-foreground hover:text-foreground px-1">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <>
              <p className="text-base font-black text-amber-700 dark:text-amber-400">
                −{formatCurrency(effectiveShippingCost)}
              </p>
              {hasManualCost ? (
                <p className="text-[10px] text-amber-600">يدوي ✏️</p>
              ) : effectiveShippingCost === 0 ? (
                <p className="text-[10px] text-muted-foreground/60">لم تُحدَّد — اضغط إضافة</p>
              ) : (
                <p className="text-[10px] text-amber-600">مُخصومة</p>
              )}
            </>
          )}
        </div>
        <div className="bg-card rounded-md p-3 border border-border">
          <p className="text-[10px] text-muted-foreground mb-1">صافي المستحق</p>
          <p className="text-base font-black text-primary">{formatCurrency(netBeforeInvoice)}</p>
          <p className="text-[10px] text-muted-foreground">بعد الشحن</p>
        </div>
        <div className={`rounded-md p-3 border ${manifest.invoicePrice != null ? "bg-card border-border" : "bg-muted/20 border-dashed border-border"}`}>
          <p className="text-[10px] text-muted-foreground mb-1">سعر الفاتورة المتفق</p>
          {manifest.invoicePrice != null ? (
            <>
              <p className="text-base font-black">{formatCurrency(manifest.invoicePrice)}</p>
              <p className="text-[10px] text-muted-foreground">المبلغ المتفق</p>
            </>
          ) : (
            <p className="text-sm text-muted-foreground/50">غير محدد</p>
          )}
        </div>
      </div>

      {/* Balance */}
      {balance !== null && (
        <div className={`rounded-md p-3 border flex items-center justify-between ${balance >= 0 ? "border-emerald-300 bg-emerald-50 dark:border-emerald-700 dark:bg-emerald-900/10" : "border-red-300 bg-red-50 dark:border-red-700 dark:bg-red-900/10"}`}>
          <div>
            <p className={`text-xs font-bold mb-0.5 ${balance >= 0 ? "text-emerald-700 dark:text-emerald-400" : "text-red-700 dark:text-red-400"}`}>
              {balance >= 0 ? "✓ فرق لصالحنا" : "⚠ فرق على حسابنا"}
            </p>
            <p className={`text-xl font-black ${balance >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>
              {formatCurrency(Math.abs(balance))}
            </p>
            <p className="text-[10px] text-muted-foreground mt-0.5">
              الفاتورة ({formatCurrency(invoicePrice)}) {balance >= 0 ? "أعلى" : "أقل"} من الصافي ({formatCurrency(netBeforeInvoice)})
            </p>
          </div>
          {balance >= 0
            ? <TrendingUp className="w-10 h-10 text-emerald-500 dark:text-emerald-400 opacity-20" />
            : <AlertTriangle className="w-10 h-10 text-red-500 dark:text-red-400 opacity-20" />}
        </div>
      )}

      {manifest.invoiceNotes && (
        <p className="text-xs text-muted-foreground mt-3 border-t border-border pt-3">
          ملاحظات الفاتورة: {manifest.invoiceNotes}
        </p>
      )}
    </Card>
  );
}

function CloseConfirmDialog({
  manifest,
  onClose,
  onConfirm,
  loading,
}: {
  manifest: ShippingManifestDetail;
  onClose: () => void;
  onConfirm: () => void;
  loading: boolean;
}) {
  const s = manifest.stats;
  const pendingCount = manifest.orders.filter(
    (o) => o.deliveryStatus === "pending"
  ).length;

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="bg-card border-border max-w-md" dir="rtl">
        <DialogHeader>
          <DialogTitle className="text-right flex items-center gap-2">
            <Lock className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            إغلاق البيان {manifest.manifestNumber}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3 mt-2">
          {pendingCount > 0 && (
            <div className="flex items-start gap-2 p-3 rounded-md bg-amber-50 dark:bg-amber-900/20 border border-amber-300 dark:border-amber-700">
              <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
              <p className="text-xs text-amber-700 dark:text-amber-400">
                يوجد <strong>{pendingCount}</strong> طلبية لم يُحدَّد وضعها بعد. هل تريد الإغلاق رغم ذلك؟
              </p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="p-2 rounded-md bg-muted/20 border border-border">
              <p className="text-muted-foreground">إجمالي الطلبيات</p>
              <p className="font-bold text-base">{s.total}</p>
            </div>
            <div className="p-2 rounded-md bg-emerald-900/10 border border-emerald-700">
              <p className="text-emerald-400">مسلَّم</p>
              <p className="font-bold text-base text-emerald-400">{s.delivered}</p>
            </div>
            <div className="p-2 rounded-md bg-orange-900/10 border border-orange-700">
              <p className="text-orange-400">مؤجل</p>
              <p className="font-bold text-base text-orange-400">
                {manifest.orders.filter((o) => o.deliveryStatus === "postponed").length}
              </p>
            </div>
            <div className="p-2 rounded-md bg-red-900/10 border border-red-700">
              <p className="text-red-400">مرتجع</p>
              <p className="font-bold text-base text-red-400">{s.returned}</p>
            </div>
          </div>

          <div className="p-3 rounded-md bg-primary/10 border border-primary/30 text-xs">
            <p className="text-muted-foreground mb-1">صافي المستحق من الشركة</p>
            <p className="font-black text-lg text-primary">
              {formatCurrency(s.deliveredGross - s.totalShippingCost)}
            </p>
            {manifest.invoicePrice != null && (
              <p className="text-muted-foreground mt-1">
                سعر الفاتورة المتفق: {formatCurrency(manifest.invoicePrice)}
              </p>
            )}
          </div>
        </div>

        <DialogFooter className="flex gap-2 mt-2">
          <Button
            className="flex-1 bg-emerald-700 hover:bg-emerald-600 text-white gap-1"
            onClick={onConfirm}
            disabled={loading}
          >
            <Lock className="w-3 h-3" />
            {loading ? "جاري الإغلاق..." : "تأكيد الإغلاق"}
          </Button>
          <Button variant="outline" className="border-border" onClick={onClose}>
            إلغاء
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Status Normalization ─────────────────────────────────────────────────────
const STATUS_MAP: Record<string, string> = {
  "مسلم": "delivered", "مسلَّم": "delivered", "مسلم ": "delivered", "delivered": "delivered", "تسليم": "delivered",
  "مرتجع": "returned", "returned": "returned", "رجع": "returned",
  "مؤجل": "postponed", "postponed": "postponed", "تأجيل": "postponed", "اجل": "postponed",
  "جزئي": "partial_received", "partial_received": "partial_received",
  "استلم جزئي": "partial_received", "partial": "partial_received", "جزئى": "partial_received",
  "انتظار": "pending", "pending": "pending", "في الانتظار": "pending", "قيد الانتظار": "pending",
};

function normalizeStatus(val: string): string | null {
  if (!val || !val.trim()) return null;
  const lower = val.trim().toLowerCase();
  for (const [key, mapped] of Object.entries(STATUS_MAP)) {
    if (lower === key.toLowerCase().trim()) return mapped;
  }
  return null;
}

// ─── Excel Import Dialog ─────────────────────────────────────────────────────
type ExcelRow = {
  orderId?: number;
  customerName?: string;
  deliveryStatus?: string;
  deliveryNote?: string;
  partialQuantity?: number;
};

function ExcelImportDialog({
  manifest,
  onClose,
  onImported,
}: {
  manifest: ShippingManifestDetail;
  onClose: () => void;
  onImported: () => void;
}) {
  const { toast } = useToast();
  const [rows, setRows] = useState<ExcelRow[]>([]);
  const [importing, setImporting] = useState(false);
  const [fileName, setFileName] = useState("");

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const data = new Uint8Array(ev.target?.result as ArrayBuffer);
      const workbook = XLSX.read(data, { type: "array" });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const json: Record<string, unknown>[] = XLSX.utils.sheet_to_json(sheet, { defval: "" });

      const parsed: ExcelRow[] = json.map((r) => {
        // Try to find orderId by matching customerName or explicit id column
        const idVal = r["رقم الطلب"] ?? r["order_id"] ?? r["id"] ?? r["ID"];
        const nameVal = String(r["اسم العميل"] ?? r["customer"] ?? r["الاسم"] ?? r["name"] ?? "");
        const statusVal = String(r["الحالة"] ?? r["status"] ?? r["delivery_status"] ?? "");
        const noteVal = String(r["ملاحظة"] ?? r["note"] ?? r["notes"] ?? "");
        const partialQty = Number(r["الكمية المستلمة"] ?? r["partial_quantity"] ?? 0);

        // Match to manifest orders by id or name
        const matchedOrder = manifest.orders.find((o) => {
          if (idVal && Number(idVal) === o.id) return true;
          if (nameVal && o.customerName?.trim().toLowerCase() === nameVal.trim().toLowerCase()) return true;
          return false;
        });

        return {
          orderId: matchedOrder?.id,
          customerName: matchedOrder?.customerName ?? nameVal,
          deliveryStatus: normalizeStatus(statusVal) ?? undefined,
          deliveryNote: noteVal || undefined,
          partialQuantity: partialQty || undefined,
        };
      }).filter((r) => r.orderId && r.deliveryStatus);

      setRows(parsed);
    };
    reader.readAsArrayBuffer(file);
  };

  const handleImport = async () => {
    if (rows.length === 0) return;
    setImporting(true);
    let success = 0;
    let failed = 0;
    for (const row of rows) {
      try {
        await apiFetch(`/shipping-manifests/${manifest.id}/orders/${row.orderId}`, {
          method: "PATCH",
          body: JSON.stringify({
            deliveryStatus: row.deliveryStatus,
            deliveryNote: row.deliveryNote ?? null,
            partialQuantity: row.partialQuantity ?? null,
          }),
        });
        success++;
      } catch {
        failed++;
      }
    }
    setImporting(false);
    toast({
      title: "اكتمل الاستيراد",
      description: `تم تحديث ${success} طلبية${failed > 0 ? ` — فشل ${failed}` : ""}`,
      variant: failed > 0 ? "destructive" : "default",
    });
    if (success > 0) {
      onImported();
      onClose();
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="bg-card border-border max-w-xl" dir="rtl">
        <DialogHeader>
          <DialogTitle className="text-right flex items-center gap-2">
            <FileSpreadsheet className="w-4 h-4 text-primary" />
            استيراد حالات التسليم من Excel
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          <div className="text-xs text-muted-foreground bg-muted/30 border border-border rounded-md p-3 space-y-1">
            <p className="font-semibold text-foreground mb-1">تعليمات الاستيراد:</p>
            <p>• الملف يحتاج أعمدة: <span className="font-mono">رقم الطلب</span> أو <span className="font-mono">اسم العميل</span></p>
            <p>• عمود الحالة: <span className="font-mono">الحالة</span> — القيم: مسلَّم، مرتجع، مؤجل، استلم جزئي، انتظار</p>
            <p>• عمود اختياري: <span className="font-mono">ملاحظة</span>، <span className="font-mono">الكمية المستلمة</span></p>
          </div>

          <label className="flex flex-col items-center justify-center border-2 border-dashed border-border rounded-lg p-6 cursor-pointer hover:border-primary transition-colors gap-2">
            <Upload className="w-6 h-6 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">
              {fileName ? fileName : "اضغط لاختيار ملف Excel"}
            </span>
            <input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleFile} />
          </label>

          {rows.length > 0 && (
            <div className="border border-border rounded-md overflow-hidden">
              <div className="bg-muted/30 px-3 py-2 text-xs font-semibold border-b border-border">
                تم العثور على {rows.length} طلبية قابلة للتحديث
              </div>
              <div className="max-h-48 overflow-y-auto">
                {rows.map((row, i) => {
                  const opt = DELIVERY_OPTIONS.find(o => o.value === row.deliveryStatus);
                  return (
                    <div key={i} className="flex items-center justify-between px-3 py-2 text-xs border-b border-border last:border-0">
                      <span className="font-medium">{row.customerName}</span>
                      <Badge variant="outline" className={`text-[10px] ${opt?.color ?? ""}`}>
                        {opt?.label ?? row.deliveryStatus}
                      </Badge>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="flex gap-2 mt-2">
          <Button
            className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90 gap-1"
            onClick={handleImport}
            disabled={importing || rows.length === 0}
          >
            <Upload className="w-3.5 h-3.5" />
            {importing ? "جاري الاستيراد..." : `استيراد ${rows.length > 0 ? rows.length + " طلبية" : ""}`}
          </Button>
          <Button variant="outline" className="border-border" onClick={onClose}>إلغاء</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Add Orders Dialog ────────────────────────────────────────────────────────
type OrderRow = {
  id: number; customerName: string; phone: string | null;
  product: string; color: string | null; size: string | null;
  quantity: number; totalPrice: number; status: string;
};

function AddOrdersToManifestDialog({
  manifestId,
  manifestNumber,
  existingOrderIds,
  onClose,
  onAdded,
}: {
  manifestId: number;
  manifestNumber: string;
  existingOrderIds: Set<number>;
  onClose: () => void;
  onAdded: () => void;
}) {
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  const { data: inShippingOrders, isLoading } = useQuery({
    queryKey: ["orders-in-shipping-all"],
    queryFn: () => apiFetch<OrderRow[]>(`/orders?status=in_shipping`),
    staleTime: 10000,
  });

  const addMutation = useMutation({
    mutationFn: () => manifestsApi.addOrders(manifestId, Array.from(selectedIds)),
    onSuccess: (res) => {
      toast({ title: `✅ تمت الإضافة`, description: `تم إضافة ${res.added} طلبية للبيان ${res.manifestNumber}` });
      onAdded();
      onClose();
    },
    onError: (e: any) =>
      toast({ title: "خطأ", description: e.message, variant: "destructive" }),
  });

  // استبعد الأوردرات الموجودة بالفعل في البيان
  const available = useMemo(() => {
    if (!inShippingOrders) return [];
    return inShippingOrders.filter(o => !existingOrderIds.has(o.id));
  }, [inShippingOrders, existingOrderIds]);

  const filtered = useMemo(() => {
    if (!search.trim()) return available;
    const q = search.toLowerCase();
    return available.filter(o =>
      o.customerName.toLowerCase().includes(q) ||
      o.product.toLowerCase().includes(q) ||
      (o.phone && o.phone.includes(q))
    );
  }, [available, search]);

  const toggleAll = () => {
    if (selectedIds.size === filtered.length && filtered.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filtered.map(o => o.id)));
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="bg-card border-border max-w-3xl max-h-[90vh] flex flex-col" dir="rtl">
        <DialogHeader>
          <DialogTitle className="text-right flex items-center gap-2">
            <PackagePlus className="w-4 h-4 text-primary" />
            إضافة طلبيات إلى البيان — {manifestNumber}
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-hidden flex flex-col gap-3 mt-2">
          {/* Search + counter */}
          <div className="flex items-center gap-3">
            <div className="relative flex-1">
              <Search className="absolute right-2.5 top-2.5 w-3.5 h-3.5 text-muted-foreground" />
              <Input
                placeholder="بحث بالاسم / المنتج / الهاتف..."
                className="h-9 text-sm bg-background pr-8"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
            {!isLoading && (
              <span className="text-xs text-muted-foreground whitespace-nowrap">
                {available.length} طلبية متاحة
              </span>
            )}
          </div>

          {/* Select-all */}
          {!isLoading && filtered.length > 0 && (
            <div className="flex items-center justify-between px-1">
              <div className="flex items-center gap-2">
                <Checkbox
                  checked={selectedIds.size === filtered.length && filtered.length > 0}
                  onCheckedChange={toggleAll}
                />
                <span className="text-xs text-muted-foreground">تحديد الكل ({filtered.length})</span>
              </div>
              <span className="text-xs font-bold text-primary">{selectedIds.size} محدد</span>
            </div>
          )}

          {/* Orders list */}
          <div className="overflow-y-auto flex-1 border border-border rounded-md">
            {isLoading ? (
              <div className="p-8 text-center text-muted-foreground text-sm animate-pulse">جاري تحميل الطلبيات...</div>
            ) : filtered.length === 0 ? (
              <div className="p-10 text-center">
                <PackagePlus className="w-8 h-8 mx-auto mb-2 text-muted-foreground opacity-20" />
                <p className="text-sm text-muted-foreground">
                  {available.length === 0 ? "لا توجد طلبيات قيد الشحن متاحة للإضافة" : "لا توجد نتائج تطابق البحث"}
                </p>
              </div>
            ) : (
              <>
                {/* Header */}
                <div className="grid grid-cols-[auto_1fr_1fr_70px_80px] gap-0 border-b border-border bg-muted/20 px-3 py-2 text-[10px] font-semibold text-muted-foreground sticky top-0">
                  <div className="w-5" />
                  <div>العميل</div>
                  <div>المنتج / المواصفات</div>
                  <div className="text-center">الكمية</div>
                  <div className="text-left">الإجمالي</div>
                </div>
                {/* Rows */}
                {filtered.map(order => {
                  const selected = selectedIds.has(order.id);
                  return (
                    <div
                      key={order.id}
                      className={`grid grid-cols-[auto_1fr_1fr_70px_80px] gap-0 items-center px-3 py-2.5 border-b border-border/50 cursor-pointer hover:bg-muted/20 transition-colors ${selected ? "bg-primary/5" : ""}`}
                      onClick={() => {
                        const next = new Set(selectedIds);
                        if (next.has(order.id)) next.delete(order.id);
                        else next.add(order.id);
                        setSelectedIds(next);
                      }}
                    >
                      <div className="w-5 flex items-center">
                        <Checkbox checked={selected} onCheckedChange={() => {}} />
                      </div>
                      <div className="min-w-0 pr-2">
                        <p className="font-semibold text-xs truncate">{order.customerName}</p>
                        <p className="text-muted-foreground text-[10px]">
                          #{order.id.toString().padStart(4, "0")}
                          {order.phone && ` · ${order.phone}`}
                        </p>
                      </div>
                      <div className="min-w-0 pr-2">
                        <p className="text-xs truncate">{order.product}</p>
                        {(order.color || order.size) && (
                          <p className="text-muted-foreground text-[10px]">
                            {[order.color, order.size].filter(Boolean).join(" / ")}
                          </p>
                        )}
                      </div>
                      <div className="text-center text-xs font-bold">{order.quantity}</div>
                      <div className="text-left text-xs font-bold text-primary">{formatCurrency(order.totalPrice)}</div>
                    </div>
                  );
                })}
              </>
            )}
          </div>
        </div>

        <DialogFooter className="flex gap-2 mt-2">
          <Button
            className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90 gap-1"
            onClick={() => addMutation.mutate()}
            disabled={addMutation.isPending || selectedIds.size === 0}
          >
            <PackagePlus className="w-3.5 h-3.5" />
            {addMutation.isPending ? "جاري الإضافة..." : `إضافة ${selectedIds.size > 0 ? selectedIds.size + " طلبيات" : ""}`}
          </Button>
          <Button variant="outline" className="border-border" onClick={onClose}>إلغاء</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function ShippingManifestPage() {
  const params = useParams();
  const id = Number(params.id);
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { canViewFinancials, isAdmin } = useAuth();
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showCloseDialog, setShowCloseDialog] = useState(false);
  const [showReopenDialog, setShowReopenDialog] = useState(false);
  const [showAddOrdersDialog, setShowAddOrdersDialog] = useState(false);
  const [showExcelImportDialog, setShowExcelImportDialog] = useState(false);
  const [showOrders, setShowOrders] = useState(true);

  const { data: manifest, isLoading, error } = useQuery({
    queryKey: ["shipping-manifest", id],
    queryFn: () => manifestsApi.get(id),
    enabled: !isNaN(id),
  });

  const refetch = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["shipping-manifest", id] });
    queryClient.invalidateQueries({ queryKey: ["shipping-manifests"] });
    queryClient.invalidateQueries({ queryKey: ["warehouses"] });
    queryClient.invalidateQueries({ queryKey: ["variants"] });
    queryClient.invalidateQueries({ queryKey: ["variants-all"] });
  }, [queryClient, id]);

  const updateMutation = useMutation({
    mutationFn: (data: { status: "open" | "closed" }) =>
      manifestsApi.update(id, data),
    onSuccess: (result) => {
      refetch();
      setShowCloseDialog(false);
      if (result.rolledOverManifest) {
        toast({
          title: "✅ تم إغلاق البيان",
          description: `${result.rolledOverManifest.orderCount} طلبية معلقة رُحِّلت تلقائياً إلى بيان جديد: ${result.rolledOverManifest.manifestNumber}`,
        });
        queryClient.invalidateQueries({ queryKey: ["shipping-manifests"] });
      } else {
        toast({ title: manifest?.status === "open" ? "تم إغلاق البيان" : "تم فتح البيان" });
      }
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => manifestsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["shipping-manifests"] });
      queryClient.invalidateQueries({ queryKey: ["warehouses"] });
      queryClient.invalidateQueries({ queryKey: ["variants"] });
      queryClient.invalidateQueries({ queryKey: ["variants-all"] });
      toast({ title: "تم الحذف" });
      window.history.back();
    },
    onError: () =>
      toast({
        title: "خطأ",
        description: "فشل حذف البيان",
        variant: "destructive",
      }),
  });

  const handlePrint = () => window.print();

  if (isLoading)
    return (
      <div className="p-12 text-center text-muted-foreground animate-pulse">
        جاري التحميل...
      </div>
    );
  if (error || !manifest)
    return (
      <div className="p-12 text-center">
        <AlertCircle className="w-12 h-12 mx-auto mb-3 text-destructive opacity-50" />
        <h2 className="text-lg font-bold mb-2">البيان غير موجود</h2>
        <Link href="/shipping">
          <Button variant="outline" className="mt-3">
            العودة لشركات الشحن
          </Button>
        </Link>
      </div>
    );

  const s = manifest.stats;
  const isLocked = manifest.status === "closed";
  const pendingOrders = manifest.orders.filter(
    (o) => o.deliveryStatus === "pending"
  ).length;

  const statusLabel = (st: DeliveryStatus) => {
    switch (st) {
      case "delivered":        return { label: "مسلَّم",          cls: "status-delivered" };
      case "returned":         return { label: "مرتجع",           cls: "status-returned" };
      case "postponed":        return { label: "مؤجل",            cls: "status-postponed" };
      case "partial_received": return { label: "جزئي",            cls: "status-partial" };
      default:                 return { label: "انتظار",          cls: "status-pending" };
    }
  };

  const deliveredGross = manifest.orders
    .filter(o => o.deliveryStatus === "delivered")
    .reduce((sum, o) => sum + o.totalPrice, 0);

  const partialGross = manifest.orders
    .filter(o => o.deliveryStatus === "partial_received")
    .reduce((sum, o) => {
      const pct = o.partialQuantity && o.quantity ? o.partialQuantity / o.quantity : 1;
      return sum + o.totalPrice * pct;
    }, 0);

  const totalCollected = deliveredGross + partialGross;

  return (
    <>
    {/* ══════════════ PRINT-ONLY ══════════════ */}
    <div className="manifest-print hidden" dir="rtl">

      {/* ─── Header ─── */}
      <div className="manifest-print-header">
        <div>
          <div className="manifest-print-brand">CAPRINA</div>
          <div className="manifest-print-brand-sub">SHIPPING MANIFEST</div>
        </div>
        <div className="manifest-print-info">
          <div className="manifest-print-title">بيان الشحن — {manifest.manifestNumber}</div>
          <div className="manifest-print-meta">
            شركة الشحن: <strong style={{ color: "#fff" }}>{manifest.companyName}</strong><br />
            تاريخ الإنشاء: {format(new Date(manifest.createdAt), "yyyy/MM/dd")}&emsp;
            {manifest.closedAt && <>أُغلق: {format(new Date(manifest.closedAt), "yyyy/MM/dd")}</>}<br />
            طُبع: {format(new Date(), "yyyy/MM/dd — HH:mm")}
          </div>
          <span className={`manifest-print-badge ${manifest.status === "closed" ? "manifest-print-badge-closed" : "manifest-print-badge-open"}`}>
            {manifest.status === "closed" ? "✓ مغلق" : "● مفتوح"}
          </span>
        </div>
      </div>

      {/* ─── Stats strip ─── */}
      <div className="manifest-print-stats">
        <div className="manifest-print-stat">
          <div className="manifest-print-stat-label">إجمالي الطلبيات</div>
          <div className="manifest-print-stat-value">{s.total}</div>
        </div>
        <div className="manifest-print-stat">
          <div className="manifest-print-stat-label">مسلَّم</div>
          <div className="manifest-print-stat-value status-delivered">{s.delivered}</div>
        </div>
        <div className="manifest-print-stat">
          <div className="manifest-print-stat-label">مرتجع</div>
          <div className="manifest-print-stat-value status-returned">{s.returned}</div>
        </div>
        <div className="manifest-print-stat">
          <div className="manifest-print-stat-label">مؤجل</div>
          <div className="manifest-print-stat-value status-postponed">
            {manifest.orders.filter(o => o.deliveryStatus === "postponed").length}
          </div>
        </div>
        <div className="manifest-print-stat">
          <div className="manifest-print-stat-label">جزئي</div>
          <div className="manifest-print-stat-value status-partial">
            {manifest.orders.filter(o => o.deliveryStatus === "partial_received").length}
          </div>
        </div>
        <div className="manifest-print-stat">
          <div className="manifest-print-stat-label">نسبة التسليم</div>
          <div className="manifest-print-stat-value">{s.deliveryRate}%</div>
        </div>
      </div>

      {/* ─── Orders table ─── */}
      <table className="manifest-print-table">
        <thead>
          <tr>
            <th style={{ width: "5%", textAlign: "center" }}>#</th>
            <th style={{ width: "18%" }}>العميل</th>
            <th style={{ width: "13%" }}>الهاتف</th>
            <th style={{ width: "26%" }}>المنتج / المواصفات</th>
            <th style={{ width: "7%", textAlign: "center" }}>الكمية</th>
            <th style={{ width: "12%", textAlign: "center" }}>الإجمالي</th>
            <th style={{ width: "11%", textAlign: "center" }}>الحالة</th>
            <th style={{ width: "8%" }}>ملاحظة</th>
          </tr>
        </thead>
        <tbody>
          {manifest.orders.map((o, idx) => {
            const { label, cls } = statusLabel(o.deliveryStatus);
            const variant = [o.color, o.size].filter(Boolean).join(" / ");
            return (
              <tr key={o.id}>
                <td style={{ textAlign: "center", color: "#9ca3af", fontSize: "7pt" }}>{idx + 1}</td>
                <td style={{ fontWeight: 700 }}>
                  {o.customerName}
                  <div style={{ fontSize: "6.5pt", color: "#9ca3af", fontWeight: 400 }}>
                    #{o.id.toString().padStart(4, "0")}
                  </div>
                </td>
                <td style={{ direction: "ltr", textAlign: "right", fontSize: "7.5pt" }}>{o.phone ?? "—"}</td>
                <td>
                  {o.product}
                  {variant && <span style={{ color: "#6b7280", fontSize: "7.5pt" }}> ({variant})</span>}
                </td>
                <td style={{ textAlign: "center", fontWeight: 700 }}>
                  {o.deliveryStatus === "partial_received" && o.partialQuantity
                    ? <><span style={{ color: "#0f766e" }}>{o.partialQuantity}</span><span style={{ color: "#9ca3af" }}>/{o.quantity}</span></>
                    : o.quantity}
                </td>
                <td style={{ textAlign: "center", fontWeight: 700 }}>
                  {o.totalPrice.toLocaleString("ar-EG")} ج
                </td>
                <td style={{ textAlign: "center" }}>
                  <span className={cls}>{label}</span>
                </td>
                <td style={{ fontSize: "7pt", color: "#6b7280" }}>{o.deliveryNote ?? ""}</td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* ─── Totals cards ─── */}
      <div className="manifest-print-totals">
        <div className="manifest-print-total-card">
          <div className="manifest-print-total-label">إجمالي المحصَّل</div>
          <div className="manifest-print-total-value">{totalCollected.toLocaleString("ar-EG")} ج.م</div>
        </div>
        <div className="manifest-print-total-card">
          <div className="manifest-print-total-label">رسوم الشحن</div>
          <div className="manifest-print-total-value" style={{ color: "#d97706" }}>
            {(manifest.manualShippingCost ?? s.totalShippingCost).toLocaleString("ar-EG")} ج.م
          </div>
        </div>
        <div className="manifest-print-total-card highlight">
          <div className="manifest-print-total-label">الصافي المستحق</div>
          <div className="manifest-print-total-value">
            {(totalCollected - (manifest.manualShippingCost ?? s.totalShippingCost)).toLocaleString("ar-EG")} ج.م
          </div>
        </div>
        {manifest.invoicePrice != null && (
          <div className="manifest-print-total-card">
            <div className="manifest-print-total-label">سعر الفاتورة المتفق</div>
            <div className="manifest-print-total-value" style={{ color: "#1d4ed8" }}>
              {manifest.invoicePrice.toLocaleString("ar-EG")} ج.م
            </div>
          </div>
        )}
      </div>

      {/* ─── Footer / Signatures ─── */}
      <div className="manifest-print-footer">
        <div className="manifest-print-watermark">
          CAPRINA · {manifest.manifestNumber} · {format(new Date(), "yyyy")}
        </div>
        <div style={{ display: "flex", gap: "4mm" }}>
          <div className="manifest-print-sig-box">
            <div className="manifest-print-sig-title">توقيع المندوب</div>
            <div className="manifest-print-sig-line" />
            <div className="manifest-print-sig-name">الاسم: ___________</div>
          </div>
          <div className="manifest-print-sig-box">
            <div className="manifest-print-sig-title">توقيع المسؤول</div>
            <div className="manifest-print-sig-line" />
            <div className="manifest-print-sig-name">الاسم: ___________</div>
          </div>
        </div>
      </div>

    </div>

    {/* ══════════════ SCREEN-ONLY ══════════════ */}
    <div className="manifest-screen max-w-5xl mx-auto space-y-5 animate-in fade-in duration-500" dir="rtl">
      {/* ─── Header ─── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link href="/shipping">
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8 rounded-full border-border"
            >
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-bold">{manifest.manifestNumber}</h1>
              <Badge
                variant="outline"
                className={`text-[10px] font-bold border ${
                  isLocked
                    ? "border-emerald-700 bg-emerald-900/20 text-emerald-400"
                    : "border-blue-700 bg-blue-900/20 text-blue-400"
                }`}
              >
                {isLocked ? "مغلق" : "مفتوح"}
              </Badge>
            </div>
            <div className="flex items-center gap-3 mt-0.5">
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Truck className="w-3 h-3" />
                {manifest.companyName}
              </p>
              <p className="text-xs text-muted-foreground">
                {format(new Date(manifest.createdAt), "yyyy/MM/dd")}
              </p>
              {manifest.closedAt && (
                <p className="text-xs text-emerald-600">
                  أُغلق: {format(new Date(manifest.closedAt), "yyyy/MM/dd")}
                </p>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 print:hidden">
          <Button
            variant="outline"
            size="sm"
            className="h-8 text-xs gap-1 border-border"
            onClick={handlePrint}
          >
            <Printer className="w-3 h-3" />طباعة
          </Button>
          {!isLocked && (
            <Button
              variant="outline"
              size="sm"
              className="h-8 text-xs gap-1 border-emerald-700/50 text-emerald-500 hover:bg-emerald-900/20"
              onClick={() => setShowExcelImportDialog(true)}
            >
              <FileSpreadsheet className="w-3 h-3" />استيراد Excel
            </Button>
          )}
          {/* إضافة طلبيات — أدمن فقط + البيان مفتوح */}
          {isAdmin && !isLocked && (
            <Button
              variant="outline"
              size="sm"
              className="h-8 text-xs gap-1 border-primary/50 text-primary hover:bg-primary/10"
              onClick={() => setShowAddOrdersDialog(true)}
            >
              <PackagePlus className="w-3 h-3" />إضافة طلبيات
            </Button>
          )}
          {/* إغلاق / فتح البيان — أدمن فقط */}
          {isAdmin && (
            isLocked ? (
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-xs gap-1 border-amber-800 text-amber-400 hover:bg-amber-900/20"
                onClick={() => setShowReopenDialog(true)}
              >
                <Unlock className="w-3 h-3" />فتح
              </Button>
            ) : (
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-xs gap-1 border-emerald-800 text-emerald-400 hover:bg-emerald-900/20"
                onClick={() => setShowCloseDialog(true)}
              >
                <Lock className="w-3 h-3" />إغلاق البيان
              </Button>
            )
          )}
          {/* حذف البيان — أدمن فقط */}
          {isAdmin && (
            <Button
              variant="outline"
              size="sm"
              className="h-8 text-xs gap-1 border-red-800 text-red-400 hover:bg-red-900/20 hover:text-red-400"
              onClick={() => setShowDeleteDialog(true)}
            >
              <Trash2 className="w-3 h-3" />حذف
            </Button>
          )}
        </div>
      </div>

      {/* ─── بانر البيان المغلق — للموظف فقط ─── */}
      {isLocked && !isAdmin && (
        <div className="flex items-center gap-3 rounded-xl border border-red-800/50 bg-red-900/10 px-4 py-3">
          <Lock className="w-5 h-5 text-red-400 shrink-0" />
          <div>
            <p className="text-sm font-bold text-red-400">هذا البيان مغلق</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              لا يمكن إجراء أي تعديلات على بيان مغلق. تواصل مع الأدمن لإعادة فتحه.
            </p>
          </div>
        </div>
      )}

      {/* ─── بانر البيان المغلق — للأدمن ─── */}
      {isLocked && isAdmin && (
        <div className="flex items-center gap-3 rounded-xl border border-amber-800/50 bg-amber-900/10 px-4 py-3">
          <Lock className="w-5 h-5 text-amber-400 shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-bold text-amber-400">البيان مغلق</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              أُغلق بتاريخ {manifest.closedAt ? format(new Date(manifest.closedAt), "yyyy/MM/dd") : "—"} · لإعادة الفتح اضغط زر "فتح" في الأعلى
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs gap-1 border-amber-800 text-amber-400 hover:bg-amber-900/20 shrink-0"
            onClick={() => setShowReopenDialog(true)}
          >
            <Unlock className="w-3 h-3" />فتح البيان
          </Button>
        </div>
      )}

      {/* ─── KPI Cards ─── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="border-border bg-card p-4">
          <p className="text-xs text-muted-foreground mb-1">إجمالي الطلبيات</p>
          <p className="text-2xl font-black">{s.total}</p>
          {pendingOrders > 0 && !isLocked && (
            <p className="text-[10px] text-amber-500 mt-0.5">
              {pendingOrders} بانتظار التقفيل
            </p>
          )}
        </Card>
        <Card className="border-emerald-900/50 bg-emerald-900/10 p-4">
          <p className="text-xs text-emerald-400 mb-1 flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3" />مُسلَّم
          </p>
          <p className="text-2xl font-black text-emerald-400">{s.delivered}</p>
          <p className="text-xs text-emerald-600 mt-0.5 font-bold">
            {s.deliveryRate}% نسبة التسليم
          </p>
        </Card>
        <Card className="border-red-900/50 bg-red-900/10 p-4">
          <p className="text-xs text-red-400 mb-1 flex items-center gap-1">
            <RotateCcw className="w-3 h-3" />مُرتجَع
          </p>
          <p className="text-2xl font-black text-red-400">{s.returned}</p>
          <p className="text-xs text-red-600 mt-0.5 font-bold">
            {s.total > 0 ? Math.round((s.returned / s.total) * 100) : 0}% نسبة الإرجاع
          </p>
        </Card>
        <Card className="border-amber-900/50 bg-amber-900/10 p-4">
          <p className="text-xs text-amber-400 mb-1 flex items-center gap-1">
            <Clock className="w-3 h-3" />مؤجل / معلَّق
          </p>
          <p className="text-2xl font-black text-amber-400">{s.pending}</p>
          <p className="text-xs text-amber-600 mt-0.5 font-bold">
            {s.total > 0 ? Math.round((s.pending / s.total) * 100) : 0}% من الإجمالي
          </p>
        </Card>
      </div>

      {/* ─── Delivery Rate Bar ─── */}
      <Card className="border-border bg-card p-4">
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm font-bold">نسبة التسليم</p>
          <p
            className={`text-xl font-black ${
              s.deliveryRate >= 70
                ? "text-emerald-400"
                : s.deliveryRate >= 40
                ? "text-amber-400"
                : "text-red-400"
            }`}
          >
            {s.deliveryRate}%
          </p>
        </div>
        <div className="w-full bg-muted rounded-full h-3 overflow-hidden flex">
          <div
            className="h-3 bg-emerald-500 transition-all"
            style={{ width: `${s.total > 0 ? (s.delivered / s.total) * 100 : 0}%` }}
          />
          <div
            className="h-3 bg-orange-500 transition-all"
            style={{
              width: `${s.total > 0 ? (s.pending / s.total) * 100 : 0}%`,
            }}
          />
          <div
            className="h-3 bg-red-500 transition-all"
            style={{ width: `${s.total > 0 ? (s.returned / s.total) * 100 : 0}%` }}
          />
        </div>
        <div className="flex justify-between mt-1.5 text-[10px] text-muted-foreground">
          <span className="text-emerald-600">مُسلَّم: {s.delivered}</span>
          <span className="text-orange-600">مؤجل: {s.pending}</span>
          <span className="text-red-600">مُرتجَع: {s.returned}</span>
        </div>
      </Card>

      {/* ─── Invoice Section ─── */}
      {canViewFinancials && (
        <Card className="border-border bg-card p-4">
          <div className="flex items-center gap-2 mb-3">
            <Banknote className="w-4 h-4 text-muted-foreground" />
            <h2 className="font-bold text-sm">فاتورة البيان</h2>
          </div>
          <div className="flex flex-col gap-1">
            <p className="text-[10px] text-muted-foreground">
              المبلغ المتفق عليه مع شركة الشحن (ما سيُدفع لنا)
            </p>
            <InvoicePriceEditor
              manifestId={id}
              current={manifest.invoicePrice}
              currentNotes={manifest.invoiceNotes}
              onSaved={refetch}
            />
          </div>
        </Card>
      )}

      {/* ─── Settlement Card ─── */}
      {canViewFinancials && <SettlementCard manifest={manifest} onSaved={refetch} />}

      {/* ─── Orders Table ─── */}
      <Card className="border-border bg-card overflow-hidden print:break-inside-avoid">
        <div
          className="flex items-center justify-between px-4 py-3 border-b border-border cursor-pointer hover:bg-muted/10 transition-colors"
          onClick={() => setShowOrders(!showOrders)}
        >
          <h2 className="font-bold text-sm flex items-center gap-2">
            <Package className="w-4 h-4 text-muted-foreground" />
            الطلبيات في البيان
            <Badge variant="outline" className="text-[9px]">
              {manifest.orders.length}
            </Badge>
            {!isLocked && pendingOrders > 0 && (
              <Badge
                variant="outline"
                className="text-[9px] border-amber-700 bg-amber-900/20 text-amber-400"
              >
                {pendingOrders} بانتظار التقفيل
              </Badge>
            )}
          </h2>
          {showOrders ? (
            <ChevronUp className="w-4 h-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="w-4 h-4 text-muted-foreground" />
          )}
        </div>

        {showOrders && (
          <>
            {manifest.orders.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground text-sm">
                لا توجد طلبيات
              </div>
            ) : (
              <div className="overflow-x-auto">
                {/* Table header */}
                <div className="grid grid-cols-[1fr_1fr_60px_80px_120px_80px] gap-0 border-b border-border bg-muted/20 px-3 py-2 text-[10px] font-semibold text-muted-foreground">
                  <div>العميل</div>
                  <div>المنتج</div>
                  <div className="text-center">الكمية</div>
                  <div className="text-left">الإجمالي</div>
                  <div>حالة التسليم</div>
                  <div className="text-left">إجراء</div>
                </div>
                {manifest.orders.map((order) => (
                  <OrderDeliveryRow
                    key={order.id}
                    order={order}
                    manifestId={id}
                    locked={isLocked}
                    onSaved={refetch}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </Card>

      {/* ─── P&L Summary (financials only — hidden in print) ─── */}
      {canViewFinancials && <div className="grid grid-cols-2 md:grid-cols-3 gap-3 print:hidden">
        <Card className="border-border bg-card p-4">
          <p className="text-xs text-muted-foreground mb-1">إجمالي الإيرادات</p>
          <p className="text-lg font-black text-emerald-400">
            {formatCurrency(s.totalRevenue)}
          </p>
        </Card>
        <Card className="border-border bg-card p-4">
          <p className="text-xs text-muted-foreground mb-1">تكلفة الشحن</p>
          <p className="text-lg font-black text-amber-400">
            {formatCurrency(manifest.manualShippingCost ?? s.totalShippingCost)}
          </p>
        </Card>
        <Card className="border-border bg-card p-4">
          <p className="text-xs text-muted-foreground mb-1">خسائر الإرجاع</p>
          <p className="text-lg font-black text-red-400">
            {formatCurrency(s.returnLosses)}
          </p>
        </Card>
        <Card className="border-border bg-card p-4">
          <p className="text-xs text-muted-foreground mb-1">تكلفة البضاعة</p>
          <p className="text-lg font-black">{formatCurrency(s.totalCost)}</p>
        </Card>
        <Card
          className={`col-span-2 p-4 border ${
            s.netProfit >= 0
              ? "border-emerald-900/50 bg-emerald-900/10"
              : "border-red-900/50 bg-red-900/10"
          }`}
        >
          <div className="flex items-center justify-between">
            <div>
              <p
                className={`text-xs mb-1 font-bold ${
                  s.netProfit >= 0 ? "text-emerald-400" : "text-red-400"
                }`}
              >
                {s.netProfit >= 0 ? "صافي الربح" : "صافي الخسارة"}
              </p>
              <p
                className={`text-2xl font-black ${
                  s.netProfit >= 0 ? "text-emerald-400" : "text-red-400"
                }`}
              >
                {formatCurrency(Math.abs(s.netProfit))}
              </p>
            </div>
            {s.netProfit >= 0 ? (
              <TrendingUp className="w-10 h-10 text-emerald-400 opacity-30" />
            ) : (
              <TrendingDown className="w-10 h-10 text-red-400 opacity-30" />
            )}
          </div>
          {s.totalRevenue > 0 && (
            <p
              className={`text-xs mt-2 font-bold ${
                s.netProfit >= 0 ? "text-emerald-600" : "text-red-600"
              }`}
            >
              هامش الربح: {Math.round((s.netProfit / s.totalRevenue) * 100)}%
            </p>
          )}
        </Card>
      </div>}

      {/* ─── Close Confirm Dialog ─── */}
      {showCloseDialog && (
        <CloseConfirmDialog
          manifest={manifest}
          onClose={() => setShowCloseDialog(false)}
          onConfirm={() => updateMutation.mutate({ status: "closed" })}
          loading={updateMutation.isPending}
        />
      )}

      {/* ─── Reopen Confirm Dialog — أدمن فقط ─── */}
      <AlertDialog open={showReopenDialog} onOpenChange={setShowReopenDialog}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-amber-500">
              <Unlock className="w-5 h-5" />
              تأكيد إعادة فتح البيان
            </AlertDialogTitle>
            <AlertDialogDescription className="text-right space-y-2">
              <span className="block">
                هل تريد إعادة فتح البيان <strong className="text-foreground">{manifest.manifestNumber}</strong>؟
              </span>
              <span className="block text-amber-600 dark:text-amber-400 font-medium">
                ⚠ هذا الإجراء متاح للأدمن فقط. بعد الفتح يمكن تعديل حالات التسليم مجدداً.
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction
              className="bg-amber-600 hover:bg-amber-500 text-white gap-1"
              onClick={() => {
                setShowReopenDialog(false);
                updateMutation.mutate({ status: "open" });
              }}
              disabled={updateMutation.isPending}
            >
              <Unlock className="w-3.5 h-3.5" />
              نعم، افتح البيان
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ─── Add Orders Dialog ─── */}
            {showExcelImportDialog && manifest && !isLocked && (
        <ExcelImportDialog
          manifest={manifest}
          onClose={() => setShowExcelImportDialog(false)}
          onImported={refetch}
        />
      )}

      {showAddOrdersDialog && manifest && (
        <AddOrdersToManifestDialog
          manifestId={id}
          manifestNumber={manifest.manifestNumber}
          existingOrderIds={new Set(manifest.orders.map(o => o.id))}
          onClose={() => setShowAddOrdersDialog(false)}
          onAdded={refetch}
        />
      )}

      {/* ─── Delete Dialog ─── */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle>تأكيد حذف البيان</AlertDialogTitle>
            <AlertDialogDescription>
              هل أنت متأكد من حذف بيان الشحن {manifest.manifestNumber}؟ لن يتم
              حذف الطلبيات المرتبطة به.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteMutation.mutate()}
              disabled={deleteMutation.isPending}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {deleteMutation.isPending ? "جاري الحذف..." : "نعم، احذف"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
    </>
  );
}
