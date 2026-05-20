import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import {
  Plus, Edit2, Trash2, Phone, ToggleLeft, ToggleRight,
  TrendingUp, TrendingDown, ChevronDown, ChevronUp,
  ShoppingBag, Search, Users, MapPin, Target,
} from "lucide-react";
import { format } from "date-fns";
import { apiFetch } from "@/lib/api";

const fmt = (n: string | number) =>
  new Intl.NumberFormat("ar-EG", { style: "currency", currency: "EGP", maximumFractionDigits: 0 }).format(Number(n));

// ── أنواع البيانات ─────────────────────────────────────────────────────────
type Client = {
  id: number; name: string; phone: string | null; phone2: string | null;
  email: string | null; address: string | null; city: string | null; region: string | null;
  taxNumber: string | null; commercialReg: string | null; paymentTerms: string | null;
  creditLimit: string; totalOrders: number; totalSales: string; totalPaid: string;
  notes: string | null; isActive: boolean; createdAt: string;
};

type SaleOrder = {
  id: number; soNumber: string; status: string;
  totalAmount: string; paidAmount: string;
  createdAt: string;
};

type ClientDetail = Client & { orders: SaleOrder[] };

const emptyForm = {
  name: "", phone: "", phone2: "", email: "", address: "", city: "", region: "",
  taxNumber: "", commercialReg: "", paymentTerms: "فوري",
  creditLimit: "0", notes: "", isActive: true,
};

// ── شريط نسبة المبيعات من الهدف — نفس شكل DeliveryBar ──────────────────────
function SalesBar({ rate }: { rate: number }) {
  const color     = rate >= 70 ? "bg-emerald-500" : rate >= 40 ? "bg-amber-500" : "bg-red-500";
  const textColor = rate >= 70 ? "text-emerald-400" : rate >= 40 ? "text-amber-400" : "text-red-400";
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-[10px] text-muted-foreground">نسبة التسليم</span>
        <span className={`text-xs font-black ${textColor}`}>{rate.toFixed(1)}%</span>
      </div>
      <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden">
        <div className={`h-1.5 rounded-full ${color}`} style={{ width: `${rate}%` }} />
      </div>
    </div>
  );
}

// ── إحصائيات العميل — نفس شكل CompanyStats ────────────────────────────────
function ClientStats({ client }: { client: Client }) {
  const sales   = parseFloat(client.totalSales  ?? "0");
  const paid    = parseFloat(client.totalPaid   ?? "0");
  const limit   = parseFloat(client.creditLimit ?? "0");
  const unpaid  = Math.max(0, sales - paid);
  const rate    = limit > 0 ? Math.min((sales / limit) * 100, 100) : 0;

  return (
    <div className="mt-4 pt-4 border-t border-border space-y-3">
      <SalesBar rate={rate} />
      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="bg-muted/20 rounded p-2">
          <p className="text-[10px] text-muted-foreground">إجمالي المبيعات</p>
          <p className="text-sm font-black text-teal-400">{fmt(sales)}</p>
        </div>
        <div className="bg-muted/20 rounded p-2">
          <p className="text-[10px] text-muted-foreground">المديونية</p>
          <p className="text-sm font-black text-red-400">{fmt(unpaid)}</p>
        </div>
        <div className="bg-muted/20 rounded p-2">
          <p className="text-[10px] text-muted-foreground">عدد الفواتير</p>
          <p className="text-sm font-black text-blue-400">{client.totalOrders ?? 0}</p>
        </div>
      </div>
      {limit > 0 && (
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground flex items-center gap-1">
            <Target className="w-3 h-3" /> الهدف
          </span>
          <span className="font-black text-primary">{fmt(limit)}</span>
        </div>
      )}
      {client.paymentTerms && (
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">شروط الدفع</span>
          <span className="font-bold">{client.paymentTerms}</span>
        </div>
      )}
    </div>
  );
}

// ── فواتير البيع — نفس شكل CompanyManifests بدون زر "بيان جديد" ─────────────
function ClientInvoices({ client }: { client: Client }) {
  const [expanded, setExpanded] = useState(false);

  const { data: detail } = useQuery<ClientDetail>({
    queryKey: ["client-detail", client.id],
    queryFn: () => apiFetch<ClientDetail>(`/finance/clients/${client.id}`),
    enabled: expanded,
    staleTime: 30_000,
  });

  const orders = (detail?.orders ?? []).filter(
    o => o.status === "processing" || o.status === "delivered"
  );

  const STATUS_LABEL: Record<string, { label: string; color: string }> = {
    processing: { label: "قيد التجهيز", color: "border-amber-700 bg-amber-900/20 text-amber-400" },
    delivered:  { label: "تم التسليم",  color: "border-emerald-700 bg-emerald-900/20 text-emerald-400" },
  };

  return (
    <div>
      <div className="flex items-center gap-2 mt-3 pt-3 border-t border-border">
        <Button
          variant="outline" size="sm"
          className="flex-1 h-7 text-[11px] gap-1 border-border text-muted-foreground"
          onClick={() => setExpanded(e => !e)}
        >
          <ShoppingBag className="w-3 h-3" />فواتير البيع
          {expanded ? <ChevronUp className="w-3 h-3 mr-auto" /> : <ChevronDown className="w-3 h-3 mr-auto" />}
        </Button>
        <Link href={`/finance/clients/${client.id}`}>
          <Button size="sm" className="h-7 text-[11px] gap-1 bg-primary text-primary-foreground hover:bg-primary/90 font-bold">
            <TrendingUp className="w-3 h-3" />التفاصيل
          </Button>
        </Link>
      </div>

      {expanded && (
        <div className="mt-2 space-y-1.5">
          {!detail ? (
            <p className="text-xs text-muted-foreground text-center py-3 animate-pulse">جاري التحميل...</p>
          ) : orders.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-3">لا توجد فواتير بيع بعد</p>
          ) : (
            orders.map(o => {
              const s = STATUS_LABEL[o.status] ?? { label: o.status, color: "border-border text-muted-foreground" };
              return (
                <Link key={o.id} href="/finance/sales">
                  <div className="flex items-center justify-between p-2.5 rounded-md bg-muted/20 hover:bg-muted/40 cursor-pointer transition-colors">
                    <div>
                      <p className="text-xs font-bold">{o.soNumber}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {format(new Date(o.createdAt), "yyyy/MM/dd")} · {fmt(o.totalAmount)}
                      </p>
                    </div>
                    <Badge variant="outline" className={`text-[9px] font-bold border ${s.color}`}>
                      {s.label}
                    </Badge>
                  </div>
                </Link>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}

// ── نموذج إضافة / تعديل عميل ────────────────────────────────────────────────
function ClientForm({ open, onClose, editClient, onSuccess }: {
  open: boolean; onClose: () => void;
  editClient: Client | null; onSuccess: () => void;
}) {
  const { toast } = useToast();
  const isEdit = !!editClient;
  const [form, setForm] = useState(() => editClient ? {
    name: editClient.name, phone: editClient.phone ?? "", phone2: editClient.phone2 ?? "",
    email: editClient.email ?? "", address: editClient.address ?? "",
    city: editClient.city ?? "", region: editClient.region ?? "",
    taxNumber: editClient.taxNumber ?? "", commercialReg: editClient.commercialReg ?? "",
    paymentTerms: editClient.paymentTerms ?? "فوري",
    creditLimit: String(editClient.creditLimit ?? "0"),
    notes: editClient.notes ?? "", isActive: editClient.isActive,
  } : { ...emptyForm });

  const mutation = useMutation({
    mutationFn: async () => {
      const body = {
        name: form.name, phone: form.phone || null, phone2: form.phone2 || null,
        email: form.email || null, address: form.address || null,
        city: form.city || null, region: form.region || null,
        taxNumber: form.taxNumber || null, commercialReg: form.commercialReg || null,
        paymentTerms: form.paymentTerms || null,
        creditLimit: parseFloat(form.creditLimit) || 0,
        notes: form.notes || null, isActive: form.isActive,
      };
      if (isEdit)
        return apiFetch<any>(`/finance/clients/${editClient!.id}`, { method: "PATCH", body: JSON.stringify(body) });
      return apiFetch<any>("/finance/clients", { method: "POST", body: JSON.stringify(body) });
    },
    onSuccess: () => { toast({ title: isEdit ? "تم تحديث العميل" : "تمت إضافة العميل" }); onSuccess(); onClose(); },
    onError: (e: any) => toast({ title: "خطأ", description: e.message, variant: "destructive" }),
  });

  const f = (k: keyof typeof form, v: any) => setForm(p => ({ ...p, [k]: v }));

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="bg-card border-border max-w-md max-h-[90vh] overflow-y-auto" dir="rtl">
        <DialogHeader>
          <DialogTitle className="text-right">
            {isEdit ? `تعديل — ${editClient?.name}` : "إضافة عميل تجاري جديد"}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3 mt-2">
          <div>
            <Label className="text-xs mb-1.5 block">الاسم / الشركة *</Label>
            <Input placeholder="شركة النور للتجارة" className="h-9 text-sm bg-background" value={form.name} onChange={e => f("name", e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs mb-1.5 block flex items-center gap-1"><Phone className="w-3 h-3" />الهاتف</Label>
              <Input placeholder="01xxxxxxxxx" className="h-9 text-sm bg-background" value={form.phone} onChange={e => f("phone", e.target.value)} />
            </div>
            <div>
              <Label className="text-xs mb-1.5 block">هاتف إضافي</Label>
              <Input placeholder="01xxxxxxxxx" className="h-9 text-sm bg-background" value={form.phone2} onChange={e => f("phone2", e.target.value)} />
            </div>
          </div>
          <div>
            <Label className="text-xs mb-1.5 block">البريد الإلكتروني</Label>
            <Input type="email" placeholder="example@company.com" className="h-9 text-sm bg-background" value={form.email} onChange={e => f("email", e.target.value)} />
          </div>
          <div>
            <Label className="text-xs mb-1.5 block flex items-center gap-1"><MapPin className="w-3 h-3" />العنوان</Label>
            <Input placeholder="الشارع والحي" className="h-9 text-sm bg-background" value={form.address} onChange={e => f("address", e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs mb-1.5 block">المدينة</Label>
              <Input placeholder="القاهرة" className="h-9 text-sm bg-background" value={form.city} onChange={e => f("city", e.target.value)} />
            </div>
            <div>
              <Label className="text-xs mb-1.5 block">المحافظة</Label>
              <Input placeholder="الجيزة" className="h-9 text-sm bg-background" value={form.region} onChange={e => f("region", e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs mb-1.5 block">الرقم الضريبي</Label>
              <Input placeholder="000-000-000" className="h-9 text-sm bg-background" value={form.taxNumber} onChange={e => f("taxNumber", e.target.value)} />
            </div>
            <div>
              <Label className="text-xs mb-1.5 block">السجل التجاري</Label>
              <Input placeholder="رقم السجل" className="h-9 text-sm bg-background" value={form.commercialReg} onChange={e => f("commercialReg", e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs mb-1.5 block">شروط الدفع</Label>
              <Select value={form.paymentTerms} onValueChange={v => f("paymentTerms", v)}>
                <SelectTrigger className="h-9 text-sm bg-background"><SelectValue /></SelectTrigger>
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
              <Label className="text-xs mb-1.5 block flex items-center gap-1"><Target className="w-3 h-3" />الهدف / حد الائتمان</Label>
              <Input type="number" min={0} placeholder="0" className="h-9 text-sm bg-background" value={form.creditLimit} onChange={e => f("creditLimit", e.target.value)} />
            </div>
          </div>
          <div>
            <Label className="text-xs mb-1.5 block">ملاحظات</Label>
            <Textarea placeholder="أي ملاحظات إضافية..." className="min-h-[60px] text-sm resize-none bg-background" value={form.notes} onChange={e => f("notes", e.target.value)} rows={2} />
          </div>
          <div className="flex items-center gap-3 p-3 bg-muted/20 rounded-md">
            <span className="text-xs font-medium">حالة العميل</span>
            <Button variant="ghost" size="sm" className="h-7 text-xs gap-1 mr-auto" onClick={() => f("isActive", !form.isActive)}>
              {form.isActive ? <><ToggleRight className="w-4 h-4 text-emerald-400" />نشط</> : <><ToggleLeft className="w-4 h-4" />غير نشط</>}
            </Button>
          </div>
          <div className="flex gap-2 pt-1">
            <Button className="flex-1 h-9 text-sm font-bold bg-primary text-primary-foreground" onClick={() => mutation.mutate()} disabled={mutation.isPending || !form.name.trim()}>
              {mutation.isPending ? "جارٍ الحفظ…" : isEdit ? "حفظ التعديلات" : "إضافة العميل"}
            </Button>
            <Button variant="outline" className="h-9 text-sm border-border" onClick={onClose}>إلغاء</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── الصفحة الرئيسية — نفس هيكل ShippingCompanies بالظبط ────────────────────
export default function FinanceClients() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editClient, setEditClient] = useState<Client | null>(null);
  const [deleteClient, setDeleteClient] = useState<Client | null>(null);

  const { data: clients = [], isLoading } = useQuery<Client[]>({
    queryKey: ["finance-clients", search],
    queryFn: () => {
      const params = new URLSearchParams();
      if (search.trim()) params.set("search", search.trim());
      return apiFetch<Client[]>(`/finance/clients?${params}`);
    },
    staleTime: 30_000,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiFetch<any>(`/finance/clients/${id}`, { method: "DELETE" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["finance-clients"] }); setDeleteClient(null); toast({ title: "تم حذف العميل" }); },
    onError: (e: any) => toast({ title: "خطأ", description: e.message, variant: "destructive" }),
  });

  const toggleActive = (c: Client) =>
    apiFetch<any>(`/finance/clients/${c.id}`, {
      method: "PATCH", body: JSON.stringify({ isActive: !c.isActive }),
    }).then(() => qc.invalidateQueries({ queryKey: ["finance-clients"] }));

  const openAdd  = () => { setEditClient(null); setFormOpen(true); };
  const openEdit = (c: Client) => { setEditClient(c); setFormOpen(true); };

  return (
    <div className="space-y-5 animate-in fade-in duration-500">

      {/* Header — نفس شكل شركات الشحن */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">العملاء التجاريون</h1>
          <p className="text-muted-foreground text-sm mt-0.5">إدارة العملاء التجاريين ومتابعة المبيعات</p>
        </div>
        <Button onClick={openAdd} className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90 font-bold text-sm">
          <Plus className="w-4 h-4" />إضافة عميل
        </Button>
      </div>

      {/* KPI Cards — نفس شكل شركات الشحن */}
      <div className="grid grid-cols-2 gap-3">
        <Card className="border-border bg-card p-4">
          <p className="text-xs text-muted-foreground">إجمالي العملاء</p>
          <p className="text-2xl font-bold mt-1">{clients.length}</p>
        </Card>
        <Card className="border-border bg-card p-4">
          <p className="text-xs text-muted-foreground">نشط</p>
          <p className="text-2xl font-bold mt-1 text-emerald-400">{clients.filter(c => c.isActive).length}</p>
        </Card>
      </div>

      {/* Search */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute right-2.5 top-2.5 w-3.5 h-3.5 text-muted-foreground" />
          <Input
            placeholder="بحث بالاسم أو الهاتف..."
            className="h-9 text-sm bg-background pr-8"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Cards Grid — نفس هيكل شركات الشحن بالظبط */}
      {isLoading ? (
        <div className="p-8 text-center text-muted-foreground text-sm">جاري التحميل...</div>
      ) : clients.length ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {clients.map(client => (
            <Card key={client.id} className={`border p-5 ${client.isActive ? "border-border bg-card" : "border-border/40 bg-card/40"}`}>

              {/* رأس البطاقة — نفس شكل شركات الشحن */}
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center shrink-0">
                    <Users className="w-5 h-5 text-muted-foreground" />
                  </div>
                  <div>
                    <Link href={`/finance/clients/${client.id}`}>
                      <h3 className="font-bold text-sm hover:text-primary hover:underline cursor-pointer transition-colors">
                        {client.name}
                      </h3>
                    </Link>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="outline" className={`text-[9px] font-bold border ${
                        client.isActive
                          ? "border-emerald-800 bg-emerald-900/30 text-emerald-400"
                          : "border-border text-muted-foreground"
                      }`}>
                        {client.isActive ? "نشط" : "موقف"}
                      </Badge>
                    </div>
                  </div>
                </div>

                {/* أزرار التحكم — نفس شكل شركات الشحن */}
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="icon" className="h-7 w-7 hover:text-primary" onClick={() => toggleActive(client)}>
                    {client.isActive ? <ToggleRight className="w-4 h-4 text-emerald-400" /> : <ToggleLeft className="w-4 h-4" />}
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7 hover:text-primary" onClick={() => openEdit(client)}>
                    <Edit2 className="w-3.5 h-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7 hover:text-destructive" onClick={() => setDeleteClient(client)}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>

              {/* بيانات الاتصال */}
              <div className="mt-3 space-y-1.5">
                {client.phone && (
                  <p className="text-xs text-muted-foreground flex items-center gap-2">
                    <Phone className="w-3 h-3" />{client.phone}
                    {client.phone2 && <span className="text-muted-foreground/60">· {client.phone2}</span>}
                  </p>
                )}
                {(client.address || client.city) && (
                  <p className="text-xs text-muted-foreground flex items-center gap-2">
                    <MapPin className="w-3 h-3" />
                    {[client.address, client.city, client.region].filter(Boolean).join("، ")}
                  </p>
                )}
                {client.notes && (
                  <p className="text-xs text-muted-foreground pt-1 border-t border-border">{client.notes}</p>
                )}
              </div>

              {/* الإحصائيات — زي CompanyStats */}
              <ClientStats client={client} />

              {/* الفواتير — زي CompanyManifests */}
              <ClientInvoices client={client} />
            </Card>
          ))}
        </div>
      ) : (
        <Card className="border-border p-12 text-center">
          <Users className="w-10 h-10 mx-auto mb-3 text-muted-foreground opacity-20" />
          <p className="font-bold">لا يوجد عملاء تجاريون</p>
          <p className="text-sm text-muted-foreground mt-1">أضف عملاءك التجاريين لمتابعة مبيعاتهم.</p>
          <Button onClick={openAdd} className="mt-4 gap-2 text-sm"><Plus className="w-4 h-4" />إضافة عميل</Button>
        </Card>
      )}

      {/* نموذج الإضافة / التعديل */}
      {formOpen && (
        <ClientForm
          open={formOpen}
          onClose={() => { setFormOpen(false); setEditClient(null); }}
          editClient={editClient}
          onSuccess={() => qc.invalidateQueries({ queryKey: ["finance-clients"] })}
        />
      )}

      {/* تأكيد الحذف */}
      <AlertDialog open={!!deleteClient} onOpenChange={() => setDeleteClient(null)}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle>تأكيد الحذف</AlertDialogTitle>
            <AlertDialogDescription>
              هل أنت متأكد من حذف العميل "{deleteClient?.name}"؟ لا يمكن التراجع عن هذا الإجراء.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteClient && deleteMutation.mutate(deleteClient.id)}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              نعم، احذف
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
