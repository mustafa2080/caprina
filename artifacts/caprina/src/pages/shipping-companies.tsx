import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { shippingApi, manifestsApi, type ShippingCompany, type ShippingManifestListItem, type ManifestCompanyStats } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Truck, Edit2, Trash2, Phone, Globe, ToggleLeft, ToggleRight, FileText, TrendingUp, TrendingDown, PackagePlus, ChevronDown, ChevronUp, Clock, CheckCircle2, RotateCcw, Search } from "lucide-react";
import { format } from "date-fns";

const BASE = "/api";
function getToken() { return localStorage.getItem("caprina_token"); }
async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const token = getToken();
  const authHeader = token ? { Authorization: `Bearer ${token}` } : {};
  const res = await fetch(`${BASE}${path}`, { headers: { "Content-Type": "application/json", ...authHeader, ...options?.headers }, ...options });
  if (res.status === 204) return undefined as unknown as T;
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data as T;
}

type OrderRow = {
  id: number; customerName: string; phone: string | null;
  product: string; color: string | null; size: string | null;
  quantity: number; totalPrice: number; status: string;
  shippingCompanyId: number | null; createdAt: string;
};

const emptyForm = { name: "", phone: "", website: "", notes: "", isActive: true };
const formatCurrency = (n: number) => new Intl.NumberFormat("ar-EG", { style: "currency", currency: "EGP", maximumFractionDigits: 0 }).format(n);

function DeliveryBar({ rate }: { rate: number }) {
  const color = rate >= 70 ? "bg-emerald-500" : rate >= 40 ? "bg-amber-500" : "bg-red-500";
  const textColor = rate >= 70 ? "text-emerald-400" : rate >= 40 ? "text-amber-400" : "text-red-400";
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-[10px] text-muted-foreground">نسبة التسليم</span>
        <span className={`text-xs font-black ${textColor}`}>{rate}%</span>
      </div>
      <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden">
        <div className={`h-1.5 rounded-full ${color}`} style={{ width: `${rate}%` }} />
      </div>
    </div>
  );
}

function CompanyStats({ companyId }: { companyId: number }) {
  const { data: stats } = useQuery({
    queryKey: ["company-stats", companyId],
    queryFn: () => manifestsApi.companyStats(companyId),
    staleTime: 30000,
  });
  if (!stats) return null;
  return (
    <div className="mt-4 pt-4 border-t border-border space-y-3">
      <DeliveryBar rate={stats.deliveryRate} />
      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="bg-muted/20 rounded p-2">
          <p className="text-[10px] text-muted-foreground">مُسلَّم</p>
          <p className="text-sm font-black text-emerald-400">{stats.delivered}</p>
        </div>
        <div className="bg-muted/20 rounded p-2">
          <p className="text-[10px] text-muted-foreground">مُرتجَع</p>
          <p className="text-sm font-black text-red-400">{stats.returned}</p>
        </div>
        <div className="bg-muted/20 rounded p-2">
          <p className="text-[10px] text-muted-foreground">معلّق</p>
          <p className="text-sm font-black text-amber-400">{stats.pending}</p>
        </div>
      </div>
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">صافي الربح / الخسارة</span>
        <span className={`font-black ${stats.netProfit >= 0 ? "text-emerald-400" : "text-red-400"}`}>
          {stats.netProfit >= 0 ? <TrendingUp className="inline w-3 h-3 mr-0.5" /> : <TrendingDown className="inline w-3 h-3 mr-0.5" />}
          {formatCurrency(Math.abs(stats.netProfit))}
        </span>
      </div>
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">عدد البيانات</span>
        <span className="font-bold">{stats.manifestCount}</span>
      </div>
    </div>
  );
}

function CompanyManifests({ company, allCompanies }: { company: ShippingCompany; allCompanies: ShippingCompany[] }) {
  const [expanded, setExpanded] = useState(false);
  const [showNewDialog, setShowNewDialog] = useState(false);
  const { data: manifests } = useQuery({
    queryKey: ["shipping-manifests", company.id],
    queryFn: () => manifestsApi.list(company.id),
    enabled: expanded,
  });

  return (
    <div>
      <div className="flex items-center gap-2 mt-3 pt-3 border-t border-border">
        <Button variant="outline" size="sm" className="flex-1 h-7 text-[11px] gap-1 border-border text-muted-foreground" onClick={() => setExpanded(!expanded)}>
          <FileText className="w-3 h-3" />البيانات
          {expanded ? <ChevronUp className="w-3 h-3 mr-auto" /> : <ChevronDown className="w-3 h-3 mr-auto" />}
        </Button>
        <Button size="sm" className="h-7 text-[11px] gap-1 bg-primary text-primary-foreground hover:bg-primary/90 font-bold" onClick={() => setShowNewDialog(true)}>
          <PackagePlus className="w-3 h-3" />بيان جديد
        </Button>
      </div>

      {expanded && (
        <div className="mt-2 space-y-1.5">
          {!manifests ? (
            <p className="text-xs text-muted-foreground text-center py-3">جاري التحميل...</p>
          ) : manifests.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-3">لا توجد بيانات شحن بعد</p>
          ) : (
            manifests.map(m => (
              <Link key={m.id} href={`/shipping/manifests/${m.id}`}>
                <div className="flex items-center justify-between p-2.5 rounded-md bg-muted/20 hover:bg-muted/40 cursor-pointer transition-colors">
                  <div>
                    <p className="text-xs font-bold">{m.manifestNumber}</p>
                    <p className="text-[10px] text-muted-foreground">{format(new Date(m.createdAt), "yyyy/MM/dd")} · {m.orderCount} طلب</p>
                  </div>
                  <Badge variant="outline" className={`text-[9px] font-bold border ${m.status === "open" ? "border-blue-700 bg-blue-900/20 text-blue-400" : "border-emerald-700 bg-emerald-900/20 text-emerald-400"}`}>
                    {m.status === "open" ? "مفتوح" : "مغلق"}
                  </Badge>
                </div>
              </Link>
            ))
          )}
        </div>
      )}

      {showNewDialog && (
        <CreateManifestDialog
          company={company}
          allCompanies={allCompanies}
          onClose={() => setShowNewDialog(false)}
        />
      )}
    </div>
  );
}

export function CreateManifestDialog({
  company,
  allCompanies,
  onClose,
  onCreated,
}: {
  company: ShippingCompany;
  allCompanies: ShippingCompany[];
  onClose: () => void;
  onCreated?: (manifest: { id: number; manifestNumber: string; orderCount: number }) => void;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [notes, setNotes] = useState("");

  const companyMap = useMemo(() => {
    const m: Record<number, string> = {};
    for (const c of allCompanies) m[c.id] = c.name;
    return m;
  }, [allCompanies]);

  const { data: inShippingOrders, isLoading } = useQuery({
    queryKey: ["orders-in-shipping-all"],
    queryFn: () => apiFetch<OrderRow[]>(`/orders?status=in_shipping`),
  });

  const createMutation = useMutation({
    mutationFn: () =>
      manifestsApi.create({
        shippingCompanyId: company.id,
        orderIds: Array.from(selectedIds),
        notes: notes.trim() || undefined,
      }),
    onSuccess: (manifest) => {
      queryClient.invalidateQueries({ queryKey: ["shipping-manifests", company.id] });
      queryClient.invalidateQueries({ queryKey: ["company-stats", company.id] });
      queryClient.invalidateQueries({ queryKey: ["orders-in-shipping-all"] });
      toast({
        title: "تم إنشاء البيان",
        description: `${manifest.manifestNumber} — ${manifest.orderCount} طلبية`,
      });
      if (onCreated) {
        onCreated({ id: manifest.id, manifestNumber: manifest.manifestNumber, orderCount: manifest.orderCount });
      } else {
        onClose();
      }
    },
    onError: (e: any) =>
      toast({ title: "خطأ", description: e.message, variant: "destructive" }),
  });

  const filtered = useMemo(() => {
    if (!inShippingOrders) return [];
    if (!search.trim()) return inShippingOrders;
    const q = search.toLowerCase();
    return inShippingOrders.filter(
      (o) =>
        o.customerName.toLowerCase().includes(q) ||
        o.product.toLowerCase().includes(q) ||
        (o.phone && o.phone.includes(q))
    );
  }, [inShippingOrders, search]);

  const toggleAll = () => {
    if (selectedIds.size === filtered.length && filtered.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filtered.map((o) => o.id)));
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent
        className="bg-card border-border max-w-3xl max-h-[90vh] flex flex-col"
        dir="rtl"
      >
        <DialogHeader>
          <DialogTitle className="text-right flex items-center gap-2">
            <Truck className="w-4 h-4 text-primary" />
            إنشاء بيان شحن — {company.name}
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
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            {!isLoading && (
              <span className="text-xs text-muted-foreground whitespace-nowrap">
                {inShippingOrders?.length ?? 0} طلبية قيد الشحن
              </span>
            )}
          </div>

          {/* Select-all row */}
          {!isLoading && filtered.length > 0 && (
            <div className="flex items-center justify-between px-1">
              <div className="flex items-center gap-2">
                <Checkbox
                  checked={
                    selectedIds.size === filtered.length && filtered.length > 0
                  }
                  onCheckedChange={toggleAll}
                />
                <span className="text-xs text-muted-foreground">
                  تحديد الكل ({filtered.length})
                </span>
              </div>
              <span className="text-xs font-bold text-primary">
                {selectedIds.size} محدد
              </span>
            </div>
          )}

          {/* Orders table */}
          <div className="overflow-y-auto flex-1 border border-border rounded-md">
            {isLoading ? (
              <div className="p-8 text-center text-muted-foreground text-sm animate-pulse">
                جاري تحميل الطلبيات...
              </div>
            ) : filtered.length === 0 ? (
              <div className="p-10 text-center">
                <Truck className="w-8 h-8 mx-auto mb-2 text-muted-foreground opacity-20" />
                <p className="text-sm text-muted-foreground">
                  {inShippingOrders?.length === 0
                    ? "لا توجد طلبيات قيد الشحن حالياً"
                    : "لا توجد نتائج تطابق البحث"}
                </p>
              </div>
            ) : (
              <>
                {/* Table header */}
                <div className="grid grid-cols-[auto_1fr_1fr_80px_80px_90px] gap-0 border-b border-border bg-muted/20 px-3 py-2 text-[10px] font-semibold text-muted-foreground sticky top-0">
                  <div className="w-5" />
                  <div>العميل</div>
                  <div>المنتج</div>
                  <div className="text-center">الكمية</div>
                  <div className="text-left">الإجمالي</div>
                  <div>شركة الشحن</div>
                </div>
                {/* Rows */}
                {filtered.map((order) => {
                  const selected = selectedIds.has(order.id);
                  const assignedCompany = order.shippingCompanyId
                    ? companyMap[order.shippingCompanyId]
                    : null;
                  return (
                    <div
                      key={order.id}
                      className={`grid grid-cols-[auto_1fr_1fr_80px_80px_90px] gap-0 items-center px-3 py-2.5 border-b border-border/50 cursor-pointer hover:bg-muted/20 transition-colors ${selected ? "bg-primary/5 hover:bg-primary/8" : ""}`}
                      onClick={() => {
                        const next = new Set(selectedIds);
                        if (next.has(order.id)) next.delete(order.id);
                        else next.add(order.id);
                        setSelectedIds(next);
                      }}
                    >
                      {/* Checkbox */}
                      <div className="w-5 flex items-center">
                        <Checkbox
                          checked={selected}
                          onCheckedChange={() => {}}
                        />
                      </div>
                      {/* Customer */}
                      <div className="min-w-0 pr-2">
                        <p className="text-xs font-semibold truncate">
                          {order.customerName}
                        </p>
                        <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                          <span className="font-mono">
                            #{order.id.toString().padStart(4, "0")}
                          </span>
                          {order.phone && (
                            <span className="text-muted-foreground/70">
                              · {order.phone}
                            </span>
                          )}
                        </p>
                      </div>
                      {/* Product */}
                      <div className="min-w-0 pr-2">
                        <p className="text-xs truncate">{order.product}</p>
                        {(order.color || order.size) && (
                          <p className="text-[10px] text-muted-foreground truncate">
                            {[order.color, order.size]
                              .filter(Boolean)
                              .join(" / ")}
                          </p>
                        )}
                      </div>
                      {/* Qty */}
                      <div className="text-center text-xs font-bold">
                        {order.quantity}
                      </div>
                      {/* Price */}
                      <div className="text-left text-xs font-bold">
                        {formatCurrency(order.totalPrice)}
                      </div>
                      {/* Assigned company */}
                      <div>
                        {assignedCompany ? (
                          <Badge
                            variant="outline"
                            className={`text-[9px] font-bold border truncate max-w-[85px] ${assignedCompany === company.name ? "border-primary/50 bg-primary/10 text-primary" : "border-border text-muted-foreground"}`}
                          >
                            {assignedCompany}
                          </Badge>
                        ) : (
                          <span className="text-[10px] text-muted-foreground/50">
                            غير محدد
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </>
            )}
          </div>

          {/* Notes */}
          <div>
            <Label className="text-xs mb-1.5 block">ملاحظات (اختياري)</Label>
            <Textarea
              placeholder="ملاحظات على البيان..."
              className="min-h-[50px] text-sm resize-none bg-background"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          {/* Actions */}
          <div className="flex gap-2">
            <Button
              className="flex-1 h-9 text-sm font-bold bg-primary text-primary-foreground hover:bg-primary/90"
              onClick={() => createMutation.mutate()}
              disabled={selectedIds.size === 0 || createMutation.isPending}
            >
              {createMutation.isPending
                ? "جاري الإنشاء..."
                : `إنشاء البيان (${selectedIds.size} طلبية)`}
            </Button>
            <Button
              variant="outline"
              className="h-9 text-sm border-border"
              onClick={onClose}
            >
              إلغاء
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function ShippingCompanies() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCompany, setEditingCompany] = useState<ShippingCompany | null>(null);
  const [deleteCompany, setDeleteCompany] = useState<ShippingCompany | null>(null);
  const [form, setForm] = useState(emptyForm);

  const { data: companies, isLoading } = useQuery({ queryKey: ["shipping"], queryFn: shippingApi.list });

  const createMutation = useMutation({
    mutationFn: (data: typeof emptyForm) => shippingApi.create(data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["shipping"] }); setDialogOpen(false); setForm(emptyForm); toast({ title: "تمت الإضافة" }); },
    onError: (e: any) => toast({ title: "خطأ", description: e.message, variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<typeof emptyForm> }) => shippingApi.update(id, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["shipping"] }); setDialogOpen(false); setEditingCompany(null); setForm(emptyForm); toast({ title: "تم التحديث" }); },
    onError: (e: any) => toast({ title: "خطأ", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => shippingApi.delete(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["shipping"] }); setDeleteCompany(null); toast({ title: "تم الحذف" }); },
    onError: (e: any) => toast({ title: "خطأ", description: e.message, variant: "destructive" }),
  });

  const openAdd = () => { setEditingCompany(null); setForm(emptyForm); setDialogOpen(true); };
  const openEdit = (c: ShippingCompany) => { setEditingCompany(c); setForm({ name: c.name, phone: c.phone ?? "", website: c.website ?? "", notes: c.notes ?? "", isActive: c.isActive }); setDialogOpen(true); };

  const handleSubmit = () => {
    if (!form.name.trim()) { toast({ title: "خطأ", description: "اسم الشركة مطلوب.", variant: "destructive" }); return; }
    const data = { ...form, phone: form.phone || null, website: form.website || null, notes: form.notes || null };
    if (editingCompany) updateMutation.mutate({ id: editingCompany.id, data });
    else createMutation.mutate(data as any);
  };

  const toggleActive = (c: ShippingCompany) => updateMutation.mutate({ id: c.id, data: { isActive: !c.isActive } });

  return (
    <div className="space-y-5 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">شركات الشحن</h1>
          <p className="text-muted-foreground text-sm mt-0.5">إدارة شركاء الشحن وبيانات التسليم</p>
        </div>
        <Button onClick={openAdd} className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90 font-bold text-sm">
          <Plus className="w-4 h-4" />إضافة شركة
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3">
        <Card className="border-border bg-card p-4">
          <p className="text-xs text-muted-foreground">إجمالي الشركات</p>
          <p className="text-2xl font-bold mt-1">{companies?.length ?? 0}</p>
        </Card>
        <Card className="border-border bg-card p-4">
          <p className="text-xs text-muted-foreground">نشط</p>
          <p className="text-2xl font-bold mt-1 text-emerald-400">{companies?.filter(c => c.isActive).length ?? 0}</p>
        </Card>
      </div>

      {isLoading ? (
        <div className="p-8 text-center text-muted-foreground text-sm">جاري التحميل...</div>
      ) : companies?.length ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {companies.map((company) => (
            <Card key={company.id} className={`border p-5 ${company.isActive ? "border-border bg-card" : "border-border/40 bg-card/40"}`}>
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center shrink-0">
                    <Truck className="w-5 h-5 text-muted-foreground" />
                  </div>
                  <div>
                    <Link href={`/shipping/company/${company.id}`}>
                      <h3 className="font-bold text-sm hover:text-primary hover:underline cursor-pointer transition-colors">{company.name}</h3>
                    </Link>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="outline" className={`text-[9px] font-bold border ${company.isActive ? "border-emerald-800 bg-emerald-900/30 text-emerald-400" : "border-border text-muted-foreground"}`}>
                        {company.isActive ? "نشط" : "موقف"}
                      </Badge>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="icon" className="h-7 w-7 hover:text-primary" onClick={() => toggleActive(company)}>
                    {company.isActive ? <ToggleRight className="w-4 h-4 text-emerald-400" /> : <ToggleLeft className="w-4 h-4" />}
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7 hover:text-primary" onClick={() => openEdit(company)}>
                    <Edit2 className="w-3.5 h-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7 hover:text-destructive" onClick={() => setDeleteCompany(company)}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>

              <div className="mt-3 space-y-1.5">
                {company.phone && <p className="text-xs text-muted-foreground flex items-center gap-2"><Phone className="w-3 h-3" />{company.phone}</p>}
                {company.website && (
                  <p className="text-xs text-muted-foreground flex items-center gap-2"><Globe className="w-3 h-3" />
                    <a href={company.website} target="_blank" rel="noreferrer" className="text-primary hover:underline">{company.website}</a>
                  </p>
                )}
                {company.notes && <p className="text-xs text-muted-foreground pt-1 border-t border-border">{company.notes}</p>}
              </div>

              <CompanyStats companyId={company.id} />
              <CompanyManifests company={company} allCompanies={companies ?? []} />
            </Card>
          ))}
        </div>
      ) : (
        <Card className="border-border p-12 text-center">
          <Truck className="w-10 h-10 mx-auto mb-3 text-muted-foreground opacity-20" />
          <p className="font-bold">لا توجد شركات شحن</p>
          <p className="text-sm text-muted-foreground mt-1">أضف شركات الشحن التي تتعامل معها.</p>
          <Button onClick={openAdd} className="mt-4 gap-2 text-sm"><Plus className="w-4 h-4" />إضافة شركة</Button>
        </Card>
      )}

      {/* Add/Edit Company Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="bg-card border-border max-w-md" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-right">{editingCompany ? "تعديل شركة الشحن" : "إضافة شركة شحن"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 mt-2">
            <div>
              <Label className="text-xs mb-1.5 block">اسم الشركة *</Label>
              <Input placeholder="مثال: أرامكس، DHL" className="h-9 text-sm bg-background" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs mb-1.5 block flex items-center gap-1"><Phone className="w-3 h-3" />الهاتف</Label>
                <Input placeholder="05xxxxxxxx" className="h-9 text-sm bg-background" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
              </div>
              <div>
                <Label className="text-xs mb-1.5 block flex items-center gap-1"><Globe className="w-3 h-3" />الموقع</Label>
                <Input placeholder="https://..." className="h-9 text-sm bg-background" value={form.website} onChange={e => setForm(f => ({ ...f, website: e.target.value }))} />
              </div>
            </div>
            <div>
              <Label className="text-xs mb-1.5 block">ملاحظات</Label>
              <Textarea placeholder="معلومات إضافية..." className="min-h-[70px] text-sm resize-none bg-background" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
            </div>
            <div className="flex items-center gap-3 p-3 bg-muted/20 rounded-md">
              <span className="text-xs font-medium">حالة الشركة</span>
              <Button variant="ghost" size="sm" className="h-7 text-xs gap-1 mr-auto" onClick={() => setForm(f => ({ ...f, isActive: !f.isActive }))}>
                {form.isActive ? <><ToggleRight className="w-4 h-4 text-emerald-400" />نشط</> : <><ToggleLeft className="w-4 h-4" />موقف</>}
              </Button>
            </div>
            <div className="flex gap-2 pt-1">
              <Button className="flex-1 h-9 text-sm font-bold bg-primary text-primary-foreground" onClick={handleSubmit} disabled={createMutation.isPending || updateMutation.isPending}>
                {createMutation.isPending || updateMutation.isPending ? "جاري الحفظ..." : editingCompany ? "حفظ" : "إضافة"}
              </Button>
              <Button variant="outline" className="h-9 text-sm border-border" onClick={() => setDialogOpen(false)}>إلغاء</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm Dialog */}
      <AlertDialog open={!!deleteCompany} onOpenChange={() => setDeleteCompany(null)}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle>تأكيد الحذف</AlertDialogTitle>
            <AlertDialogDescription>
              هل أنت متأكد من حذف شركة الشحن "{deleteCompany?.name}"؟ لا يمكن التراجع عن هذا الإجراء.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteCompany && deleteMutation.mutate(deleteCompany.id)} className="bg-red-600 hover:bg-red-700 text-white">
              نعم، احذف
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
