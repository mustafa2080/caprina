import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
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
  Download,
} from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { useAuth } from "@/contexts/AuthContext";
import { useBrand } from "@/contexts/BrandContext";
import { format } from "date-fns";
import { RETURN_REASONS, returnReasonLabel } from "@/lib/order-constants";

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
  hideAction = false,
}: {
  order: ManifestOrder;
  manifestId: number;
  locked: boolean;
  onSaved: () => void;
  hideAction?: boolean;
}) {
  const { toast } = useToast();
  const [editing, setEditing] = useState(false);
  const [status, setStatus] = useState<DeliveryStatus>(order.deliveryStatus);
  const [note, setNote] = useState(order.deliveryNote ?? "");
  const [partialQty, setPartialQty] = useState(
    order.partialQuantity?.toString() ?? ""
  );
  const [partialProduct, setPartialProduct] = useState(
    order.deliveryNote?.startsWith("منتج:") ? order.deliveryNote.split("|")[0].replace("منتج:", "").trim() : ""
  );
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [returnReceived, setReturnReceived] = useState<boolean | null>(
    (order as any).returnReceived === 1 ? true : (order as any).returnReceived === 0 ? false : null
  );
  const [returnReason, setReturnReason] = useState<string>(
    (order as any).returnReason ?? ""
  );
  const [partialReturnReceived, setPartialReturnReceived] = useState<boolean | null>(
    order.deliveryStatus === "partial_received"
      ? ((order as any).returnReceived === 1 ? true : (order as any).returnReceived === 0 ? false : null)
      : null
  );

  // مزامنة الـ state مع الـ prop بعد كل refetch
  useEffect(() => {
    if (!editing) {
      setStatus(order.deliveryStatus);
      setNote(order.deliveryNote ?? "");
      setPartialQty(order.partialQuantity?.toString() ?? "");
      setReturnReceived(
        (order as any).returnReceived === 1 ? true : (order as any).returnReceived === 0 ? false : null
      );
      setReturnReason((order as any).returnReason ?? "");
      setPartialReturnReceived(
        order.deliveryStatus === "partial_received"
          ? ((order as any).returnReceived === 1 ? true : (order as any).returnReceived === 0 ? false : null)
          : null
      );
    }
  }, [order.deliveryStatus, order.deliveryNote, order.partialQuantity, (order as any).returnReceived, editing]);

  const cancelMutation = useMutation({
    mutationFn: () => manifestsApi.cancelOrder(manifestId, order.id),
    onSuccess: () => {
      toast({ title: "تم إلغاء الطلبية من البيان وإرجاعها للانتظار" });
      setEditing(false);
      onSaved();
      setTimeout(() => window.location.reload(), 500);
    },
    onError: (e: any) =>
      toast({ title: "خطأ", description: e.message, variant: "destructive" }),
  });

  const mutation = useMutation({
    mutationFn: () => {
      if (status === "partial_received") {
        const qty = parseInt(partialQty);
        if (partialQty === "" || partialQty === null || partialQty === undefined || isNaN(qty) || qty < 0) {
          throw new Error("يجب إدخال الكمية المستلمة أولاً");
        }
        if (qty > order.quantity) {
          throw new Error("الكمية لا يمكن أن تتجاوز " + order.quantity);
        }
      }
      let finalNote = note.trim() || null;
      if (status === "partial_received" && partialProduct.trim()) {
        finalNote = partialProduct.trim() + (note.trim() ? " | " + note.trim() : "");
      }
      return manifestsApi.updateOrderDelivery(manifestId, order.id, {
        deliveryStatus: status,
        deliveryNote: finalNote,
        partialQuantity:
          status === "partial_received" && partialQty !== "" && partialQty !== null && partialQty !== undefined
            ? parseInt(partialQty)
            : null,
        ...(status === "returned" ? { returnReceived } : {}),
        ...(status === "returned" && returnReason ? { returnReason } : {}),
        ...(status === "partial_received" ? { partialReturnReceived } : {}),
      });
    },
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
      partialQty !== (order.partialQuantity?.toString() ?? "")) ||
    (status === "partial_received" &&
      partialReturnReceived !== ((order as any).returnReceived === 1 ? true : (order as any).returnReceived === 0 ? false : null)) ||
    (status === "returned" &&
      returnReceived !== ((order as any).returnReceived === 1 ? true : (order as any).returnReceived === 0 ? false : null));

  return (
    <div className={`border-b border-border/50 transition-colors ${editing ? "bg-primary/5" : "hover:bg-muted/10"}`}>
      {/* Main row */}
      <div className="hidden md:grid grid-cols-[minmax(140px,1fr)_minmax(120px,1fr)_minmax(140px,1fr)_60px_80px_80px] min-w-[860px] gap-0 items-start px-3 py-2.5 text-xs">
        {/* Order ID only — no customer name (already shown in parent row) */}
        <div className="min-w-0 pr-1 flex items-center gap-1.5">
          <span className="font-mono text-[10px] text-muted-foreground bg-muted/40 rounded px-1.5 py-0.5 border border-border/40">
            #{order.id.toString().padStart(4, "0")}
          </span>
          {order.phone && (
            <span className="text-[10px] text-muted-foreground">{order.phone}</span>
          )}
        </div>
        {/* Product */}
        <div className="min-w-0 pr-2">
          <p className="truncate font-medium">{order.product}</p>
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
        {/* Delivery Status Badge -- always visible */}
        <div>
          <Badge
            variant="outline"
            className={`text-[9px] font-bold border ${opt.bg} ${opt.color}`}
          >
            {opt.label}
          </Badge>
          {/* sub-status للمرتجع */}
          {order.deliveryStatus === "returned" && (order as any).returnReceived === 1 && (
            <p className="text-[10px] text-emerald-600 mt-0.5 font-semibold">↩ تم الاستلام</p>
          )}
          {order.deliveryStatus === "returned" && (order as any).returnReceived === 0 && (
            <p className="text-[10px] text-orange-500 mt-0.5 font-semibold">⏳ عند شركة الشحن</p>
          )}
          {/* sub-status للاستلام الجزئي — الباقي */}
          {order.deliveryStatus === "partial_received" && (order as any).returnReceived === 1 && (
            <p className="text-[10px] text-emerald-600 mt-0.5 font-semibold">↩ الباقي في المخزن</p>
          )}
          {order.deliveryStatus === "partial_received" && (order as any).returnReceived === 0 && (
            <p className="text-[10px] text-orange-500 mt-0.5 font-semibold">🚚 الباقي عند الشحن</p>
          )}
          {order.deliveryNote && !editing && (
            <p className="text-[10px] text-muted-foreground mt-0.5 truncate max-w-[110px]">
              {order.deliveryNote}
            </p>
          )}
          {(order as any).returnReason && !editing && (
            <p className="text-[10px] text-red-400 mt-0.5 truncate max-w-[110px]">
              ↩ {returnReasonLabel((order as any).returnReason)}
            </p>
          )}
        </div>
        {/* Action */}
        <div className="flex justify-end">
          {!locked && !hideAction && (
            editing ? (
              <Button
                variant="ghost"
                size="sm"
                className="h-6 text-[10px] px-1.5 text-muted-foreground"
                onClick={() => {
                  setEditing(false);
                  setStatus(order.deliveryStatus);
                  setNote(order.deliveryNote ?? "");
                  setPartialProduct("");
                  setPartialQty(order.partialQuantity?.toString() ?? "");
                  setReturnReceived((order as any).returnReceived === 1 ? true : (order as any).returnReceived === 0 ? false : null);
                  setPartialReturnReceived(order.deliveryStatus === "partial_received" ? ((order as any).returnReceived === 1 ? true : (order as any).returnReceived === 0 ? false : null) : null);
                }}
              >
                <X className="w-3 h-3" />
              </Button>
            ) : (
              <Button
                variant="ghost"
                size="sm"
                className="h-6 text-[10px] px-1.5 text-primary hover:text-primary"
                onClick={() => {
                  setStatus(order.deliveryStatus);
                  setNote(order.deliveryNote ?? "");
                  setPartialQty(order.partialQuantity?.toString() ?? "");
                  setReturnReceived((order as any).returnReceived === 1 ? true : (order as any).returnReceived === 0 ? false : null);
                  setPartialReturnReceived(order.deliveryStatus === "partial_received" ? ((order as any).returnReceived === 1 ? true : (order as any).returnReceived === 0 ? false : null) : null);
                  setEditing(true);
                }}
              >
                <Edit2 className="w-3 h-3 ml-0.5" />تقفيل
              </Button>
            )
          )}
          {locked && !hideAction && (
            <Link href={`/orders/${order.id}`}>
              <Button variant="ghost" size="sm" className="h-6 text-[10px] px-2 text-primary hover:text-primary">
                عرض
              </Button>
            </Link>
          )}
        </div>
      </div>

      {/* Mobile card (md:hidden) */}
      <div className="md:hidden px-3 py-2.5 text-xs flex flex-col gap-1.5">
        <div className="flex items-start justify-between gap-2">
          <div className="flex flex-col gap-0.5 min-w-0">
            <span className="font-mono text-[10px] text-muted-foreground bg-muted/40 rounded px-1.5 py-0.5 border border-border/40 self-start">
              #{order.id.toString().padStart(4, "0")}
            </span>
            {order.phone && <span className="text-[10px] text-muted-foreground">{order.phone}</span>}
          </div>
          <Badge variant="outline" className={`text-[9px] font-bold border shrink-0 ${opt.bg} ${opt.color}`}>
            {opt.label}
          </Badge>
        </div>
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="font-medium truncate">{order.product}</p>
            {(order.color || order.size) && (
              <p className="text-muted-foreground text-[10px]">{[order.color, order.size].filter(Boolean).join(" / ")}</p>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className="font-bold">{order.quantity}</span>
            <span className="font-bold text-primary">{formatCurrency(order.totalPrice)}</span>
          </div>
        </div>
        {order.deliveryStatus === "returned" && (order as any).returnReceived === 1 && (
          <p className="text-[10px] text-emerald-600 font-semibold">↩ تم الاستلام</p>
        )}
        {order.deliveryStatus === "returned" && (order as any).returnReceived === 0 && (
          <p className="text-[10px] text-orange-500 font-semibold">⏳ عند شركة الشحن</p>
        )}
        {order.deliveryStatus === "partial_received" && (order as any).returnReceived === 1 && (
          <p className="text-[10px] text-emerald-600 font-semibold">↩ الباقي في المخزن</p>
        )}
        {order.deliveryStatus === "partial_received" && (order as any).returnReceived === 0 && (
          <p className="text-[10px] text-orange-500 font-semibold">🚚 الباقي عند الشحن</p>
        )}
        {order.deliveryNote && !editing && (
          <p className="text-[10px] text-muted-foreground">{order.deliveryNote}</p>
        )}
        {(order as any).returnReason && !editing && (
          <p className="text-[10px] text-red-400 font-semibold">↩ {returnReasonLabel((order as any).returnReason)}</p>
        )}
        {!locked && !hideAction && (
          <div className="flex justify-end">
            {editing ? (
              <Button variant="ghost" size="sm" className="h-6 text-[10px] px-1.5 text-muted-foreground"
                onClick={() => { setEditing(false); setStatus(order.deliveryStatus); setNote(order.deliveryNote ?? ""); setPartialProduct(""); setPartialQty(order.partialQuantity?.toString() ?? ""); setReturnReceived((order as any).returnReceived === 1 ? true : (order as any).returnReceived === 0 ? false : null); setPartialReturnReceived(order.deliveryStatus === "partial_received" ? ((order as any).returnReceived === 1 ? true : (order as any).returnReceived === 0 ? false : null) : null); }}>
                <X className="w-3 h-3" />
              </Button>
            ) : (
              <Button variant="ghost" size="sm" className="h-6 text-[10px] px-1.5 text-primary hover:text-primary"
                onClick={() => { setStatus(order.deliveryStatus); setNote(order.deliveryNote ?? ""); setPartialQty(order.partialQuantity?.toString() ?? ""); setReturnReceived((order as any).returnReceived === 1 ? true : (order as any).returnReceived === 0 ? false : null); setPartialReturnReceived(order.deliveryStatus === "partial_received" ? ((order as any).returnReceived === 1 ? true : (order as any).returnReceived === 0 ? false : null) : null); setEditing(true); }}>
                <Edit2 className="w-3 h-3 ml-0.5" />تقفيل
              </Button>
            )}
          </div>
        )}
        {locked && !hideAction && (
          <div className="flex justify-end">
            <Link href={`/orders/${order.id}`}>
              <Button variant="ghost" size="sm" className="h-6 text-[10px] px-2 text-primary hover:text-primary">عرض</Button>
            </Link>
          </div>
        )}
      </div>

      {/* Editing panel -- Select + qty + note + save */}
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
                  {DELIVERY_OPTIONS.filter((o) => o.value !== "partial_received" || order.quantity > 1).map((o) => (
                    <SelectItem key={o.value} value={o.value} className="text-xs">
                      <span className={o.color}>{o.label}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {needsPartial && (
              <>
                <div>
                  <Label className="text-[10px] mb-1 block text-muted-foreground">
                    الكمية المستلمة (من {order.quantity}) <span className="text-destructive font-bold">*</span>
                  </Label>
                  <Input
                    type="number"
                    min={0}
                    max={order.quantity}
                    value={partialQty}
                    onChange={(e) => setPartialQty(e.target.value)}
                    className={`h-8 text-xs w-28 bg-background ${partialQty === "" ? "border-destructive" : ""}`}
                    placeholder="مطلوب"
                    autoFocus
                  />
                  {(partialQty === "") && (
                    <p className="text-[10px] text-destructive mt-0.5">⚠ أدخل الكمية المستلمة</p>
                  )}
                </div>
                <div>
                  <Label className="text-[10px] mb-1 block text-muted-foreground">
                    المنتج المستلم
                  </Label>
                  <Input
                    value={partialProduct}
                    onChange={(e) => setPartialProduct(e.target.value)}
                    className="h-8 text-xs w-44 bg-background"
                    placeholder={order.product}
                  />
                </div>
              </>
            )}
          </div>
          {/* هل الباقي من الاستلام الجزئي عند الشحن؟ */}
          {status === "partial_received" && (
            <div className="space-y-1.5">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">هل الباقي عند شركة الشحن؟ *</p>
              <div className="flex gap-2.5">
                <button
                  type="button"
                  onClick={() => setPartialReturnReceived(false)}
                  className={`flex-1 flex flex-col items-center gap-1 px-3 py-2.5 rounded-lg border text-xs font-bold transition-all ${
                    partialReturnReceived === false
                      ? "border-amber-500 bg-amber-900/30 text-amber-300"
                      : "border-border text-muted-foreground hover:bg-muted/20"
                  }`}
                >
                  <span className="text-base">🚚</span>
                  <span>مازال عند الشحن</span>
                  <span className="text-[9px] font-normal opacity-70">سيُرحَّل للبيان الجديد</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPartialReturnReceived(true)}
                  className={`flex-1 flex flex-col items-center gap-1 px-3 py-2.5 rounded-lg border text-xs font-bold transition-all ${
                    partialReturnReceived === true
                      ? "border-emerald-500 bg-emerald-900/30 text-emerald-300"
                      : "border-border text-muted-foreground hover:bg-muted/20"
                  }`}
                >
                  <span className="text-base">✅</span>
                  <span>تم استلامه في المخزن</span>
                  <span className="text-[9px] font-normal opacity-70">يُعاد للمخزن تلقائياً</span>
                </button>
              </div>
              <p className="text-[10px] text-center font-medium" style={{ color: partialReturnReceived === true ? "#0F6E56" : partialReturnReceived === false ? "#854F0B" : "var(--color-text-secondary)" }}>
                {partialReturnReceived === true && "✓ سيتم إرجاع الباقي للمخزن"}
                {partialReturnReceived === false && "⏳ الباقي مازال في شركة الشحن — سيُرحَّل"}
                {partialReturnReceived === null && "⚠ يجب اختيار حالة الباقي قبل الحفظ"}
              </p>
            </div>
          )}
          {/* حالة استلام المرتجع + سبب — زي الطلبات */}
          {status === "returned" && (
            <div className="flex flex-wrap gap-2 items-end">
              {/* سبب الإرجاع */}
              <div>
                <Label className="text-[10px] mb-1 block text-muted-foreground">سبب الإرجاع</Label>
                <Select value={returnReason} onValueChange={setReturnReason}>
                  <SelectTrigger className="h-8 text-xs w-44 bg-background border-red-800/60 focus:ring-red-700">
                    <SelectValue placeholder="اختر السبب..." />
                  </SelectTrigger>
                  <SelectContent>
                    {RETURN_REASONS.map(r => (
                      <SelectItem key={r.value} value={r.value} className="text-xs">{r.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {/* هل تم استلام المرتجع */}
              <div>
                <Label className="text-[10px] mb-1 block text-muted-foreground">حالة الاستلام *</Label>
                <Select
                  value={returnReceived === true ? "received" : returnReceived === false ? "at_shipping" : ""}
                  onValueChange={v => setReturnReceived(v === "received" ? true : v === "at_shipping" ? false : null)}
                >
                  <SelectTrigger className="h-8 text-xs w-44 bg-background border-red-800/60 focus:ring-red-700">
                    <SelectValue placeholder="اختر الحالة... *" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="received" className="text-xs">
                      <span className="text-emerald-600 dark:text-emerald-400">↩ تم استلام المرتجع — يُعاد للمخزن</span>
                    </SelectItem>
                    <SelectItem value="at_shipping" className="text-xs">
                      <span className="text-orange-600 dark:text-orange-400">🚚 مازال في الشحن — سيُرحَّل</span>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {returnReceived === null && (
                <p className="text-[10px] text-destructive w-full">⚠ يجب اختيار حالة الاستلام قبل الحفظ</p>
              )}
            </div>
          )}
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
                  : "ملاحظة (اختياري)..."
              }
              autoFocus={!needsPartial}
            />
          </div>
          <div className="flex gap-2 justify-between items-center">
            <Button
              size="sm"
              variant="ghost"
              className="h-7 text-[11px] text-destructive hover:text-destructive hover:bg-destructive/10 gap-1"
              onClick={() => setConfirmCancel(true)}
              disabled={cancelMutation.isPending}
            >
              <Trash2 className="w-3 h-3" />
              إلغاء من البيان
            </Button>
            <Button
              size="sm"
              className="h-7 text-[11px] bg-primary text-primary-foreground hover:bg-primary/90 gap-1"
              onClick={() => mutation.mutate()}
              disabled={
                mutation.isPending ||
                (needsNote && !note.trim()) ||
                (needsPartial && (partialQty === "")) ||
                (status === "returned" && returnReceived === null)
              }
            >
              <Save className="w-3 h-3" />
              {mutation.isPending ? "جاري الحفظ..." : "حفظ"}
            </Button>
          </div>
          <AlertDialog open={confirmCancel} onOpenChange={setConfirmCancel}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>إلغاء الطلبية من البيان</AlertDialogTitle>
                <AlertDialogDescription>
                  هل أنت متأكد من إلغاء طلبية <strong>{order.customerName}</strong> ({order.product}) من البيان؟
                  <br />سيتم إرجاعها لحالة &quot;انتظار&quot; وإلغاء تأثيرها على المخزون.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>لا، تراجع</AlertDialogCancel>
                <AlertDialogAction
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  onClick={() => { setConfirmCancel(false); cancelMutation.mutate(); }}
                >
                  نعم، إلغاء الطلبية
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      )}
    </div>
  );
}

// ─── Invoice Group Row — يعرض مجموعة طلبات بنفس invoiceNumber كصف واحد ─────
function InvoiceGroupDeliveryRow({
  group,
  manifestId,
  locked,
  onSaved,
  rowIndex = 0,
  selected = false,
  onToggleSelect,
}: {
  group: ManifestOrder[];
  manifestId: number;
  locked: boolean;
  onSaved: () => void;
  rowIndex?: number;
  selected?: boolean;
  onToggleSelect?: (groupKey: string) => void;
}) {
  const { toast } = useToast();
  const [expanded, setExpanded] = useState(false);

  const rep = group[0];
  const groupKey = getManifestGroupKey(rep);
  const totalQty = group.reduce((s, o) => s + o.quantity, 0);
  // السعر الفعلي: لو partial_received احسب الجزء المستلم فقط
  const totalPrice = group.reduce((s, o) => {
    if (o.deliveryStatus === "partial_received" && o.partialQuantity != null) {
      return s + o.unitPrice * o.partialQuantity;
    }
    return s + o.totalPrice;
  }, 0);
  // السعر الكامل للفاتورة (للعرض والمرجع)
  const totalFullPrice = group.reduce((s, o) => s + o.totalPrice, 0);
  const invoiceNum = (rep as any).invoiceNumber?.trim() || null;
  const isMulti = group.length > 1;

  // حالة المجموعة: لو كل الطلبات بنفس الحالة → اعرضها
  // لو مختلطة بين partial_received و pending/postponed → partial_received (بعض المنتجات استُلمت وبعضها لا)
  // وإلا → "pending"
  const statuses = [...new Set(group.map(o => o.deliveryStatus))];
  const hasMixedPartial = statuses.includes("partial_received") && statuses.every(s => s === "partial_received" || s === "pending" || s === "postponed");
  const groupStatus: DeliveryStatus = statuses.length === 1
    ? statuses[0] as DeliveryStatus
    : hasMixedPartial
      ? "partial_received"
      : "pending";
  const groupOpt = deliveryOpt(groupStatus);
  const hasMultipleStatuses = statuses.length > 1;

  // الحالة المعروضة: لو في وضع تعديل أو بعد حفظ (قبل refetch) → نعرض bulkStatus، غير كده نعرض groupStatus
  // هيتحدث بعد ما groupPartialKey يتغير (refetch رجع) لأن pendingSaveRef.current سيُمسح

  // تقفيل جماعي — state
  const [bulkEditing, setBulkEditing] = useState(false);
  const [bulkStatus, setBulkStatus] = useState<DeliveryStatus>(groupStatus);
  const [bulkNote, setBulkNote] = useState(rep.deliveryNote ?? "");
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [bulkReturnReceived, setBulkReturnReceived] = useState<boolean | null>(
    (rep as any).returnReceived === 1 ? true : (rep as any).returnReceived === 0 ? false : null
  );
  const [bulkReturnReason, setBulkReturnReason] = useState<string>((rep as any).returnReason ?? "");

  // لكل منتج في الفاتورة: حالة مستقلة — نستخدم o.id كـ key
  const [perOrderStatus, setPerOrderStatus] = useState<Record<number, DeliveryStatus>>(
    Object.fromEntries(group.map(o => [o.id, o.deliveryStatus as DeliveryStatus]))
  );
  const [partialQtyMap, setPartialQtyMap] = useState<Record<number, string>>(
    Object.fromEntries(group.map(o => [o.id, o.partialQuantity?.toString() ?? ""]))
  );
  const [partialReturnReceived, setPartialReturnReceived] = useState<boolean | null>(
    group[0]?.returnReceived === 1 ? true : group[0]?.returnReceived === 0 ? false : null
  );
  // نحفظ القيم المُرسَلة للـ API هنا عشان نستخدمها في onSuccess
  const pendingSaveRef = useRef<{
    partialQtyMap: Record<number, string>;
    perOrderStatus: Record<number, DeliveryStatus>;
    bulkStatus: DeliveryStatus;
    partialReturnReceived: boolean | null;
  } | null>(null);

  // key مستقر للـ group — بيتغير لما partialQuantity أو returnReceived يتغيروا
  const groupPartialKey = group.map(o => `${o.id}:${o.partialQuantity ?? ""}:${(o as any).returnReceived ?? ""}`).join(",");

  // الكميات المعروضة: لو في وضع التعديل أو بعد حفظ فوري → من state، وإلا من server
  // الحالة المعروضة في الـ UI (خارج وضع التعديل): لما pendingSaveRef موجود نعرض bulkStatus (الحالة المحفوظة) لحد ما يجي الـ refetch
  const displayStatus: DeliveryStatus = (bulkEditing || pendingSaveRef.current !== null) ? bulkStatus : groupStatus;
  const displayOpt = deliveryOpt(displayStatus);

  const displayPartialQtyMap: Record<number, number> = Object.fromEntries(
    group.map(o => {
      const stateVal = partialQtyMap[o.id];
      const parsed = stateVal !== "" && stateVal !== undefined ? parseInt(stateVal) : NaN;
      const useState = bulkEditing || pendingSaveRef.current !== null;
      return [o.id, useState && !isNaN(parsed) ? parsed : (o.partialQuantity ?? 0)];
    })
  );
  const displayTotalPartialQty = Object.values(displayPartialQtyMap).reduce((s, v) => s + v, 0);

  // مزامنة الـ state مع الـ prop بعد كل refetch أو لما نخرج من وضع التعديل
  // تتبع آخر groupPartialKey شفناه — عشان نعرف لو الـ server data فعلاً اتغيرت
  const prevGroupPartialKeyRef = useRef(groupPartialKey);

  useEffect(() => {
    if (!bulkEditing) {
      const keyChanged = prevGroupPartialKeyRef.current !== groupPartialKey;
      prevGroupPartialKeyRef.current = groupPartialKey;

      if (pendingSaveRef.current) {
        if (keyChanged) {
          // server data وصلت فعلاً وفيها التغيير → امسح الـ ref واعمل sync
          pendingSaveRef.current = null;
        } else {
          // refetch لسه ما خلصش أو مفيش تغيير في الـ key → مش نعمل sync دلوقتي
          return;
        }
      }
      setBulkStatus(groupStatus);
      setBulkNote(rep.deliveryNote ?? "");
      setBulkReturnReceived((rep as any).returnReceived === 1 ? true : (rep as any).returnReceived === 0 ? false : null);
      setBulkReturnReason((rep as any).returnReason ?? "");
      setPerOrderStatus(Object.fromEntries(group.map(o => [o.id, o.deliveryStatus as DeliveryStatus])));
      setPartialQtyMap(Object.fromEntries(group.map(o => [o.id, o.partialQuantity?.toString() ?? ""])));
      const serverPartialReturn = group[0]?.returnReceived === 1 ? true : group[0]?.returnReceived === 0 ? false : null;
      setPartialReturnReceived(groupStatus === "partial_received" && serverPartialReturn === null ? false : serverPartialReturn);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupStatus, rep.deliveryNote, (rep as any).returnReceived, bulkEditing, groupPartialKey]);

  const cancelGroupMutation = useMutation({
    mutationFn: async () => {
      for (const order of group) {
        await manifestsApi.cancelOrder(manifestId, order.id);
      }
    },
    onSuccess: () => {
      toast({ title: "تم إلغاء الفاتورة كاملها من البيان وإرجاعها للانتظار" });
      setBulkEditing(false);
      onSaved();
      setTimeout(() => window.location.reload(), 500);
    },
    onError: (e: any) =>
      toast({ title: "خطأ", description: e.message, variant: "destructive" }),
  });

  // وضع per-item: لما فاتورة متعددة → دايماً كل منتج له حالته المستقلة
  // لما فاتورة منتج واحد → bulkStatus على الكل
  const isPerItemMode = isMulti;

  const bulkMutation = useMutation({
    mutationFn: async () => {
      // نحفظ snapshot من القيم الحالية قبل الـ API calls
      pendingSaveRef.current = {
        partialQtyMap: { ...partialQtyMap },
        perOrderStatus: { ...perOrderStatus },
        bulkStatus,
        partialReturnReceived,
      };
      for (const order of group) {
        let finalStatus: DeliveryStatus = bulkStatus;
        let finalPartialQty: number | null = null;

        if (isMulti && bulkStatus === "partial_received") {
          // فاتورة متعددة + partial: كل منتج له كميته المستقلة من partialQtyMap
          const key = order.id;
          const val = partialQtyMap[key];
          const parsed = (val !== "" && val !== undefined && val !== null) ? parseInt(val) : null;
          if (parsed !== null && !isNaN(parsed) && parsed >= 0) {
            finalStatus = "partial_received";
            finalPartialQty = parsed;
          } else if (order.partialQuantity && order.partialQuantity > 0) {
            // مفيش قيمة جديدة → نستخدم الكمية الموجودة في DB (مش نغير الحالة)
            finalStatus = "partial_received";
            finalPartialQty = order.partialQuantity;
          } else {
            // مفيش قيمة خالص → نفضل على نفس الحالة القديمة (مش نبعت pending)
            finalStatus = (order.deliveryStatus as DeliveryStatus) ?? bulkStatus;
            finalPartialQty = null;
          }
        } else if (isPerItemMode && bulkStatus !== "partial_received") {
          // فاتورة متعددة + حالة أخرى: كل منتج له حالته المستقلة من perOrderStatus
          const key = order.id;
          finalStatus = perOrderStatus[key] ?? bulkStatus;
          if (finalStatus === "partial_received") {
            const val = partialQtyMap[key];
            finalPartialQty = (val !== "" && val !== undefined) ? parseInt(val) : null;
          }
        } else {
          // فاتورة منتج واحد
          finalStatus = bulkStatus;
          if (finalStatus === "partial_received") {
            const key = order.id;
            const val = partialQtyMap[key];
            finalPartialQty = (val !== "" && val !== undefined) ? parseInt(val) : null;
          }
        }

        await manifestsApi.updateOrderDelivery(manifestId, order.id, {
          deliveryStatus: finalStatus,
          deliveryNote: bulkNote.trim() || null,
          partialQuantity: finalPartialQty,
          ...(finalStatus === 'partial_received' ? { partialReturnReceived: partialReturnReceived ?? false } : {}),
          ...(finalStatus === 'returned' ? { returnReceived: bulkReturnReceived, returnReason: bulkReturnReason || null } : {}),
        });
      }
    },
    onSuccess: () => {
      toast({ title: "تم حفظ حالة التسليم للفاتورة كاملها" });
      // نطبق القيم المُرسَلة في الـ state فوراً
      if (pendingSaveRef.current) {
        const { partialQtyMap: savedQty, perOrderStatus: savedStatus, bulkStatus: savedBulk, partialReturnReceived: savedPartialReturn } = pendingSaveRef.current;
        setPartialQtyMap(savedQty);
        setPerOrderStatus(savedStatus);
        setBulkStatus(savedBulk);
        setPartialReturnReceived(savedPartialReturn);
        // لا نمسح pendingSaveRef هنا — يحمي useEffect من override بالقيم القديمة
        // سيُمسح في useEffect لما groupPartialKey يتغير (= server data وصلت فعلاً)
      }
      setBulkEditing(false);
      onSaved();
    },
    onError: (e: any) =>
      toast({ title: "خطأ", description: e.message, variant: "destructive" }),
  });
  const needsBulkNote = bulkStatus === "postponed" || bulkStatus === "returned";

  // products summary
  const productsText = group.map(o => {
    const variant = [o.color, o.size].filter(Boolean).join("/");
    return variant ? `${o.product} (${variant}) ×${o.quantity}` : `${o.product} ×${o.quantity}`;
  }).join("، ");

  return (
    <>
      {/* ── Main group row ── */}
      <div
        className={`border-b border-border/50 transition-colors ${bulkEditing ? "bg-primary/5" : selected ? "bg-primary/10 border-primary/30" : "hover:bg-muted/10"}`}
        style={{
          animation: "rowFadeIn 0.35s ease both",
          animationDelay: `${rowIndex * 45}ms`,
        }}
      >
        {/* Desktop row */}
        <div dir="rtl" className="hidden md:grid grid-cols-[minmax(140px,1fr)_minmax(120px,1fr)_minmax(140px,1fr)_60px_90px_160px_90px_80px] min-w-[860px] gap-0 items-start py-2.5 text-xs">
          {/* Customer */}
          <div className="min-w-0 px-3 flex items-start gap-2">
            {onToggleSelect && (
              <Checkbox
                checked={selected}
                onCheckedChange={() => onToggleSelect(groupKey)}
                className="mt-0.5 shrink-0"
                onClick={e => e.stopPropagation()}
              />
            )}
            <div className="min-w-0">
              <p className="font-semibold truncate">{rep.customerName}</p>
              <div className="flex items-center gap-1 flex-wrap">
                {invoiceNum && (
                  <span className="text-[9px] bg-primary/10 text-primary px-1 rounded font-mono">
                    {invoiceNum}
                  </span>
                )}
                {rep.phone && (
                  <span className="text-muted-foreground text-[10px]">{rep.phone}</span>
                )}
              </div>
            </div>
          </div>
          {/* المحافظة / العنوان */}
          <div className="min-w-0 px-3">
            {rep.city && (
              <p className="font-semibold text-[10px] truncate">{rep.city}</p>
            )}
            {rep.address && (
              <p className="text-muted-foreground text-[10px] truncate">{rep.address}</p>
            )}
            {!rep.city && !rep.address && (
              <p className="text-muted-foreground/40 text-[10px]">—</p>
            )}
          </div>
          {/* Products */}
          <div className="min-w-0 px-3">
            {isMulti ? (
              <div className="space-y-1">
                <button
                  type="button"
                  className="text-right w-full"
                  onClick={() => setExpanded(!expanded)}
                >
                  <p className="text-primary text-[10px] font-bold flex items-center gap-1">
                    {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                    {group.length} منتجات داخل الطلب
                  </p>
                    <p className="text-muted-foreground text-[10px] truncate">
                      {expanded ? "إخفاء المنتجات" : productsText}
                    </p>
                </button>
              </div>
            ) : (
              <>
                <p className="truncate">{rep.product}</p>
                {(rep.color || rep.size) && (
                  <p className="text-muted-foreground text-[10px]">
                    {[rep.color, rep.size].filter(Boolean).join(" / ")}
                  </p>
                )}
              </>
            )}
          </div>
          {/* Qty */}
          <div className="text-center font-bold">
            {displayStatus === "partial_received" ? (
              <span>
                <span className="text-teal-400">{displayTotalPartialQty}</span>
                <span className="text-muted-foreground">/{totalQty}</span>
              </span>
            ) : totalQty}
          </div>
          {/* Price */}
          <div className="text-left font-bold px-3">
            {formatCurrency(totalPrice)}
            {totalPrice !== totalFullPrice && (
              <p className="text-[9px] text-muted-foreground font-normal line-through">{formatCurrency(totalFullPrice)}</p>
            )}
          </div>
          {/* Status */}
          <div className="px-3">
            {hasMultipleStatuses && !hasMixedPartial ? (
              <div className="flex flex-col gap-0.5">
                <Badge variant="outline" className="text-[9px] font-bold border border-border text-muted-foreground">
                  حالات متعددة
                </Badge>
                {group.map(o => {
                  const opt = deliveryOpt(o.deliveryStatus as DeliveryStatus);
                  const label = o.deliveryStatus === "partial_received" && o.partialQuantity
                    ? `${o.product} ×${o.partialQuantity}/${o.quantity}`
                    : `${o.product}`;
                  return (
                    <p key={o.id} className={`text-[9px] truncate max-w-[110px] font-medium ${opt.color}`}>
                      {o.deliveryStatus === "delivered" ? "✓" :
                       o.deliveryStatus === "returned" ? "✕" :
                       o.deliveryStatus === "partial_received" ? "◑" :
                       o.deliveryStatus === "postponed" ? "⏸" : "○"} {label}
                    </p>
                  );
                })}
              </div>
            ) : displayStatus === "partial_received" ? (
              <div className="flex flex-col gap-0.5">
                <Badge variant="outline" className={`text-[9px] font-bold border ${displayOpt.bg} ${displayOpt.color}`}>
                  {displayOpt.label} ({displayTotalPartialQty}/{totalQty})
                </Badge>
                {group.filter(o => (displayPartialQtyMap[o.id] ?? 0) > 0).map(o => (
                  <p key={o.id} className="text-[9px] text-teal-600 dark:text-teal-400 truncate max-w-[110px]">
                    ◑ {o.product} ×{displayPartialQtyMap[o.id]}
                  </p>
                ))}
                {(rep as any).returnReceived === 0 && (
                  <p className="text-[9px] text-orange-500 font-semibold">🚚 الباقي عند الشحن</p>
                )}
                {(rep as any).returnReceived === 1 && (
                  <p className="text-[9px] text-emerald-500 font-semibold">↩ الباقي في المخزن</p>
                )}
              </div>
            ) : (
              <div className="flex flex-col gap-0.5">
                <Badge variant="outline" className={`text-[9px] font-bold border ${displayOpt.bg} ${displayOpt.color}`}>
                  {displayOpt.label}
                </Badge>
                {/* sub-status للمرتجع في الـ group row */}
                {displayStatus === "returned" && (rep as any).returnReceived === 1 && (
                  <p className="text-[10px] text-emerald-600 mt-0.5 font-semibold">↩ تم الاستلام</p>
                )}
                {displayStatus === "returned" && (rep as any).returnReceived === 0 && (
                  <p className="text-[10px] text-orange-500 mt-0.5 font-semibold">⏳ عند شركة الشحن</p>
                )}
                {displayStatus === "partial_received" && (rep as any).returnReceived === 1 && (
                  <p className="text-[10px] text-emerald-600 mt-0.5 font-semibold">↩ الباقي في المخزن</p>
                )}
                {displayStatus === "partial_received" && (rep as any).returnReceived === 0 && (
                  <p className="text-[10px] text-orange-500 mt-0.5 font-semibold">🚚 الباقي عند الشحن</p>
                )}
              </div>
            )}
          </div>
          {/* Added At */}
          <div className="px-2 text-center">
            {rep.addedAt ? (
              <p className="text-[9px] text-muted-foreground leading-tight">
                {format(new Date((rep as any).addedAt), "MM/dd")}
                <br />
                <span className="text-[8px] opacity-70">{format(new Date((rep as any).addedAt), "HH:mm")}</span>
              </p>
            ) : (
              <p className="text-[9px] text-muted-foreground/40">—</p>
            )}
          </div>
          {/* Action */}
          <div className="flex justify-end">
            {!locked && (
              bulkEditing ? (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 text-[10px] px-1.5 text-muted-foreground"
                  onClick={() => setBulkEditing(false)}
                >
                  <X className="w-3 h-3" />
                </Button>
              ) : (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 text-[10px] px-1.5 text-primary hover:text-primary"
                  onClick={() => { 
                    setBulkEditing(true); 
                    setBulkStatus(groupStatus); 
                    setBulkNote(rep.deliveryNote ?? ""); 
                    setPartialQtyMap(Object.fromEntries(group.map(o => [o.id, o.partialQuantity?.toString() ?? ""]))); 
                    setPerOrderStatus(Object.fromEntries(group.map(o => [o.id, o.deliveryStatus as DeliveryStatus]))); 
                    setBulkReturnReceived((rep as any).returnReceived === 1 ? true : (rep as any).returnReceived === 0 ? false : null); 
                    // لو partial_received وreturnReceived غير محدد → default false (مازال عند الشحن)
                    const existingPartialReturn = (rep as any).returnReceived === 1 ? true : (rep as any).returnReceived === 0 ? false : null;
                    setPartialReturnReceived(groupStatus === "partial_received" && existingPartialReturn === null ? false : existingPartialReturn); 
                  }}
                >
                  <Edit2 className="w-3 h-3 ml-0.5" />تقفيل
                </Button>
              )
            )}
          </div>
        </div>

        {/* Mobile card (md:hidden) */}
        <div className="md:hidden px-3 py-2.5 text-xs flex flex-col gap-2">
          {/* Row 1: customer + status badge */}
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-start gap-2 min-w-0">
              {onToggleSelect && (
                <Checkbox
                  checked={selected}
                  onCheckedChange={() => onToggleSelect(groupKey)}
                  className="mt-0.5 shrink-0"
                  onClick={e => e.stopPropagation()}
                />
              )}
              <div className="min-w-0">
                <p className="font-semibold truncate">{rep.customerName}</p>
                <div className="flex items-center gap-1 flex-wrap mt-0.5">
                  {invoiceNum && <span className="text-[9px] bg-primary/10 text-primary px-1 rounded font-mono">{invoiceNum}</span>}
                  {rep.phone && <span className="text-muted-foreground text-[10px]">{rep.phone}</span>}
                  {rep.city && <span className="text-muted-foreground text-[10px]">📍 {rep.city}</span>}
                </div>
              </div>
            </div>
            <div className="shrink-0">
              {hasMultipleStatuses && !hasMixedPartial ? (
                <Badge variant="outline" className="text-[9px] font-bold border border-border text-muted-foreground">حالات متعددة</Badge>
              ) : (
                <Badge variant="outline" className={`text-[9px] font-bold border ${displayOpt.bg} ${displayOpt.color}`}>
                  {displayOpt.label}
                </Badge>
              )}
            </div>
          </div>
          {/* Row 2: products + qty + price */}
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0 flex-1">
              {isMulti ? (
                <button type="button" className="text-right w-full" onClick={() => setExpanded(!expanded)}>
                  <p className="text-primary text-[10px] font-bold flex items-center gap-1">
                    {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                    {group.length} منتجات
                  </p>
                  <p className="text-muted-foreground text-[10px] truncate">{expanded ? "إخفاء المنتجات" : productsText}</p>
                </button>
              ) : (
                <>
                  <p className="truncate">{rep.product}</p>
                  {(rep.color || rep.size) && <p className="text-muted-foreground text-[10px]">{[rep.color, rep.size].filter(Boolean).join(" / ")}</p>}
                </>
              )}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className="font-bold">{totalQty}</span>
              <span className="font-bold text-primary">{formatCurrency(totalPrice)}</span>
            </div>
          </div>
          {/* Sub-statuses */}
          {displayStatus === "returned" && (rep as any).returnReceived === 1 && <p className="text-[10px] text-emerald-600 font-semibold">↩ تم الاستلام</p>}
          {displayStatus === "returned" && (rep as any).returnReceived === 0 && <p className="text-[10px] text-orange-500 font-semibold">⏳ عند شركة الشحن</p>}
          {displayStatus === "returned" && (rep as any).returnReason && (
            <p className="text-[10px] text-red-500 font-medium flex items-center gap-1">
              <RotateCcw className="w-2.5 h-2.5 shrink-0" />
              {RETURN_REASONS.find(r => r.value === (rep as any).returnReason)?.label ?? (rep as any).returnReason}
            </p>
          )}
          {displayStatus === "partial_received" && (rep as any).returnReceived === 1 && <p className="text-[10px] text-emerald-600 font-semibold">↩ الباقي في المخزن</p>}
          {displayStatus === "partial_received" && (rep as any).returnReceived === 0 && <p className="text-[10px] text-orange-500 font-semibold">🚚 الباقي عند الشحن</p>}
          {/* Action button */}
          {!locked && (
            <div className="flex justify-end">
              {bulkEditing ? (
                <Button variant="ghost" size="sm" className="h-6 text-[10px] px-1.5 text-muted-foreground" onClick={() => setBulkEditing(false)}>
                  <X className="w-3 h-3" />
                </Button>
              ) : (
                <Button variant="ghost" size="sm" className="h-6 text-[10px] px-1.5 text-primary hover:text-primary"
                  onClick={() => { setBulkEditing(true); setBulkStatus(groupStatus); setBulkNote(rep.deliveryNote ?? ""); setBulkReturnReason((rep as any).returnReason ?? ""); setPartialQtyMap(Object.fromEntries(group.map(o => [o.id, o.partialQuantity?.toString() ?? ""]))); setPerOrderStatus(Object.fromEntries(group.map(o => [o.id, o.deliveryStatus as DeliveryStatus]))); setBulkReturnReceived((rep as any).returnReceived === 1 ? true : (rep as any).returnReceived === 0 ? false : null); const ep = (rep as any).returnReceived === 1 ? true : (rep as any).returnReceived === 0 ? false : null; setPartialReturnReceived(groupStatus === "partial_received" && ep === null ? false : ep); }}>
                  <Edit2 className="w-3 h-3 ml-0.5" />تقفيل
                </Button>
              )}
            </div>
          )}
        </div>

        {/* Bulk editing panel */}
        {bulkEditing && (
          <div className="px-4 pb-3 flex flex-col gap-2 bg-primary/5 border-t border-primary/10">

            {/* ── Dropdown الحالة: يظهر دايماً سواء منتج واحد أو متعددة ── */}
            <div className="flex flex-wrap gap-2 items-end mt-2">
              <div>
                <Label className="text-[10px] mb-1 block text-muted-foreground">حالة التسليم</Label>
                <Select
                  value={bulkStatus}
                  onValueChange={(v) => {
                    setBulkStatus(v as DeliveryStatus);
                    // sync perOrderStatus مع الاختيار الجديد دايماً
                    setPerOrderStatus(Object.fromEntries(group.map(o => [o.id, v as DeliveryStatus])));
                  }}
                >
                  <SelectTrigger className="h-8 text-xs w-40 bg-background">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DELIVERY_OPTIONS.filter((o) => {
                      if (o.value !== "partial_received") return true;
                      // أظهر "استلام جزئي" فقط لو الكمية الكلية للمجموعة أكتر من 1
                      const totalQty = group.reduce((s, o) => s + (o.quantity ?? 1), 0);
                      return totalQty > 1;
                    }).map((o) => (
                      <SelectItem key={o.value} value={o.value} className="text-xs">
                        <span className={o.color}>{o.label}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {/* منتج واحد: خانة الكمية في نفس الصف */}
              {!isMulti && bulkStatus === "partial_received" && group[0] && (
                <div>
                  <Label className="text-[10px] mb-1 block text-muted-foreground">
                    الكمية المستلمة (من {group[0].quantity}) <span className="text-destructive font-bold">*</span>
                  </Label>
                  <Input
                    type="number"
                    min={0}
                    max={group[0].quantity}
                    value={partialQtyMap[group[0].id] ?? ""}
                    onChange={(e) => setPartialQtyMap(prev => ({ ...prev, [group[0].id]: e.target.value }))}
                    className={`h-8 text-xs w-28 bg-background ${!(partialQtyMap[group[0].id] !== "") ? "border-destructive" : ""}`}
                    placeholder="مطلوب"
                    autoFocus
                  />
                  {(partialQtyMap[group[0].id] === "" || partialQtyMap[group[0].id] === undefined) && (
                    <p className="text-[10px] text-destructive mt-0.5">⚠ أدخل الكمية المستلمة</p>
                  )}
                </div>
              )}
            </div>

            {/* ── فاتورة متعددة + partial_received: اعرض كل منتج على حدة ── */}
            {isMulti && bulkStatus === "partial_received" && (
              <div className="flex flex-col gap-2 border border-teal-300 dark:border-teal-700 rounded-md p-2.5 bg-teal-50 dark:bg-teal-900/20">
                <Label className="text-[10px] font-bold text-teal-700 dark:text-teal-400">
                  حدد الكمية المستلمة لكل منتج
                </Label>
                {group.map((o) => {
                  const variant = [o.color, o.size].filter(Boolean).join(" / ");
                  const unitPrice = o.quantity > 0 ? o.totalPrice / o.quantity : 0;
                  const mKey = o.id;
                  const rawVal = partialQtyMap[mKey];
                  const hasQty = rawVal !== "" && rawVal !== undefined && rawVal !== null;
                  const partialVal = hasQty ? parseInt(rawVal) : 0;
                  return (
                    <div key={mKey} className="rounded-md border border-teal-200 dark:border-teal-800 bg-background p-2 flex flex-col gap-1.5">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-xs font-semibold">{o.product}</p>
                          {variant && <p className="text-[10px] text-muted-foreground">{variant}</p>}
                        </div>
                        <span className="text-xs font-bold text-muted-foreground">الإجمالي: {o.quantity}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Label className="text-[10px] text-muted-foreground shrink-0">المستلم:</Label>
                        <input
                          type="number"
                          min={0}
                          max={o.quantity}
                          value={partialQtyMap[mKey] ?? ""}
                          onChange={e => {
                            const raw = e.target.value;
                            if (raw === "") {
                              setPartialQtyMap(prev => ({ ...prev, [mKey]: "" }));
                            } else {
                              const n = parseInt(raw);
                              if (!isNaN(n) && n >= 0 && n <= o.quantity) {
                                setPartialQtyMap(prev => ({ ...prev, [mKey]: String(n) }));
                              }
                            }
                          }}
                          className={`h-7 w-20 rounded border bg-background px-2 text-xs text-center ${!hasQty ? "border-destructive" : "border-teal-400"}`}
                          placeholder="مطلوب"
                          autoFocus={o.id === group[0].id}
                        />
                        <span className="text-[10px] text-muted-foreground">من {o.quantity}</span>
                        {!hasQty && (
                          <span className="text-[10px] text-destructive">⚠ مطلوب</span>
                        )}
                        {partialVal > 0 && (
                          <span className="text-[10px] text-teal-600 dark:text-teal-400 font-bold">
                            = {(unitPrice * partialVal).toFixed(0)} ج.م
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* ── فاتورة متعددة + حالة أخرى (مش partial): لا تظهر تفاصيل — الحالة بتتطبق على الكل تلقائياً ── */}
            {isMulti && bulkStatus !== "partial_received" && false && (
              <div className="flex flex-col gap-2 border border-border/40 rounded-md p-2.5 bg-muted/10">
                <Label className="text-[10px] font-bold text-muted-foreground">
                  تفاصيل المنتجات — يمكن تعديل حالة كل منتج على حدة
                </Label>
                {group.map((o) => {
                  const variant = [o.color, o.size].filter(Boolean).join(" / ");
                  const oStatus = perOrderStatus[o.id] ?? bulkStatus;
                  return (
                    <div key={o.id} className="rounded-md border border-border/40 bg-background p-2 flex flex-col gap-1.5">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-xs font-semibold">{o.product}</p>
                          {variant && <p className="text-[10px] text-muted-foreground">{variant}</p>}
                        </div>
                        <span className="text-xs font-bold text-muted-foreground">{o.quantity}x</span>
                      </div>
                      <div className="flex gap-1 flex-wrap">
                        {([
                          { v: "delivered",        label: "مسلَّم ✓", cls: "border-emerald-400 bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400" },
                          { v: "partial_received", label: "جزئي",     cls: "border-teal-400 bg-teal-100 dark:bg-teal-900/40 text-teal-700 dark:text-teal-400" },
                          { v: "returned",         label: "مرتجع",   cls: "border-red-400 bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-400" },
                          { v: "pending",          label: "انتظار",  cls: "border-border bg-muted/30 text-muted-foreground" },
                        ] as { v: DeliveryStatus; label: string; cls: string }[]).map(btn => (
                          <button
                            key={btn.v}
                            type="button"
                            onClick={() => setPerOrderStatus(prev => ({ ...prev, [o.id]: btn.v }))}
                            className={`text-[10px] font-bold px-2 py-0.5 rounded border transition-all ${
                              oStatus === btn.v
                                ? btn.cls + " ring-1 ring-offset-1 ring-current"
                                : "border-border/40 text-muted-foreground hover:bg-muted/20"
                            }`}
                          >
                            {btn.label}
                          </button>
                        ))}
                      </div>
                      {oStatus === "partial_received" && (
                        <div className="flex items-center gap-2 mt-0.5">
                          <Label className="text-[10px] text-muted-foreground shrink-0">المستلم من {o.quantity}:</Label>
                          <input
                            type="number"
                            min={0}
                            max={o.quantity}
                            value={partialQtyMap[o.id] ?? ""}
                            onChange={e => setPartialQtyMap(prev => ({ ...prev, [o.id]: e.target.value }))}
                            className={`h-7 w-20 rounded border bg-background px-2 text-xs text-center ${
                              partialQtyMap[o.id] === "" || partialQtyMap[o.id] === undefined
                                ? "border-border text-muted-foreground"
                                : parseInt(partialQtyMap[o.id]) > 0
                                  ? "border-teal-400 text-teal-600"
                                  : "border-amber-400 text-amber-600"
                            }`}
                            placeholder="0"
                          />
                          <span className="text-[10px] text-muted-foreground">
                            {partialQtyMap[o.id] === "" || partialQtyMap[o.id] === undefined
                              ? "اتركها 0 إذا لم يُستلم"
                              : parseInt(partialQtyMap[o.id]) > 0
                                ? "✓ سيُسجَّل كاستلام جزئي"
                                : "لم يُستلم — سيبقى عند الشحن"}
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* حالة الباقي من الاستلام الجزئي — تظهر فقط لما يختار "استلام جزئي" */}
            {bulkStatus === "partial_received" && (
              <div className="space-y-1.5">
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">الباقي عند شركة الشحن؟ <span className="text-destructive">*</span></p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setPartialReturnReceived(false)}
                    className={`flex-1 flex flex-col items-center gap-1 px-3 py-2.5 rounded-lg border text-xs font-bold transition-all ${
                      partialReturnReceived === false
                        ? "border-amber-500 bg-amber-900/30 text-amber-300"
                        : "border-border text-muted-foreground hover:bg-muted/20"
                    }`}
                  >
                    <span className="text-base">🚚</span>
                    <span>مازال عند الشحن</span>
                    <span className="text-[9px] font-normal opacity-70">سيُرحَّل للبيان الجديد</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPartialReturnReceived(true)}
                    className={`flex-1 flex flex-col items-center gap-1 px-3 py-2.5 rounded-lg border text-xs font-bold transition-all ${
                      partialReturnReceived === true
                        ? "border-emerald-500 bg-emerald-900/30 text-emerald-300"
                        : "border-border text-muted-foreground hover:bg-muted/20"
                    }`}
                  >
                    <span className="text-base">✅</span>
                    <span>تم استلامه في المخزن</span>
                    <span className="text-[9px] font-normal opacity-70">يُعاد للمخزن تلقائياً</span>
                  </button>
                </div>
                {partialReturnReceived === null && (
                  <p className="text-[10px] text-destructive font-medium">⚠ يجب اختيار حالة الباقي قبل الحفظ</p>
                )}
              </div>
            )}

            {/* حالة استلام المرتجع — تظهر فقط لما المستخدم يختار "مرتجع" */}
            {bulkStatus === "returned" && (
              <div className="space-y-2">
                {/* سبب الإرجاع */}
                <div>
                  <Label className="text-[10px] mb-1 block text-muted-foreground">سبب الإرجاع</Label>
                  <Select value={bulkReturnReason} onValueChange={setBulkReturnReason}>
                    <SelectTrigger className="h-8 text-xs w-52 bg-background border-red-800/60 focus:ring-red-700">
                      <SelectValue placeholder="اختر السبب..." />
                    </SelectTrigger>
                    <SelectContent>
                      {RETURN_REASONS.map(r => (
                        <SelectItem key={r.value} value={r.value} className="text-xs">{r.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">هل تم استلام المرتجع؟</p>
                <div className="flex gap-3">
                  <button type="button" onClick={() => setBulkReturnReceived(true)}
                    className="flex-1 relative outline-none cursor-pointer p-0 border-0 bg-transparent select-none"
                    style={{ borderRadius: 18 }}>
                    <div className="absolute inset-0 rounded-[18px] transition-all duration-150" style={{
                      background: bulkReturnReceived === true ? "linear-gradient(175deg,#043d2a 0%,#021f15 100%)" : "linear-gradient(175deg,#065c3e 0%,#033d28 100%)",
                      boxShadow: bulkReturnReceived === true ? "0 1px 0 #010f09, 0 0 0 1.5px rgba(0,180,100,0.18)" : "0 5px 0 #032918, 0 0 0 1.5px rgba(0,180,100,0.22), 0 8px 20px rgba(0,180,100,0.12)",
                    }} />
                    <div className="relative z-10 flex flex-col items-center gap-1 px-3 pt-4 pb-3.5 rounded-[18px] overflow-hidden transition-all duration-150" style={{
                      background: bulkReturnReceived === true ? "linear-gradient(155deg,#0d8f62 0%,#09714c 55%,#065539 100%)" : "linear-gradient(155deg,#12c482 0%,#0daa6e 55%,#098f5b 100%)",
                      border: bulkReturnReceived === true ? "1px solid rgba(255,255,255,0.08)" : "1px solid rgba(255,255,255,0.14)",
                      boxShadow: bulkReturnReceived === true ? "inset 0 -4px 8px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.12)" : "inset 0 -4px 8px rgba(0,0,0,0.18), inset 0 2px 0 rgba(255,255,255,0.28)",
                      transform: bulkReturnReceived === true ? "translateY(4px)" : "translateY(0)",
                    }}>
                      <div className="absolute left-1/2 -translate-x-1/2 w-14 h-5 rounded-full" style={{ background: "radial-gradient(ellipse,rgba(180,255,220,0.38) 0%,transparent 75%)", top: 6 }} />
                      <div className="w-10 h-10 rounded-full flex items-center justify-center mb-0.5" style={{ background: bulkReturnReceived === true ? "radial-gradient(circle,rgba(0,0,0,0.25) 0%,rgba(0,0,0,0.35) 100%)" : "radial-gradient(circle,rgba(0,0,0,0.12) 0%,rgba(0,0,0,0.22) 100%)", boxShadow: "inset 0 2px 4px rgba(0,0,0,0.3), 0 0 12px rgba(20,220,140,0.3)" }}>
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#c6f6d5" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" style={{ filter: "drop-shadow(0 0 6px rgba(134,239,172,0.85))" }}>
                          <path d="M20 6L9 17l-5-5"/>
                        </svg>
                      </div>
                      <span className="text-[12.5px] font-black leading-tight tracking-tight" style={{ color: bulkReturnReceived === true ? "#a7f3d0" : "#d1fae5", textShadow: "0 1px 3px rgba(0,0,0,0.5)" }}>تم استلام المرتجع</span>
                      <span className="text-[9.5px] font-medium leading-tight" style={{ color: bulkReturnReceived === true ? "rgba(167,243,208,0.65)" : "rgba(209,250,229,0.7)" }}>يُعاد للمخزن تلقائياً</span>
                    </div>
                  </button>
                  <button type="button" onClick={() => setBulkReturnReceived(false)}
                    className="flex-1 relative outline-none cursor-pointer p-0 border-0 bg-transparent select-none"
                    style={{ borderRadius: 18 }}>
                    <div className="absolute inset-0 rounded-[18px] transition-all duration-150" style={{
                      background: bulkReturnReceived === false ? "linear-gradient(175deg,#4a2204 0%,#2e1502 100%)" : "linear-gradient(175deg,#7c3d08 0%,#4f2804 100%)",
                      boxShadow: bulkReturnReceived === false ? "0 1px 0 #180900, 0 0 0 1.5px rgba(200,130,20,0.2)" : "0 5px 0 #3e1d03, 0 0 0 1.5px rgba(200,140,30,0.25), 0 8px 20px rgba(200,140,30,0.12)",
                    }} />
                    <div className="relative z-10 flex flex-col items-center gap-1 px-3 pt-4 pb-3.5 rounded-[18px] overflow-hidden transition-all duration-150" style={{
                      background: bulkReturnReceived === false ? "linear-gradient(155deg,#b8860b 0%,#996b08 55%,#7a5406 100%)" : "linear-gradient(155deg,#e8a820 0%,#c98e14 55%,#a87010 100%)",
                      border: bulkReturnReceived === false ? "1px solid rgba(255,255,255,0.07)" : "1px solid rgba(255,255,255,0.15)",
                      boxShadow: bulkReturnReceived === false ? "inset 0 -4px 8px rgba(0,0,0,0.42), inset 0 1px 0 rgba(255,255,255,0.1)" : "inset 0 -4px 8px rgba(0,0,0,0.18), inset 0 2px 0 rgba(255,255,255,0.30)",
                      transform: bulkReturnReceived === false ? "translateY(4px)" : "translateY(0)",
                    }}>
                      <div className="absolute left-1/2 -translate-x-1/2 w-14 h-5 rounded-full" style={{ background: "radial-gradient(ellipse,rgba(255,240,160,0.38) 0%,transparent 75%)", top: 6 }} />
                      <div className="w-10 h-10 rounded-full flex items-center justify-center mb-0.5" style={{ background: bulkReturnReceived === false ? "radial-gradient(circle,rgba(0,0,0,0.28) 0%,rgba(0,0,0,0.38) 100%)" : "radial-gradient(circle,rgba(0,0,0,0.12) 0%,rgba(0,0,0,0.22) 100%)", boxShadow: "inset 0 2px 4px rgba(0,0,0,0.32), 0 0 12px rgba(220,170,20,0.3)" }}>
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fef3c7" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ filter: "drop-shadow(0 0 6px rgba(253,230,138,0.85))" }}>
                          <rect x="1" y="3" width="15" height="13" rx="2"/><path d="M16 8h4l3 5v3h-7V8z"/>
                          <circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/>
                        </svg>
                      </div>
                      <span className="text-[12.5px] font-black leading-tight tracking-tight" style={{ color: bulkReturnReceived === false ? "#fde68a" : "#fff8e1", textShadow: "0 1px 3px rgba(0,0,0,0.55)" }}>مازال في الشحن</span>
                      <span className="text-[9.5px] font-medium leading-tight" style={{ color: bulkReturnReceived === false ? "rgba(253,230,138,0.65)" : "rgba(255,248,225,0.72)" }}>لن يؤثر على المخزن</span>
                    </div>
                  </button>
                </div>
                <p className="text-[10px] text-center font-medium" style={{ color: bulkReturnReceived === true ? "#0F6E56" : bulkReturnReceived === false ? "#854F0B" : "var(--color-text-secondary)" }}>
                  {bulkReturnReceived === true && "✓ سيتم إرجاع البضاعة للمخزن تلقائياً"}
                  {bulkReturnReceived === false && "⏳ مرتجع مازال في شركة الشحن — لن يؤثر على المخزن"}
                  {bulkReturnReceived === null && "⚠ يجب اختيار حالة استلام المرتجع قبل الحفظ"}
                </p>
              </div>
            )}

            <div>
              <Label className="text-[10px] mb-1 block text-muted-foreground">
                {needsBulkNote ? "سبب / ملاحظة (مطلوب)" : "ملاحظة (اختياري)"}
              </Label>
              <Input
                value={bulkNote}
                onChange={(e) => setBulkNote(e.target.value)}
                className="h-8 text-xs bg-background"
                placeholder={
                  bulkStatus === "postponed" ? "مثال: العميل طلب التأجيل..."
                  : bulkStatus === "returned" ? "مثال: العميل رفض الاستلام..."
                  : "ملاحظة (اختياري)..."
                }
              />
            </div>
            <div className="flex gap-2 justify-between items-center">
              <Button
                size="sm"
                variant="ghost"
                className="h-7 text-[11px] text-destructive hover:text-destructive hover:bg-destructive/10 gap-1"
                onClick={() => setConfirmCancel(true)}
                disabled={cancelGroupMutation.isPending}
              >
                <Trash2 className="w-3 h-3" />
                إلغاء من البيان
              </Button>
              <Button
                size="sm"
                className="h-7 text-[11px] bg-primary text-primary-foreground hover:bg-primary/90 gap-1"
                onClick={() => bulkMutation.mutate()}
                disabled={
                  bulkMutation.isPending ||
                  (needsBulkNote && !bulkNote.trim()) ||
                  (bulkStatus === "returned" && bulkReturnReceived === null) ||
                  (bulkStatus === "partial_received" && partialReturnReceived === null) ||
                  (!isPerItemMode && bulkStatus === "partial_received" && group[0] && (
                    partialQtyMap[group[0].id] === "" || partialQtyMap[group[0].id] === undefined
                  )) ||
                  (isMulti && bulkStatus === "partial_received" && !group.some(o => {
                    const val = partialQtyMap[o.id];
                    return val !== "" && val !== undefined && val !== null && parseInt(val) > 0;
                  })) ||
                  (isPerItemMode && bulkStatus !== "partial_received" && group.some(o =>
                    perOrderStatus[o.id] === "partial_received" &&
                    (partialQtyMap[o.id] === "" || partialQtyMap[o.id] === undefined)
                  ))
                }
              >
                <Save className="w-3 h-3" />
                {bulkMutation.isPending ? "جاري الحفظ..." : "حفظ"}
              </Button>
            </div>
            <AlertDialog open={confirmCancel} onOpenChange={setConfirmCancel}>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>إلغاء الفاتورة من البيان</AlertDialogTitle>
                  <AlertDialogDescription>
                    هل أنت متأكد من إلغاء فاتورة <strong>{rep.customerName}</strong> ({group.length > 1 ? `${group.length} منتجات` : rep.product}) من البيان؟
                    <br />سيتم إرجاع جميع طلبياتها لحالة &quot;انتظار&quot; وإلغاء تأثيرها على المخزون.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>لا، تراجع</AlertDialogCancel>
                  <AlertDialogAction
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    onClick={() => { setConfirmCancel(false); cancelGroupMutation.mutate(); }}
                  >
                    نعم، إلغاء الفاتورة
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        )}
      </div>

      {/* Expanded: product cards */}
      {expanded && isMulti && (
        <div className="px-4 pb-3 pt-1 flex flex-col gap-1.5 bg-muted/5 border-t border-border/20">
          {group.map((order) => {
            const variant = [order.color, order.size].filter(Boolean).join(" / ");
            return (
              <div
                key={order.id}
                className="flex items-center justify-between rounded-md border border-border/40 bg-background/60 px-3 py-1.5"
              >
                {/* اسم المنتج + المواصفات */}
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold truncate">{order.product}</p>
                  {variant && (
                    <p className="text-[10px] text-muted-foreground">{variant}</p>
                  )}
                </div>
                {/* الكمية */}
                <div className="text-xs font-bold text-muted-foreground mx-3 shrink-0">
                  {order.quantity}x
                </div>
                {/* السعر */}
                <div className="text-xs font-bold text-primary shrink-0">
                  {formatCurrency(order.totalPrice)}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
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
  // صافي الربح الحقيقي = إجمالي الإيرادات − تكلفة البضاعة − تكلفة الشحن − خسائر الإرجاع
  const netProfit = s.totalRevenue - s.totalCost - effectiveShippingCost - s.returnLosses;
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
          <p className="text-[10px] text-muted-foreground mb-1">صافي المستحق من الشركة</p>
          <p className="text-base font-black text-primary">{formatCurrency(netBeforeInvoice)}</p>
          <p className="text-[10px] text-muted-foreground">إيرادات − شحن</p>
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

      {/* صافي الربح الحقيقي = إيرادات − تكلفة البضاعة − تكلفة الشحن − خسائر الإرجاع */}
      <div className={`rounded-md p-4 border flex items-center justify-between ${netProfit >= 0 ? "border-emerald-700/40 bg-emerald-900/10" : "border-red-700/40 bg-red-900/10"}`}>
        <div>
          <p className="text-[10px] font-bold text-muted-foreground mb-1">صافي الربح الحقيقي</p>
          <p className={`text-2xl font-black ${netProfit >= 0 ? "text-emerald-400" : "text-red-400"}`}>
            {formatCurrency(netProfit)}
          </p>
          <p className="text-[10px] text-muted-foreground mt-1">
            {formatCurrency(s.totalRevenue)} إيرادات
            &nbsp;−&nbsp;{formatCurrency(s.totalCost)} تكلفة بضاعة
            &nbsp;−&nbsp;{formatCurrency(effectiveShippingCost)} شحن
            {s.returnLosses > 0 && <>&nbsp;−&nbsp;{formatCurrency(s.returnLosses)} خسائر مرتجع</>}
          </p>
        </div>
        {netProfit >= 0
          ? <TrendingUp className="w-10 h-10 text-emerald-500 opacity-20" />
          : <TrendingDown className="w-10 h-10 text-red-500 opacity-20" />}
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
              {(() => {
                const atShipping = manifest.orders.filter(o => o.deliveryStatus === "returned" && (o as any).returnReceived === 0).length;
                const atWarehouse = manifest.orders.filter(o => o.deliveryStatus === "returned" && (o as any).returnReceived === 1).length;
                return (
                  <>
                    {atShipping > 0 && <p className="text-[9px] text-orange-400">🚚 عند الشحن: {atShipping}</p>}
                    {atWarehouse > 0 && <p className="text-[9px] text-emerald-400">↩ في المخزن: {atWarehouse}</p>}
                  </>
                );
              })()}
            </div>
            <div className="p-2 rounded-md bg-teal-900/10 border border-teal-700">
              <p className="text-teal-400">استلم جزئي</p>
              <p className="font-bold text-base text-teal-400">
                {manifest.orders.filter((o) => o.deliveryStatus === "partial_received").length}
              </p>
              {(() => {
                const atShipping = manifest.orders.filter(o => o.deliveryStatus === "partial_received" && (o as any).returnReceived === 0).length;
                const atWarehouse = manifest.orders.filter(o => o.deliveryStatus === "partial_received" && (o as any).returnReceived === 1).length;
                return (
                  <>
                    {atShipping > 0 && <p className="text-[9px] text-orange-400">🚚 باقي عند الشحن: {atShipping}</p>}
                    {atWarehouse > 0 && <p className="text-[9px] text-emerald-400">↩ باقي في المخزن: {atWarehouse}</p>}
                  </>
                );
              })()}
            </div>
          </div>

          {/* ─── صافي المستحق من الشركة ─── */}
          <div className="space-y-2">
            <div className="p-3 rounded-md bg-primary/10 border border-primary/30 text-xs">
              <p className="text-muted-foreground mb-1">صافي المستحق من الشركة</p>
              {(() => {
                const effectiveShipping = manifest.manualShippingCost ?? s.totalShippingCost;
                const due = s.deliveredGross - effectiveShipping;
                return (
                  <>
                    <p className="font-black text-lg text-primary">
                      {formatCurrency(due)}
                    </p>
                    <p className="text-[10px] text-muted-foreground mt-1">
                      إيرادات مستلمة ({formatCurrency(s.deliveredGross)}) − تكلفة شحن ({formatCurrency(effectiveShipping)})
                    </p>
                  </>
                );
              })()}
              {manifest.invoicePrice != null && (
                <p className="text-muted-foreground mt-1">
                  سعر الفاتورة المتفق: {formatCurrency(manifest.invoicePrice)}
                </p>
              )}
            </div>
            {(s as any).stillAtShippingCount > 0 && (
              <div className="p-2 rounded-md bg-orange-900/10 border border-orange-700 text-xs flex items-start gap-2">
                <span className="text-base">🚚</span>
                <div>
                  <p className="text-orange-400 font-bold">لسه عند الشحن: {(s as any).stillAtShippingCount} طلبية</p>
                  <p className="text-orange-300 text-[10px]">مبلغ متوقع: {formatCurrency((s as any).stillAtShippingAmount ?? 0)}</p>
                </div>
              </div>
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

// ─── Status sort priority — ترتيب أبجدي عربي ────────────────────────────────
// أ→ي: استلم جزئي(0) ← مرتجع(1) ← مسلَّم(2) ← مؤجل(3) ← قيد الانتظار(4)
const STATUS_SORT_PRIORITY: Record<string, number> = {
  partial_received: 0, // استلم جزئي
  returned:         1, // مرتجع
  delivered:        2, // مسلَّم
  postponed:        3, // مؤجل
  pending:          4, // قيد الانتظار
};

// ─── Status label helper ──────────────────────────────────────────────────────
const STATUS_LABEL_AR: Record<string, string> = {
  delivered:        "مسلَّم",
  returned:         "مرتجع",
  postponed:        "مؤجل",
  partial_received: "استلم جزئي",
  pending:          "قيد الانتظار",
};

function getManifestGroupKey(order: ManifestOrder) {
  return (order as any).invoiceNumber?.trim() || `${order.customerName}__${order.phone ?? ""}__${order.address ?? ""}`;
}

function groupManifestOrders(orders: ManifestOrder[]) {
  const groupMap = new Map<string, ManifestOrder[]>();
  orders.forEach((order) => {
    const key = getManifestGroupKey(order);
    if (!groupMap.has(key)) groupMap.set(key, []);
    groupMap.get(key)!.push(order);
  });
  return Array.from(groupMap.values());
}

// ─── Export Dialog (Excel + PDF) ──────────────────────────────────────────────
function ExportDialog({
  manifest,
  onClose,
}: {
  manifest: ShippingManifestDetail;
  onClose: () => void;
}) {
  const s = manifest.stats;
  const effectiveShipping = manifest.manualShippingCost ?? s.totalShippingCost;
  const { brand } = useBrand();

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
  const netDue = totalCollected - effectiveShipping;

  // ── Excel Export — XLSX library with cell-level styling ─────────────────────
  const exportExcel = () => {

    const brandName    = brand.name || "CAPRINA";
    const brandTagline = brand.tagline || "";
    const manifestDate = format(new Date(manifest.createdAt), "yyyy/MM/dd");
    const printDate    = format(new Date(), "yyyy/MM/dd HH:mm");
    const postponedCnt = manifest.orders.filter(o => o.deliveryStatus === "postponed").length;
    const partialCnt   = manifest.orders.filter(o => o.deliveryStatus === "partial_received").length;
    const pendingCnt   = manifest.orders.filter(o => o.deliveryStatus === "pending").length;
    const fmtMoney = (n: number) => `${n.toLocaleString("ar-EG")} ج.م`;

    // ── Color palette ──────────────────────────────────────────────────────────
    const C = {
      darkBg:   "0F172A", navyBg:  "1E293B", gold:    "F59E0B",
      white:    "FFFFFF", offWhite:"F8FAFC", slate:   "475569",
      green:    "15803D", greenBg: "DCFCE7", red:     "DC2626",
      redBg:    "FEE2E2", amber:   "D97706", amberBg: "FEF3C7",
      teal:     "0F766E", tealBg:  "CCFBF1", gray:    "64748B",
      grayBg:   "F1F5F9", darkText:"1E293B",
    };

    // ── Style factories ────────────────────────────────────────────────────────
    const font = (color: string, sz = 10, bold = false, name = "Cairo") =>
      ({ name, sz, bold, color: { rgb: color } });
    const fill = (rgb: string) =>
      ({ type: "pattern" as const, patternType: "solid" as const, fgColor: { rgb } });
    const border = (color = "CBD5E1", style: "thin" | "medium" = "thin") => {
      const s = { style, color: { rgb: color } };
      return { top: s, bottom: s, left: s, right: s };
    };
    const align = (h: "center"|"left"|"right" = "center", wrap = false) =>
      ({ horizontal: h, vertical: "center" as const, readingOrder: 2, wrapText: wrap });

    // Predefined cell styles
    const S = {
      brandTitle: { font: font(C.gold, 18, true), fill: fill(C.darkBg), alignment: align("center", true) },
      title:      { font: font(C.gold, 12, true), fill: fill(C.darkBg), alignment: align("center") },
      printInfo:  { font: font(C.slate,  9),      fill: fill(C.navyBg), alignment: align("center") },
      spacer:     { fill: fill(C.darkBg) },
      header:     { font: font(C.white, 10, true), fill: fill(C.navyBg), border: border(), alignment: align("center") },
      white:      { font: font(C.darkText), fill: fill(C.white),    border: border(), alignment: align() },
      alt:        { font: font(C.darkText), fill: fill(C.offWhite), border: border(), alignment: align() },
      whiteNum:   { font: font(C.darkText), fill: fill(C.white),    border: border(), alignment: align("center") },
      altNum:     { font: font(C.darkText), fill: fill(C.offWhite), border: border(), alignment: align("center") },
      delivered:  { font: font(C.green, 10, true),  fill: fill(C.greenBg), border: border(C.green), alignment: align("center") },
      returned:   { font: font(C.red,   10, true),  fill: fill(C.redBg),   border: border(C.red),   alignment: align("center") },
      postponed:  { font: font(C.amber, 10, true),  fill: fill(C.amberBg), border: border(C.amber), alignment: align("center") },
      partial:    { font: font(C.teal,  10, true),  fill: fill(C.tealBg),  border: border(C.teal),  alignment: align("center") },
      pending:    { font: font(C.gray,  10, true),  fill: fill(C.grayBg),  border: border(),         alignment: align("center") },
      totalDark:  { font: font(C.gold, 10, true),   fill: fill(C.darkBg),  border: border(C.gold),  alignment: align() },
      netGreen:   { font: font(C.white,10, true),   fill: fill(C.green),   border: border(C.green), alignment: align() },
      shipping:   { font: font(C.white,10, true),   fill: fill("92400E"),  border: border(),         alignment: align() },
      invoice:    { font: font(C.white,10, true),   fill: fill("1D4ED8"),  border: border(),         alignment: align() },
      section:    { font: font(C.gold, 10, true),   fill: fill("1E3A5F"),  border: border(),         alignment: align() },
      label:      { font: font(C.slate,10),          fill: fill(C.offWhite),border: border(),         alignment: align() },
      moneyGreen: { font: font(C.green,10, true),   fill: fill(C.offWhite),border: border(),         alignment: align() },
      moneyRed:   { font: font(C.red,  10, true),   fill: fill(C.offWhite),border: border(),         alignment: align() },
      subHeader:  { font: font(C.white,10, true),   fill: fill("1E3A5F"),  border: border(),         alignment: align() },
    };

    const statusStyle = (st: string) => ({
      delivered: S.delivered, returned: S.returned,
      postponed: S.postponed, partial_received: S.partial, pending: S.pending,
    }[st] ?? S.pending);

    // ── Cell helper: styled cell ───────────────────────────────────────────────
    const sc = (v: string | number, style: object): XLSX.CellObject => ({
      v, t: typeof v === "number" ? "n" : "s",
      s: style,
    } as XLSX.CellObject);

    // ── Worksheet builder from 2-D array of CellObject ────────────────────────
    const makeWS = (
      rows: (XLSX.CellObject | null)[][],
      colWidths: number[],
      merges: XLSX.Range[] = [],
      tableOpts?: { headerRow: number; totalRows: number; name: string },
    ): XLSX.WorkSheet => {
      const ws: XLSX.WorkSheet = {};
      let maxR = 0, maxC = 0;
      rows.forEach((row, R) => {
        row.forEach((cell, C) => {
          if (!cell) return;
          const addr = XLSX.utils.encode_cell({ r: R, c: C });
          ws[addr] = cell;
          if (C > maxC) maxC = C;
        });
        if (R > maxR) maxR = R;
      });
      ws["!ref"] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: maxR, c: maxC } });
      ws["!cols"] = colWidths.map(w => ({ wch: w }));
      if (merges.length) ws["!merges"] = merges;
      ws["!sheetview"] = [{ rightToLeft: true }] as any;

      // Add Excel Table for auto-filter + banding
      if (tableOpts) {
        const { headerRow, totalRows, name } = tableOpts;
        const tableRef = XLSX.utils.encode_range({
          s: { r: headerRow, c: 0 },
          e: { r: headerRow + totalRows, c: maxC },
        });
        const cols = rows[headerRow]
          .map((cell, i) => ({
            name: (cell?.v as string) ?? `Col${i + 1}`,
            filterButton: true,
          }));
        ws["!tables"] = ws["!tables"] || [];
        (ws["!tables"] as any[]).push({ name, ref: tableRef, columns: cols, style: { name: "TableStyleMedium9", showRowStripes: true } });
      }

      return ws;
    };

    // ── Merge helper: A1-style range → XLSX.Range ─────────────────────────────
    const merge = (ref: string): XLSX.Range => XLSX.utils.decode_range(ref);

    // ── Spacer row (empty styled cells) ───────────────────────────────────────
    const spacerRow = (n: number) => Array.from({ length: n }, () => sc("", S.spacer));

    // ══════════════════════════════════════════════════════════════════
    // SHEET 1 — الطلبيات
    // ══════════════════════════════════════════════════════════════════
    const sheet1Data: (XLSX.CellObject | null)[][] = [];
    const nCols = 10;

    // Row 0: brand title (merged A1:J1)
    const brandRow = [sc(`${brandName}${brandTagline ? "  ·  " + brandTagline : ""}`, S.brandTitle),
      ...Array(nCols - 1).fill(sc("", S.brandTitle))];
    sheet1Data.push(brandRow);

    // Row 1: manifest title (merged A2:J2)
    sheet1Data.push([
      sc(`بيان الشحن — ${manifest.manifestNumber}   |   ${manifest.companyName}   |   ${manifestDate}`, S.title),
      ...Array(nCols - 1).fill(sc("", S.title)),
    ]);

    // Row 2: print info (merged A3:J3)
    sheet1Data.push([
      sc(`طُبع: ${printDate}   |   إجمالي: ${manifest.orders.length} طلبية   |   نسبة التسليم: ${s.deliveryRate}%`, S.printInfo),
      ...Array(nCols - 1).fill(sc("", S.printInfo)),
    ]);

    // Row 3: spacer
    sheet1Data.push(spacerRow(nCols));

    // ── Group orders by invoiceNumber (or customerName+phone as fallback) ──────
    const groupedOrders = groupManifestOrders(manifest.orders);

    // Row 4: headers  (رقم الفاتورة بدل رقم الطلب)
    sheet1Data.push(["#","رقم الفاتورة","اسم العميل","الهاتف","المنتجات","الكمية الكلية","الإجمالي","حالة التسليم","ملاحظة", ""]
      .map(h => sc(h, S.header)));

    // Rows: one row per customer/invoice group
    groupedOrders.forEach((group, idx) => {
      const base  = idx % 2 === 0 ? S.white   : S.alt;
      const baseN = idx % 2 === 0 ? S.whiteNum : S.altNum;
      const rep = group[0];
      const invoiceNum = (rep as any).invoiceNumber?.trim() || `${rep.customerName}-${idx + 1}`;
      const totalQty   = group.reduce((s, o) => s + o.quantity, 0);
      const totalPrice = group.reduce((s, o) => s + o.totalPrice, 0);

      // Build products string: "منتج 1 (لون/مقاس) ×ك\nمنتج 2 ×ك"
      const productsText = group.map(o => {
        const variant = [o.color, o.size].filter(Boolean).join("/");
        return variant ? `${o.product} (${variant}) ×${o.quantity}` : `${o.product} ×${o.quantity}`;
      }).join("\n");

      // Delivery status: if all same → show it, else "متعددة"
      const statuses = [...new Set(group.map(o => o.deliveryStatus))];
      const deliveryStatus = statuses.length === 1 ? statuses[0] : "pending";
      const deliveryLabel  = statuses.length === 1
        ? (STATUS_LABEL_AR[statuses[0]] ?? statuses[0])
        : "حالات متعددة";

      // Notes: collect unique non-empty notes
      const notes = [...new Set(group.map(o => o.deliveryNote).filter(Boolean))].join(" | ");

      const productsCell: XLSX.CellObject = {
        v: productsText, t: "s",
        s: { ...base, alignment: { ...align("right", true) } },
      } as XLSX.CellObject;

      sheet1Data.push([
        sc(idx + 1,       baseN),
        sc(invoiceNum,    base),
        sc(rep.customerName, base),
        sc(rep.phone ?? "—", base),
        productsCell,
        sc(totalQty,      baseN),
        sc(totalPrice,    baseN),
        sc(deliveryLabel, statuses.length === 1 ? statusStyle(deliveryStatus) : S.pending),
        sc(notes,         base),
        sc("",            base),
      ]);
    });

    // Totals row
    const grandTotal = manifest.orders.reduce((sum, o) => sum + o.totalPrice, 0);
    sheet1Data.push([
      sc("الإجمالي الكلي", S.totalDark),
      ...Array(5).fill(sc("", S.totalDark)),
      sc(grandTotal,  S.netGreen),
      sc(`${s.deliveryRate}% نسبة تسليم`, S.totalDark),
      sc("", S.totalDark),
      sc("", S.totalDark),
    ]);

    const ws1 = makeWS(sheet1Data,
      [5, 14, 22, 14, 36, 10, 13, 13, 28, 5],
      [merge("A1:J1"), merge("A2:J2"), merge("A3:J3"), merge("A4:J4")],
      { headerRow: 4, totalRows: groupedOrders.length, name: "OrdersTable" },
    );

    // ══════════════════════════════════════════════════════════════════
    // SHEET 2 — ملخص البيان
    // ══════════════════════════════════════════════════════════════════
    const sheet2Data: (XLSX.CellObject | null)[][] = [];

    const addSection = (label: string) =>
      sheet2Data.push([sc(label, S.section), sc("", S.section)]);
    const addInfo = (label: string, val: string, valStyle = S.white) =>
      sheet2Data.push([sc(label, S.label), sc(val, valStyle)]);
    const addMoney = (label: string, val: number, style: object) =>
      sheet2Data.push([sc(label, style), sc(fmtMoney(val), style)]);
    const addSpacer2 = () =>
      sheet2Data.push([sc("", S.spacer), sc("", S.spacer)]);

    sheet2Data.push([sc(`${brandName}${brandTagline ? "  ·  " + brandTagline : ""}`, S.brandTitle), sc("", S.brandTitle)]);
    sheet2Data.push([sc(`ملخص بيان الشحن — ${manifest.manifestNumber}`, S.title), sc("", S.title)]);
    addSpacer2();

    addSection("معلومات البيان");
    addInfo("رقم البيان",     manifest.manifestNumber, S.subHeader);
    addInfo("شركة الشحن",    manifest.companyName,     S.subHeader);
    addInfo("تاريخ الإنشاء", manifestDate);
    addInfo("الحالة", manifest.status === "closed" ? "مغلق ✓" : "مفتوح",
      manifest.status === "closed" ? S.moneyGreen : S.invoice);
    if (manifest.closedAt)
      addInfo("تاريخ الإغلاق", format(new Date(manifest.closedAt), "yyyy/MM/dd"));

    addSpacer2();
    addSection("إحصائيات التسليم");
    addInfo("إجمالي الطلبيات", String(s.total),       S.subHeader);
    addInfo("مسلَّم",           String(s.delivered),   S.delivered);
    addInfo("مرتجع",            String(s.returned),    S.returned);
    addInfo("مؤجل",             String(postponedCnt),  S.postponed);
    addInfo("استلم جزئي",      String(partialCnt),    S.partial);
    addInfo("قيد الانتظار",    String(pendingCnt),    S.pending);
    addInfo("نسبة التسليم",    `${s.deliveryRate}%`,
      s.deliveryRate >= 70 ? S.moneyGreen : s.deliveryRate >= 40 ? S.postponed : S.returned);

    addSpacer2();
    addSection("الحساب المالي");
    addMoney("اجمالي المحصَّل",   totalCollected,   S.moneyGreen);
    addMoney("رسوم الشحن",        effectiveShipping, S.shipping);
    addMoney("صافي المستحق",      netDue,            S.netGreen);
    if (manifest.invoicePrice != null) {
      addMoney("سعر الفاتورة المتفق", manifest.invoicePrice, S.invoice);
      const diff = manifest.invoicePrice - netDue;
      addMoney(diff >= 0 ? "فرق لصالحنا" : "فرق علينا", Math.abs(diff),
        diff >= 0 ? S.moneyGreen : S.moneyRed);
    }

    const ws2 = makeWS(sheet2Data, [26, 24],
      [merge("A1:B1"), merge("A2:B2"), merge("A3:B3")]);

    // ══════════════════════════════════════════════════════════════════
    // SHEETS 3..N — كل حالة على حدة
    // ══════════════════════════════════════════════════════════════════
    const statusDefs2: { key: DeliveryStatus; label: string; sty: object }[] = [
      { key: "delivered",        label: "مسلَّم",        sty: S.delivered },
      { key: "returned",         label: "مرتجع",         sty: S.returned  },
      { key: "postponed",        label: "مؤجل",          sty: S.postponed },
      { key: "partial_received", label: "استلم جزئي",   sty: S.partial   },
      { key: "pending",          label: "قيد الانتظار", sty: S.pending   },
    ];

    const statusSheets2: { name: string; ws: XLSX.WorkSheet }[] = [];
    statusDefs2.forEach(({ key, label, sty }) => {
      const orders = manifest.orders.filter(o => o.deliveryStatus === key);
      if (orders.length === 0) return;

      // Group by invoice / customer
        const sGroupMap = new Map<string, ManifestOrder[]>();
        orders.forEach(o => {
          const k = getManifestGroupKey(o);
          if (!sGroupMap.has(k)) sGroupMap.set(k, []);
          sGroupMap.get(k)!.push(o);
        });
      const sGroups = Array.from(sGroupMap.values());

      const data: (XLSX.CellObject | null)[][] = [];
      // Title row
      data.push([sc(`${label} — ${sGroups.length} عميل / ${orders.length} طلبية`, sty), ...Array(7).fill(sc("", sty))]);
      // Headers
      data.push(["#","رقم الفاتورة","اسم العميل","الهاتف","المنتجات","الكمية","الإجمالي","ملاحظة"].map(h => sc(h, S.header)));
      sGroups.forEach((group, idx) => {
        const base  = idx % 2 === 0 ? S.white   : S.alt;
        const baseN = idx % 2 === 0 ? S.whiteNum : S.altNum;
        const rep = group[0];
        const invoiceNum = (rep as any).invoiceNumber?.trim() || `${rep.customerName}-${idx + 1}`;
        const totalQty   = group.reduce((s, o) => s + o.quantity, 0);
        const totalPrice = group.reduce((s, o) => s + o.totalPrice, 0);
        const productsText = group.map(o => {
          const variant = [o.color, o.size].filter(Boolean).join("/");
          return variant ? `${o.product} (${variant}) ×${o.quantity}` : `${o.product} ×${o.quantity}`;
        }).join("\n");
        const notes = [...new Set(group.map(o => o.deliveryNote).filter(Boolean))].join(" | ");
        const productsCell: XLSX.CellObject = {
          v: productsText, t: "s",
          s: { ...base, alignment: { ...align("right", true) } },
        } as XLSX.CellObject;
        data.push([
          sc(idx + 1, baseN), sc(invoiceNum, base),
          sc(rep.customerName, base), sc(rep.phone ?? "—", base),
          productsCell,
          sc(totalQty, baseN), sc(totalPrice, baseN), sc(notes, base),
        ]);
      });
      const sub = orders.reduce((sum, o) => sum + o.totalPrice, 0);
      data.push([sc(`المجموع (${sGroups.length} عميل)`, sty), ...Array(5).fill(sc("", sty)), sc(fmtMoney(sub), sty), sc("", sty)]);
      statusSheets2.push({ name: label, ws: makeWS(data, [5,14,22,14,36,7,13,28], [merge("A1:H1")],
        { headerRow: 1, totalRows: sGroups.length, name: `Table_${key}` }) });
    });

    // ══════════════════════════════════════════════════════════════════
    // Assemble workbook & download
    // ══════════════════════════════════════════════════════════════════
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws1, "الطلبيات");
    XLSX.utils.book_append_sheet(wb, ws2, "ملخص البيان");
    statusSheets2.forEach(({ name, ws }) => XLSX.utils.book_append_sheet(wb, ws, name));

    const wbout = XLSX.write(wb, { bookType: "xlsx", type: "array" });
    const blob = new Blob([wbout], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `بيان-${manifest.manifestNumber}-${format(new Date(), "yyyy-MM-dd")}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ── PDF Export (via print) ──────────────────────────────────────────────────
  const exportPDF = () => {
    onClose();
    setTimeout(() => window.print(), 150);
  };

  // stats for preview
  const statusGroups = [
    { label: "مسلَّم", count: s.delivered, color: "#15803d", bg: "#dcfce7" },
    { label: "مرتجع", count: s.returned, color: "#dc2626", bg: "#fee2e2" },
    { label: "مؤجل", count: manifest.orders.filter(o => o.deliveryStatus === "postponed").length, color: "#d97706", bg: "#fef3c7" },
    { label: "جزئي", count: manifest.orders.filter(o => o.deliveryStatus === "partial_received").length, color: "#0f766e", bg: "#ccfbf1" },
    { label: "انتظار", count: manifest.orders.filter(o => o.deliveryStatus === "pending").length, color: "#64748b", bg: "#f1f5f9" },
  ];

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="bg-card border-border max-w-lg" dir="rtl">
        <DialogHeader>
          <DialogTitle className="text-right flex items-center gap-2">
            <Download className="w-4 h-4 text-primary" />
            تصدير البيان — {manifest.manifestNumber}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-1">
          {/* Preview card */}
          <div className="rounded-lg border border-border bg-muted/20 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-black text-base">{manifest.manifestNumber}</p>
                <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                  <Truck className="w-3 h-3" />{manifest.companyName}
                </p>
              </div>
              <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full ${
                manifest.status === "closed"
                  ? "bg-emerald-900/30 text-emerald-400 border border-emerald-700"
                  : "bg-blue-900/30 text-blue-400 border border-blue-700"
              }`}>
                {manifest.status === "closed" ? "✓ مغلق" : "● مفتوح"}
              </span>
            </div>

            {/* Status pills */}
            <div className="flex flex-wrap gap-1.5">
              {statusGroups.filter(g => g.count > 0).map(g => (
                <span key={g.label} className="text-[10px] font-bold px-2 py-0.5 rounded-full border"
                  style={{ color: g.color, backgroundColor: g.bg + "33", borderColor: g.color + "44" }}>
                  {g.label}: {g.count}
                </span>
              ))}
            </div>

            {/* Financials */}
            <div className="grid grid-cols-3 gap-2 pt-1 border-t border-border">
              <div className="text-center">
                <p className="text-[9px] text-muted-foreground mb-0.5">محصَّل</p>
                <p className="text-xs font-black text-emerald-400">{totalCollected.toLocaleString("ar-EG")} ج</p>
              </div>
              <div className="text-center border-x border-border">
                <p className="text-[9px] text-muted-foreground mb-0.5">شحن</p>
                <p className="text-xs font-black text-amber-400">−{effectiveShipping.toLocaleString("ar-EG")} ج</p>
              </div>
              <div className="text-center">
                <p className="text-[9px] text-muted-foreground mb-0.5">صافي</p>
                <p className="text-xs font-black text-primary">{netDue.toLocaleString("ar-EG")} ج</p>
              </div>
            </div>
          </div>

          {/* Export options */}
          <div className="grid grid-cols-2 gap-3">
            {/* Excel */}
            <button
              onClick={exportExcel}
              className="group flex flex-col items-center gap-3 p-5 rounded-xl border-2 border-border hover:border-emerald-600 bg-card hover:bg-emerald-900/10 transition-all"
            >
              <div className="w-12 h-12 rounded-xl bg-emerald-900/20 border border-emerald-700/50 flex items-center justify-center group-hover:scale-110 transition-transform">
                <FileSpreadsheet className="w-6 h-6 text-emerald-400" />
              </div>
              <div className="text-center">
                <p className="font-black text-sm text-foreground">تصدير Excel</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">3 شيتات: الطلبيات · الملخص · حسب الحالة</p>
              </div>
              <span className="text-[10px] font-bold text-emerald-400 bg-emerald-900/20 border border-emerald-800 px-2.5 py-0.5 rounded-full">
                .xlsx
              </span>
            </button>

            {/* PDF */}
            <button
              onClick={exportPDF}
              className="group flex flex-col items-center gap-3 p-5 rounded-xl border-2 border-border hover:border-red-600 bg-card hover:bg-red-900/10 transition-all"
            >
              <div className="w-12 h-12 rounded-xl bg-red-900/20 border border-red-700/50 flex items-center justify-center group-hover:scale-110 transition-transform">
                <FileText className="w-6 h-6 text-red-400" />
              </div>
              <div className="text-center">
                <p className="font-black text-sm text-foreground">تصدير PDF</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">بيان رسمي مع الإحصائيات والأرقام</p>
              </div>
              <span className="text-[10px] font-bold text-red-400 bg-red-900/20 border border-red-800 px-2.5 py-0.5 rounded-full">
                .pdf
              </span>
            </button>
          </div>

          {/* Info note */}
          <p className="text-[10px] text-muted-foreground text-center border-t border-border pt-3">
            Excel: {manifest.orders.length} طلبية في {[...new Set(manifest.orders.map(o => o.deliveryStatus))].length} حالات مختلفة &nbsp;·&nbsp;
            PDF: طباعة البيان الرسمي بصيغة A4
          </p>
        </div>
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
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  // جيب فقط الطلبات القابلة للإضافة: warehouse_ready فقط (قيد الشحن في المخزن)
  // pending و delayed لا يظهران هنا — الطلب لازم يكون في المخزن أولاً قبل إضافته لبيان
  const { data: allAvailableOrders, isLoading } = useQuery({
    queryKey: ["orders-available-for-manifest"],
    queryFn: async () => {
      const warehouseReady = await apiFetch<OrderRow[]>(`/orders?status=warehouse_ready`);
      return warehouseReady;
    },
    staleTime: 10000,
  });

  // جيب الطلبات اللي في بيانات مفتوحة تانية عشان نمنعها من الإضافة مرة تانية
  const { data: inManifestData } = useQuery({
    queryKey: ["in-manifest-ids"],
    queryFn: () => apiFetch<{ ids: number[] }>("/orders/in-manifest-ids"),
    staleTime: 10000,
  });

  const addMutation = useMutation({
    mutationFn: () => manifestsApi.addOrders(manifestId, Array.from(selectedIds)),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ["orders-in-manifest-ids"] });
      toast({ title: `✅ تمت الإضافة`, description: `تم إضافة ${res.added} طلبية للبيان ${res.manifestNumber}` });
      onAdded();
      onClose();
    },
    onError: (e: any) =>
      toast({ title: "خطأ", description: e.message, variant: "destructive" }),
  });

  // IDs الطلبات اللي في بيانات مفتوحة تانية (غير بياننا الحالي)
  const inOtherManifestIds = useMemo(() => {
    if (!inManifestData) return new Set<number>();
    const manifestSet = new Set(inManifestData.ids);
    // الموجودين في البيان الحالي مش "تاني" — شيلهم من الـ set
    existingOrderIds.forEach(id => manifestSet.delete(id));
    return manifestSet;
  }, [inManifestData, existingOrderIds]);

  const available = useMemo(() => {
    if (!allAvailableOrders) return [];
    // نزيل التكرار بالـ id (ممكن يجي نفس الأوردر من أكتر من status query)
    const seen = new Set<number>();
    return allAvailableOrders.filter(o => {
      if (seen.has(o.id)) return false;
      seen.add(o.id);
      // استبعد الموجودين في البيان الحالي
      if (existingOrderIds.has(o.id)) return false;
      // استبعد اللي في بيانات مفتوحة تانية (in_shipping في بيان تاني)
      if (inOtherManifestIds.has(o.id)) return false;
      return true;
    });
  }, [allAvailableOrders, existingOrderIds, inOtherManifestIds]);

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
                  const invoiceGroupIds = (order as any).invoiceNumber
                    ? available.filter((o: any) => o.invoiceNumber === (order as any).invoiceNumber).map(o => o.id)
                    : [order.id];
                  const isGroupSelected = invoiceGroupIds.every(id => selectedIds.has(id));
                  return (
                    <div
                      key={order.id}
                      className={`grid grid-cols-[auto_1fr_1fr_70px_80px] gap-0 items-center px-3 py-2.5 border-b border-border/50 cursor-pointer hover:bg-muted/20 transition-colors ${isGroupSelected ? "bg-primary/5" : ""}`}
                      onClick={() => {
                        const next = new Set(selectedIds);
                        if (isGroupSelected) invoiceGroupIds.forEach(id => next.delete(id));
                        else invoiceGroupIds.forEach(id => next.add(id));
                        setSelectedIds(next);
                      }}
                    >
                      <div className="w-5 flex items-center">
                        <Checkbox checked={isGroupSelected} onCheckedChange={() => {}} />
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

type ColFilters = {
  customer: Set<string>;
  governorate: Set<string>;
  product: Set<string>;
  qty: Set<string>;
  total: Set<string>;
  date: Set<string>;
  status: Set<string>;
};

/* ── أيقونة فلتر Excel لكل عمود ── */
function ColFilterBtn({ col, colFilters, getColOptions, toggleColFilter, clearColFilter, sortCol, sortDir, onSort }: {
  col: keyof ColFilters;
  colFilters: ColFilters;
  getColOptions: (col: keyof ColFilters) => string[];
  toggleColFilter: (col: keyof ColFilters, val: string) => void;
  clearColFilter: (col: keyof ColFilters) => void;
  sortCol: keyof ColFilters | null;
  sortDir: "asc" | "desc";
  onSort: (col: keyof ColFilters, dir: "asc" | "desc") => void;
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
      // استخدم fixed بدل absolute — بيعمل صح بغض النظر عن الـ scroll أو الـ overflow
      const panelW = 208; // w-52
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
        className={`flex items-center justify-center w-5 h-5 rounded transition-all shrink-0 ${active ? "text-primary" : "text-muted-foreground/40 hover:text-muted-foreground"}`}
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
          <div className="max-h-48 overflow-y-auto px-1 py-1.5 flex flex-col gap-0.5">
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
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [showOrders, setShowOrders] = useState(true);
  const [showRolloverDialog, setShowRolloverDialog] = useState<null | { id: number; manifestNumber: string; orderCount: number; breakdown: string }>(null);
  // ─── البحث المباشر — بدون popover ──────────────────────────────────────────
  const [customerSearch, setCustomerSearch] = useState("");
  const [showCustomerSearch, setShowCustomerSearch] = useState(false);
  // ─── ترتيب حسب الحالة ───────────────────────────────────────────────────────
  const [statusSort, setStatusSort] = useState<"none" | "asc" | "desc">("none");
  // ─── ترتيب حسب تاريخ الإضافة ────────────────────────────────────────────────
  const [dateSort, setDateSort] = useState<"none" | "asc" | "desc">("none");
  // ─── Excel-style Column Filters ─────────────────────────────────────────────
  const [colFilterOpen, setColFilterOpen] = useState(false);
  const [activeFilterCol, setActiveFilterCol] = useState<string | null>(null);
  const [colFilters, setColFilters] = useState<ColFilters>({
    customer: new Set(), governorate: new Set(), product: new Set(),
    qty: new Set(), total: new Set(), date: new Set(), status: new Set(),
  });
  const [showColFilters, setShowColFilters] = useState(false);
  const [manifestCustomerSearch, setManifestCustomerSearch] = useState("");
  const [manifestProductSearch, setManifestProductSearch] = useState("");
  const [manifestTotalSearch, setManifestTotalSearch] = useState("");
  const [sortCol, setSortCol] = useState<keyof ColFilters | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const handleSort = useCallback((col: keyof ColFilters, dir: "asc" | "desc") => {
    setSortCol(col); setSortDir(dir);
  }, []);
  const [colFilterSearch, setColFilterSearch] = useState("");
  const [colFilterSort, setColFilterSort] = useState<"none" | "asc" | "desc">("none");
  // ─── نظام التحديد (Bulk Selection) ─────────────────────────────────────────
  const [selectedGroups, setSelectedGroups] = useState<Set<string>>(new Set());

  const { data: manifest, isLoading, error } = useQuery({
    queryKey: ["shipping-manifest", id],
    queryFn: () => manifestsApi.get(id),
    enabled: !isNaN(id),
  });

  // ─── Search filter — real-time, no popover ────────────────────────────────
  const filteredManifestOrders = useMemo(() => {
    const orders = manifest?.orders ?? [];
    const groups = groupManifestOrders(orders);
    if (!manifestCustomerSearch && !manifestProductSearch && !manifestTotalSearch) return groups;
    const cLow = manifestCustomerSearch.toLowerCase();
    const pLow = manifestProductSearch.toLowerCase();
    return groups.filter(group => {
      const rep = group[0];
      if (cLow && !(rep.customerName ?? "").toLowerCase().includes(cLow)) return false;
      if (pLow && !group.some(o => (o.product ?? "").toLowerCase().includes(pLow) || (o.phone ?? "").toLowerCase().includes(pLow))) return false;
      if (manifestTotalSearch) {
        const total = group.reduce((s, o) => s + (o.totalPrice ?? 0), 0);
        if (!String(Math.round(total)).includes(manifestTotalSearch)) return false;
      }
      return true;
    });
  }, [manifest?.orders, manifestCustomerSearch, manifestProductSearch, manifestTotalSearch]);

  // ─── Sort — حسب الحالة فوق الـ filter ──────────────────────────────────────
  const sortedManifestOrders = useMemo(() => {
    if (statusSort === "none" && dateSort === "none") return filteredManifestOrders;
    const getGroupPriority = (group: ManifestOrder[]) => {
      const statuses = [...new Set(group.map(o => o.deliveryStatus))];
      const maxP = Math.max(...statuses.map(s => STATUS_SORT_PRIORITY[s] ?? 0));
      return maxP;
    };
    const getGroupDate = (group: ManifestOrder[]) => {
      const ts = (group[0] as any).addedAt;
      return ts ? new Date(ts).getTime() : 0;
    };
    return [...filteredManifestOrders].sort((a, b) => {
      // الترتيب حسب التاريخ له الأولوية لو كان مفعّل
      if (dateSort !== "none") {
        const diff = getGroupDate(a) - getGroupDate(b);
        if (diff !== 0) return dateSort === "asc" ? diff : -diff;
      }
      // ثم الترتيب حسب الحالة
      if (statusSort !== "none") {
        const diff = getGroupPriority(a) - getGroupPriority(b);
        if (diff !== 0) return statusSort === "asc" ? diff : -diff;
      }
      return 0;
    });
  }, [filteredManifestOrders, statusSort, dateSort]);

  // ─── Excel Column Filter helpers ─────────────────────────────────────────────
  const getGroupVal = (col: keyof ColFilters, group: ManifestOrder[]): string => {
    const rep = group[0];
    switch (col) {
      case "customer":    return rep.customerName ?? "";
      case "governorate": return rep.city ?? "";
      case "product":     return group.map(o => o.product).filter(Boolean).join(", ");
      case "qty":         return String(group.reduce((s, o) => s + o.quantity, 0));
      case "total":       return String(group.reduce((s, o) => s + o.totalPrice, 0));
      case "date":        return (rep as any).addedAt ? new Date((rep as any).addedAt).toLocaleDateString("ar-EG") : "—";
      case "status": {
        const statuses = [...new Set(group.map(o => o.deliveryStatus))];
        const labels: Record<string, string> = {
          delivered:"مسلَّم", returned:"مرتجع", pending:"قيد الانتظار",
          postponed:"مؤجَّل", partial_received:"استلام جزئي",
        };
        return statuses.map(s => labels[s] ?? s).join(" / ");
      }
      default: return "";
    }
  };

  const colFilteredGroups = useMemo(() => {
    const hasAny = Object.values(colFilters).some(s => s.size > 0);
    if (!hasAny) return sortedManifestOrders;
    return sortedManifestOrders.filter(group =>
      (Object.keys(colFilters) as (keyof ColFilters)[]).every(col => {
        const set = colFilters[col];
        if (set.size === 0) return true;
        return set.has(getGroupVal(col, group));
      })
    );
  }, [sortedManifestOrders, colFilters]);

  const colFilterHasActive = Object.values(colFilters).some(s => s.size > 0);

  const displayGroups = useMemo(() => {
    if (!sortCol) return colFilteredGroups;
    return [...colFilteredGroups].sort((a, b) => {
      const va = getGroupVal(sortCol, a);
      const vb = getGroupVal(sortCol, b);
      const cmp = va.localeCompare(vb, "ar", { numeric: true });
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [colFilteredGroups, sortCol, sortDir]);

  // القيم المتاحة لكل عمود بناءً على البيانات الحالية بعد باقي الفلاتر
  const getColOptions = (col: keyof ColFilters): string[] => {
    const base = sortedManifestOrders; // نعرض كل القيم الموجودة
    const vals = [...new Set(base.map(g => getGroupVal(col, g)))].filter(v => v && v !== "—");
    return vals.sort((a, b) => a.localeCompare(b, "ar"));
  };

  const toggleColFilter = (col: keyof ColFilters, val: string) => {
    setColFilters(prev => {
      const next = new Set(prev[col]);
      next.has(val) ? next.delete(val) : next.add(val);
      return { ...prev, [col]: next };
    });
  };

  const clearColFilter = (col: keyof ColFilters) => {
    setColFilters(prev => ({ ...prev, [col]: new Set() }));
  };

  const clearAllColFilters = () => {
    setColFilters({ customer: new Set(), governorate: new Set(), product: new Set(), qty: new Set(), total: new Set(), date: new Set(), status: new Set() });
  };

  // ─── Selection helpers ───────────────────────────────────────────────────────
  const allGroupKeys = useMemo(
    () => colFilteredGroups.map(g => getManifestGroupKey(g[0])),
    [colFilteredGroups]
  );
  const allSelected = allGroupKeys.length > 0 && allGroupKeys.every(k => selectedGroups.has(k));
  const someSelected = !allSelected && allGroupKeys.some(k => selectedGroups.has(k));

  const toggleGroup = useCallback((key: string) => {
    setSelectedGroups(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  }, []);

  const toggleAll = useCallback(() => {
    if (allSelected) {
      setSelectedGroups(new Set());
    } else {
      setSelectedGroups(new Set(allGroupKeys));
    }
  }, [allSelected, allGroupKeys]);

  const clearSelection = useCallback(() => setSelectedGroups(new Set()), []);

  const refetch = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["shipping-manifest", id] });
    queryClient.invalidateQueries({ queryKey: ["shipping-manifests"] });
    queryClient.invalidateQueries({ queryKey: ["warehouses"] });
    queryClient.invalidateQueries({ queryKey: ["variants"] });
    queryClient.invalidateQueries({ queryKey: ["variants-all"] });
    queryClient.invalidateQueries({ queryKey: ["orders-in-manifest-ids"] });
    // تحديث حركات المخزون والمنتجات تلقائياً بعد كل تغيير حالة
    queryClient.invalidateQueries({ queryKey: ["movements"] });
    queryClient.invalidateQueries({ queryKey: ["movements-totals"] });
    queryClient.invalidateQueries({ queryKey: ["products"] });
    queryClient.invalidateQueries({ queryKey: ["stock-intelligence"] });
    queryClient.invalidateQueries({ queryKey: ["variant-wh-stock"] });
  }, [queryClient, id]);

  const updateMutation = useMutation({
    mutationFn: (data: { status: "open" | "closed" }) =>
      manifestsApi.update(id, data),
    onSuccess: (result: any) => {
      refetch();
      setShowCloseDialog(false);
      if (result?.rolledOverManifest) {
        const rolled = result.rolledOverManifest;
        const parts: string[] = [];
        if (rolled.postponedCount > 0) parts.push(`${rolled.postponedCount} مؤجل`);
        if (rolled.pendingCount > 0) parts.push(`${rolled.pendingCount} قيد الانتظار`);
        if (rolled.returnedInShippingCount > 0) parts.push(`${rolled.returnedInShippingCount} مرتجع في الشحن`);
        const breakdown = parts.length > 0 ? ` (${parts.join(" · ")})` : "";
        toast({
          title: "🔒 تم إغلاق البيان بنجاح",
          description: `📦 تم إنشاء بيان جديد "${rolled.manifestNumber}" — ${rolled.orderCount} طلبية${breakdown}`,
          duration: 15000,
        });
        setShowRolloverDialog({ id: rolled.id, manifestNumber: rolled.manifestNumber, orderCount: rolled.orderCount, breakdown });
      } else {
        toast({ title: "🔒 تم إغلاق البيان بنجاح" });
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
  const groupedManifestOrders = groupManifestOrders(manifest.orders);

  const statusLabel = (st: DeliveryStatus) => {
    switch (st) {
      case "delivered":        return { label: "مسلَّم",          cls: "status-delivered" };
      case "returned":         return { label: "مرتجع",           cls: "status-returned" };
      case "postponed":        return { label: "مؤجل",            cls: "status-postponed" };
      case "partial_received": return { label: "جزئي",            cls: "status-partial" };
      default:                 return { label: "قيد الانتظار",   cls: "status-pending" };
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
          <div className="manifest-print-stat-value">{displayGroups.length}</div>
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
          {displayGroups.map((group, idx) => {
            const rep = group[0];
            const statuses = [...new Set(group.map((o) => o.deliveryStatus))];
            const isSingleStatus = statuses.length === 1;
            const { label, cls } = statusLabel(isSingleStatus ? statuses[0] as DeliveryStatus : "pending");
            const totalQty = group.reduce((sum, o) => sum + o.quantity, 0);
            const totalPrice = group.reduce((sum, o) => sum + o.totalPrice, 0);
            const productsText = group.map((o) => {
              const variant = [o.color, o.size].filter(Boolean).join(" / ");
              return variant ? `${o.product} (${variant}) ×${o.quantity}` : `${o.product} ×${o.quantity}`;
            }).join("، ");
            const notes = [...new Set(group.map((o) => o.deliveryNote).filter(Boolean))].join(" | ");
            return (
              <tr key={group.map((o) => o.id).join("-")}>
                <td style={{ textAlign: "center", color: "#9ca3af", fontSize: "7pt" }}>{idx + 1}</td>
                <td style={{ fontWeight: 700 }}>
                  {rep.customerName}
                  <div style={{ fontSize: "6.5pt", color: "#9ca3af", fontWeight: 400 }}>
                    {(rep as any).invoiceNumber?.trim() || `#${rep.id.toString().padStart(4, "0")}`}
                  </div>
                </td>
                <td style={{ direction: "ltr", textAlign: "right", fontSize: "7.5pt" }}>{rep.phone ?? "—"}</td>
                <td>{productsText}</td>
                <td style={{ textAlign: "center", fontWeight: 700 }}>{totalQty}</td>
                <td style={{ textAlign: "center", fontWeight: 700 }}>
                  {totalPrice.toLocaleString("ar-EG")} ج
                </td>
                <td style={{ textAlign: "center" }}>
                  <span className={cls}>{isSingleStatus ? label : "حالات متعددة"}</span>
                </td>
                <td style={{ fontSize: "7pt", color: "#6b7280" }}>{notes}</td>
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
              className="h-8 w-8 rounded-full border-border shrink-0"
            >
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-lg sm:text-xl font-bold">{manifest.manifestNumber}</h1>
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
            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
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
        <div className="flex items-center gap-1.5 flex-wrap print:hidden">
          <Button
            variant="outline"
            size="sm"
            className="h-8 text-xs gap-1 border-border"
            onClick={handlePrint}
          >
            <Printer className="w-3 h-3" />طباعة
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-8 text-xs gap-1 border-primary/50 text-primary hover:bg-primary/10"
            onClick={() => setShowExportDialog(true)}
          >
            <Download className="w-3 h-3" />تصدير
          </Button>
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
      <Card className="border-border bg-card overflow-visible print:break-inside-avoid">
        <div
          className="flex items-center justify-between px-4 py-3 border-b border-border cursor-pointer hover:bg-muted/10 transition-colors"
          onClick={() => setShowOrders(!showOrders)}
        >
          <h2 className="font-bold text-sm flex items-center gap-2">
              <Package className="w-4 h-4 text-muted-foreground" />
              الطلبيات في البيان
              <Badge variant="outline" className="text-[9px]">
                {groupedManifestOrders.length}
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
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                if (showColFilters) {
                  setColFilters({ customer: new Set(), governorate: new Set(), product: new Set(), qty: new Set(), total: new Set(), date: new Set(), status: new Set() });
                  setSortCol(null);
                }
                setShowColFilters(v => !v);
              }}
              className={`h-7 flex items-center gap-1.5 px-2.5 rounded-lg border text-xs font-medium transition-all ${showColFilters ? "border-destructive/50 text-destructive bg-destructive/5 hover:bg-destructive/10" : "border-primary/40 text-primary bg-primary/5 hover:bg-primary/10"}`}
            >
              <svg viewBox="0 0 24 24" className="w-3 h-3" fill={showColFilters ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>
              {showColFilters ? "إلغاء الفلتر" : "إنشاء فلتر"}
            </button>
            {showOrders ? (
              <ChevronUp className="w-4 h-4 text-muted-foreground" />
            ) : (
              <ChevronDown className="w-4 h-4 text-muted-foreground" />
            )}
          </div>
        </div>

        {showOrders && (
          <>
            {manifest.orders.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground text-sm">
                  لا توجد طلبيات
                </div>
              ) : (
                <>
                {/* ══ Selection Action Bar ══ */}
                {selectedGroups.size > 0 && (
                  <div dir="rtl" className="flex items-center gap-3 px-4 py-2.5 bg-primary/10 border-b border-primary/30 text-xs">
                    <Checkbox checked={allSelected} onCheckedChange={toggleAll} className={someSelected ? "opacity-60" : ""} />
                    <span className="font-bold text-primary">
                      {selectedGroups.size} محدد من {allGroupKeys.length}
                    </span>
                    <div className="flex items-center gap-2 mr-auto">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 text-[11px] px-2.5 text-muted-foreground hover:text-foreground border border-border/50"
                        onClick={clearSelection}
                      >
                        <X className="w-3 h-3 ml-1" />
                        إلغاء التحديد
                      </Button>
                    </div>
                  </div>
                )}
                {/* ══ Search Bar ══ */}
                <div className="p-3 border-b border-border bg-muted/10 flex flex-col gap-2">
                  <div className="relative">
                    <svg className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-primary/60" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                    <input
                      value={manifestCustomerSearch}
                      onChange={e => setManifestCustomerSearch(e.target.value)}
                      placeholder="ابحث باسم العميل..."
                      className="w-full pr-9 pl-8 bg-card text-sm h-9 border border-primary/30 rounded-md focus:outline-none focus:ring-1 focus:ring-primary/40 placeholder:text-muted-foreground/60 font-medium"
                      dir="rtl"
                    />
                    {manifestCustomerSearch && (
                      <>
                        <button className="absolute left-9 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" onClick={() => setManifestCustomerSearch("")}>
                          <X className="w-3.5 h-3.5" />
                        </button>
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-primary bg-primary/10 px-1.5 py-0.5 rounded-full">
                          {displayGroups.length}
                        </span>
                      </>
                    )}
                  </div>
                  <div className="relative">
                    <svg className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                    <input
                      value={manifestProductSearch}
                      onChange={e => setManifestProductSearch(e.target.value)}
                      placeholder="ابحث بالمنتج أو الهاتف..."
                      className="w-full pr-9 bg-card text-sm h-9 border border-border rounded-md focus:outline-none focus:ring-1 focus:ring-primary/40 placeholder:text-muted-foreground/60"
                      dir="rtl"
                    />
                    {manifestProductSearch && (
                      <button className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" onClick={() => setManifestProductSearch("")}>
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
                {/* ══ رأس الجدول المحسَّن ══ */}
                <div className="overflow-x-auto">
                <div dir="rtl" className="hidden md:grid grid-cols-[minmax(140px,1fr)_minmax(120px,1fr)_minmax(140px,1fr)_60px_90px_160px_90px_80px] min-w-[860px] gap-0 border-b-2 border-border bg-muted/20 text-[10px] font-bold text-muted-foreground tracking-wide
                  [&>*:not(:last-child)]:border-l [&>*]:border-border/30">
                  {/* ─── عمود العميل — checkbox + نص/سيرش ─── */}
                  <div className="relative flex items-center">
                    <div className="flex items-center px-3 shrink-0">
                      <Checkbox
                        checked={allSelected}
                        onCheckedChange={toggleAll}
                        className={someSelected ? "opacity-60" : ""}
                        aria-label="تحديد الكل"
                      />
                    </div>
                    <div className="flex items-center justify-between w-full h-9 px-3">
                      <span className="font-bold">العميل</span>
                      {showColFilters && <ColFilterBtn col="customer" colFilters={colFilters} getColOptions={getColOptions} toggleColFilter={toggleColFilter} clearColFilter={clearColFilter} sortCol={sortCol} sortDir={sortDir} onSort={handleSort} />}
                    </div>
                  </div>
                  {/* ─── عمود المحافظة / العنوان ─── */}
                  <div className="flex items-center justify-between gap-1 px-3 h-9">
                    <div className="flex items-center gap-1.5">
                      <span className="w-5 h-5 rounded bg-muted flex items-center justify-center shrink-0">
                        <svg className="w-2.5 h-2.5 opacity-50" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M12 22s-8-4.5-8-11.8A8 8 0 0112 2a8 8 0 018 8.2c0 7.3-8 11.8-8 11.8z"/><circle cx="12" cy="10" r="3"/></svg>
                      </span>
                      المحافظة
                    </div>
                    {showColFilters && <ColFilterBtn col="governorate" colFilters={colFilters} getColOptions={getColOptions} toggleColFilter={toggleColFilter} clearColFilter={clearColFilter} sortCol={sortCol} sortDir={sortDir} onSort={handleSort} />}
                  </div>
                  {/* ─── عمود المنتج — نص ثابت ─── */}
                  <div className="flex items-center justify-between gap-1 px-3 h-9">
                    <div className="flex items-center gap-1.5">
                      <span className="w-5 h-5 rounded bg-muted flex items-center justify-center shrink-0">
                        <Package className="w-2.5 h-2.5 opacity-50" />
                      </span>
                      المنتج
                    </div>
                    {showColFilters && <ColFilterBtn col="product" colFilters={colFilters} getColOptions={getColOptions} toggleColFilter={toggleColFilter} clearColFilter={clearColFilter} sortCol={sortCol} sortDir={sortDir} onSort={handleSort} />}
                  </div>
                  {/* ─── الكمية ─── */}
                  <div className="flex items-center justify-center gap-1 h-9">
                    الكمية
                    {showColFilters && <ColFilterBtn col="qty" colFilters={colFilters} getColOptions={getColOptions} toggleColFilter={toggleColFilter} clearColFilter={clearColFilter} sortCol={sortCol} sortDir={sortDir} onSort={handleSort} />}
                  </div>
                  {/* ─── عمود الإجمالي ─── */}
                  <div className="flex items-center justify-between gap-1 px-3 h-9">
                    {!showColFilters
                      ? <input
                          value={manifestTotalSearch}
                          onChange={e => setManifestTotalSearch(e.target.value)}
                          placeholder="الإجمالي..."
                          className="w-full h-5 text-[10px] px-1.5 border border-border rounded bg-muted/30 focus:outline-none focus:ring-1 focus:ring-primary"
                          dir="rtl"
                        />
                      : <span className="font-bold">الإجمالي</span>
                    }
                    {showColFilters && <ColFilterBtn col="total" colFilters={colFilters} getColOptions={getColOptions} toggleColFilter={toggleColFilter} clearColFilter={clearColFilter} sortCol={sortCol} sortDir={sortDir} onSort={handleSort} />}
                  </div>
                  {/* ─── حالة التسليم ─── */}
                  <div className="flex items-center gap-1 px-2 h-9">
                    <span className="w-5 h-5 rounded bg-muted flex items-center justify-center shrink-0">
                      <CheckCircle2 className="w-2.5 h-2.5 opacity-50" />
                    </span>
                    <span className="shrink-0">الحالة</span>
                    {showColFilters && <ColFilterBtn col="status" colFilters={colFilters} getColOptions={getColOptions} toggleColFilter={toggleColFilter} clearColFilter={clearColFilter} sortCol={sortCol} sortDir={sortDir} onSort={handleSort} />}
                  </div>
                  {/* ─── تاريخ الإضافة ─── */}
                  <div className="flex items-center justify-center gap-1 h-9 px-1">
                    <span className="shrink-0 text-[9px] opacity-60">تاريخ الإضافة</span>
                    {showColFilters && <ColFilterBtn col="date" colFilters={colFilters} getColOptions={getColOptions} toggleColFilter={toggleColFilter} clearColFilter={clearColFilter} sortCol={sortCol} sortDir={sortDir} onSort={handleSort} />}
                  </div>
                  {/* ─── حالة الطلب ─── */}
                  <div className="flex items-center justify-center h-9 text-[9px] opacity-60 px-3">
                    الحالة
                  </div>
                </div>
                {displayGroups.length === 0 && colFilterHasActive ? (
                  <div className="p-6 text-center text-muted-foreground text-sm">
                    <Search className="w-8 h-8 mx-auto mb-2 opacity-30" />
                    <p>لا توجد نتائج للبحث</p>
                    <button
                      onClick={() => { setCustomerSearch(""); clearAllColFilters(); }}
                      className="text-xs text-primary hover:underline mt-1"
                    >
                      مسح كل الفلاتر
                    </button>
                  </div>
                ) : (
                  <div key={customerSearch}>
                  {displayGroups.map((group, index) => (
                  <InvoiceGroupDeliveryRow
                    key={group.map((order) => `${order.id}-${order.deliveryStatus}-${order.partialQuantity ?? 0}-${order.deliveryNote ?? ""}`).join("|")}
                    group={group}
                    manifestId={id}
                    locked={isLocked && !isAdmin}
                    onSaved={refetch}
                    rowIndex={index}
                    selected={selectedGroups.has(getManifestGroupKey(group[0]))}
                    onToggleSelect={toggleGroup}
                  />
                  ))}
                  </div>
                )}
                </div>{/* end overflow-x-auto */}
              </>
            )}
          </>
        )}
      </Card>

      {/* ─── P&L Summary (financials only — hidden in print) ─── */}
      {canViewFinancials && (() => {
        // تكلفة الشحن الفعلية = اليدوية لو موجودة، وإلا من الطلبيات
        const effectiveShipping = manifest.manualShippingCost ?? s.totalShippingCost;
        // صافي الربح = إيرادات − تكلفة بضاعة − تكلفة شحن فعلية
        const trueNetProfit = s.totalRevenue - s.totalCost - effectiveShipping;
        const isProfit = trueNetProfit >= 0;
        return (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 print:hidden">
            <Card className="border-border bg-card p-4">
              <p className="text-xs text-muted-foreground mb-1">إجمالي الإيرادات</p>
              <p className="text-lg font-black text-emerald-400">{formatCurrency(s.totalRevenue)}</p>
            </Card>
            <Card className="border-amber-900/40 bg-amber-900/10 p-4">
              <p className="text-xs text-amber-400 mb-1">تكلفة الشحن</p>
              <p className="text-lg font-black text-amber-400">
                −{formatCurrency(effectiveShipping)}
              </p>
              {manifest.manualShippingCost != null && (
                <p className="text-[10px] text-amber-600">يدوي ✏️</p>
              )}
            </Card>
            <Card className="border-border bg-card p-4">
              <p className="text-xs text-muted-foreground mb-1">خسائر الإرجاع</p>
              <p className="text-lg font-black text-red-400">−{formatCurrency(s.returnLosses)}</p>
            </Card>
            <Card className="border-border bg-card p-4">
              <p className="text-xs text-muted-foreground mb-1">تكلفة البضاعة</p>
              <p className="text-lg font-black">−{formatCurrency(s.totalCost)}</p>
            </Card>
            <Card className={`col-span-2 p-4 border ${isProfit ? "border-emerald-900/50 bg-emerald-900/10" : "border-red-900/50 bg-red-900/10"}`}>
              <div className="flex items-center justify-between">
                <div>
                  <p className={`text-xs mb-1 font-bold ${isProfit ? "text-emerald-400" : "text-red-400"}`}>
                    {isProfit ? "صافي الربح" : "صافي الخسارة"}
                  </p>
                  <p className={`text-2xl font-black ${isProfit ? "text-emerald-400" : "text-red-400"}`}>
                    {formatCurrency(Math.abs(trueNetProfit))}
                  </p>
                </div>
                {isProfit
                  ? <TrendingUp className="w-10 h-10 text-emerald-400 opacity-30" />
                  : <TrendingDown className="w-10 h-10 text-red-400 opacity-30" />}
              </div>
              {s.totalRevenue > 0 && (
                <p className={`text-xs mt-2 font-bold ${isProfit ? "text-emerald-600" : "text-red-600"}`}>
                  هامش الربح: {Math.round((trueNetProfit / s.totalRevenue) * 100)}%
                </p>
              )}
            </Card>
          </div>
        );
      })()}

      {/* ─── Close Confirm Dialog ─── */}
      {showCloseDialog && (
        <CloseConfirmDialog
          manifest={manifest}
          onClose={() => setShowCloseDialog(false)}
          onConfirm={() => updateMutation.mutate({ status: "closed" })}
          loading={updateMutation.isPending}
        />
      )}

      {/* ─── Rollover Dialog — بيان جديد اتنشأ ─── */}
      {showRolloverDialog && (
        <AlertDialog open onOpenChange={() => setShowRolloverDialog(null)}>
          <AlertDialogContent dir="rtl">
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2 text-emerald-500">
                <CheckCircle2 className="w-5 h-5" />
                تم إغلاق البيان وإنشاء بيان جديد
              </AlertDialogTitle>
              <AlertDialogDescription className="text-right space-y-3">
                <span className="block text-foreground font-medium text-sm">
                  تم إنشاء البيان <strong className="text-emerald-400">{showRolloverDialog.manifestNumber}</strong> تلقائياً
                </span>
                <span className="block text-muted-foreground text-xs">
                  يحتوي على <strong>{showRolloverDialog.orderCount}</strong> طلبية مرحَّلة{showRolloverDialog.breakdown && <span className="text-amber-400"> {showRolloverDialog.breakdown}</span>}
                </span>
                <span className="block text-xs text-muted-foreground">
                  هل تريد الانتقال للبيان الجديد الآن؟
                </span>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setShowRolloverDialog(null)}>لاحقاً</AlertDialogCancel>
              <AlertDialogAction
                className="bg-emerald-700 hover:bg-emerald-600 text-white gap-1"
                onClick={() => { window.location.href = `/shipping/manifests/${showRolloverDialog.id}`; }}
              >
                <ArrowRight className="w-3.5 h-3.5" />
                انتقل للبيان الجديد
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
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
      {showExportDialog && manifest && (
        <ExportDialog
          manifest={manifest}
          onClose={() => setShowExportDialog(false)}
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
