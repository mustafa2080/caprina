import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, MapPin, Edit2, Trash2, Search, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { zonesApi, type Zone } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { useDebounce } from "@/hooks/use-debounce";

function ZoneFormDialog({
  open, onClose, existing,
}: {
  open: boolean; onClose: () => void; existing?: Zone;
}) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [name, setName] = useState(existing?.name ?? "");
  const [notes, setNotes] = useState(existing?.notes ?? "");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!name.trim()) {
      toast({ title: "خطأ", description: "اسم المنطقة مطلوب", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      if (existing) {
        await zonesApi.update(existing.id, { name, notes: notes || null });
        toast({ title: "تم تحديث المنطقة" });
      } else {
        await zonesApi.create({ name, notes: notes || null });
        toast({ title: "تم إنشاء المنطقة" });
      }
      qc.invalidateQueries({ queryKey: ["zones"] });
      onClose();
    } catch (e: any) {
      toast({ title: "خطأ", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-md" dir="rtl">
        <DialogHeader><DialogTitle>{existing ? "تعديل المنطقة" : "إضافة منطقة جديدة"}</DialogTitle></DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1">
            <Label className="text-xs">اسم المنطقة *</Label>
            <Input value={name} onChange={e => setName(e.target.value)} placeholder="مثال: منطقة شرق" className="h-9 text-sm" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">ملاحظات</Label>
            <Textarea value={notes ?? ""} onChange={e => setNotes(e.target.value)} placeholder="..." className="min-h-[60px] text-sm resize-none" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} className="text-xs h-8">إلغاء</Button>
          <Button onClick={handleSave} disabled={saving} className="text-xs h-8">{saving ? "جاري الحفظ..." : "حفظ"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function ZonesPage() {
  const { can, isAdmin } = useAuth();
  const canEdit = isAdmin || can("tools.zones");
  const { toast } = useToast();
  const qc = useQueryClient();
  const [formOpen, setFormOpen] = useState(false);
  const [editingZone, setEditingZone] = useState<Zone | undefined>();
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 250);
  const [deleteTarget, setDeleteTarget] = useState<Zone | null>(null);

  const { data: zones, isLoading } = useQuery({ queryKey: ["zones"], queryFn: zonesApi.list });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => zonesApi.delete(id),
    onSuccess: () => {
      toast({ title: "تم حذف المنطقة" });
      qc.invalidateQueries({ queryKey: ["zones"] });
      setDeleteTarget(null);
    },
    onError: (e: any) => toast({ title: "خطأ", description: e.message, variant: "destructive" }),
  });

  const filteredZones = useMemo(() => {
    if (!zones) return [];
    const q = debouncedSearch.toLowerCase().trim();
    if (!q) return zones;
    return zones.filter(z => z.name.toLowerCase().includes(q) || z.notes?.toLowerCase().includes(q));
  }, [zones, debouncedSearch]);

  return (
    <div dir="rtl" className="p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="relative overflow-hidden rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/10 via-background to-background p-6 shadow-lg">
        <div className="absolute -top-16 -left-16 h-48 w-48 rounded-full bg-primary/20 blur-3xl" />
        <div className="relative flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/15 text-primary shadow-inner">
              <MapPin className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold">المحافظة</h1>
              <p className="text-sm text-muted-foreground">إدارة قائمة المحافظات المستخدمة في الطلبات والشحن — لتحليلات المحافظات الذكية راجع صفحة "التحليل الذكي"</p>
            </div>
          </div>
          {canEdit && (
            <Button onClick={() => { setEditingZone(undefined); setFormOpen(true); }} className="gap-2 shadow-md shadow-primary/20">
              <Plus className="h-4 w-4" /> إضافة محافظة
            </Button>
          )}
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="بحث عن منطقة..."
          className="pr-9 h-9 text-sm"
        />
        {search && (
          <button onClick={() => setSearch("")} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Grid */}
      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground text-sm">جاري التحميل...</div>
      ) : filteredZones.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center text-muted-foreground text-sm">
            {search ? "لا توجد نتائج مطابقة" : "لا توجد مناطق بعد. أضف أول منطقة."}
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredZones.map(zone => (
            <Card key={zone.id} className="group relative overflow-hidden border-border/60 hover:border-primary/40 transition-colors shadow-sm hover:shadow-lg hover:shadow-primary/10">
              <div className="absolute -top-8 -left-8 h-24 w-24 rounded-full bg-primary/5 group-hover:bg-primary/10 blur-2xl transition-colors" />
              <CardContent className="relative p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <MapPin className="h-4 w-4" />
                    </div>
                    <h3 className="font-semibold text-sm">{zone.name}</h3>
                  </div>
                  {canEdit && (
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => { setEditingZone(zone); setFormOpen(true); }}>
                        <Edit2 className="h-3.5 w-3.5" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => setDeleteTarget(zone)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  )}
                </div>
                {zone.notes && <p className="text-xs text-muted-foreground line-clamp-2">{zone.notes}</p>}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <ZoneFormDialog open={formOpen} onClose={() => setFormOpen(false)} existing={editingZone} />

      <Dialog open={!!deleteTarget} onOpenChange={v => !v && setDeleteTarget(null)}>
        <DialogContent className="max-w-sm" dir="rtl">
          <DialogHeader><DialogTitle>حذف المنطقة</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">
            هل أنت متأكد من حذف منطقة "{deleteTarget?.name}"؟ هذا الإجراء لا يمكن التراجع عنه.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)} className="text-xs h-8">إلغاء</Button>
            <Button
              variant="destructive"
              disabled={deleteMutation.isPending}
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
              className="text-xs h-8"
            >
              {deleteMutation.isPending ? "جاري الحذف..." : "حذف"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
