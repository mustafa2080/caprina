import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, MapPin, Edit2, Trash2, Search, X, RefreshCw, RotateCcw, TrendingUp, TrendingDown, AlertTriangle, Package, ChevronLeft } from "lucide-react";
import { PieChart, Pie, Sector, ResponsiveContainer, Cell } from "recharts";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { zonesApi, type Zone, type ZoneInsight, type ZoneReturnReasonItem } from "@/lib/api";
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

// ══════════════════════════════════════════════════════════════════════════
// ─── Zones Analytics (تحليلات المناطق الذكية) ───────────────────────────────
// ══════════════════════════════════════════════════════════════════════════

const fc = (n: number) =>
  new Intl.NumberFormat("ar-EG", { style: "currency", currency: "EGP", maximumFractionDigits: 0 }).format(n);
const fn = (n: number) => new Intl.NumberFormat("ar-EG").format(Math.round(n));

const REASON_DONUT_COLORS = [
  "#f43f5e", "#f59e0b", "#3b82f6", "#10b981", "#8b5cf6",
  "#06b6d4", "#ec4899", "#84cc16", "#f97316", "#64748b",
];

function ReasonActiveShape(props: any) {
  const { cx, cy, innerRadius, outerRadius, startAngle, endAngle, fill, payload, percent, value } = props;
  return (
    <g tabIndex={-1} style={{ outline: "none" }}>
      <Sector cx={cx} cy={cy} innerRadius={outerRadius + 5} outerRadius={outerRadius + 9} startAngle={startAngle} endAngle={endAngle} fill={fill} opacity={0.2} cornerRadius={6} />
      <Sector cx={cx} cy={cy} innerRadius={innerRadius - 4} outerRadius={outerRadius + 7} startAngle={startAngle} endAngle={endAngle} fill={fill} cornerRadius={6} tabIndex={-1} style={{ outline: "none" }} />
      <text x={cx} y={cy - 14} textAnchor="middle" fill="hsl(var(--foreground))" fontSize={26} fontWeight={900} style={{ pointerEvents: "none", userSelect: "none" }}>{value}</text>
      <text x={cx} y={cy + 10} textAnchor="middle" fill="hsl(var(--muted-foreground))" fontSize={10} style={{ pointerEvents: "none", userSelect: "none" }}>
        <tspan x={cx}>{String(payload.label).length > 18 ? String(payload.label).slice(0, 18) + "…" : payload.label}</tspan>
      </text>
      <text x={cx} y={cy + 26} textAnchor="middle" fill={fill} fontSize={14} fontWeight={800} style={{ pointerEvents: "none", userSelect: "none" }}>{`${(percent * 100).toFixed(0)}%`}</text>
    </g>
  );
}

// دونات عام قابل لإعادة الاستخدام: شامل كل المناطق أو خاص بمنطقة واحدة
function ReasonsDonut({ items, total, centerLabel }: { items: ZoneReturnReasonItem[]; total: number; centerLabel: string }) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [selected, setSelected] = useState<string | null>(null);

  const colored = useMemo(() => items.map((r, i) => ({ ...r, color: REASON_DONUT_COLORS[i % REASON_DONUT_COLORS.length] })), [items]);

  return (
    <div className="space-y-5">
      <div className="relative" style={{ height: 240 }}>
        {activeIndex === null && (
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none z-10">
            <p className="text-4xl font-black text-foreground leading-none">{fn(total)}</p>
            <p className="text-xs text-muted-foreground mt-1">{centerLabel}</p>
          </div>
        )}
        <ResponsiveContainer width="100%" height="100%">
          <PieChart tabIndex={-1} style={{ outline: "none" }}>
            <Pie
              data={colored} cx="50%" cy="50%" innerRadius="52%" outerRadius="78%" paddingAngle={3}
              dataKey="count" nameKey="label" stroke="none" cornerRadius={5} startAngle={90} endAngle={-270}
              labelLine={false} activeIndex={activeIndex ?? undefined} activeShape={ReasonActiveShape}
              animationBegin={0} animationDuration={600} animationEasing="ease-out"
              onMouseEnter={(_, index) => setActiveIndex(index)} onMouseLeave={() => setActiveIndex(null)}
              onClick={(entry: any) => setSelected(v => v === entry.reason ? null : entry.reason)}
              style={{ cursor: "pointer", outline: "none" }}
            >
              {colored.map((d, i) => <Cell key={i} fill={d.color} opacity={selected && selected !== d.reason ? 0.35 : 1} />)}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
      </div>

      <div className="flex flex-col gap-1.5 max-h-72 overflow-y-auto pr-1">
        {colored.map((item) => {
          const isSelected = selected === item.reason;
          return (
            <button
              key={item.reason} type="button"
              onClick={() => setSelected(v => v === item.reason ? null : item.reason)}
              className="w-full flex items-center gap-3 rounded-lg px-2 py-1 transition-all text-right"
              style={{ background: isSelected ? item.color + "1a" : "transparent", border: isSelected ? `1px solid ${item.color}55` : "1px solid transparent" }}
            >
              <span className="w-3 h-3 rounded-full shrink-0" style={{ background: item.color }} />
              <span className="text-xs font-semibold text-foreground flex-1 truncate" title={item.label}>{item.label}</span>
              <span className="text-xs font-bold px-2 py-0.5 rounded-md shrink-0" style={{ background: item.color + "1a", color: item.color }}>{item.count}</span>
              <span className="text-xs font-black w-9 text-right shrink-0" style={{ color: item.color }}>{item.pct}%</span>
            </button>
          );
        })}
        {colored.length === 0 && (
          <div className="text-center py-6 text-muted-foreground text-xs">
            <RotateCcw className="w-6 h-6 mx-auto mb-2 opacity-30" />
            لا توجد مرتجعات مسجلة
          </div>
        )}
      </div>
    </div>
  );
}

// ─── رسالة تحليلية ذكية مبنية على أعلى سبب مرتجع في المنطقة ─────────────────
const REASON_SMART_ADVICE: Record<string, string> = {
  no_answer: "نسبة كبيرة من العملاء هنا ما بيردوش. جرّب تأكيد الطلب بمكالمة أو رسالة واتساب قبل الشحن مباشرة.",
  unavailable: "العميل بيبقى مغلق أو مش متاح وقت التوصيل. اتفق مع المندوب على ميعاد بديل أو اتصل قبل التوصيل بساعة.",
  postponed: "طلبات كتير بتتأجل من العميل نفسه. حاول تحدد ميعاد التسليم مع العميل من البداية بدل ما يتفاجئ.",
  no_knowledge: "العميل مش عارف إن فيه شحنة جايله. تأكد إن رسالة التأكيد بعد الطلب بتوصل فعليًا (واتساب/SMS).",
  cancel_request: "نسبة إلغاء عالية من العميل نفسه بعد الطلب. راجع وضوح السعر والمواصفات وقت البيع.",
  refused_paid: "العميل بيرفض بعد ما يشوف المنتج وبيدفع مصاريف الشحن. المشكلة غالبًا في المنتج نفسه أو الوصف — راجع الصور والمواصفات.",
  refused_unpaid: "رفض استلام مرتفع بدون دفع مصاريف الشحن، يعني في احتمال طلبات وهمية أو عدم جدية. فكّر في تفعيل تأكيد مسبق بالدفع الجزئي.",
  damaged: "نسبة شحنات تالفة عالية في المنطقة دي. راجع التغليف أو شركة الشحن المسؤولة عن التوصيل هنا.",
  unclear_address: "عناوين غير واضحة بتسبب مرتجعات. اطلب من فريق البيع تأكيد العنوان بالتفصيل وقت تسجيل الطلب.",
  out_of_coverage: "المنطقة دي فيها عناوين خارج نطاق التغطية الفعلي لشركة الشحن. فكّر تغيّر شركة الشحن لهذه المنطقة أو توضح حدود التغطية.",
  time_mismatch: "توقيت المندوب مش مناسب لعملاء المنطقة دي. جرّب تنسيق مواعيد توصيل بديلة (مساءً مثلاً).",
  other: "أغلب المرتجعات هنا بسبب غير مصنف. راجع ملاحظات المرتجعات يدويًا لفهم السبب الحقيقي.",
};

function zoneSmartAdvice(zone: ZoneInsight): string {
  if (zone.returnedCount === 0) return "لا توجد مرتجعات مسجلة في هذه المنطقة حتى الآن. أداء ممتاز، استمر في نفس الأسلوب.";
  if (!zone.topReason) return "توجد مرتجعات لكن بدون سبب محدد. تأكد إن فريق الشحن بيسجل سبب المرتجع دايمًا.";
  const advice = REASON_SMART_ADVICE[zone.topReason.reason];
  if (advice) return advice;
  return `أعلى سبب مرتجع هنا هو "${zone.topReason.label}" بنسبة ${zone.topReason.pct}%. راجع تفاصيل هذا السبب لتحسين الأداء.`;
}

function zoneVerdict(zone: ZoneInsight): { label: string; color: string; icon: React.ElementType } {
  if (zone.closedCount < 3) return { label: "بيانات غير كافية", color: "text-muted-foreground", icon: Package };
  if (zone.returnRate >= 40) return { label: "ركّز هنا — مرتجعات عالية جدًا", color: "text-red-600 dark:text-red-400", icon: AlertTriangle };
  if (zone.returnRate >= 20) return { label: "راقب هذه المنطقة", color: "text-amber-600 dark:text-amber-400", icon: TrendingDown };
  return { label: "أداء جيد", color: "text-emerald-600 dark:text-emerald-400", icon: TrendingUp };
}

// ─── كارت ملخص منطقة في القايمة المرتبة ─────────────────────────────────────
function ZoneSummaryCard({ zone, onOpen }: { zone: ZoneInsight; onOpen: () => void }) {
  const verdict = zoneVerdict(zone);
  const VerdictIcon = verdict.icon;
  return (
    <button
      type="button"
      onClick={onOpen}
      className="w-full text-right p-4 rounded-xl border border-border/60 hover:border-primary/40 bg-card hover:shadow-md hover:shadow-primary/5 transition-all group"
    >
      <div className="flex items-center justify-between gap-3 mb-3">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
            <MapPin className="w-4 h-4" />
          </div>
          <h3 className="font-bold text-sm truncate">{zone.zoneName}</h3>
        </div>
        <ChevronLeft className="w-4 h-4 text-muted-foreground shrink-0 group-hover:-translate-x-1 transition-transform" />
      </div>

      <div className={`flex items-center gap-1.5 mb-3 text-xs font-bold ${verdict.color}`}>
        <VerdictIcon className="w-3.5 h-3.5" />
        {verdict.label}
      </div>

      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="rounded-lg bg-muted/40 py-2">
          <p className="text-[10px] text-muted-foreground mb-0.5">الإيراد</p>
          <p className="text-xs font-black">{fc(zone.revenue)}</p>
        </div>
        <div className="rounded-lg bg-emerald-50 dark:bg-emerald-900/20 py-2">
          <p className="text-[10px] text-muted-foreground mb-0.5">نسبة التسليم</p>
          <p className="text-xs font-black text-emerald-600 dark:text-emerald-400">{zone.deliveryRate}%</p>
        </div>
        <div className="rounded-lg bg-red-50 dark:bg-red-900/20 py-2">
          <p className="text-[10px] text-muted-foreground mb-0.5">نسبة المرتجعات</p>
          <p className="text-xs font-black text-red-600 dark:text-red-400">{zone.returnRate}%</p>
        </div>
      </div>
    </button>
  );
}

// ─── تفاصيل منطقة واحدة (دونات + رسالة ذكية) ────────────────────────────────
function ZoneDetailView({ zone, onBack }: { zone: ZoneInsight; onBack: () => void }) {
  const verdict = zoneVerdict(zone);
  const VerdictIcon = verdict.icon;
  return (
    <div className="space-y-5">
      <button onClick={onBack} className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors">
        <ChevronLeft className="w-3.5 h-3.5 rotate-180" /> رجوع لكل المناطق
      </button>

      <div className="flex flex-wrap items-center gap-3 justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
            <MapPin className="w-5 h-5" />
          </div>
          <div>
            <h2 className="font-black text-base">{zone.zoneName}</h2>
            <p className="text-xs text-muted-foreground">{fn(zone.ordersCount)} طلب إجمالاً</p>
          </div>
        </div>
        <Badge className={`gap-1.5 border-0 font-bold text-xs px-3 py-1.5 ${verdict.color} bg-current/10`}>
          <VerdictIcon className="w-3.5 h-3.5" /> {verdict.label}
        </Badge>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="rounded-xl border border-border/60 bg-card p-3 text-center">
          <p className="text-[10px] text-muted-foreground mb-1">الإيراد</p>
          <p className="text-sm font-black">{fc(zone.revenue)}</p>
        </div>
        <div className="rounded-xl border border-emerald-200 dark:border-emerald-800/50 bg-emerald-50 dark:bg-emerald-900/20 p-3 text-center">
          <p className="text-[10px] text-muted-foreground mb-1">نسبة التسليم</p>
          <p className="text-sm font-black text-emerald-600 dark:text-emerald-400">{zone.deliveryRate}%</p>
        </div>
        <div className="rounded-xl border border-red-200 dark:border-red-800/50 bg-red-50 dark:bg-red-900/20 p-3 text-center">
          <p className="text-[10px] text-muted-foreground mb-1">نسبة المرتجعات</p>
          <p className="text-sm font-black text-red-600 dark:text-red-400">{zone.returnRate}%</p>
        </div>
        <div className="rounded-xl border border-border/60 bg-card p-3 text-center">
          <p className="text-[10px] text-muted-foreground mb-1">عدد المرتجعات</p>
          <p className="text-sm font-black">{fn(zone.returnedCount)}</p>
        </div>
      </div>

      {/* رسالة تحليلية ذكية */}
      <div className={`flex items-start gap-3 rounded-xl border p-4 ${verdict.color} bg-current/5 border-current/20`}>
        <VerdictIcon className="w-5 h-5 shrink-0 mt-0.5" />
        <p className="text-xs font-semibold leading-relaxed text-foreground">{zoneSmartAdvice(zone)}</p>
      </div>

      {/* دونات أسباب المرتجعات */}
      <div>
        <h3 className="font-black text-sm mb-4 flex items-center gap-2">
          <RotateCcw className="w-4 h-4 text-red-600 dark:text-red-400" /> أسباب المرتجعات في {zone.zoneName}
        </h3>
        <ReasonsDonut items={zone.byReason} total={zone.returnedCount} centerLabel="إجمالي المرتجعات" />
      </div>
    </div>
  );
}

function ZonesAnalyticsTab() {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [selectedZoneId, setSelectedZoneId] = useState<number | null | undefined>(undefined); // undefined = لسه محددش

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ["zones-insights", from, to],
    queryFn: () => zonesApi.insights({ from: from || undefined, to: to || undefined }),
  });

  const selectedZone = useMemo(() => {
    if (selectedZoneId === undefined || !data) return null;
    return data.zones.find(z => z.zoneId === selectedZoneId) ?? null;
  }, [selectedZoneId, data]);

  if (isLoading) {
    return <div className="text-center py-12 text-muted-foreground text-sm">جاري تحميل التحليلات...</div>;
  }

  if (!data) return null;

  return (
    <div className="space-y-6">
      {/* فلتر التاريخ */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex items-center gap-1.5 text-sm bg-card border border-border rounded-xl px-3 py-2">
          <span className="text-muted-foreground text-xs">من</span>
          <input type="date" className="bg-transparent text-sm outline-none w-32" value={from} onChange={e => setFrom(e.target.value)} />
          <span className="text-muted-foreground text-xs">إلى</span>
          <input type="date" className="bg-transparent text-sm outline-none w-32" value={to} onChange={e => setTo(e.target.value)} />
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching} className="gap-1.5 h-9">
          <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? "animate-spin" : ""}`} /> تحديث
        </Button>
      </div>

      {selectedZone ? (
        <ZoneDetailView zone={selectedZone} onBack={() => setSelectedZoneId(undefined)} />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* دونات شامل لكل المناطق */}
          <div>
            <h3 className="font-black text-sm mb-4 flex items-center gap-2">
              <RotateCcw className="w-4 h-4 text-red-600 dark:text-red-400" /> أسباب المرتجعات — كل المناطق
            </h3>
            <ReasonsDonut items={data.overall.byReason} total={data.overall.returnedCount} centerLabel="إجمالي المرتجعات" />
          </div>

          {/* قايمة المناطق مرتبة من الأسوأ للأفضل */}
          <div>
            <h3 className="font-black text-sm mb-4 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400" /> المناطق (الأعلى مرتجعًا أولاً)
            </h3>
            <div className="space-y-2.5 max-h-[560px] overflow-y-auto pr-1">
              {data.zones.length === 0 ? (
                <div className="text-center py-10 text-muted-foreground text-xs">لا توجد بيانات كافية بعد</div>
              ) : (
                data.zones.map(zone => (
                  <ZoneSummaryCard key={zone.zoneId ?? "__none__"} zone={zone} onOpen={() => setSelectedZoneId(zone.zoneId)} />
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
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
              <h1 className="text-xl font-bold">المناطق</h1>
              <p className="text-sm text-muted-foreground">تصنيف إضافي للطلبات، مستقل عن المحافظة</p>
            </div>
          </div>
          {canEdit && (
            <Button onClick={() => { setEditingZone(undefined); setFormOpen(true); }} className="gap-2 shadow-md shadow-primary/20">
              <Plus className="h-4 w-4" /> إضافة منطقة
            </Button>
          )}
        </div>
      </div>

      {/* Tabs: نظرة عامة / التحليلات الذكية */}
      <Tabs defaultValue="overview" dir="rtl">
        <TabsList>
          <TabsTrigger value="overview" className="gap-1.5"><MapPin className="w-3.5 h-3.5" /> نظرة عامة</TabsTrigger>
          <TabsTrigger value="analytics" className="gap-1.5"><RotateCcw className="w-3.5 h-3.5" /> تحليلات المناطق</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6 mt-4">
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
        </TabsContent>

        <TabsContent value="analytics" className="mt-4">
          <ZonesAnalyticsTab />
        </TabsContent>
      </Tabs>

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
