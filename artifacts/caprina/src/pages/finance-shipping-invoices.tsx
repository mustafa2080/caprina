import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api";
import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Truck, CheckCircle, Clock, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  pending:   { label: "بانتظار التسوية", color: "bg-amber-50 text-amber-700 border-amber-300" },
  verified:  { label: "تم التحقق",       color: "bg-blue-50 text-blue-700 border-blue-300" },
  paid:      { label: "مسددة",           color: "bg-emerald-50 text-emerald-700 border-emerald-300" },
  disputed:  { label: "متنازع عليها",    color: "bg-rose-50 text-rose-700 border-rose-300" },
};

const fmt = (n: string | number) => new Intl.NumberFormat("ar-EG", { style: "currency", currency: "EGP", maximumFractionDigits: 0 }).format(Number(n));

export default function FinanceShippingInvoices() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    invoiceNumber: "", shippingCompanyId: "", totalOrders: "", deliveredOrders: "", returnedOrders: "",
    grossRevenue: "", shippingFees: "", returnFees: "", netDue: "", notes: "", invoiceDate: format(new Date(), "yyyy-MM-dd"), dueDate: "",
  });

  const { data: invoices = [], isLoading } = useQuery<any[]>({
    queryKey: ["finance-shipping-invoices"],
    queryFn: () => apiClient.get("/finance/shipping-invoices").then(r => r.data),
  });

  const { data: shippingCompanies = [] } = useQuery<any[]>({
    queryKey: ["shipping"],
    queryFn: () => apiClient.get("/shipping-companies").then(r => r.data),
  });

  const save = useMutation({
    mutationFn: () => apiClient.post("/finance/shipping-invoices", {
      ...form,
      shippingCompanyId: parseInt(form.shippingCompanyId),
      totalOrders: parseInt(form.totalOrders) || 0,
      deliveredOrders: parseInt(form.deliveredOrders) || 0,
      returnedOrders: parseInt(form.returnedOrders) || 0,
      grossRevenue: parseFloat(form.grossRevenue) || 0,
      shippingFees: parseFloat(form.shippingFees) || 0,
      returnFees: parseFloat(form.returnFees) || 0,
      netDue: parseFloat(form.netDue) || (parseFloat(form.grossRevenue) - parseFloat(form.shippingFees) - parseFloat(form.returnFees)),
    }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["finance-shipping-invoices"] }); setOpen(false); toast({ title: "تمت إضافة الفاتورة" }); },
  });

  const pay = useMutation({
    mutationFn: ({ id, paidAmount }: { id: number; paidAmount: number }) =>
      apiClient.patch(`/finance/shipping-invoices/${id}`, { status: "paid", paidAmount }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["finance-shipping-invoices"] }); toast({ title: "تم تسجيل الدفع" }); },
  });

  const totalDue = invoices.filter(i => i.status === "pending").reduce((s, i) => s + Number(i.netDue) - Number(i.paidAmount), 0);

  return (
    <div className="space-y-5 animate-in fade-in duration-500" dir="rtl">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">فواتير شركات الشحن</h1>
          <p className="text-muted-foreground text-sm">متابعة المستحقات المالية مع شركات الشحن</p>
        </div>
        <Button onClick={() => setOpen(true)} className="gap-2"><Plus className="w-4 h-4" />فاتورة جديدة</Button>
      </div>

      {totalDue > 0 && (
        <Card className="p-4 border-amber-500/30 bg-amber-500/5 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-amber-500 shrink-0" />
          <div>
            <p className="text-sm font-bold text-amber-700 dark:text-amber-400">مستحقات غير مسددة: {fmt(totalDue)}</p>
            <p className="text-xs text-muted-foreground">يوجد فواتير شحن بانتظار التسوية</p>
          </div>
        </Card>
      )}

      {isLoading ? (
        <div className="p-8 text-center text-muted-foreground">جاري التحميل...</div>
      ) : (
        <div className="space-y-3">
          {invoices.map(inv => {
            const company = shippingCompanies.find((c: any) => c.id === inv.shippingCompanyId);
            const st = STATUS_LABELS[inv.status] ?? { label: inv.status, color: "" };
            return (
              <Card key={inv.id} className="p-4 border-border">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-sky-500/10 flex items-center justify-center">
                      <Truck className="w-4 h-4 text-sky-500" />
                    </div>
                    <div>
                      <p className="font-bold text-sm">فاتورة #{inv.invoiceNumber}</p>
                      <p className="text-xs text-muted-foreground">{company?.name ?? "—"} · {format(new Date(inv.invoiceDate), "yyyy/MM/dd")}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className={`text-[9px] border ${st.color}`}>{st.label}</Badge>
                    {inv.status === "pending" && (
                      <Button size="sm" className="h-7 text-xs" onClick={() => pay.mutate({ id: inv.id, paidAmount: parseFloat(inv.netDue) })}>
                        <CheckCircle className="w-3 h-3 mr-1" />تسوية
                      </Button>
                    )}
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3 mt-3 pt-3 border-t border-border">
                  <div><p className="text-[10px] text-muted-foreground">الإيراد الإجمالي</p><p className="text-sm font-bold text-emerald-500">{fmt(inv.grossRevenue)}</p></div>
                  <div><p className="text-[10px] text-muted-foreground">رسوم الشحن</p><p className="text-sm font-bold text-rose-500">{fmt(inv.shippingFees)}</p></div>
                  <div><p className="text-[10px] text-muted-foreground">صافي المستحق</p><p className="text-sm font-black text-primary">{fmt(inv.netDue)}</p></div>
                </div>
                <div className="flex gap-4 mt-2 text-[10px] text-muted-foreground">
                  <span>إجمالي الطلبات: {inv.totalOrders}</span>
                  <span>مسلّم: {inv.deliveredOrders}</span>
                  <span>مرتجع: {inv.returnedOrders}</span>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="bg-card border-border max-w-lg" dir="rtl">
          <DialogHeader><DialogTitle>فاتورة شحن جديدة</DialogTitle></DialogHeader>
          <div className="space-y-3 mt-2 max-h-[70vh] overflow-y-auto pl-1">
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-xs mb-1 block">رقم الفاتورة *</Label><Input className="h-9 text-sm" value={form.invoiceNumber} onChange={e => setForm(f => ({ ...f, invoiceNumber: e.target.value }))} /></div>
              <div>
                <Label className="text-xs mb-1 block">شركة الشحن *</Label>
                <Select value={form.shippingCompanyId} onValueChange={v => setForm(f => ({ ...f, shippingCompanyId: v }))}>
                  <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="اختر" /></SelectTrigger>
                  <SelectContent>{shippingCompanies.map((c: any) => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div><Label className="text-xs mb-1 block">إجمالي الطلبات</Label><Input type="number" className="h-9 text-sm" value={form.totalOrders} onChange={e => setForm(f => ({ ...f, totalOrders: e.target.value }))} /></div>
              <div><Label className="text-xs mb-1 block">مسلّم</Label><Input type="number" className="h-9 text-sm" value={form.deliveredOrders} onChange={e => setForm(f => ({ ...f, deliveredOrders: e.target.value }))} /></div>
              <div><Label className="text-xs mb-1 block">مرتجع</Label><Input type="number" className="h-9 text-sm" value={form.returnedOrders} onChange={e => setForm(f => ({ ...f, returnedOrders: e.target.value }))} /></div>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div><Label className="text-xs mb-1 block">الإيراد الإجمالي</Label><Input type="number" className="h-9 text-sm" value={form.grossRevenue} onChange={e => setForm(f => ({ ...f, grossRevenue: e.target.value }))} /></div>
              <div><Label className="text-xs mb-1 block">رسوم الشحن</Label><Input type="number" className="h-9 text-sm" value={form.shippingFees} onChange={e => setForm(f => ({ ...f, shippingFees: e.target.value }))} /></div>
              <div><Label className="text-xs mb-1 block">رسوم المرتجع</Label><Input type="number" className="h-9 text-sm" value={form.returnFees} onChange={e => setForm(f => ({ ...f, returnFees: e.target.value }))} /></div>
            </div>
            <div><Label className="text-xs mb-1 block">صافي المستحق</Label><Input type="number" className="h-9 text-sm font-bold" placeholder="يُحسب تلقائياً" value={form.netDue} onChange={e => setForm(f => ({ ...f, netDue: e.target.value }))} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-xs mb-1 block">تاريخ الفاتورة</Label><Input type="date" className="h-9 text-sm" value={form.invoiceDate} onChange={e => setForm(f => ({ ...f, invoiceDate: e.target.value }))} /></div>
              <div><Label className="text-xs mb-1 block">تاريخ الاستحقاق</Label><Input type="date" className="h-9 text-sm" value={form.dueDate} onChange={e => setForm(f => ({ ...f, dueDate: e.target.value }))} /></div>
            </div>
            <div><Label className="text-xs mb-1 block">ملاحظات</Label><Textarea className="text-sm min-h-[60px]" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} /></div>
            <div className="flex gap-2 pt-2">
              <Button className="flex-1 h-9 font-bold" onClick={() => save.mutate()} disabled={save.isPending || !form.invoiceNumber || !form.shippingCompanyId}>{save.isPending ? "جاري الحفظ..." : "حفظ"}</Button>
              <Button variant="outline" className="h-9 border-border" onClick={() => setOpen(false)}>إلغاء</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
