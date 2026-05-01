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
  Download,
} from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { useAuth } from "@/contexts/AuthContext";
import { useBrand } from "@/contexts/BrandContext";
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

// ─── 3D Return Buttons ────────────────────────────────────────────────────────
function ReturnReceivedButtons({
  value,
  onChange,
}: {
  value: boolean | null;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex gap-3">

      {/* ══════════════════════════════════════════
          ✅  تم استلام المرتجع  — Emerald / Green
          ══════════════════════════════════════════ */}
      <button
        type="button"
        onClick={() => onChange(true)}
        aria-pressed={value === true}
        className="flex-1 relative outline-none cursor-pointer p-0 border-0 bg-transparent select-none group"
        style={{ borderRadius: 18 }}
      >
        {/* ── bottom "ledge" that creates the 3-D depth ── */}
        <div
          className="absolute inset-0 rounded-[18px] transition-all duration-150"
          style={{
            background: value === true
              ? "linear-gradient(175deg,#043d2a 0%,#021f15 100%)"
              : "linear-gradient(175deg,#065c3e 0%,#033d28 100%)",
            boxShadow: value === true
              ? "0 1px 0 #010f09, 0 0 0 1.5px rgba(0,180,100,0.18)"
              : "0 5px 0 #032918, 0 0 0 1.5px rgba(0,180,100,0.22), 0 8px 20px rgba(0,180,100,0.12)",
          }}
        />
        {/* ── shiny face ── */}
        <div
          className="relative z-10 flex flex-col items-center gap-1 px-3 pt-4 pb-3.5 rounded-[18px] overflow-hidden transition-all duration-150"
          style={{
            background: value === true
              ? "linear-gradient(155deg,#0d8f62 0%,#09714c 55%,#065539 100%)"
              : "linear-gradient(155deg,#12c482 0%,#0daa6e 55%,#098f5b 100%)",
            border: value === true
              ? "1px solid rgba(255,255,255,0.08)"
              : "1px solid rgba(255,255,255,0.14)",
            boxShadow: value === true
              ? "inset 0 -4px 8px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.12)"
              : "inset 0 -4px 8px rgba(0,0,0,0.18), inset 0 2px 0 rgba(255,255,255,0.28), 0 1px 3px rgba(0,0,0,0.3)",
            transform: value === true ? "translateY(4px)" : "translateY(0)",
          }}
        >
          {/* gloss streak */}
          <div
            className="absolute top-0 left-1/2 -translate-x-1/2 w-14 h-5 rounded-full"
            style={{ background: "radial-gradient(ellipse,rgba(180,255,220,0.38) 0%,transparent 75%)", top: 6 }}
          />
          {/* icon */}
          <div
            className="w-10 h-10 rounded-full flex items-center justify-center mb-0.5"
            style={{
              background: value === true
                ? "radial-gradient(circle,rgba(0,0,0,0.25) 0%,rgba(0,0,0,0.35) 100%)"
                : "radial-gradient(circle,rgba(0,0,0,0.12) 0%,rgba(0,0,0,0.22) 100%)",
              boxShadow: "inset 0 2px 4px rgba(0,0,0,0.3), 0 0 12px rgba(20,220,140,0.3)",
            }}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
              stroke="#c6f6d5" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round"
              style={{ filter: "drop-shadow(0 0 6px rgba(134,239,172,0.85))" }}>
              <path d="M20 6L9 17l-5-5"/>
            </svg>
          </div>
          <span className="text-[12.5px] font-black leading-tight tracking-tight"
            style={{ color: value === true ? "#a7f3d0" : "#d1fae5", textShadow: "0 1px 3px rgba(0,0,0,0.5)" }}>
            تم استلام المرتجع
          </span>
          <span className="text-[9.5px] font-medium leading-tight"
            style={{ color: value === true ? "rgba(167,243,208,0.65)" : "rgba(209,250,229,0.7)" }}>
            يُعاد للمخزن تلقائياً
          </span>
        </div>
      </button>

      {/* ══════════════════════════════════════════════
          🚚  مازال في الشحن  — Amber / Gold (brand)
          ══════════════════════════════════════════════ */}
      <button
        type="button"
        onClick={() => onChange(false)}
        aria-pressed={value === false}
        className="flex-1 relative outline-none cursor-pointer p-0 border-0 bg-transparent select-none group"
        style={{ borderRadius: 18 }}
      >
        {/* ledge */}
        <div
          className="absolute inset-0 rounded-[18px] transition-all duration-150"
          style={{
            background: value === false
              ? "linear-gradient(175deg,#4a2204 0%,#2e1502 100%)"
              : "linear-gradient(175deg,#7c3d08 0%,#4f2804 100%)",
            boxShadow: value === false
              ? "0 1px 0 #180900, 0 0 0 1.5px rgba(200,130,20,0.2)"
              : "0 5px 0 #3e1d03, 0 0 0 1.5px rgba(200,140,30,0.25), 0 8px 20px rgba(200,140,30,0.12)",
          }}
        />
        {/* face */}
        <div
          className="relative z-10 flex flex-col items-center gap-1 px-3 pt-4 pb-3.5 rounded-[18px] overflow-hidden transition-all duration-150"
          style={{
            /* uses brand gold = hsl(43 74% 50%) ≈ #D4A017 — slightly darker face */
            background: value === false
              ? "linear-gradient(155deg,#b8860b 0%,#996b08 55%,#7a5406 100%)"
              : "linear-gradient(155deg,#e8a820 0%,#c98e14 55%,#a87010 100%)",
            border: value === false
              ? "1px solid rgba(255,255,255,0.07)"
              : "1px solid rgba(255,255,255,0.15)",
            boxShadow: value === false
              ? "inset 0 -4px 8px rgba(0,0,0,0.42), inset 0 1px 0 rgba(255,255,255,0.1)"
              : "inset 0 -4px 8px rgba(0,0,0,0.18), inset 0 2px 0 rgba(255,255,255,0.30), 0 1px 3px rgba(0,0,0,0.3)",
            transform: value === false ? "translateY(4px)" : "translateY(0)",
          }}
        >
          {/* gloss */}
          <div
            className="absolute left-1/2 -translate-x-1/2 w-14 h-5 rounded-full"
            style={{ background: "radial-gradient(ellipse,rgba(255,240,160,0.38) 0%,transparent 75%)", top: 6 }}
          />
          {/* truck icon circle */}
          <div
            className="w-10 h-10 rounded-full flex items-center justify-center mb-0.5"
            style={{
              background: value === false
                ? "radial-gradient(circle,rgba(0,0,0,0.28) 0%,rgba(0,0,0,0.38) 100%)"
                : "radial-gradient(circle,rgba(0,0,0,0.12) 0%,rgba(0,0,0,0.22) 100%)",
              boxShadow: "inset 0 2px 4px rgba(0,0,0,0.32), 0 0 12px rgba(220,170,20,0.3)",
            }}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
              stroke="#fef3c7" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
              style={{ filter: "drop-shadow(0 0 6px rgba(253,230,138,0.85))" }}>
              <rect x="1" y="3" width="15" height="13" rx="2"/>
              <path d="M16 8h4l3 5v3h-7V8z"/>
              <circle cx="5.5" cy="18.5" r="2.5"/>
              <circle cx="18.5" cy="18.5" r="2.5"/>
            </svg>
          </div>
          <span className="text-[12.5px] font-black leading-tight tracking-tight"
            style={{ color: value === false ? "#fde68a" : "#fff8e1", textShadow: "0 1px 3px rgba(0,0,0,0.55)" }}>
            مازال في الشحن
          </span>
          <span className="text-[9.5px] font-medium leading-tight"
            style={{ color: value === false ? "rgba(253,230,138,0.65)" : "rgba(255,248,225,0.72)" }}>
            لن يؤثر على المخزن
          </span>
        </div>
      </button>

    </div>
  );
}

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
        if (!partialQty || isNaN(qty) || qty < 1) {
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
          status === "partial_received" && partialQty
            ? parseInt(partialQty)
            : null,
        ...(status === "returned" ? { returnReceived } : {}),
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
      partialQty !== (order.partialQuantity?.toString() ?? ""));

  return (
    <div className={`border-b border-border/50 transition-colors ${editing ? "bg-primary/5" : "hover:bg-muted/10"}`}>
      <div className="grid grid-cols-[1fr_1fr_60px_80px_120px_80px] gap-0 items-start px-3 py-2.5 text-xs">
        <div className="min-w-0 pr-1 flex items-center gap-1.5">
          <span className="font-mono text-[10px] text-muted-foreground bg-muted/40 rounded px-1.5 py-0.5 border border-border/40">
            #{order.id.toString().padStart(4, "0")}
          </span>
          {order.phone && (
            <span className="text-[10px] text-muted-foreground">{order.phone}</span>
          )}
        </div>
        <div className="min-w-0 pr-2">
          <p className="truncate font-medium">{order.product}</p>
          {(order.color || order.size) && (
            <p className="text-muted-foreground text-[10px]">
              {[order.color, order.size].filter(Boolean).join(" / ")}
            </p>
          )}
        </div>
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
        <div className="text-left font-bold">{formatCurrency(order.totalPrice)}</div>
        <div>
          <Badge
            variant="outline"
            className={`text-[9px] font-bold border ${opt.bg} ${opt.color}`}
          >
            {opt.label}
          </Badge>
          {order.deliveryStatus === "returned" && (order as any).returnReceived === 1 && (
            <p className="text-[10px] text-emerald-600 mt-0.5 font-semibold">↩ تم الاستلام</p>
          )}
          {order.deliveryStatus === "returned" && (order as any).returnReceived === 0 && (
            <p className="text-[10px] text-orange-500 mt-0.5 font-semibold">⏳ عند شركة الشحن</p>
          )}
          {order.deliveryNote && !editing && (
            <p className="text-[10px] text-muted-foreground mt-0.5 truncate max-w-[110px]">
              {order.deliveryNote}
            </p>
          )}
        </div>
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
          {locked && !hideAction && (
            <Link href={`/orders/${order.id}`}>
              <Button variant="ghost" size="sm" className="h-6 text-[10px] px-2 text-primary hover:text-primary">
                عرض
              </Button>
            </Link>
          )}
        </div>
      </div>

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
              <>
                <div>
                  <Label className="text-[10px] mb-1 block text-muted-foreground">
                    الكمية المستلمة (من {order.quantity}) <span className="text-destructive font-bold">*</span>
                  </Label>
                  <Input
                    type="number"
                    min={1}
                    max={order.quantity}
                    value={partialQty}
                    onChange={(e) => setPartialQty(e.target.value)}
                    className={`h-8 text-xs w-28 bg-background ${!partialQty || parseInt(partialQty) < 1 ? "border-destructive" : ""}`}
                    placeholder="مطلوب"
                    autoFocus
                  />
                  {(!partialQty || parseInt(partialQty) < 1) && (
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
          {/* حالة استلام المرتجع — 3D buttons */}
          {status === "returned" && (
            <div className="space-y-2">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">هل تم استلام المرتجع؟</p>
              <ReturnReceivedButtons value={returnReceived} onChange={setReturnReceived} />
              <p className="text-[10px] text-center font-medium"
                style={{
                  color: returnReceived === true ? "#0F6E56"
                    : returnReceived === false ? "#854F0B"
                    : "var(--color-text-secondary)",
                }}>
                {returnReceived === true && "✓ سيتم إرجاع البضاعة للمخزن تلقائياً"}
                {returnReceived === false && "⏳ مرتجع مازال في شركة الشحن — لن يؤثر على المخزن"}
                {returnReceived === null && "⚠ يجب اختيار حالة الاستلام قبل الحفظ"}
              </p>
            </div>
          )}
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
              autoFocus={!needsPartial}
            />
          </div>
          )}
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
                !hasChanges ||
                (needsNote && !note.trim()) ||
                (needsPartial && (!partialQty || parseInt(partialQty) < 1)) ||
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

// ─── Invoice Group Row ────────────────────────────────────────────────────────
function InvoiceGroupDeliveryRow({
  group,
  manifestId,
  locked,
  onSaved,
}: {
  group: ManifestOrder[];
  manifestId: number;
  locked: boolean;
  onSaved: () => void;
}) {
  const { toast } = useToast();
  const [expanded, setExpanded] = useState(false);

  const rep = group[0];
  const totalQty = group.reduce((s, o) => s + o.quantity, 0);
  const totalPrice = group.reduce((s, o) => s + o.totalPrice, 0);
  const invoiceNum = (rep as any).invoiceNumber?.trim() || null;
  const isMulti = group.length > 1;

  const statuses = [...new Set(group.map(o => o.deliveryStatus))];
  const groupStatus: DeliveryStatus = statuses.length === 1 ? statuses[0] as DeliveryStatus : "pending";
  const groupOpt = deliveryOpt(groupStatus);
  const hasMultipleStatuses = statuses.length > 1;

  const [bulkEditing, setBulkEditing] = useState(false);
  const [bulkStatus, setBulkStatus] = useState<DeliveryStatus>(groupStatus);
  const [bulkNote, setBulkNote] = useState("");
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [bulkReturnReceived, setBulkReturnReceived] = useState<boolean | null>(
    (rep as any).returnReceived === 1 ? true : (rep as any).returnReceived === 0 ? false : null
  );

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

  const [perOrderStatus, setPerOrderStatus] = useState<Record<number, DeliveryStatus>>(
    Object.fromEntries(group.map(o => [o.id, o.deliveryStatus as DeliveryStatus]))
  );
  const [partialQtyMap, setPartialQtyMap] = useState<Record<number, string>>(
    Object.fromEntries(group.map(o => [o.id, o.partialQuantity?.toString() ?? ""]))
  );

  const isPerItemMode = isMulti;

  const bulkMutation = useMutation({
    mutationFn: async () => {
      for (const order of group) {
        let finalStatus: DeliveryStatus = bulkStatus;
        let finalPartialQty: number | null = null;

        if (isMulti && bulkStatus === "partial_received") {
          finalStatus = "partial_received";
          const val = partialQtyMap[order.id];
          finalPartialQty = val ? parseInt(val) : null;
        } else if (isPerItemMode) {
          finalStatus = perOrderStatus[order.id] ?? bulkStatus;
          if (finalStatus === "partial_received") {
            const val = partialQtyMap[order.id];
            finalPartialQty = val ? parseInt(val) : null;
          }
        } else {
          finalStatus = bulkStatus;
          if (finalStatus === "partial_received") {
            const val = partialQtyMap[order.id];
            finalPartialQty = val ? parseInt(val) : null;
          }
        }

        await manifestsApi.updateOrderDelivery(manifestId, order.id, {
          deliveryStatus: finalStatus,
          deliveryNote: bulkNote.trim() || null,
          partialQuantity: finalPartialQty,
          ...(finalStatus === 'returned' ? { returnReceived: bulkReturnReceived } : {}),
        });
      }
    },
    onSuccess: () => {
      toast({ title: "تم حفظ حالة التسليم للفاتورة كاملها" });
      setBulkEditing(false);
      onSaved();
    },
    onError: (e: any) =>
      toast({ title: "خطأ", description: e.message, variant: "destructive" }),
  });
  const needsBulkNote = bulkStatus === "postponed" || bulkStatus === "returned";

  const productsText = group.map(o => {
    const variant = [o.color, o.size].filter(Boolean).join("/");
    return variant ? `${o.product} (${variant}) ×${o.quantity}` : `${o.product} ×${o.quantity}`;
  }).join("، ");

  return (
    <>
      <div className={`border-b border-border/50 transition-colors ${bulkEditing ? "bg-primary/5" : "hover:bg-muted/10"}`}>
        <div className="grid grid-cols-[1fr_1fr_60px_80px_120px_80px] gap-0 items-start px-3 py-2.5 text-xs">
          <div className="min-w-0 pr-1">
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
          <div className="min-w-0 pr-2">
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
          <div className="text-center font-bold">
            {groupStatus === "partial_received" && !hasMultipleStatuses ? (
              <span>
                <span className="text-teal-400">{group.reduce((s, o) => s + (o.partialQuantity ?? 0), 0)}</span>
                <span className="text-muted-foreground">/{totalQty}</span>
              </span>
            ) : totalQty}
          </div>
          <div className="text-left font-bold">{formatCurrency(totalPrice)}</div>
          <div>
            {hasMultipleStatuses ? (
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
            ) : groupStatus === "partial_received" ? (
              <div className="flex flex-col gap-0.5">
                <Badge variant="outline" className={`text-[9px] font-bold border ${groupOpt.bg} ${groupOpt.color}`}>
                  {groupOpt.label} ({group.reduce((s, o) => s + (o.partialQuantity ?? 0), 0)}/{totalQty})
                </Badge>
                {group.filter(o => o.partialQuantity && o.partialQuantity > 0).map(o => (
                  <p key={o.id} className="text-[9px] text-teal-600 dark:text-teal-400 truncate max-w-[110px]">
                    ◑ {o.product} ×{o.partialQuantity}
                  </p>
                ))}
              </div>
            ) : (
              <div className="flex flex-col gap-0.5">
                <Badge variant="outline" className={`text-[9px] font-bold border ${groupOpt.bg} ${groupOpt.color}`}>
                  {groupOpt.label}
                </Badge>
                {groupStatus === "returned" && (rep as any).returnReceived === 1 && (
                  <p className="text-[10px] text-emerald-600 mt-0.5 font-semibold">↩ تم الاستلام</p>
                )}
                {groupStatus === "returned" && (rep as any).returnReceived === 0 && (
                  <p className="text-[10px] text-orange-500 mt-0.5 font-semibold">⏳ عند شركة الشحن</p>
                )}
              </div>
            )}
          </div>
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
                  onClick={() => { setBulkEditing(true); setBulkStatus(groupStatus); setBulkNote(""); setPartialQtyMap(Object.fromEntries(group.map(o => [o.id, o.partialQuantity?.toString() ?? ""]))); setPerOrderStatus(Object.fromEntries(group.map(o => [o.id, o.deliveryStatus as DeliveryStatus]))); }}
                >
                  <Edit2 className="w-3 h-3 ml-0.5" />تقفيل
                </Button>
              )
            )}
          </div>
        </div>

        {bulkEditing && (
          <div className="px-4 pb-3 flex flex-col gap-2 bg-primary/5 border-t border-primary/10">
            <div className="flex flex-wrap gap-2 items-end mt-2">
              <div>
                <Label className="text-[10px] mb-1 block text-muted-foreground">حالة التسليم</Label>
                <Select
                  value={bulkStatus}
                  onValueChange={(v) => {
                    setBulkStatus(v as DeliveryStatus);
                    setPerOrderStatus(Object.fromEntries(group.map(o => [o.id, v as DeliveryStatus])));
                  }}
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
              {!isMulti && bulkStatus === "partial_received" && group[0] && (
                <div>
                  <Label className="text-[10px] mb-1 block text-muted-foreground">
                    الكمية المستلمة (من {group[0].quantity}) <span className="text-destructive font-bold">*</span>
                  </Label>
                  <Input
                    type="number"
                    min={1}
                    max={group[0].quantity}
                    value={partialQtyMap[group[0].id] ?? ""}
                    onChange={(e) => setPartialQtyMap(prev => ({ ...prev, [group[0].id]: e.target.value }))}
                    className={`h-8 text-xs w-28 bg-background ${!(partialQtyMap[group[0].id]) || parseInt(partialQtyMap[group[0].id]) < 1 ? "border-destructive" : ""}`}
                    placeholder="مطلوب"
                    autoFocus
                  />
                  {(!(partialQtyMap[group[0].id]) || parseInt(partialQtyMap[group[0].id]) < 1) && (
                    <p className="text-[10px] text-destructive mt-0.5">⚠ أدخل الكمية المستلمة</p>
                  )}
                </div>
              )}
            </div>

            {isMulti && bulkStatus === "partial_received" && (
              <div className="flex flex-col gap-2 border border-teal-300 dark:border-teal-700 rounded-md p-2.5 bg-teal-50 dark:bg-teal-900/20">
                <Label className="text-[10px] font-bold text-teal-700 dark:text-teal-400">
                  حدد الكمية المستلمة لكل منتج
                </Label>
                {group.map((o) => {
                  const variant = [o.color, o.size].filter(Boolean).join(" / ");
                  const unitPrice = o.quantity > 0 ? o.totalPrice / o.quantity : 0;
                  const partialVal = partialQtyMap[o.id] ? parseInt(partialQtyMap[o.id]) : 0;
                  const hasQty = partialQtyMap[o.id] && parseInt(partialQtyMap[o.id]) >= 1;
                  return (
                    <div key={o.id} className="rounded-md border border-teal-200 dark:border-teal-800 bg-background p-2 flex flex-col gap-1.5">
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
                          min={1}
                          max={o.quantity}
                          value={partialQtyMap[o.id] ?? ""}
                          onChange={e => setPartialQtyMap(prev => ({ ...prev, [o.id]: e.target.value }))}
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

            {/* حالة استلام المرتجع — 3D buttons */}
            {bulkStatus === "returned" && (
              <div className="space-y-2">
                <Label className="text-[10px] mb-1.5 block text-muted-foreground font-semibold">
                  هل تم استلام المرتجع؟
                </Label>
                <ReturnReceivedButtons value={bulkReturnReceived} onChange={setBulkReturnReceived} />
                {bulkReturnReceived === null && (
                  <p className="text-[10px] text-destructive mt-1 font-semibold">⚠ يجب اختيار حالة استلام المرتجع قبل الحفظ</p>
                )}
                {bulkReturnReceived === true && (
                  <p className="text-[10px] text-emerald-600 mt-1">✓ سيتم إرجاع البضاعة للمخزن تلقائياً</p>
                )}
                {bulkReturnReceived === false && (
                  <p className="text-[10px] text-orange-500 mt-1">⏳ مرتجع مازال في شركة الشحن — لن يؤثر على المخزن</p>
                )}
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
                  (!isPerItemMode && bulkStatus === "partial_received" && group[0] && (
                    !partialQtyMap[group[0].id] || parseInt(partialQtyMap[group[0].id]) < 1
                  )) ||
                  (isPerItemMode && group.some(o =>
                    perOrderStatus[o.id] === "partial_received" &&
                    (!partialQtyMap[o.id] || parseInt(partialQtyMap[o.id]) < 1)
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

      {expanded && isMulti && (
        <div className="px-4 pb-3 pt-1 flex flex-col gap-1.5 bg-muted/5 border-t border-border/20">
          {group.map((order) => {
            const variant = [order.color, order.size].filter(Boolean).join(" / ");
            return (
              <div
                key={order.id}
                className="flex items-center justify-between rounded-md border border-border/40 bg-background/60 px-3 py-1.5"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold truncate">{order.product}</p>
                  {variant && (
                    <p className="text-[10px] text-muted-foreground">{variant}</p>
                  )}
                </div>
                <div className="text-xs font-bold text-muted-foreground mx-3 shrink-0">
                  {order.quantity}x
                </div>
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
