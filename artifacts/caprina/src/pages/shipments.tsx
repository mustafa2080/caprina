import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { createPortal } from "react-dom";
import { format } from "date-fns";
import {
  Search, Filter, Plus, Truck, CalendarDays, X, ChevronUp, ChevronDown,
  Download, Package, MapPin, User, Phone, DollarSign, FileText, ChevronRight,
} from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useDebounce } from "@/hooks/use-debounce";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { apiFetch, shippingApi } from "@/lib/api";

// ── أنواع الشحنة ─────────────────────────────────────────────────────────────
export type ShipmentStatus = "pending" | "in_transit" | "delivered" | "returned" | "cancelled";

export interface Shipment {
  id: number;
  tenantId?: number;
  // بيانات المرسل / العميل
  senderName: string;
  senderPhone: string;
  senderPhone2?: string | null;
  senderCity?: string | null;
  senderAddress?: string | null;
  // بيانات المستلم والعنوان
  receiverName: string;
  receiverPhone: string;
  receiverGovernorate?: string | null;
  receiverAddress?: string | null;
  // تفاصيل الشحنة
  shippingCompanyId?: number | null;
  shippingCompanyName?: string | null;
  description?: string | null;
  weight?: number | null;
  pieces?: number | null;
  trackingNumber?: string | null;
  notes?: string | null;
  // البيانات المالية
  codAmount: number;
  shippingCost?: number | null;
  paymentMethod?: "cash" | "prepaid" | null;
  // الحالة
  status: ShipmentStatus;
  createdByName?: string | null;
  createdAt: string;
  updatedAt: string;
}

const statusLabels: Record<ShipmentStatus, string> = {
  pending:    "قيد الانتظار",
  in_transit: "في الطريق",
  delivered:  "تم التسليم",
  returned:   "مرتجع",
  cancelled:  "ملغي",
};

const statusClasses: Record<ShipmentStatus, string> = {
  pending:    "bg-amber-50   dark:bg-amber-900/30   text-amber-700   dark:text-amber-400   border-amber-300   dark:border-amber-800",
  in_transit: "bg-sky-50     dark:bg-sky-900/30     text-sky-700     dark:text-sky-400     border-sky-300     dark:border-sky-800",
  delivered:  "bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 border-emerald-300 dark:border-emerald-800",
  returned:   "bg-red-50     dark:bg-red-900/30     text-red-700     dark:text-red-400     border-red-300     dark:border-red-800",
  cancelled:  "bg-zinc-50    dark:bg-zinc-900/30    text-zinc-500    dark:text-zinc-400    border-zinc-300    dark:border-zinc-700",
};

const STATUS_OPTIONS: { value: ShipmentStatus; label: string; rgb: string }[] = [
  { value: "pending",    label: "قيد الانتظار", rgb: "251,191,36"  },
  { value: "in_transit", label: "في الطريق",    rgb: "56,189,248"  },
  { value: "delivered",  label: "تم التسليم",   rgb: "52,211,153"  },
  { value: "returned",   label: "مرتجع",         rgb: "248,113,113" },
  { value: "cancelled",  label: "ملغي",          rgb: "161,161,170" },
];

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat("ar-EG", { style: "currency", currency: "EGP", maximumFractionDigits: 0 }).format(amount);

// ── ColFilterBtn ─────────────────────────────────────────────────────────────
type ColKey = "id" | "date" | "sender" | "receiver" | "phone" | "cod" | "status" | "company";
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

// ── فورم إضافة شحنة ─────────────────────────────────────────────────────────
interface ShipmentFormData {
  // بيانات المرسل / العميل
  senderName: string;
  senderPhone: string;
  senderPhone2: string;
  senderCity: string;
  senderAddress: string;
  // بيانات المستلم والعنوان
  receiverName: string;
  receiverPhone: string;
  receiverGovernorate: string;
  receiverAddress: string;
  // تفاصيل الشحنة
  shippingCompanyId: string;
  description: string;
  weight: string;
  pieces: string;
  trackingNumber: string;
  notes: string;
  // البيانات المالية
  codAmount: string;
  shippingCost: string;
  paymentMethod: "cash" | "prepaid";
}

const EMPTY_FORM: ShipmentFormData = {
  senderName: "", senderPhone: "", senderPhone2: "", senderCity: "", senderAddress: "",
  receiverName: "", receiverPhone: "", receiverGovernorate: "", receiverAddress: "",
  shippingCompanyId: "", description: "", weight: "", pieces: "", trackingNumber: "", notes: "",
  codAmount: "", shippingCost: "", paymentMethod: "cash",
};

const EGYPT_GOVERNORATES = [
  "القاهرة","الجيزة","الإسكندرية","الدقهلية","البحر الأحمر","البحيرة","الفيوم",
  "الغربية","الإسماعيلية","المنوفية","المنيا","القليوبية","الوادي الجديد","السويس",
  "أسوان","أسيوط","بني سويف","بور سعيد","دمياط","الشرقية","جنوب سيناء","كفر الشيخ",
  "مطروح","الأقصر","قنا","شمال سيناء","سوهاج",
];

type FormStep = 0 | 1 | 2 | 3;

const STEPS = [
  { label: "المرسل / العميل",       icon: User },
  { label: "المستلم والعنوان",       icon: MapPin },
  { label: "تفاصيل الشحنة",        icon: Package },
  { label: "البيانات المالية",       icon: DollarSign },
];

function NewShipmentDialog({
  open,
  onClose,
  onCreated,
  shippingCompanies,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
  shippingCompanies: { id: number; name: string }[];
}) {
  const [step, setStep] = useState<FormStep>(0);
  const [form, setForm] = useState<ShipmentFormData>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const set = (k: keyof ShipmentFormData, v: string) =>
    setForm(prev => ({ ...prev, [k]: v }));

  const reset = () => { setForm(EMPTY_FORM); setStep(0); };

  const handleClose = () => { reset(); onClose(); };

  const handleSubmit = async () => {
    if (!form.senderName.trim() || !form.senderPhone.trim()) {
      toast({ title: "بيانات ناقصة", description: "اسم المرسل ورقم هاتفه مطلوبان", variant: "destructive" });
      setStep(0); return;
    }
    if (!form.receiverName.trim() || !form.receiverPhone.trim()) {
      toast({ title: "بيانات ناقصة", description: "اسم المستلم ورقم هاتفه مطلوبان", variant: "destructive" });
      setStep(1); return;
    }
    if (!form.codAmount || isNaN(Number(form.codAmount))) {
      toast({ title: "بيانات ناقصة", description: "قيمة الشحنة (COD) مطلوبة", variant: "destructive" });
      setStep(3); return;
    }
    setSaving(true);
    try {
      await apiFetch("/shipments", {
        method: "POST",
        body: JSON.stringify({
          senderName:        form.senderName.trim(),
          senderPhone:       form.senderPhone.trim(),
          senderPhone2:      form.senderPhone2.trim() || null,
          senderCity:        form.senderCity.trim() || null,
          senderAddress:     form.senderAddress.trim() || null,
          receiverName:      form.receiverName.trim(),
          receiverPhone:     form.receiverPhone.trim(),
          receiverGovernorate: form.receiverGovernorate || null,
          receiverAddress:   form.receiverAddress.trim() || null,
          shippingCompanyId: form.shippingCompanyId ? Number(form.shippingCompanyId) : null,
          description:       form.description.trim() || null,
          weight:            form.weight ? Number(form.weight) : null,
          pieces:            form.pieces ? Number(form.pieces) : null,
          trackingNumber:    form.trackingNumber.trim() || null,
          notes:             form.notes.trim() || null,
          codAmount:         Number(form.codAmount),
          shippingCost:      form.shippingCost ? Number(form.shippingCost) : null,
          paymentMethod:     form.paymentMethod,
        }),
      });
      toast({ title: "تم إضافة الشحنة ✅" });
      reset();
      onCreated();
      onClose();
    } catch (err: any) {
      toast({ title: "خطأ", description: err.message || "فشل حفظ الشحنة", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={v => !v && handleClose()}>
      <DialogContent className="max-w-lg w-full" dir="rtl">
        <DialogHeader>
          <DialogTitle className="text-right flex items-center gap-2 text-base font-bold">
            <Truck className="w-4 h-4 text-primary" />
            شحنة جديدة
          </DialogTitle>
        </DialogHeader>

        {/* Stepper */}
        <div className="flex items-center gap-0 mb-4">
          {STEPS.map((s, i) => {
            const Icon = s.icon;
            const done = i < step;
            const active = i === step;
            return (
              <div key={i} className="flex items-center flex-1">
                <button
                  type="button"
                  onClick={() => setStep(i as FormStep)}
                  className={`flex flex-col items-center gap-1 flex-1 py-1.5 rounded-lg transition-all text-[10px] font-bold
                    ${active ? "text-primary bg-primary/8" : done ? "text-emerald-500" : "text-muted-foreground/50"}`}
                >
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center border-2 transition-all
                    ${active ? "border-primary bg-primary text-primary-foreground" : done ? "border-emerald-500 bg-emerald-500/10 text-emerald-500" : "border-muted-foreground/20 bg-muted/30"}`}>
                    {done ? <span className="text-[10px]">✓</span> : <Icon className="w-3 h-3" />}
                  </div>
                  <span className="hidden sm:block text-[9px] leading-tight text-center">{s.label}</span>
                </button>
                {i < STEPS.length - 1 && (
                  <div className={`h-0.5 w-3 shrink-0 rounded-full transition-all ${done ? "bg-emerald-500" : "bg-muted-foreground/15"}`} />
                )}
              </div>
            );
          })}
        </div>


        {/* Step Content */}
        <div className="min-h-[260px]">

          {/* ── Step 0: المرسل / العميل ── */}
          {step === 0 && (
            <div className="space-y-3">
              <p className="text-xs font-bold text-muted-foreground mb-2 flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-primary" />بيانات المرسل / العميل
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <Label className="text-xs mb-1 block">اسم المرسل <span className="text-destructive">*</span></Label>
                  <Input value={form.senderName} onChange={e => set("senderName", e.target.value)} placeholder="الاسم الكامل" className="h-9 text-sm" />
                </div>
                <div>
                  <Label className="text-xs mb-1 block">رقم الهاتف <span className="text-destructive">*</span></Label>
                  <Input value={form.senderPhone} onChange={e => set("senderPhone", e.target.value)} placeholder="01xxxxxxxxx" className="h-9 text-sm" dir="ltr" />
                </div>
                <div>
                  <Label className="text-xs mb-1 block">رقم هاتف ثاني</Label>
                  <Input value={form.senderPhone2} onChange={e => set("senderPhone2", e.target.value)} placeholder="اختياري" className="h-9 text-sm" dir="ltr" />
                </div>
                <div>
                  <Label className="text-xs mb-1 block">المدينة</Label>
                  <Input value={form.senderCity} onChange={e => set("senderCity", e.target.value)} placeholder="مثال: القاهرة" className="h-9 text-sm" />
                </div>
                <div className="col-span-2">
                  <Label className="text-xs mb-1 block">العنوان التفصيلي</Label>
                  <Input value={form.senderAddress} onChange={e => set("senderAddress", e.target.value)} placeholder="الشارع، المبنى، الشقة..." className="h-9 text-sm" />
                </div>
              </div>
            </div>
          )}

          {/* ── Step 1: المستلم والعنوان ── */}
          {step === 1 && (
            <div className="space-y-3">
              <p className="text-xs font-bold text-muted-foreground mb-2 flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-primary" />بيانات المستلم والعنوان
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <Label className="text-xs mb-1 block">اسم المستلم <span className="text-destructive">*</span></Label>
                  <Input value={form.receiverName} onChange={e => set("receiverName", e.target.value)} placeholder="الاسم الكامل" className="h-9 text-sm" />
                </div>
                <div>
                  <Label className="text-xs mb-1 block">هاتف المستلم <span className="text-destructive">*</span></Label>
                  <Input value={form.receiverPhone} onChange={e => set("receiverPhone", e.target.value)} placeholder="01xxxxxxxxx" className="h-9 text-sm" dir="ltr" />
                </div>
                <div>
                  <Label className="text-xs mb-1 block">المحافظة</Label>
                  <Select value={form.receiverGovernorate} onValueChange={v => set("receiverGovernorate", v)}>
                    <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="اختر المحافظة" /></SelectTrigger>
                    <SelectContent>
                      {EGYPT_GOVERNORATES.map(g => <SelectItem key={g} value={g}>{g}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="col-span-2">
                  <Label className="text-xs mb-1 block">العنوان التفصيلي</Label>
                  <Textarea value={form.receiverAddress} onChange={e => set("receiverAddress", e.target.value)} placeholder="الشارع، المنطقة، أقرب نقطة دالة..." rows={2} className="text-sm resize-none" />
                </div>
              </div>
            </div>
          )}

          {/* ── Step 2: تفاصيل الشحنة ── */}
          {step === 2 && (
            <div className="space-y-3">
              <p className="text-xs font-bold text-muted-foreground mb-2 flex items-center gap-1.5">
                <Package className="w-3.5 h-3.5 text-primary" />تفاصيل الشحنة
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <Label className="text-xs mb-1 block">شركة الشحن</Label>
                  <Select value={form.shippingCompanyId} onValueChange={v => set("shippingCompanyId", v)}>
                    <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="اختر شركة الشحن" /></SelectTrigger>
                    <SelectContent>
                      {shippingCompanies.map(c => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="col-span-2">
                  <Label className="text-xs mb-1 block">وصف المحتوى</Label>
                  <Input value={form.description} onChange={e => set("description", e.target.value)} placeholder="مثال: ملابس، إلكترونيات..." className="h-9 text-sm" />
                </div>
                <div>
                  <Label className="text-xs mb-1 block">الوزن (كجم)</Label>
                  <Input type="number" min="0" step="0.1" value={form.weight} onChange={e => set("weight", e.target.value)} placeholder="0.0" className="h-9 text-sm" dir="ltr" />
                </div>
                <div>
                  <Label className="text-xs mb-1 block">عدد القطع</Label>
                  <Input type="number" min="1" value={form.pieces} onChange={e => set("pieces", e.target.value)} placeholder="1" className="h-9 text-sm" dir="ltr" />
                </div>
                <div className="col-span-2">
                  <Label className="text-xs mb-1 block">رقم التتبع</Label>
                  <Input value={form.trackingNumber} onChange={e => set("trackingNumber", e.target.value)} placeholder="اختياري" className="h-9 text-sm" dir="ltr" />
                </div>
                <div className="col-span-2">
                  <Label className="text-xs mb-1 block">ملاحظات</Label>
                  <Textarea value={form.notes} onChange={e => set("notes", e.target.value)} placeholder="أي ملاحظات خاصة بالشحنة..." rows={2} className="text-sm resize-none" />
                </div>
              </div>
            </div>
          )}

          {/* ── Step 3: البيانات المالية ── */}
          {step === 3 && (
            <div className="space-y-3">
              <p className="text-xs font-bold text-muted-foreground mb-2 flex items-center gap-1.5">
                <DollarSign className="w-3.5 h-3.5 text-primary" />البيانات المالية
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <Label className="text-xs mb-1 block">قيمة الشحنة COD <span className="text-destructive">*</span></Label>
                  <Input type="number" min="0" value={form.codAmount} onChange={e => set("codAmount", e.target.value)} placeholder="0" className="h-9 text-sm" dir="ltr" />
                </div>
                <div>
                  <Label className="text-xs mb-1 block">تكلفة الشحن</Label>
                  <Input type="number" min="0" value={form.shippingCost} onChange={e => set("shippingCost", e.target.value)} placeholder="0" className="h-9 text-sm" dir="ltr" />
                </div>
                <div>
                  <Label className="text-xs mb-1 block">طريقة الدفع</Label>
                  <Select value={form.paymentMethod} onValueChange={v => set("paymentMethod", v as any)}>
                    <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cash">كاش عند الاستلام</SelectItem>
                      <SelectItem value="prepaid">مدفوع مسبقاً</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {form.codAmount && form.shippingCost && (
                  <div className="col-span-2 rounded-xl p-3 border border-primary/20 bg-primary/5 flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">صافي المبلغ بعد الشحن</span>
                    <span className="font-black text-primary text-base">
                      {formatCurrency(Number(form.codAmount) - Number(form.shippingCost))}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Navigation */}
        <div className="flex items-center justify-between pt-2 border-t border-border/50 mt-2">
          <Button variant="outline" size="sm" className="text-xs h-8" onClick={handleClose} disabled={saving}>
            إلغاء
          </Button>
          <div className="flex gap-2">
            {step > 0 && (
              <Button variant="ghost" size="sm" className="text-xs h-8 gap-1" onClick={() => setStep(s => (s - 1) as FormStep)} disabled={saving}>
                <ChevronRight className="w-3.5 h-3.5 rotate-180" />السابق
              </Button>
            )}
            {step < 3 ? (
              <Button size="sm" className="text-xs h-8 gap-1 bg-primary text-primary-foreground font-bold" onClick={() => setStep(s => (s + 1) as FormStep)}>
                التالي<ChevronRight className="w-3.5 h-3.5" />
              </Button>
            ) : (
              <Button size="sm" className="text-xs h-8 gap-1.5 bg-primary text-primary-foreground font-bold" onClick={handleSubmit} disabled={saving}>
                {saving ? <span className="animate-spin">⏳</span> : <Truck className="w-3.5 h-3.5" />}
                {saving ? "جاري الحفظ..." : "حفظ الشحنة"}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}


// ── الصفحة الرئيسية ──────────────────────────────────────────────────────────
export default function Shipments() {
  const [search, setSearch]           = useState("");
  const [status, setStatus]           = useState<string>("all");
  const [dateFrom, setDateFrom]       = useState("");
  const [dateTo, setDateTo]           = useState("");
  const [filterCompany, setFilterCompany] = useState("all");
  const [showNewDialog, setShowNewDialog] = useState(false);
  const [showColFilters, setShowColFilters] = useState(false);
  const [sortCol, setSortCol]         = useState<ColKey | null>(null);
  const [sortDir, setSortDir]         = useState<"asc" | "desc">("asc");
  const [colFilters, setColFilters]   = useState<ColFilters>({
    id: new Set(), date: new Set(), sender: new Set(), receiver: new Set(),
    phone: new Set(), cod: new Set(), status: new Set(), company: new Set(),
  });

  const debouncedSearch = useDebounce(search, 300);
  const queryClient     = useQueryClient();
  const { isAdmin, can } = useAuth();

  const canView   = isAdmin || can("shipments.view");
  const canCreate = isAdmin || can("shipments.create");

  const handleSort = useCallback((col: ColKey, dir: "asc" | "desc") => {
    setSortCol(col); setSortDir(dir);
  }, []);

  const colFilterHasActive = Object.values(colFilters).some(s => s.size > 0);

  // ── Queries ─────────────────────────────────────────────────────────────────
  const { data: shipments = [], isLoading } = useQuery<Shipment[]>({
    queryKey: ["shipments-list", debouncedSearch, status, dateFrom, dateTo, filterCompany],
    queryFn: () => apiFetch<Shipment[]>(`/shipments?${new URLSearchParams({
      ...(debouncedSearch ? { search: debouncedSearch } : {}),
      ...(status !== "all" ? { status } : {}),
      ...(dateFrom ? { dateFrom } : {}),
      ...(dateTo ? { dateTo } : {}),
      ...(filterCompany !== "all" ? { shippingCompanyId: filterCompany } : {}),
    }).toString()}`),
    staleTime: 15_000,
    gcTime: 60_000,
  });

  const { data: companies = [] } = useQuery<{ id: number; name: string }[]>({
    queryKey: ["shipping-companies-list"],
    queryFn: () => shippingApi.list(),
    staleTime: 5 * 60_000,
  });

  // ── Col filter helpers ───────────────────────────────────────────────────────
  const getColVal = useCallback((col: ColKey, s: Shipment): string => {
    switch (col) {
      case "id":       return `#${s.id.toString().padStart(4, "0")}`;
      case "date":     return format(new Date(s.createdAt), "yyyy/MM/dd");
      case "sender":   return s.senderName;
      case "receiver": return s.receiverName;
      case "phone":    return s.senderPhone;
      case "cod":      return String(Math.round(s.codAmount));
      case "status":   return statusLabels[s.status] ?? s.status;
      case "company":  return s.shippingCompanyName ?? "";
      default:         return "";
    }
  }, []);

  const getColOptions = useCallback((col: ColKey): string[] => {
    const vals = [...new Set(shipments.map(s => getColVal(col, s)))].filter(Boolean);
    return vals.sort((a, b) => a.localeCompare(b, "ar"));
  }, [shipments, getColVal]);

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

  const colFiltered = useMemo(() => {
    if (!colFilterHasActive) return shipments;
    return shipments.filter(s =>
      (Object.keys(colFilters) as ColKey[]).every(col => {
        const set = colFilters[col];
        return set.size === 0 || set.has(getColVal(col, s));
      })
    );
  }, [shipments, colFilters, colFilterHasActive, getColVal]);

  const displayRows = useMemo(() => {
    if (!sortCol) return colFiltered;
    return [...colFiltered].sort((a, b) => {
      const va = getColVal(sortCol, a);
      const vb = getColVal(sortCol, b);
      const cmp = va.localeCompare(vb, "ar", { numeric: true });
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [colFiltered, sortCol, sortDir, getColVal]);

  const hasActiveFilter = search || status !== "all" || dateFrom || dateTo || filterCompany !== "all";
  const clearFilters = () => {
    setSearch(""); setStatus("all"); setDateFrom(""); setDateTo(""); setFilterCompany("all");
  };

  if (!canView) return (
    <div className="flex items-center justify-center min-h-[60vh] text-muted-foreground" dir="rtl">
      <div className="text-center space-y-2">
        <p className="text-4xl">🔒</p>
        <p className="font-bold">ليس لديك صلاحية لعرض الشحنات</p>
      </div>
    </div>
  );

