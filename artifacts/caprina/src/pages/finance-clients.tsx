import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Plus, Search, X, Users, Phone, MapPin, FileText,
  TrendingUp, Wallet, RefreshCw, ChevronRight, ShoppingBag,
  Edit2, Trash2, Eye
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { apiFetch } from "@/lib/api";
import { useLocation } from "wouter";

const fmt = (n: string | number) =>
  new Intl.NumberFormat("ar-EG", { style: "currency", currency: "EGP", maximumFractionDigits: 0 }).format(Number(n));

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  draft:      { label: "مسودة",        color: "bg-muted/50 text-muted-foreground border-border" },
  confirmed:  { label: "مؤكد",         color: "bg-blue-500/15 text-blue-400 border-blue-500/30" },
  processing: { label: "جاري التجهيز", color: "bg-amber-500/15 text-amber-400 border-amber-500/30" },
  delivered:  { label: "تم التسليم",   color: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" },
  closed:     { label: "مُغلَق",        color: "bg-purple-500/15 text-purple-400 border-purple-500/30" },
  cancelled:  { label: "ملغي",         color: "bg-rose-500/15 text-rose-400 border-rose-500/30" },
};

type Client = {
  id: number; name: string; phone: string | null; phone2: string | null;
  email: string | null; address: string | null; city: string | null; region: string | null;
  taxNumber: string | null; commercialReg: string | null; paymentTerms: string | null;
  creditLimit: string; totalOrders: number; totalSales: string; totalPaid: string;
  notes: string | null; isActive: boolean; createdAt: string;
};

type ClientDetail = Client & {
  orders: {
    id: number; soNumber: string; status: string; paymentStatus: string;
    totalAmount: string; paidAmount: string; createdAt: string; expectedDate: string | null;
  }[];
};

// ── نموذج إضافة / تعديل عميل ─────────────────────────────────────────────────
function ClientForm({ open, onClose, editClient, onSuccess }: {
  open: boolean; onClose: () => void;
  editClient: Client | null; onSuccess: () => void;
}) {
  const { toast } = useToast();
  const isEdit = !!editClient;

  const [name,          setName]          = useState(editClient?.name          ?? "");
  const [phone,         setPhone]         = useState(editClient?.phone         ?? "");
  const [phone2,        setPhone2]        = useState(editClient?.phone2        ?? "");
  const [email,         setEmail]         = useState(editClient?.email         ?? "");
  const [address,       setAddress]       = useState(editClient?.address       ?? "");
  const [city,          setCity]          = useState(editClient?.city          ?? "");
  const [region,        setRegion]        = useState(editClient?.region        ?? "");
  const [taxNumber,     setTaxNumber]     = useState(editClient?.taxNumber     ?? "");
  const [commercialReg, setCommercialReg] = useState(editClient?.commercialReg ?? "");
  const [paymentTerms,  setPaymentTerms]  = useState(editClient?.paymentTerms  ?? "");
  const [creditLimit,   setCreditLimit]   = useState(String(editClient?.creditLimit ?? "0"));
  const [notes,         setNotes]         = useState(editClient?.notes         ?? "");
  const [isActive,      setIsActive]      = useState(editClient?.isActive      ?? true);

  const mutation = useMutation({
    mutationFn: async () => {
      const body = {
        name, phone: phone || null, phone2: phone2 || null, email: email || null,
        address: address || null, city: city || null, region: region || null,
        taxNumber: taxNumber || null, commercialReg: commercialReg || null,
        paymentTerms: paymentTerms || null, creditLimit: parseFloat(creditLimit) || 0,
        notes: notes || null, isActive,
      };
      if (isEdit) {
        return apiFetch<any>(`/finance/clients/${editClient!.id}`, { method: "PATCH", body: JSON.stringify(body) });
      }
      return apiFetch<any>("/finance/clients", { method: "POST", body: JSON.stringify(body) });
    },
    onSuccess: () => {
      toast({ title: isEdit ? "تم تحديث العميل" : "تمت إضافة العميل" });
      onSuccess(); onClose();
    },
    onError: (e: any) => toast({ title: "خطأ", description: e.message, variant: "destructive" }),
  });

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" dir="rtl">
        <DialogHeader>
          <DialogTitle>{isEdit ? `تعديل — ${editClient?.name}` : "إضافة عميل تجاري جديد"}</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-4 mt-2">
          {/* الاسم */}
          <div className="col-span-2">
            <Label>الاسم / الشركة *</Label>
            <Input placeholder="مثال: شركة النور للتجارة" value={name} onChange={e => setName(e.target.value)} />
          </div>
          {/* الهواتف */}
          <div>
            <Label>رقم الهاتف الأساسي</Label>
            <Input placeholder="01xxxxxxxxx" value={phone} onChange={e => setPhone(e.target.value)} />
          </div>
          <div>
            <Label>رقم هاتف إضافي</Label>
            <Input placeholder="01xxxxxxxxx" value={phone2} onChange={e => setPhone2(e.target.value)} />
          </div>
          {/* البريد */}
          <div className="col-span-2">
            <Label>البريد الإلكتروني</Label>
            <Input type="email" placeholder="example@company.com" value={email} onChange={e => setEmail(e.target.value)} />
          </div>
          {/* العنوان */}
          <div className="col-span-2">
            <Label>العنوان</Label>
            <Input placeholder="الشارع والحي" value={address} onChange={e => setAddress(e.target.value)} />
          </div>
          <div>
            <Label>المدينة</Label>
            <Input placeholder="القاهرة" value={city} onChange={e => setCity(e.target.value)} />
          </div>
          <div>
            <Label>المنطقة / المحافظة</Label>
            <Input placeholder="الجيزة" value={region} onChange={e => setRegion(e.target.value)} />
          </div>
          {/* تجاري */}
          <div>
            <Label>الرقم الضريبي</Label>
            <Input placeholder="000-000-000" value={taxNumber} onChange={e => setTaxNumber(e.target.value)} />
          </div>
          <div>
            <Label>السجل التجاري</Label>
            <Input placeholder="رقم السجل" value={commercialReg} onChange={e => setCommercialReg(e.target.value)} />
          </div>
          <div>
            <Label>شروط الدفع</Label>
            <Select value={paymentTerms} onValueChange={setPaymentTerms}>
              <SelectTrigger><SelectValue placeholder="اختر" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="فوري">فوري</SelectItem>
                <SelectItem value="آجل 15 يوم">آجل 15 يوم</SelectItem>
                <SelectItem value="آجل 30 يوم">آجل 30 يوم</SelectItem>
                <SelectItem value="آجل 60 يوم">آجل 60 يوم</SelectItem>
                <SelectItem value="آجل 90 يوم">آجل 90 يوم</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>حد الائتمان (ج.م)</Label>
            <Input type="number" min={0} value={creditLimit} onChange={e => setCreditLimit(e.target.value)} />
          </div>
          <div className="col-span-2">
            <Label>ملاحظات</Label>
            <Textarea placeholder="أي ملاحظات إضافية..." value={notes} onChange={e => setNotes(e.target.value)} rows={2} />
          </div>
          <div className="flex items-center gap-2">
            <input type="checkbox" id="isActive" checked={isActive} onChange={e => setIsActive(e.target.checked)} className="w-4 h-4" />
            <Label htmlFor="isActive">عميل نشط</Label>
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <Button variant="outline" onClick={onClose}>إلغاء</Button>
          <Button onClick={() => mutation.mutate()} disabled={mutation.isPending || !name.trim()}>
            {mutation.isPending ? "جارٍ الحفظ…" : isEdit ? "حفظ التعديلات" : "إضافة العميل"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── تفاصيل العميل ─────────────────────────────────────────────────────────────
function ClientDetailDrawer({ client, onClose, onEdit }: {
  client: Client; onClose: () => void; onEdit: () => void;
}) {
  const [, navigate] = useLocation();
  const { data, isLoading } = useQuery<ClientDetail>({
    queryKey: ["client-detail", client.id],
    queryFn: () => apiFetch<ClientDetail>(`/finance/clients/${client.id}`),
  });

  const totalUnpaid = data
    ? (parseFloat(data.totalSales) - parseFloat(data.totalPaid))
    : 0;

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" dir="rtl">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2">
              <Users className="w-5 h-5 text-teal-400" />
              {client.name}
            </DialogTitle>
            <Button variant="outline" size="sm" onClick={onEdit}>
              <Edit2 className="w-3 h-3 ml-1" /> تعديل
            </Button>
          </div>
        </DialogHeader>

        {/* بطاقات الإحصائيات */}
        <div className="grid grid-cols-3 gap-3 mt-2">
          <div className="rounded-xl p-3 text-center" style={{ background: "hsl(var(--muted)/0.3)" }}>
            <p className="text-2xl font-black text-blue-400">{data?.totalOrders ?? 0}</p>
            <p className="text-xs text-muted-foreground mt-0.5">إجمالي الأوامر</p>
          </div>
          <div className="rounded-xl p-3 text-center" style={{ background: "hsl(var(--muted)/0.3)" }}>
            <p className="text-lg font-black text-teal-400">{fmt(data?.totalSales ?? 0)}</p>
            <p className="text-xs text-muted-foreground mt-0.5">إجمالي المشتريات</p>
          </div>
          <div className="rounded-xl p-3 text-center" style={{ background: "hsl(var(--muted)/0.3)" }}>
            <p className="text-lg font-black text-rose-400">{fmt(totalUnpaid)}</p>
            <p className="text-xs text-muted-foreground mt-0.5">مديونية متبقية</p>
          </div>
        </div>

        {/* البيانات */}
        <div className="grid grid-cols-2 gap-x-6 gap-y-2 mt-3 text-sm">
          {client.phone && (
            <div className="flex items-center gap-2">
              <Phone className="w-3.5 h-3.5 text-muted-foreground" />
              <span>{client.phone}</span>
              {client.phone2 && <span className="text-muted-foreground">/ {client.phone2}</span>}
            </div>
          )}
          {(client.address || client.city) && (
            <div className="flex items-center gap-2">
              <MapPin className="w-3.5 h-3.5 text-muted-foreground" />
              <span>{[client.address, client.city, client.region].filter(Boolean).join("، ")}</span>
            </div>
          )}
          {client.paymentTerms && (
            <div className="flex items-center gap-2">
              <Wallet className="w-3.5 h-3.5 text-muted-foreground" />
              <span>شروط الدفع: <strong>{client.paymentTerms}</strong></span>
            </div>
          )}
          {parseFloat(client.creditLimit) > 0 && (
            <div className="flex items-center gap-2">
              <TrendingUp className="w-3.5 h-3.5 text-muted-foreground" />
              <span>حد الائتمان: <strong>{fmt(client.creditLimit)}</strong></span>
            </div>
          )}
          {client.taxNumber && (
            <div className="text-muted-foreground">ضريبي: <strong className="text-foreground">{client.taxNumber}</strong></div>
          )}
          {client.commercialReg && (
            <div className="text-muted-foreground">سجل تجاري: <strong className="text-foreground">{client.commercialReg}</strong></div>
          )}
        </div>

        {/* أوامر البيع */}
        <div className="mt-4">
          <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
            <ShoppingBag className="w-4 h-4 text-teal-400" />
            أوامر البيع المرتبطة
          </h4>
          {isLoading ? (
            <p className="text-xs text-muted-foreground py-4 text-center">جارٍ التحميل…</p>
          ) : (data?.orders ?? []).length === 0 ? (
            <p className="text-xs text-muted-foreground py-4 text-center">لا توجد أوامر بيع بعد</p>
          ) : (
            <div className="space-y-1.5 max-h-56 overflow-y-auto">
              {(data?.orders ?? []).map(o => {
                const s = STATUS_LABELS[o.status] ?? { label: o.status, color: "" };
                const unpaid = parseFloat(o.totalAmount) - parseFloat(o.paidAmount);
                return (
                  <div key={o.id}
                    className="flex items-center justify-between px-3 py-2 rounded-lg cursor-pointer hover:bg-accent transition-colors"
                    style={{ background: "hsl(var(--muted)/0.3)" }}
                    onClick={() => { onClose(); navigate(`/finance/sales`); }}
                  >
                    <div>
                      <p className="text-sm font-mono font-semibold">{o.soNumber}</p>
                      <p className="text-xs text-muted-foreground">
                        {o.createdAt ? format(new Date(o.createdAt), "dd/MM/yyyy") : ""}
                      </p>
                    </div>
                    <div className="text-center">
                      <Badge className={`text-xs border ${s.color}`}>{s.label}</Badge>
                    </div>
                    <div className="text-left">
                      <p className="text-sm font-semibold">{fmt(o.totalAmount)}</p>
                      {unpaid > 0 && <p className="text-xs text-rose-400">متبقي: {fmt(unpaid)}</p>}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── الصفحة الرئيسية ───────────────────────────────────────────────────────────
export default function FinanceClients() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [search,      setSearch]      = useState("");
  const [filterActive, setFilterActive] = useState("all");
  const [formOpen,    setFormOpen]    = useState(false);
  const [editClient,  setEditClient]  = useState<Client | null>(null);
  const [viewClient,  setViewClient]  = useState<Client | null>(null);

  const { data: clients = [], isLoading } = useQuery<Client[]>({
    queryKey: ["finance-clients", search, filterActive],
    queryFn: () => {
      const params = new URLSearchParams();
      if (search.trim()) params.set("search", search.trim());
      if (filterActive !== "all") params.set("isActive", filterActive);
      return apiFetch<Client[]>(`/finance/clients?${params}`);
    },
    staleTime: 30_000,
  });

  const syncMutation = useMutation({
    mutationFn: (id: number) => apiFetch<any>(`/finance/clients/${id}/sync`, { method: "PATCH", body: "{}" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["finance-clients"] }); toast({ title: "تم تحديث الإحصائيات" }); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiFetch<any>(`/finance/clients/${id}`, { method: "DELETE" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["finance-clients"] }); toast({ title: "تم حذف العميل" }); },
    onError: (e: any) => toast({ title: "خطأ", description: e.message, variant: "destructive" }),
  });

  const totalSales  = clients.reduce((s, c) => s + parseFloat(c.totalSales  ?? "0"), 0);
  const totalUnpaid = clients.reduce((s, c) => s + (parseFloat(c.totalSales ?? "0") - parseFloat(c.totalPaid ?? "0")), 0);

  return (
    <div className="space-y-5 p-4" dir="rtl">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black flex items-center gap-2">
            <Users className="w-6 h-6 text-teal-400" />
            العملاء التجاريون
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">{clients.length} عميل مسجّل</p>
        </div>
        <Button onClick={() => { setEditClient(null); setFormOpen(true); }}
          className="gap-1.5" style={{ background: "#26A69A", color: "#fff" }}>
          <Plus className="w-4 h-4" /> عميل جديد
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="p-4">
          <p className="text-xs text-muted-foreground">عدد العملاء النشطين</p>
          <p className="text-3xl font-black text-teal-400 mt-1">
            {clients.filter(c => c.isActive).length}
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-muted-foreground">إجمالي المبيعات</p>
          <p className="text-2xl font-black text-blue-400 mt-1">{fmt(totalSales)}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-muted-foreground">إجمالي المديونيات</p>
          <p className="text-2xl font-black text-rose-400 mt-1">{fmt(totalUnpaid)}</p>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input className="pr-9 h-9" placeholder="بحث بالاسم أو الهاتف..." value={search}
            onChange={e => setSearch(e.target.value)} />
          {search && <button className="absolute left-2 top-1/2 -translate-y-1/2" onClick={() => setSearch("")}><X className="w-3.5 h-3.5 text-muted-foreground" /></button>}
        </div>
        <Select value={filterActive} onValueChange={setFilterActive}>
          <SelectTrigger className="h-9 w-36"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">الكل</SelectItem>
            <SelectItem value="true">نشط فقط</SelectItem>
            <SelectItem value="false">غير نشط</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <Card className="overflow-hidden">
        {isLoading ? (
          <div className="py-16 text-center text-muted-foreground">جارٍ التحميل…</div>
        ) : clients.length === 0 ? (
          <div className="py-16 text-center">
            <Users className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-muted-foreground">لا يوجد عملاء بعد</p>
            <Button className="mt-3" variant="outline" onClick={() => { setEditClient(null); setFormOpen(true); }}>
              <Plus className="w-4 h-4 ml-1" /> أضف أول عميل
            </Button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ background: "hsl(var(--muted)/0.5)", borderBottom: "1px solid hsl(var(--border))" }}>
                  <th className="text-right px-4 py-3 font-semibold">العميل</th>
                  <th className="text-right px-3 py-3 font-semibold">الهاتف</th>
                  <th className="text-center px-3 py-3 font-semibold">الأوامر</th>
                  <th className="text-right px-3 py-3 font-semibold">إجمالي المشتريات</th>
                  <th className="text-right px-3 py-3 font-semibold">المديونية</th>
                  <th className="text-right px-3 py-3 font-semibold">شروط الدفع</th>
                  <th className="text-center px-3 py-3 font-semibold">الحالة</th>
                  <th className="px-3 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {clients.map((c, idx) => {
                  const unpaid = parseFloat(c.totalSales ?? "0") - parseFloat(c.totalPaid ?? "0");
                  return (
                    <tr key={c.id}
                      style={{ borderBottom: "1px solid hsl(var(--border)/0.5)", background: idx % 2 === 0 ? "transparent" : "hsl(var(--muted)/0.15)" }}
                      className="hover:bg-accent/30 transition-colors">
                      <td className="px-4 py-3">
                        <button className="text-right" onClick={() => setViewClient(c)}>
                          <p className="font-semibold hover:text-teal-400 transition-colors">{c.name}</p>
                          {c.email && <p className="text-xs text-muted-foreground">{c.email}</p>}
                        </button>
                      </td>
                      <td className="px-3 py-3 text-sm text-muted-foreground">{c.phone ?? "—"}</td>
                      <td className="px-3 py-3 text-center">
                        <span className="text-sm font-bold text-blue-400">{c.totalOrders ?? 0}</span>
                      </td>
                      <td className="px-3 py-3 font-semibold text-sm">{fmt(c.totalSales ?? 0)}</td>
                      <td className="px-3 py-3 text-sm">
                        <span className={unpaid > 0 ? "text-rose-400 font-semibold" : "text-emerald-400 font-semibold"}>
                          {fmt(unpaid)}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-xs text-muted-foreground">{c.paymentTerms ?? "—"}</td>
                      <td className="px-3 py-3 text-center">
                        <Badge variant="outline" className={c.isActive
                          ? "text-xs bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                          : "text-xs bg-muted/50 text-muted-foreground border-border"}>
                          {c.isActive ? "نشط" : "غير نشط"}
                        </Badge>
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-1 justify-end">
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-blue-400"
                            onClick={() => setViewClient(c)}>
                            <Eye className="w-3.5 h-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7"
                            onClick={() => syncMutation.mutate(c.id)}>
                            <RefreshCw className="w-3.5 h-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7"
                            onClick={() => { setEditClient(c); setFormOpen(true); }}>
                            <Edit2 className="w-3.5 h-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-rose-400"
                            onClick={() => {
                              if (confirm(`حذف العميل "${c.name}"؟`)) deleteMutation.mutate(c.id);
                            }}>
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* نموذج الإضافة / التعديل */}
      {formOpen && (
        <ClientForm
          open={formOpen}
          onClose={() => { setFormOpen(false); setEditClient(null); }}
          editClient={editClient}
          onSuccess={() => qc.invalidateQueries({ queryKey: ["finance-clients"] })}
        />
      )}

      {/* درج تفاصيل العميل */}
      {viewClient && (
        <ClientDetailDrawer
          client={viewClient}
          onClose={() => setViewClient(null)}
          onEdit={() => { setEditClient(viewClient); setViewClient(null); setFormOpen(true); }}
        />
      )}
    </div>
  );
}
