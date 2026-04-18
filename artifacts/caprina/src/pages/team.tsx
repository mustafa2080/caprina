import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Users, Plus, Edit2, Trash2, Target, FileText, ChevronRight, Check, X,
  TrendingUp, TrendingDown, Printer, Star, AlertCircle, Trophy, Briefcase,
  DollarSign, Calendar, BarChart2, Settings, ArrowLeft,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { employeeApi, usersApi, type EmployeeProfile, type EmployeeKpi, type EmployeeReport, type AppUser } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";

const fmt = (n: number) =>
  new Intl.NumberFormat("ar-EG", { style: "currency", currency: "EGP", maximumFractionDigits: 0 }).format(n);
const fmtNum = (n: number) => new Intl.NumberFormat("ar-EG").format(n);

const METRIC_OPTIONS = [
  { value: "delivery_rate", label: "نسبة التسليم", unit: "%", direction: "higher_is_better", defaultTarget: 80 },
  { value: "return_rate", label: "نسبة المرتجعات", unit: "%", direction: "lower_is_better", defaultTarget: 20 },
  { value: "total_orders", label: "عدد الطلبيات", unit: "طلب", direction: "higher_is_better", defaultTarget: 50 },
  { value: "profit", label: "الربح المحقق", unit: "ج.م", direction: "higher_is_better", defaultTarget: 5000 },
  { value: "revenue", label: "الإيرادات", unit: "ج.م", direction: "higher_is_better", defaultTarget: 10000 },
  { value: "manual", label: "مؤشر مخصص (يدوي)", unit: "", direction: "higher_is_better", defaultTarget: 100 },
];

const RATING_CONFIG: Record<string, { color: string; bg: string; label: string }> = {
  ممتاز: { color: "text-emerald-400", bg: "bg-emerald-900/30", label: "ممتاز ⭐" },
  "جيد جداً": { color: "text-blue-400", bg: "bg-blue-900/30", label: "جيد جداً 👍" },
  جيد: { color: "text-primary", bg: "bg-primary/10", label: "جيد 👌" },
  مقبول: { color: "text-amber-400", bg: "bg-amber-900/20", label: "مقبول ⚠️" },
  ضعيف: { color: "text-red-400", bg: "bg-red-900/20", label: "ضعيف ❌" },
  "غير محدد": { color: "text-muted-foreground", bg: "bg-muted/20", label: "غير محدد" },
};

// ─── Profile Form Dialog ──────────────────────────────────────────────────────
function ProfileFormDialog({
  open, onClose, user, existing,
}: {
  open: boolean; onClose: () => void; user: AppUser; existing: EmployeeProfile | null;
}) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [jobTitle, setJobTitle] = useState(existing?.jobTitle ?? "");
  const [department, setDepartment] = useState(existing?.department ?? "");
  const [monthlySalary, setMonthlySalary] = useState(existing?.monthlySalary?.toString() ?? "0");
  const [hireDate, setHireDate] = useState(existing?.hireDate ?? "");
  const [notes, setNotes] = useState(existing?.notes ?? "");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await employeeApi.upsertProfile({
        userId: user.id,
        jobTitle: jobTitle || null,
        department: department || null,
        monthlySalary: parseFloat(monthlySalary) || 0,
        hireDate: hireDate || null,
        notes: notes || null,
      });
      qc.invalidateQueries({ queryKey: ["employee-profiles"] });
      toast({ title: "تم حفظ بيانات الموظف" });
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
        <DialogHeader><DialogTitle>بيانات الموظف: {user.displayName}</DialogTitle></DialogHeader>
        <div className="space-y-3 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">المسمى الوظيفي</Label>
              <Input value={jobTitle} onChange={e => setJobTitle(e.target.value)} placeholder="مندوب مبيعات" className="h-8 text-xs" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">القسم</Label>
              <Input value={department} onChange={e => setDepartment(e.target.value)} placeholder="المبيعات" className="h-8 text-xs" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">الراتب الشهري (ج.م)</Label>
              <Input type="number" min="0" value={monthlySalary} onChange={e => setMonthlySalary(e.target.value)} className="h-8 text-xs" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">تاريخ التعيين</Label>
              <Input type="date" value={hireDate} onChange={e => setHireDate(e.target.value)} className="h-8 text-xs" />
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">ملاحظات</Label>
            <Textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="..." className="min-h-[50px] text-xs resize-none" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} className="text-xs h-7">إلغاء</Button>
          <Button onClick={handleSave} disabled={saving} className="text-xs h-7">{saving ? "جاري الحفظ..." : "حفظ"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── KPI Form Dialog ──────────────────────────────────────────────────────────
function KpiFormDialog({
  open, onClose, userId, existing,
}: {
  open: boolean; onClose: () => void; userId: number; existing?: EmployeeKpi;
}) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [name, setName] = useState(existing?.name ?? "");
  const [metric, setMetric] = useState(existing?.metric ?? "delivery_rate");
  const [targetValue, setTargetValue] = useState(existing?.targetValue?.toString() ?? "80");
  const [unit, setUnit] = useState(existing?.unit ?? "%");
  const [direction, setDirection] = useState<"higher_is_better" | "lower_is_better">(
    existing?.direction ?? "higher_is_better"
  );
  const [weight, setWeight] = useState(existing?.weight?.toString() ?? "100");
  const [description, setDescription] = useState(existing?.description ?? "");
  const [isActive, setIsActive] = useState(existing?.isActive ?? true);
  const [saving, setSaving] = useState(false);

  const handleMetricChange = (m: string) => {
    setMetric(m);
    const preset = METRIC_OPTIONS.find(o => o.value === m);
    if (preset && !existing) {
      setName(preset.label);
      setUnit(preset.unit);
      setDirection(preset.direction as any);
      setTargetValue(preset.defaultTarget.toString());
    }
  };

  const handleSave = async () => {
    if (!name.trim()) { toast({ title: "اسم المؤشر مطلوب", variant: "destructive" }); return; }
    setSaving(true);
    try {
      if (existing) {
        await employeeApi.updateKpi(existing.id, {
          name, metric, targetValue: parseFloat(targetValue), unit,
          direction, weight: parseFloat(weight), isActive, description: description || null,
        });
        toast({ title: "تم تحديث المؤشر" });
      } else {
        await employeeApi.createKpi({
          userId, name, metric, targetValue: parseFloat(targetValue), unit,
          direction, weight: parseFloat(weight), isActive, description: description || null,
        });
        toast({ title: "تم إضافة المؤشر" });
      }
      qc.invalidateQueries({ queryKey: ["employee-kpis", userId] });
      qc.invalidateQueries({ queryKey: ["employee-report", userId] });
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
        <DialogHeader><DialogTitle>{existing ? "تعديل المؤشر" : "إضافة مؤشر أداء"}</DialogTitle></DialogHeader>
        <div className="space-y-3 py-2">
          <div className="space-y-1">
            <Label className="text-xs">نوع المؤشر</Label>
            <Select value={metric} onValueChange={handleMetricChange}>
              <SelectTrigger className="h-8 text-xs bg-card"><SelectValue /></SelectTrigger>
              <SelectContent>
                {METRIC_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">اسم المؤشر *</Label>
            <Input value={name} onChange={e => setName(e.target.value)} className="h-8 text-xs" />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div className="space-y-1">
              <Label className="text-xs">الهدف *</Label>
              <Input type="number" value={targetValue} onChange={e => setTargetValue(e.target.value)} className="h-8 text-xs" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">الوحدة</Label>
              <Input value={unit} onChange={e => setUnit(e.target.value)} placeholder="%" className="h-8 text-xs" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">الوزن (%)</Label>
              <Input type="number" min="0" max="100" value={weight} onChange={e => setWeight(e.target.value)} className="h-8 text-xs" />
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">الاتجاه</Label>
            <Select value={direction} onValueChange={v => setDirection(v as any)}>
              <SelectTrigger className="h-8 text-xs bg-card"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="higher_is_better">↑ كلما زاد كلما كان أفضل</SelectItem>
                <SelectItem value="lower_is_better">↓ كلما قلّ كلما كان أفضل</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">وصف (اختياري)</Label>
            <Input value={description} onChange={e => setDescription(e.target.value)} placeholder="..." className="h-8 text-xs" />
          </div>
          <div className="flex items-center justify-between">
            <Label className="text-xs">مؤشر نشط</Label>
            <Switch checked={isActive} onCheckedChange={setIsActive} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} className="text-xs h-7">إلغاء</Button>
          <Button onClick={handleSave} disabled={saving} className="text-xs h-7">{saving ? "جاري الحفظ..." : "حفظ"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Monthly Report ───────────────────────────────────────────────────────────
function MonthlyReport({ report }: { report: EmployeeReport }) {
  const printRef = useRef<HTMLDivElement>(null);
  const ratingCfg = RATING_CONFIG[report.rating] ?? RATING_CONFIG["غير محدد"];

  const handlePrint = () => {
    const content = printRef.current;
    if (!content) return;
    const printWindow = window.open("", "_blank", "width=900,height=700");
    if (!printWindow) return;
    printWindow.document.write(`
      <!DOCTYPE html><html dir="rtl" lang="ar">
      <head>
        <meta charset="UTF-8" />
        <title>تقرير الأداء - ${report.displayName}</title>
        <style>
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body { font-family: 'Segoe UI', Tahoma, Arial, sans-serif; background: white; color: #1a1a1a; direction: rtl; font-size: 13px; }
          .report { max-width: 800px; margin: 20px auto; padding: 30px; }
          .header { border-bottom: 3px solid #c9a227; padding-bottom: 16px; margin-bottom: 20px; display: flex; justify-content: space-between; align-items: flex-start; }
          .brand { font-size: 22px; font-weight: 900; color: #c9a227; }
          .title { font-size: 14px; color: #666; margin-top: 4px; }
          .employee-info { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 20px; }
          .info-card { background: #f8f8f8; border-radius: 8px; padding: 12px; }
          .info-card h3 { font-size: 11px; color: #888; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px; }
          .info-row { display: flex; justify-content: space-between; font-size: 12px; margin-bottom: 4px; }
          .info-label { color: #666; }
          .info-value { font-weight: 600; }
          .stats-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin-bottom: 20px; }
          .stat-box { background: #f8f8f8; border-radius: 8px; padding: 10px; text-align: center; }
          .stat-value { font-size: 18px; font-weight: 800; }
          .stat-label { font-size: 10px; color: #888; margin-top: 2px; }
          .delivered { color: #16a34a; }
          .returned { color: #dc2626; }
          .pending { color: #d97706; }
          .kpis-table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
          .kpis-table th { background: #c9a227; color: white; padding: 8px 12px; text-align: right; font-size: 11px; }
          .kpis-table td { padding: 8px 12px; border-bottom: 1px solid #eee; font-size: 12px; }
          .kpis-table tr:nth-child(even) td { background: #fafafa; }
          .score-bar { width: 80px; height: 6px; background: #eee; border-radius: 3px; display: inline-block; vertical-align: middle; margin-left: 6px; }
          .score-fill { height: 100%; border-radius: 3px; }
          .achieved-yes { color: #16a34a; font-weight: 700; }
          .achieved-no { color: #dc2626; font-weight: 700; }
          .overall { background: #fef9e7; border: 2px solid #c9a227; border-radius: 8px; padding: 16px; margin-bottom: 20px; display: flex; justify-content: space-between; align-items: center; }
          .score-big { font-size: 36px; font-weight: 900; color: #c9a227; }
          .rating-badge { font-size: 18px; font-weight: 800; }
          .salary-section { background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 12px; }
          .footer { text-align: center; font-size: 10px; color: #aaa; margin-top: 24px; border-top: 1px solid #eee; padding-top: 12px; }
          @media print { @page { size: A4; margin: 15mm; } .report { margin: 0; padding: 0; max-width: 100%; } }
        </style>
      </head>
      <body>${content.innerHTML}</body></html>
    `);
    printWindow.document.close();
    setTimeout(() => { printWindow.print(); printWindow.close(); }, 500);
  };

  const [yearStr, monthStr] = report.period.month.split("-");
  const periodLabel = new Date(parseInt(yearStr), parseInt(monthStr) - 1, 1)
    .toLocaleDateString("ar-EG", { month: "long", year: "numeric" });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-end">
        <Button onClick={handlePrint} className="gap-2 h-8 text-xs bg-primary">
          <Printer className="w-3.5 h-3.5" />طباعة التقرير
        </Button>
      </div>

      <div ref={printRef}>
        <div className="report" style={{ direction: "rtl", fontFamily: "'Segoe UI', Tahoma, Arial, sans-serif", color: "#1a1a1a" }}>

          {/* Header */}
          <div className="header" style={{ borderBottom: "3px solid #c9a227", paddingBottom: 16, marginBottom: 20, display: "flex", justifyContent: "space-between" }}>
            <div>
              <div className="brand" style={{ fontSize: 22, fontWeight: 900, color: "#c9a227" }}>CAPRINA</div>
              <div className="title" style={{ fontSize: 13, color: "#666" }}>تقرير أداء موظف — {periodLabel}</div>
            </div>
            <div style={{ textAlign: "left", fontSize: 12, color: "#666" }}>
              <div>تاريخ الإصدار: {new Date().toLocaleDateString("ar-EG")}</div>
              {report.profile?.department && <div>القسم: {report.profile.department}</div>}
            </div>
          </div>

          {/* Employee Info */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 20 }}>
            <div style={{ background: "#f8f8f8", borderRadius: 8, padding: 12 }}>
              <h3 style={{ fontSize: 10, color: "#888", textTransform: "uppercase", marginBottom: 8 }}>بيانات الموظف</h3>
              {[
                ["الاسم", report.displayName],
                ["المسمى الوظيفي", report.profile?.jobTitle || "—"],
                ["القسم", report.profile?.department || "—"],
                ["تاريخ التعيين", report.profile?.hireDate ? new Date(report.profile.hireDate).toLocaleDateString("ar-EG") : "—"],
              ].map(([label, value]) => (
                <div key={label} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4 }}>
                  <span style={{ color: "#666" }}>{label}</span>
                  <span style={{ fontWeight: 600 }}>{value}</span>
                </div>
              ))}
            </div>
            <div style={{ background: "#f8f8f8", borderRadius: 8, padding: 12 }}>
              <h3 style={{ fontSize: 10, color: "#888", textTransform: "uppercase", marginBottom: 8 }}>فترة التقرير</h3>
              {[
                ["الشهر", periodLabel],
                ["من", new Date(report.period.from).toLocaleDateString("ar-EG")],
                ["إلى", new Date(report.period.to).toLocaleDateString("ar-EG")],
                ["إجمالي الطلبيات", fmtNum(report.orderStats.total)],
              ].map(([label, value]) => (
                <div key={label} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4 }}>
                  <span style={{ color: "#666" }}>{label}</span>
                  <span style={{ fontWeight: 600 }}>{value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Order Stats */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8, marginBottom: 20 }}>
            {[
              { label: "إجمالي الطلبيات", value: fmtNum(report.orderStats.total), color: "#1a1a1a" },
              { label: "مُسلَّم", value: fmtNum(report.orderStats.delivered), color: "#16a34a" },
              { label: "مُرتجَع", value: fmtNum(report.orderStats.returned), color: "#dc2626" },
              { label: "نسبة التسليم", value: `${report.orderStats.deliveryRate}%`, color: "#c9a227" },
            ].map(s => (
              <div key={s.label} style={{ background: "#f8f8f8", borderRadius: 8, padding: 10, textAlign: "center" }}>
                <div style={{ fontSize: 20, fontWeight: 800, color: s.color }}>{s.value}</div>
                <div style={{ fontSize: 10, color: "#888" }}>{s.label}</div>
              </div>
            ))}
          </div>

          {/* KPIs Table */}
          {report.kpis.length > 0 && (
            <div style={{ marginBottom: 20 }}>
              <h3 style={{ fontSize: 13, fontWeight: 700, marginBottom: 8, borderRight: "3px solid #c9a227", paddingRight: 8 }}>مؤشرات الأداء الرئيسية</h3>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    {["المؤشر", "الهدف", "الفعلي", "الدرجة", "الحالة"].map(h => (
                      <th key={h} style={{ background: "#c9a227", color: "white", padding: "8px 10px", textAlign: "right", fontSize: 11 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {report.kpis.map((kpi, i) => (
                    <tr key={kpi.id}>
                      <td style={{ padding: "8px 10px", borderBottom: "1px solid #eee", background: i % 2 === 0 ? "white" : "#fafafa", fontSize: 12, fontWeight: 600 }}>
                        {kpi.name}
                        {kpi.description && <div style={{ fontSize: 10, color: "#888", fontWeight: 400 }}>{kpi.description}</div>}
                      </td>
                      <td style={{ padding: "8px 10px", borderBottom: "1px solid #eee", background: i % 2 === 0 ? "white" : "#fafafa", fontSize: 12 }}>
                        {kpi.direction === "lower_is_better" ? "≤" : "≥"}{fmtNum(kpi.targetValue)} {kpi.unit}
                      </td>
                      <td style={{ padding: "8px 10px", borderBottom: "1px solid #eee", background: i % 2 === 0 ? "white" : "#fafafa", fontSize: 12, fontWeight: 700 }}>
                        {kpi.actualValue !== null ? `${fmtNum(kpi.actualValue)} ${kpi.unit}` : "—"}
                      </td>
                      <td style={{ padding: "8px 10px", borderBottom: "1px solid #eee", background: i % 2 === 0 ? "white" : "#fafafa", fontSize: 12 }}>
                        {kpi.score !== null ? `${kpi.score}%` : "—"}
                      </td>
                      <td style={{ padding: "8px 10px", borderBottom: "1px solid #eee", background: i % 2 === 0 ? "white" : "#fafafa", fontSize: 12, fontWeight: 700, color: kpi.achieved ? "#16a34a" : kpi.achieved === false ? "#dc2626" : "#888" }}>
                        {kpi.achieved === true ? "✓ محقق" : kpi.achieved === false ? "✗ لم يتحقق" : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Overall Score */}
          <div style={{ background: "#fef9e7", border: "2px solid #c9a227", borderRadius: 8, padding: 16, marginBottom: 20, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <div style={{ fontSize: 12, color: "#888", marginBottom: 4 }}>التقييم الإجمالي</div>
              <div style={{ fontSize: 36, fontWeight: 900, color: "#c9a227" }}>
                {report.overallScore !== null ? `${report.overallScore}%` : "—"}
              </div>
            </div>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 20, fontWeight: 800 }}>{report.rating}</div>
              <div style={{ fontSize: 11, color: "#888", marginTop: 4 }}>
                {report.overallScore !== null
                  ? report.overallScore >= 90 ? "أداء استثنائي" : report.overallScore >= 75 ? "أداء فوق المتوسط" : report.overallScore >= 60 ? "أداء مقبول" : "يحتاج تحسين"
                  : "لا توجد مؤشرات"}
              </div>
            </div>
          </div>

          {/* Salary */}
          <div style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 8, padding: 12, marginBottom: 20 }}>
            <h3 style={{ fontSize: 11, color: "#888", marginBottom: 8 }}>الراتب الشهري</h3>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ fontSize: 12 }}>الراتب المستحق عن شهر {periodLabel}</span>
              <span style={{ fontSize: 20, fontWeight: 900, color: "#16a34a" }}>{fmt(report.salary)}</span>
            </div>
          </div>

          {/* Footer */}
          <div style={{ textAlign: "center", fontSize: 10, color: "#aaa", marginTop: 24, borderTop: "1px solid #eee", paddingTop: 12 }}>
            تقرير صادر من نظام CAPRINA لإدارة المبيعات — {new Date().toLocaleDateString("ar-EG", { year: "numeric", month: "long", day: "numeric" })}
          </div>

        </div>
      </div>
    </div>
  );
}

// ─── Employee Detail ──────────────────────────────────────────────────────────
function EmployeeDetail({
  user, profile, onBack,
}: {
  user: AppUser; profile: EmployeeProfile | null; onBack: () => void;
}) {
  const { isAdmin } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [profileOpen, setProfileOpen] = useState(false);
  const [kpiDialogOpen, setKpiDialogOpen] = useState(false);
  const [editingKpi, setEditingKpi] = useState<EmployeeKpi | undefined>();
  const [reportMonth, setReportMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });

  const { data: kpis = [], isLoading: kpisLoading } = useQuery({
    queryKey: ["employee-kpis", user.id],
    queryFn: () => employeeApi.listKpis(user.id),
  });

  const { data: report, isLoading: reportLoading } = useQuery({
    queryKey: ["employee-report", user.id, reportMonth],
    queryFn: () => employeeApi.getReport(user.id, reportMonth),
  });

  const deleteKpi = async (kpiId: number) => {
    if (!confirm("حذف هذا المؤشر؟")) return;
    try {
      await employeeApi.deleteKpi(kpiId);
      qc.invalidateQueries({ queryKey: ["employee-kpis", user.id] });
      qc.invalidateQueries({ queryKey: ["employee-report", user.id] });
      toast({ title: "تم حذف المؤشر" });
    } catch (e: any) {
      toast({ title: "خطأ", description: e.message, variant: "destructive" });
    }
  };

  const ratingCfg = RATING_CONFIG[report?.rating ?? "غير محدد"] ?? RATING_CONFIG["غير محدد"];

  return (
    <div className="space-y-4 animate-in fade-in duration-300">
      {/* Back button + name */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onBack}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h2 className="text-base font-bold">{user.displayName}</h2>
          <p className="text-xs text-muted-foreground">
            {profile?.jobTitle && <span>{profile.jobTitle}</span>}
            {profile?.department && <span> — {profile.department}</span>}
            {!profile?.jobTitle && !profile?.department && <span>@{user.username}</span>}
          </p>
        </div>
        {isAdmin && (
          <Button size="sm" variant="outline" className="mr-auto h-7 text-xs gap-1" onClick={() => setProfileOpen(true)}>
            <Edit2 className="w-3 h-3" />تعديل البيانات
          </Button>
        )}
      </div>

      <Tabs defaultValue="kpis">
        <TabsList className="h-8 text-xs">
          <TabsTrigger value="kpis" className="text-xs">مؤشرات الأداء</TabsTrigger>
          <TabsTrigger value="report" className="text-xs">التقرير الشهري</TabsTrigger>
          <TabsTrigger value="profile" className="text-xs">الملف الشخصي</TabsTrigger>
        </TabsList>

        {/* ─── KPIs Tab ─── */}
        <TabsContent value="kpis" className="space-y-3 mt-3">
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">حدد المؤشرات التي سيُقيَّم عليها هذا الموظف</p>
            {isAdmin && (
              <Button size="sm" className="h-7 text-xs gap-1" onClick={() => { setEditingKpi(undefined); setKpiDialogOpen(true); }}>
                <Plus className="w-3 h-3" />إضافة مؤشر
              </Button>
            )}
          </div>

          {kpisLoading && <p className="text-center text-muted-foreground text-xs py-6">جاري التحميل...</p>}

          {!kpisLoading && kpis.length === 0 && (
            <div className="text-center py-10 text-muted-foreground border border-dashed border-border rounded-lg">
              <Target className="w-8 h-8 mx-auto mb-2 opacity-20" />
              <p className="text-sm">لا توجد مؤشرات أداء بعد.</p>
              {isAdmin && <p className="text-xs mt-1">أضف مؤشرات لتتبع أداء هذا الموظف.</p>}
            </div>
          )}

          <div className="space-y-2">
            {kpis.map(kpi => (
              <Card key={kpi.id} className={`border-border bg-card ${!kpi.isActive ? "opacity-50" : ""}`}>
                <CardContent className="px-4 py-3 flex items-center gap-3">
                  <Target className="w-4 h-4 text-primary shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-xs font-bold">{kpi.name}</p>
                      {!kpi.isActive && <Badge variant="outline" className="text-[9px] h-4">معطل</Badge>}
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      الهدف: {kpi.direction === "lower_is_better" ? "≤" : "≥"}{fmtNum(kpi.targetValue)} {kpi.unit}
                      {" · "}الوزن: {kpi.weight}%
                      {" · "}{kpi.direction === "higher_is_better" ? "↑ الأعلى أفضل" : "↓ الأدنى أفضل"}
                    </p>
                    {kpi.description && <p className="text-[10px] text-muted-foreground/60 mt-0.5">{kpi.description}</p>}
                  </div>
                  {isAdmin && (
                    <div className="flex items-center gap-1 shrink-0">
                      <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-primary"
                        onClick={() => { setEditingKpi(kpi); setKpiDialogOpen(true); }}>
                        <Edit2 className="w-3 h-3" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-destructive"
                        onClick={() => deleteKpi(kpi.id)}>
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* ─── Monthly Report Tab ─── */}
        <TabsContent value="report" className="space-y-3 mt-3">
          <div className="flex items-center gap-3">
            <div className="space-y-0.5">
              <Label className="text-[10px] text-muted-foreground">اختر الشهر</Label>
              <Input type="month" value={reportMonth} onChange={e => setReportMonth(e.target.value)} className="h-7 text-xs w-40" />
            </div>
            {report && (
              <div className={`mr-auto px-3 py-1 rounded-full text-xs font-bold ${ratingCfg.bg} ${ratingCfg.color}`}>
                {ratingCfg.label}
                {report.overallScore !== null && ` — ${report.overallScore}%`}
              </div>
            )}
          </div>

          {reportLoading && <p className="text-center text-muted-foreground text-xs py-8">جاري التحميل...</p>}

          {report && !reportLoading && (
            <>
              {/* Quick stats row */}
              <div className="grid grid-cols-4 gap-2">
                {[
                  { label: "الطلبيات", value: fmtNum(report.orderStats.total), color: "text-primary" },
                  { label: "مُسلَّم", value: fmtNum(report.orderStats.delivered), color: "text-emerald-400" },
                  { label: "مُرتجَع", value: fmtNum(report.orderStats.returned), color: "text-red-400" },
                  { label: "نسبة التسليم", value: `${report.orderStats.deliveryRate}%`, color: "text-primary" },
                ].map(s => (
                  <Card key={s.label} className="border-border bg-card">
                    <CardContent className="px-3 py-2 text-center">
                      <p className={`text-base font-bold ${s.color}`}>{s.value}</p>
                      <p className="text-[9px] text-muted-foreground">{s.label}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {/* KPI Evaluation */}
              {report.kpis.length > 0 && (
                <div className="space-y-2">
                  <h3 className="text-xs font-bold text-muted-foreground">تقييم المؤشرات</h3>
                  {report.kpis.map(kpi => (
                    <div key={kpi.id} className="flex items-center gap-3 p-3 rounded-lg border border-border bg-card">
                      <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${kpi.achieved === true ? "bg-emerald-900/40" : kpi.achieved === false ? "bg-red-900/40" : "bg-muted/40"}`}>
                        {kpi.achieved === true ? <Check className="w-3 h-3 text-emerald-400" /> : kpi.achieved === false ? <X className="w-3 h-3 text-red-400" /> : <AlertCircle className="w-3 h-3 text-muted-foreground" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <p className="text-xs font-bold">{kpi.name}</p>
                          <span className="text-[10px] text-muted-foreground shrink-0">
                            الفعلي: <strong className={kpi.achieved ? "text-emerald-400" : "text-foreground"}>
                              {kpi.actualValue !== null ? `${fmtNum(kpi.actualValue)} ${kpi.unit}` : "—"}
                            </strong>
                            {" / هدف: "}{kpi.direction === "lower_is_better" ? "≤" : "≥"}{fmtNum(kpi.targetValue)} {kpi.unit}
                          </span>
                        </div>
                        <Progress value={kpi.score ?? 0} className="h-1.5" />
                      </div>
                      <div className="text-xs font-bold w-10 text-center shrink-0">
                        {kpi.score !== null ? `${kpi.score}%` : "—"}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Salary + print */}
              <Card className="border-emerald-900/40 bg-emerald-900/5">
                <CardContent className="px-4 py-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <DollarSign className="w-4 h-4 text-emerald-400" />
                    <div>
                      <p className="text-xs font-bold">الراتب المستحق</p>
                      <p className="text-[10px] text-muted-foreground">
                        {new Date(parseInt(reportMonth.split("-")[0]), parseInt(reportMonth.split("-")[1]) - 1, 1)
                          .toLocaleDateString("ar-EG", { month: "long", year: "numeric" })}
                      </p>
                    </div>
                  </div>
                  <span className="text-xl font-black text-emerald-400">{fmt(report.salary)}</span>
                </CardContent>
              </Card>

              <MonthlyReport report={report} />
            </>
          )}
        </TabsContent>

        {/* ─── Profile Tab ─── */}
        <TabsContent value="profile" className="mt-3">
          <Card className="border-border bg-card">
            <CardContent className="px-4 py-4 space-y-3">
              {[
                { label: "الاسم الكامل", value: user.displayName, icon: <Users className="w-3.5 h-3.5" /> },
                { label: "اسم المستخدم", value: `@${user.username}`, icon: null },
                { label: "المسمى الوظيفي", value: profile?.jobTitle || "—", icon: <Briefcase className="w-3.5 h-3.5" /> },
                { label: "القسم", value: profile?.department || "—", icon: null },
                { label: "الراتب الشهري", value: profile?.monthlySalary ? fmt(profile.monthlySalary) : "—", icon: <DollarSign className="w-3.5 h-3.5" /> },
                { label: "تاريخ التعيين", value: profile?.hireDate ? new Date(profile.hireDate).toLocaleDateString("ar-EG") : "—", icon: <Calendar className="w-3.5 h-3.5" /> },
              ].map(row => (
                <div key={row.label} className="flex items-center justify-between py-1 border-b border-border/30 last:border-0">
                  <span className="text-xs text-muted-foreground flex items-center gap-1">{row.icon}{row.label}</span>
                  <span className="text-xs font-bold">{row.value}</span>
                </div>
              ))}
              {profile?.notes && (
                <div className="pt-1">
                  <p className="text-[10px] text-muted-foreground">ملاحظات:</p>
                  <p className="text-xs mt-1">{profile.notes}</p>
                </div>
              )}
              {!profile && (
                <p className="text-center text-xs text-muted-foreground py-4">
                  لم يتم إدخال بيانات الموظف بعد.
                  {isAdmin && " اضغط 'تعديل البيانات' لإضافتها."}
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {profileOpen && (
        <ProfileFormDialog
          open={profileOpen}
          onClose={() => setProfileOpen(false)}
          user={user}
          existing={profile}
        />
      )}

      {kpiDialogOpen && (
        <KpiFormDialog
          open={kpiDialogOpen}
          onClose={() => { setKpiDialogOpen(false); setEditingKpi(undefined); }}
          userId={user.id}
          existing={editingKpi}
        />
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function TeamPage() {
  const { isAdmin } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const [addProfileOpen, setAddProfileOpen] = useState(false);
  const [addingUser, setAddingUser] = useState<AppUser | null>(null);

  const { data: profiles = [], isLoading: profilesLoading } = useQuery({
    queryKey: ["employee-profiles"],
    queryFn: employeeApi.listProfiles,
  });

  const { data: allUsers = [] } = useQuery({
    queryKey: ["users"],
    queryFn: usersApi.list,
  });

  const profiledUserIds = new Set(profiles.map(p => p.userId));
  const unprofiledUsers = allUsers.filter(u => !profiledUserIds.has(u.id) && u.isActive);

  const selectedProfile = profiles.find(p => p.userId === selectedUserId);
  const selectedUser = allUsers.find(u => u.id === selectedUserId);

  if (selectedUserId !== null && selectedUser) {
    return (
      <div className="max-w-3xl mx-auto animate-in fade-in duration-300">
        <EmployeeDetail
          user={selectedUser}
          profile={selectedProfile ?? null}
          onBack={() => setSelectedUserId(null)}
        />
      </div>
    );
  }

  return (
    <div className="space-y-5 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <Users className="w-5 h-5 text-primary" />
            إدارة الفريق
          </h1>
          <p className="text-muted-foreground text-xs mt-0.5">بيانات الموظفين، مؤشرات الأداء، والتقارير الشهرية</p>
        </div>
        {isAdmin && unprofiledUsers.length > 0 && (
          <Button size="sm" className="gap-1 h-8 text-xs" onClick={() => setAddProfileOpen(true)}>
            <Plus className="w-3.5 h-3.5" />إضافة موظف
          </Button>
        )}
      </div>

      {profilesLoading && <p className="text-center text-muted-foreground py-12 text-sm">جاري التحميل...</p>}

      {!profilesLoading && profiles.length === 0 && (
        <div className="text-center py-16 text-muted-foreground">
          <Users className="w-10 h-10 mx-auto mb-3 opacity-20" />
          <p className="text-sm">لا توجد ملفات موظفين بعد.</p>
          {isAdmin && unprofiledUsers.length > 0 && (
            <Button size="sm" className="mt-3 text-xs" onClick={() => setAddProfileOpen(true)}>
              إضافة موظف
            </Button>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {profiles.map(profile => {
          const user = allUsers.find(u => u.id === profile.userId);
          return (
            <Card
              key={profile.userId}
              className="border-border bg-card hover:border-primary/40 transition-colors cursor-pointer"
              onClick={() => setSelectedUserId(profile.userId)}
            >
              <CardContent className="px-4 py-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-sm font-black text-primary shrink-0">
                      {profile.displayName.charAt(0)}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-bold truncate">{profile.displayName}</p>
                      <p className="text-[10px] text-muted-foreground truncate">
                        {profile.jobTitle || profile.role === "admin" ? profile.jobTitle || "مدير" : "موظف"}
                        {profile.department && ` · ${profile.department}`}
                      </p>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0 mt-1" />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-muted/20 rounded-md p-2 text-center">
                    <p className="text-sm font-bold text-emerald-400">{fmt(profile.monthlySalary ?? 0)}</p>
                    <p className="text-[9px] text-muted-foreground">الراتب الشهري</p>
                  </div>
                  <div className="bg-muted/20 rounded-md p-2 text-center">
                    <p className="text-sm font-bold">
                      {profile.hireDate ? Math.floor((Date.now() - new Date(profile.hireDate).getTime()) / (1000 * 60 * 60 * 24 * 30)) : "—"}
                    </p>
                    <p className="text-[9px] text-muted-foreground">شهر في العمل</p>
                  </div>
                </div>
                <div className="flex items-center justify-between text-[10px] text-muted-foreground pt-1 border-t border-border/30">
                  <span className="flex items-center gap-1"><Target className="w-3 h-3" />عرض المؤشرات والتقرير</span>
                  <Badge variant="outline" className="text-[9px] h-4">
                    {profile.role === "admin" ? "مدير" : profile.role === "warehouse" ? "مخزن" : "موظف"}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Add profile dialog */}
      {addProfileOpen && (
        <Dialog open={addProfileOpen} onOpenChange={v => { if (!v) { setAddProfileOpen(false); setAddingUser(null); }}}>
          <DialogContent className="max-w-sm" dir="rtl">
            <DialogHeader><DialogTitle>اختر مستخدماً لإضافته كموظف</DialogTitle></DialogHeader>
            <div className="space-y-2 py-2">
              {unprofiledUsers.length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-4">جميع المستخدمين لديهم ملفات بالفعل.</p>
              )}
              {unprofiledUsers.map(u => (
                <div
                  key={u.id}
                  className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${addingUser?.id === u.id ? "border-primary bg-primary/5" : "border-border hover:border-primary/40"}`}
                  onClick={() => setAddingUser(u)}
                >
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-black text-primary">
                    {u.displayName.charAt(0)}
                  </div>
                  <div>
                    <p className="text-xs font-bold">{u.displayName}</p>
                    <p className="text-[10px] text-muted-foreground">@{u.username}</p>
                  </div>
                  {addingUser?.id === u.id && <Check className="w-4 h-4 text-primary mr-auto" />}
                </div>
              ))}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => { setAddProfileOpen(false); setAddingUser(null); }} className="text-xs h-7">إلغاء</Button>
              <Button
                disabled={!addingUser}
                onClick={() => {
                  if (addingUser) {
                    setAddProfileOpen(false);
                    setSelectedUserId(addingUser.id);
                    setTimeout(() => {
                      qc.invalidateQueries({ queryKey: ["employee-profiles"] });
                    }, 100);
                  }
                }}
                className="text-xs h-7"
              >
                متابعة
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
