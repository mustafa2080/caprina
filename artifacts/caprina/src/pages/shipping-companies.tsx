import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { shippingApi, type ShippingCompany } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Truck, Edit2, Trash2, Phone, Globe, ToggleLeft, ToggleRight } from "lucide-react";

const emptyForm = { name: "", phone: "", website: "", notes: "", isActive: true };

export default function ShippingCompanies() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCompany, setEditingCompany] = useState<ShippingCompany | null>(null);
  const [form, setForm] = useState(emptyForm);

  const { data: companies, isLoading } = useQuery({ queryKey: ["shipping"], queryFn: shippingApi.list });

  const createMutation = useMutation({
    mutationFn: (data: typeof emptyForm) => shippingApi.create(data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["shipping"] }); setDialogOpen(false); setForm(emptyForm); toast({ title: "تمت الإضافة", description: "تم إضافة شركة الشحن." }); },
    onError: (e: any) => toast({ title: "خطأ", description: e.message, variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<typeof emptyForm> }) => shippingApi.update(id, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["shipping"] }); setDialogOpen(false); setEditingCompany(null); setForm(emptyForm); toast({ title: "تم التحديث" }); },
    onError: (e: any) => toast({ title: "خطأ", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => shippingApi.delete(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["shipping"] }); toast({ title: "تم الحذف" }); },
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

  const toggleActive = (c: ShippingCompany) => {
    updateMutation.mutate({ id: c.id, data: { isActive: !c.isActive } });
  };

  return (
    <div className="space-y-5 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">شركات الشحن</h1>
          <p className="text-muted-foreground text-sm mt-0.5">إدارة شركاء الشحن والتوصيل</p>
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
                    <h3 className="font-bold text-sm">{company.name}</h3>
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
                  <Button variant="ghost" size="icon" className="h-7 w-7 hover:text-destructive" onClick={() => { if (confirm(`حذف "${company.name}"؟`)) deleteMutation.mutate(company.id); }}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
              <div className="mt-4 space-y-1.5">
                {company.phone && (
                  <p className="text-xs text-muted-foreground flex items-center gap-2"><Phone className="w-3 h-3" />{company.phone}</p>
                )}
                {company.website && (
                  <p className="text-xs text-muted-foreground flex items-center gap-2"><Globe className="w-3 h-3" />
                    <a href={company.website} target="_blank" rel="noreferrer" className="text-primary hover:underline">{company.website}</a>
                  </p>
                )}
                {company.notes && <p className="text-xs text-muted-foreground mt-2 pt-2 border-t border-border">{company.notes}</p>}
              </div>
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
    </div>
  );
}
