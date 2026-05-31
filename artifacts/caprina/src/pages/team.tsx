import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Users, Plus, Edit2, Trash2, Target, FileText, ChevronRight, Check, X,
  TrendingUp, TrendingDown, Printer, Star, AlertCircle, Trophy, Briefcase, Package,
  DollarSign, Calendar, BarChart2, Settings, ArrowLeft, Save, RefreshCw, UserPlus,
  Clock, UserCheck, UserX, Gift, MinusCircle, CheckCircle2, XCircle, AlertTriangle,
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
import { employeeApi, usersApi, type EmployeeProfile, type EmployeeKpi, type EmployeeReport, type AppUser, type DailyKpiEntry, type DailyLogDay, appSettingsApi, attendanceApi, type AttendanceRecord, type AttendanceStatus, type PayrollAdjustment, type MonthlySalaryReport } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";

const fmt = (n: number) =>
  new Intl.NumberFormat("ar-EG", { style: "currency", currency: "EGP", maximumFractionDigits: 0 }).format(n);
const fmtNum = (n: number) => new Intl.NumberFormat("ar-EG").format(n);

function dbInitials(name: string) {
  const p = (name || "?").trim().split(/\s+/);
  return p.length >= 2 ? (p[0][0] + p[1][0]).toUpperCase() : (name || "?").slice(0, 2).toUpperCase();
}

const METRIC_OPTIONS = [
  { value: "delivery_rate", label: "نسبة التسليم", unit: "%", direction: "higher_is_better", defaultTarget: 80 },
  { value: "return_rate", label: "نسبة المرتجعات", unit: "%", direction: "lower_is_better", defaultTarget: 20 },
  { value: "total_orders", label: "عدد الطلبيات", unit: "طلب", direction: "higher_is_better", defaultTarget: 50 },
  { value: "profit", label: "الربح المحقق", unit: "ج.م", direction: "higher_is_better", defaultTarget: 5000 },
  { value: "revenue", label: "الإيرادات", unit: "ج.م", direction: "higher_is_better", defaultTarget: 10000 },
  { value: "manual", label: "مؤشر مخصص (يدوي)", unit: "", direction: "higher_is_better", defaultTarget: 100 },
];

const RATING_CONFIG: Record<string, { color: string; bg: string; label: string }> = {
  ممتاز:      { color: "text-emerald-700 dark:text-emerald-400", bg: "bg-emerald-50 dark:bg-emerald-900/30", label: "ممتاز ⭐" },
  "جيد جداً": { color: "text-blue-700    dark:text-blue-400",    bg: "bg-blue-50    dark:bg-blue-900/30",    label: "جيد جداً 👍" },
  جيد:        { color: "text-primary",                            bg: "bg-primary/10",                        label: "جيد 👌" },
  مقبول:      { color: "text-amber-700   dark:text-amber-400",   bg: "bg-amber-50   dark:bg-amber-900/20",   label: "مقبول ⚠️" },
  ضعيف:       { color: "text-red-700     dark:text-red-400",     bg: "bg-red-50     dark:bg-red-900/20",     label: "ضعيف ❌" },
  "غير محدد": { color: "text-muted-foreground",                   bg: "bg-muted/20",                          label: "غير محدد" },
};

// ─── Profile Form Dialog ──────────────────────────────────────────────────────
function ProfileFormDialog({
  open, onClose, profileId, displayName, isSystemUser, existing,
}: {
  open: boolean; onClose: () => void; profileId: number; displayName: string; isSystemUser: boolean; existing: EmployeeProfile | null;
}) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [memberName, setMemberName] = useState(existing?.displayName ?? displayName);
  const [jobTitle, setJobTitle] = useState(existing?.jobTitle ?? "");
  const [department, setDepartment] = useState(existing?.department ?? "");
  const [monthlySalary, setMonthlySalary] = useState(existing?.monthlySalary?.toString() ?? "0");
  const [hireDate, setHireDate] = useState(existing?.hireDate ?? "");
  const [notes, setNotes] = useState(existing?.notes ?? "");
  const [avatar, setAvatar] = useState<string | null | undefined>(existing?.avatar ?? null);
  const [saving, setSaving] = useState(false);

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: "الصورة كبيرة جداً", description: "الحد الأقصى 5MB", variant: "destructive" });
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const MAX = 300;
        let w = img.width, h = img.height;
        if (w > h) { if (w > MAX) { h = Math.round(h * MAX / w); w = MAX; } }
        else { if (h > MAX) { w = Math.round(w * MAX / h); h = MAX; } }
        canvas.width = w; canvas.height = h;
        const ctx = canvas.getContext("2d")!;
        ctx.drawImage(img, 0, 0, w, h);
        const compressed = canvas.toDataURL("image/jpeg", 0.8);
        setAvatar(compressed);
      };
      img.src = ev.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await employeeApi.updateProfile(profileId, {
        displayName: memberName || undefined,
        jobTitle: jobTitle || null,
        department: department || null,
        monthlySalary: parseFloat(monthlySalary) || 0,
        hireDate: hireDate || null,
        notes: notes || null,
        avatar: avatar ?? null,
      });
      qc.invalidateQueries({ queryKey: ["employee-profiles"] });
      toast({ title: "تم حفظ بيانات العضو" });
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
        <DialogHeader><DialogTitle>بيانات العضو: {displayName}</DialogTitle></DialogHeader>
        <div className="space-y-3 py-2">
          {/* ── صورة الموظف ── */}
          <div className="flex items-center gap-3">
            <div className="relative shrink-0">
              {avatar ? (
                <img src={avatar} alt="صورة الموظف" className="w-16 h-16 rounded-full object-cover border-2 border-border" />
              ) : (
                <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center text-2xl font-bold text-muted-foreground border-2 border-border border-dashed">
                  {dbInitials(memberName || displayName || "؟")}
                </div>
              )}
              {avatar && (
                <button
                  onClick={() => { setAvatar(null); }}
                  className="absolute -top-1 -left-1 w-4 h-4 bg-red-500 text-white rounded-full text-[10px] flex items-center justify-center hover:bg-red-600"
                >✕</button>
              )}
            </div>
            <div className="flex-1 space-y-1">
              <Label className="text-xs font-bold">صورة الموظف</Label>
              <label className="flex items-center gap-1.5 cursor-pointer bg-muted/40 hover:bg-muted/70 transition-colors rounded-md px-3 py-1.5 text-xs text-muted-foreground border border-border w-fit">
                <span>📷</span>
                <span>{avatar ? "تغيير الصورة" : "رفع صورة"}</span>
                <input type="file" accept="image/*" onChange={handleAvatarChange} className="hidden" />
              </label>
              <p className="text-[9px] text-muted-foreground">JPG / PNG / WebP — حد أقصى 2MB</p>
            </div>
          </div>

          {!isSystemUser && (
            <div className="space-y-1">
              <Label className="text-xs font-bold">الاسم الكامل</Label>
              <Input value={memberName} onChange={e => setMemberName(e.target.value)} placeholder="أحمد محمد" className="h-8 text-xs" />
            </div>
          )}
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
  open, onClose, profileId, isSystemUser, existing,
}: {
  open: boolean; onClose: () => void; profileId: number; isSystemUser: boolean; existing?: EmployeeKpi;
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
          profileId, name, metric, targetValue: parseFloat(targetValue), unit,
          direction, weight: parseFloat(weight), isActive, description: description || null,
        });
        toast({ title: "تم إضافة المؤشر" });
      }
      qc.invalidateQueries({ queryKey: ["employee-kpis", profileId] });
      qc.invalidateQueries({ queryKey: ["employee-report", profileId] });
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
                {(isSystemUser ? METRIC_OPTIONS : METRIC_OPTIONS.filter(o => o.value === "manual")).map(o => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {!isSystemUser && (
              <p className="text-[10px] text-muted-foreground">أعضاء الفريق بدون حساب نظام يدعمون المؤشرات اليدوية فقط</p>
            )}
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

  // جلب تقرير المرتب التفصيلي (الحضور + الخصومات + البونص)
  const { data: salaryReport } = useQuery({
    queryKey: ["salary-report", report.profile?.id, report.period.month],
    queryFn: () => {
      const profileId = report.profile?.id;
      if (!profileId) return null;
      return attendanceApi.salaryReport(profileId, report.period.month);
    },
    enabled: !!report.profile?.id,
  });

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
          .attendance-grid { display: grid; grid-template-columns: repeat(5, 1fr); gap: 6px; margin-bottom: 12px; }
          .att-box { background: #f8f8f8; border-radius: 6px; padding: 8px 6px; text-align: center; }
          .att-val { font-size: 18px; font-weight: 800; }
          .att-label { font-size: 9px; color: #888; margin-top: 2px; }
          .salary-table { width: 100%; border-collapse: collapse; margin-bottom: 8px; }
          .salary-table th { background: #c9a227; color: white; padding: 6px 10px; text-align: right; font-size: 11px; }
          .salary-table td { padding: 6px 10px; border-bottom: 1px solid #eee; font-size: 12px; }
          .adj-row { display: flex; justify-content: space-between; font-size: 11px; padding: 4px 8px; border-radius: 4px; margin-bottom: 3px; }
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

          {/* Attendance & Salary Section */}
          {salaryReport && (
            <div style={{ marginBottom: 20 }}>
              <h3 style={{ fontSize: 13, fontWeight: 700, marginBottom: 10, borderRight: "3px solid #c9a227", paddingRight: 8 }}>الحضور والمرتب التفصيلي</h3>

              {/* Attendance stats - responsive 3 cols on small, 5 on large */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 6, marginBottom: 12 }}>
                {[
                  { label: "أيام الحضور",  val: salaryReport.workedDays,        color: "#16a34a", bg: "#f0fdf4" },
                  { label: "أيام الغياب",  val: salaryReport.absentDays,        color: "#dc2626", bg: "#fef2f2" },
                  { label: "أيام التأخير", val: salaryReport.lateDays,          color: "#d97706", bg: "#fffbeb" },
                  { label: "نصف يوم",      val: salaryReport.halfDays,          color: "#2563eb", bg: "#eff6ff" },
                  { label: "إجمالي الأيام", val: salaryReport.totalWorkingDays, color: "#555",    bg: "#f8f8f8" },
                  { label: "أيام العمل الفعلية", val: salaryReport.workedDays + salaryReport.halfDays * 0.5, color: "#c9a227", bg: "#fef9e7" },
                ].map(s => (
                  <div key={s.label} style={{ background: s.bg, border: `1px solid ${s.color}22`, borderRadius: 8, padding: "10px 8px", textAlign: "center" }}>
                    <div style={{ fontSize: 22, fontWeight: 900, color: s.color, lineHeight: 1 }}>{s.val}</div>
                    <div style={{ fontSize: 10, color: "#666", marginTop: 4, fontWeight: 500 }}>{s.label}</div>
                  </div>
                ))}
              </div>

              {/* Salary breakdown */}
              <div style={{ border: "1px solid #e5e7eb", borderRadius: 8, overflow: "hidden", marginBottom: 10 }}>
                <div style={{ background: "#c9a227", padding: "8px 12px", display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: "white", fontWeight: 700, fontSize: 12 }}>البند</span>
                  <span style={{ color: "white", fontWeight: 700, fontSize: 12 }}>المبلغ</span>
                </div>
                {[
                  { label: "الراتب الأساسي",        val: salaryReport.baseSalary,            color: "#1a1a1a", sign: "",  bg: "white"   },
                  { label: "خصم الغياب / نصف اليوم", val: salaryReport.attendanceDeduction,   color: salaryReport.attendanceDeduction > 0 ? "#dc2626" : "#aaa", sign: salaryReport.attendanceDeduction > 0 ? "−" : "", bg: salaryReport.attendanceDeduction > 0 ? "#fff5f5" : "white" },
                  { label: "بونص إضافي",             val: salaryReport.bonuses,               color: salaryReport.bonuses > 0 ? "#16a34a" : "#aaa", sign: salaryReport.bonuses > 0 ? "+" : "", bg: salaryReport.bonuses > 0 ? "#f0fdf4" : "white" },
                  { label: "خصومات إضافية",          val: salaryReport.extraDeductions,       color: salaryReport.extraDeductions > 0 ? "#dc2626" : "#aaa", sign: salaryReport.extraDeductions > 0 ? "−" : "", bg: salaryReport.extraDeductions > 0 ? "#fff5f5" : "white" },
                ].map(({ label, val, color, sign, bg }) => (
                  <div key={label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "9px 12px", background: bg, borderBottom: "1px solid #f0f0f0" }}>
                    <span style={{ fontSize: 12, color: "#444" }}>{label}</span>
                    <span style={{ fontSize: 13, fontWeight: 700, color }}>{sign}{fmt(Math.abs(val))}</span>
                  </div>
                ))}
                {/* Net salary row */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "11px 12px", background: salaryReport.netSalary >= salaryReport.baseSalary ? "#f0fdf4" : "#fffbeb", borderTop: "2px solid #c9a227" }}>
                  <span style={{ fontSize: 13, fontWeight: 800, color: "#1a1a1a" }}>💰 صافي المرتب</span>
                  <span style={{ fontSize: 20, fontWeight: 900, color: salaryReport.netSalary >= salaryReport.baseSalary ? "#16a34a" : "#d97706" }}>{fmt(salaryReport.netSalary)}</span>
                </div>
              </div>

              {/* Adjustments list */}
              {salaryReport.adjustments.length > 0 && (
                <div>
                  <p style={{ fontSize: 11, color: "#888", marginBottom: 6, fontWeight: 600 }}>تفاصيل البونص والخصومات:</p>
                  {salaryReport.adjustments.map(adj => (
                    <div key={adj.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 12, padding: "7px 10px", background: adj.type === "bonus" ? "#f0fdf4" : "#fef2f2", border: `1px solid ${adj.type === "bonus" ? "#bbf7d0" : "#fecaca"}`, borderRadius: 6, marginBottom: 4 }}>
                      <span style={{ color: "#444" }}>{adj.reason}</span>
                      <span style={{ fontWeight: 800, fontSize: 13, color: adj.type === "bonus" ? "#16a34a" : "#dc2626" }}>
                        {adj.type === "bonus" ? "+" : "−"}{fmt(adj.amount)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Salary fallback (if no salaryReport) */}
          {!salaryReport && (
            <div style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 8, padding: 12, marginBottom: 20 }}>
              <h3 style={{ fontSize: 11, color: "#888", marginBottom: 8 }}>الراتب الشهري</h3>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ fontSize: 12 }}>الراتب المستحق عن شهر {periodLabel}</span>
                <span style={{ fontSize: 20, fontWeight: 900, color: "#16a34a" }}>{fmt(report.salary)}</span>
              </div>
            </div>
          )}

          {/* Footer */}
          <div style={{ textAlign: "center", fontSize: 10, color: "#aaa", marginTop: 24, borderTop: "1px solid #eee", paddingTop: 12 }}>
            تقرير صادر من نظام CAPRINA لإدارة المبيعات — {new Date().toLocaleDateString("ar-EG", { year: "numeric", month: "long", day: "numeric" })}
          </div>

        </div>
      </div>
    </div>
  );
}

// ─── Attendance Tab ──────────────────────────────────────────────────────────
const STATUS_CONFIG: Record<AttendanceStatus, { label: string; color: string; bg: string; icon: any; deductPct: number }> = {
  present:  { label: "حاضر",       color: "text-emerald-600", bg: "bg-emerald-50 dark:bg-emerald-900/20", icon: CheckCircle2,   deductPct: 0    },
  late:     { label: "متأخر",      color: "text-amber-600",   bg: "bg-amber-50 dark:bg-amber-900/20",     icon: Clock,          deductPct: 0    },
  half_day: { label: "نصف يوم",    color: "text-blue-600",    bg: "bg-blue-50 dark:bg-blue-900/20",       icon: AlertTriangle,  deductPct: 50   },
  absent:   { label: "غائب",       color: "text-red-600",     bg: "bg-red-50 dark:bg-red-900/20",         icon: XCircle,        deductPct: 100  },
  holiday:  { label: "إجازة",      color: "text-purple-600",  bg: "bg-purple-50 dark:bg-purple-900/20",   icon: Calendar,       deductPct: 0    },
  excused:  { label: "إذن/مبرر",   color: "text-gray-500",    bg: "bg-gray-50 dark:bg-gray-900/20",       icon: AlertCircle,    deductPct: 0    },
};

function AttendanceTab({ profileId, monthlySalary, isAdmin }: {
  profileId: number; monthlySalary: number; isAdmin: boolean;
}) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const today = new Date().toISOString().slice(0, 10);
  const [month, setMonth] = useState(() => today.slice(0, 7));
  const [savingDay, setSavingDay] = useState<string | null>(null);
  const [adjType, setAdjType] = useState<"bonus" | "deduction">("bonus");
  const [adjAmount, setAdjAmount] = useState("");
  const [adjReason, setAdjReason] = useState("");
  const [savingAdj, setSavingAdj] = useState(false);
  const [activeView, setActiveView] = useState<"calendar" | "salary">("calendar");

  // جلب سجل الحضور
  const { data: records = [], isLoading } = useQuery({
    queryKey: ["attendance", profileId, month],
    queryFn: () => attendanceApi.list(profileId, month),
  });

  // جلب الخصومات والبونص
  const { data: adjustments = [] } = useQuery({
    queryKey: ["attendance-adjustments", profileId, month],
    queryFn: () => attendanceApi.listAdjustments(profileId, month),
  });

  // بناء خريطة التواريخ
  const recMap = Object.fromEntries(records.map(r => [r.date, r]));

  // حساب أيام الشهر
  const [year, mon] = month.split("-").map(Number);
  const daysInMonth = new Date(year, mon, 0).getDate();
  const days = Array.from({ length: daysInMonth }, (_, i) => {
    const d = String(i + 1).padStart(2, "0");
    return `${month}-${d}`;
  });

  // إحصائيات الحضور
  const stats = days.reduce((acc, date) => {
    const rec = recMap[date];
    if (!rec) return acc;
    if (rec.status === "present") acc.present++;
    else if (rec.status === "absent") acc.absent++;
    else if (rec.status === "late") { acc.present++; acc.late++; }
    else if (rec.status === "half_day") acc.halfDay++;
    else if (rec.status === "holiday" || rec.status === "excused") acc.excused++;
    acc.totalDeduction += rec.deduction;
    return acc;
  }, { present: 0, absent: 0, late: 0, halfDay: 0, excused: 0, totalDeduction: 0 });

  const workedDays = stats.present + stats.halfDay * 0.5;
  const bonusTotal = adjustments.filter(a => a.type === "bonus").reduce((s, a) => s + a.amount, 0);
  const deductTotal = adjustments.filter(a => a.type === "deduction").reduce((s, a) => s + a.amount, 0);
  const netSalary = monthlySalary - stats.totalDeduction + bonusTotal - deductTotal;

  // تغيير حالة يوم
  const handleDayStatus = async (date: string, status: AttendanceStatus) => {
    setSavingDay(date);
    const dailySalary = monthlySalary / daysInMonth;
    const cfg = STATUS_CONFIG[status];
    const deduction = (dailySalary * cfg.deductPct) / 100;
    try {
      await attendanceApi.save({ profileId, date, status, deduction });
      qc.invalidateQueries({ queryKey: ["attendance", profileId, month] });
      toast({ title: `تم تسجيل ${cfg.label} ليوم ${date}` });
    } catch (e: any) {
      toast({ title: "خطأ", description: e.message, variant: "destructive" });
    } finally { setSavingDay(null); }
  };

  const handleAddAdjustment = async () => {
    if (!adjAmount || !adjReason.trim()) {
      toast({ title: "أدخل المبلغ والسبب", variant: "destructive" }); return;
    }
    setSavingAdj(true);
    try {
      await attendanceApi.addAdjustment({ profileId, month, type: adjType, amount: parseFloat(adjAmount), reason: adjReason });
      qc.invalidateQueries({ queryKey: ["attendance-adjustments", profileId, month] });
      setAdjAmount(""); setAdjReason("");
      toast({ title: adjType === "bonus" ? "تم إضافة البونص ✅" : "تم إضافة الخصم ✅" });
    } catch (e: any) {
      toast({ title: "خطأ", description: e.message, variant: "destructive" });
    } finally { setSavingAdj(false); }
  };

  const handleDeleteAdj = async (id: number) => {
    try {
      await attendanceApi.deleteAdjustment(id);
      qc.invalidateQueries({ queryKey: ["attendance-adjustments", profileId, month] });
      toast({ title: "تم الحذف" });
    } catch (e: any) {
      toast({ title: "خطأ", description: e.message, variant: "destructive" });
    }
  };

  return (
    <div className="space-y-4">
      {/* Header: شهر + تبويب */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-muted-foreground" />
          <Input type="month" value={month} onChange={e => setMonth(e.target.value)} className="h-8 text-xs w-36" />
        </div>
        <div className="flex gap-1 mr-auto">
          <Button size="sm" variant={activeView === "calendar" ? "default" : "outline"} className="h-7 text-xs" onClick={() => setActiveView("calendar")}>
            <Calendar className="w-3 h-3 ml-1" />الحضور
          </Button>
          <Button size="sm" variant={activeView === "salary" ? "default" : "outline"} className="h-7 text-xs" onClick={() => setActiveView("salary")}>
            <DollarSign className="w-3 h-3 ml-1" />المرتب
          </Button>
        </div>
      </div>

      {/* بطاقات الإحصائيات */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {[
          { label: "أيام الحضور",   val: stats.present,  icon: UserCheck,    color: "text-emerald-600" },
          { label: "أيام الغياب",   val: stats.absent,   icon: UserX,        color: "text-red-600"     },
          { label: "أيام التأخير",  val: stats.late,     icon: Clock,        color: "text-amber-600"   },
          { label: "إجمالي العمل",  val: `${workedDays} يوم`, icon: BarChart2, color: "text-blue-600" },
        ].map(({ label, val, icon: Icon, color }) => (
          <Card key={label} className="border-border">
            <CardContent className="p-3 flex items-center gap-2">
              <Icon className={`w-5 h-5 ${color} shrink-0`} />
              <div>
                <p className="text-[10px] text-muted-foreground">{label}</p>
                <p className={`text-sm font-bold ${color}`}>{val}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* ─── عرض التقويم ─── */}
      {activeView === "calendar" && (
        <div className="space-y-3">
          {isLoading && <p className="text-center text-xs text-muted-foreground py-6">جاري التحميل...</p>}
          {!isLoading && (
            <div className="grid grid-cols-7 gap-1">
              {["أحد","إثن","ثلا","أرب","خمس","جمع","سبت"].map(d => (
                <div key={d} className="text-center text-[9px] font-bold text-muted-foreground py-1">{d}</div>
              ))}
              {/* padding للبداية */}
              {Array.from({ length: new Date(`${month}-01`).getDay() }).map((_, i) => (
                <div key={`pad-${i}`} />
              ))}
              {days.map(date => {
                const rec = recMap[date];
                const d = parseInt(date.split("-")[2]);
                const isToday = date === today;
                const isFuture = date > today;
                const cfg = rec ? STATUS_CONFIG[rec.status] : null;
                const Icon = cfg?.icon;
                return (
                  <div key={date} className={`relative rounded-lg border text-center p-1 transition-all ${isToday ? "ring-2 ring-primary" : ""} ${cfg ? cfg.bg : "bg-card"} ${isFuture ? "opacity-40" : ""}`}>
                    <div className={`text-[10px] font-bold mb-0.5 ${cfg ? cfg.color : "text-foreground"}`}>{d}</div>
                    {Icon && <Icon className={`w-3 h-3 mx-auto ${cfg.color}`} />}
                    {!isFuture && isAdmin && (
                      <Select
                        value={rec?.status ?? ""}
                        onValueChange={val => handleDayStatus(date, val as AttendanceStatus)}
                        disabled={savingDay === date}
                      >
                        <SelectTrigger className="h-4 text-[8px] mt-0.5 px-0.5 border-0 bg-transparent p-0 shadow-none focus:ring-0">
                          <SelectValue placeholder="—" />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.entries(STATUS_CONFIG).map(([val, s]) => (
                            <SelectItem key={val} value={val} className="text-xs">{s.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                    {!isAdmin && cfg && (
                      <p className={`text-[8px] font-bold mt-0.5 ${cfg.color}`}>{cfg.label}</p>
                    )}
                    {rec?.deduction ? (
                      <p className="text-[8px] text-red-500 font-bold">-{rec.deduction.toFixed(0)}</p>
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}

          {/* Legend */}
          <div className="flex flex-wrap gap-2 pt-1">
            {Object.entries(STATUS_CONFIG).map(([k, s]) => (
              <div key={k} className="flex items-center gap-1">
                <div className={`w-2 h-2 rounded-full ${s.bg.split(" ")[0].replace("bg-","bg-")} ${s.color}`} style={{background:"currentColor"}} />
                <span className="text-[9px] text-muted-foreground">{s.label}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ─── عرض المرتب ─── */}
      {activeView === "salary" && (
        <div className="space-y-4">
          {/* ملخص المرتب */}
          <Card className="border-border">
            <CardHeader className="pb-2 pt-3 px-4">
              <CardTitle className="text-sm flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-primary" />
                ملخص المرتب — {month}
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4 space-y-2">
              {[
                { label: "الراتب الأساسي",      val: monthlySalary,          color: "text-foreground",    sign: ""  },
                { label: "خصم الغياب/النصف",     val: -stats.totalDeduction,  color: "text-red-600",       sign: "-" },
                { label: "بونص إضافي",           val: bonusTotal,             color: "text-emerald-600",   sign: "+" },
                { label: "خصومات إضافية",        val: -deductTotal,           color: "text-red-600",       sign: "-" },
              ].map(({ label, val, color, sign }) => (
                <div key={label} className="flex justify-between items-center text-xs border-b border-border pb-1">
                  <span className="text-muted-foreground">{label}</span>
                  <span className={`font-bold ${color}`}>{sign}{fmt(Math.abs(val))}</span>
                </div>
              ))}
              <div className="flex justify-between items-center pt-1">
                <span className="font-bold text-sm">صافي المرتب</span>
                <span className={`text-lg font-black ${netSalary >= monthlySalary ? "text-emerald-600" : "text-amber-600"}`}>
                  {fmt(netSalary)}
                </span>
              </div>
              <div className="text-[10px] text-muted-foreground pt-1">
                أيام العمل الفعلية: <strong>{workedDays}</strong> من <strong>{daysInMonth}</strong> يوم
                {stats.late > 0 && <span> · تأخير: <strong className="text-amber-600">{stats.late} مرة</strong></span>}
              </div>
            </CardContent>
          </Card>

          {/* إضافة بونص أو خصم */}
          {isAdmin && (
            <Card className="border-border">
              <CardHeader className="pb-2 pt-3 px-4">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Gift className="w-4 h-4 text-primary" />
                  إضافة بونص / خصم
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4 space-y-2">
                <div className="flex gap-2">
                  <Button size="sm" variant={adjType === "bonus" ? "default" : "outline"}
                    className="h-7 text-xs flex-1 gap-1" onClick={() => setAdjType("bonus")}>
                    <Gift className="w-3 h-3" />بونص
                  </Button>
                  <Button size="sm" variant={adjType === "deduction" ? "destructive" : "outline"}
                    className="h-7 text-xs flex-1 gap-1" onClick={() => setAdjType("deduction")}>
                    <MinusCircle className="w-3 h-3" />خصم
                  </Button>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-[10px]">المبلغ (ج.م)</Label>
                    <Input type="number" min="0" placeholder="500" value={adjAmount}
                      onChange={e => setAdjAmount(e.target.value)} className="h-8 text-xs mt-1" />
                  </div>
                  <div>
                    <Label className="text-[10px]">السبب</Label>
                    <Input placeholder="مكافأة أداء..." value={adjReason}
                      onChange={e => setAdjReason(e.target.value)} className="h-8 text-xs mt-1" />
                  </div>
                </div>
                <Button size="sm" className="h-7 text-xs w-full gap-1" onClick={handleAddAdjustment} disabled={savingAdj}>
                  <Plus className="w-3 h-3" />{savingAdj ? "جاري الحفظ..." : "إضافة"}
                </Button>
              </CardContent>
            </Card>
          )}

          {/* قائمة البونص والخصومات */}
          {adjustments.length > 0 && (
            <div className="space-y-1">
              <p className="text-xs font-bold text-muted-foreground">البونص والخصومات</p>
              {adjustments.map(adj => (
                <div key={adj.id} className={`rounded-lg px-3 py-2 text-xs border ${adj.type === "bonus" ? "bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800" : "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800"}`}>
                  {/* السطر الأول: الأيقونة + المبلغ + زر الحذف */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      {adj.type === "bonus"
                        ? <Gift className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                        : <MinusCircle className="w-3.5 h-3.5 text-red-600 shrink-0" />}
                      <span className={`font-bold text-sm ${adj.type === "bonus" ? "text-emerald-600" : "text-red-600"}`}>
                        {adj.type === "bonus" ? "+" : "-"}{fmt(adj.amount)}
                      </span>
                      <span className="text-[10px] text-muted-foreground">
                        {adj.type === "bonus" ? "بونص" : "خصم"}
                      </span>
                    </div>
                    {isAdmin && (
                      <Button variant="ghost" size="icon" className="h-5 w-5 text-muted-foreground hover:text-destructive"
                        onClick={() => handleDeleteAdj(adj.id)}>
                        <X className="w-3 h-3" />
                      </Button>
                    )}
                  </div>
                  {/* السطر الثاني: السبب */}
                  {adj.reason && (
                    <p className="text-[11px] text-muted-foreground mt-1 pr-5 leading-snug">
                      {adj.reason}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Daily Tracker Tab ───────────────────────────────────────────────────────
function DailyTrackerTab({ profileId }: { profileId: number }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [logValues, setLogValues] = useState<Record<number, string>>({});
  const [saving, setSaving] = useState<Record<number, boolean>>({});

  const { data: dailyData, isLoading, refetch } = useQuery({
    queryKey: ["employee-daily-logs", profileId, selectedDate],
    queryFn: () => employeeApi.getDailyLogs(profileId, selectedDate),
  });

  const { data: weekData } = useQuery({
    queryKey: ["employee-week-logs", profileId, selectedDate],
    queryFn: () => employeeApi.getWeekLogs(profileId, selectedDate),
  });

  useEffect(() => {
    if (!dailyData) return;
    const init: Record<number, string> = {};
    dailyData.kpis.forEach(kpi => {
      if (kpi.metric === "manual" && kpi.actualValue !== null) {
        init[kpi.id] = String(kpi.actualValue);
      }
    });
    setLogValues(init);
  }, [dailyData]);

  const handleSave = async (kpi: DailyKpiEntry) => {
    const val = parseFloat(logValues[kpi.id] ?? "");
    if (isNaN(val)) { toast({ title: "أدخل قيمة صحيحة", variant: "destructive" }); return; }
    setSaving(s => ({ ...s, [kpi.id]: true }));
    try {
      await employeeApi.saveDailyLog({ profileId, kpiId: kpi.id, date: selectedDate, value: val });
      qc.invalidateQueries({ queryKey: ["employee-daily-logs", profileId, selectedDate] });
      qc.invalidateQueries({ queryKey: ["employee-week-logs", profileId, selectedDate] });
      toast({ title: "تم التسجيل ✅" });
    } catch (e: any) {
      toast({ title: "خطأ", description: e.message, variant: "destructive" });
    } finally {
      setSaving(s => ({ ...s, [kpi.id]: false }));
    }
  };

  const achievedCount = dailyData?.kpis.filter(k => k.achieved === true).length ?? 0;
  const totalCount = dailyData?.kpis.length ?? 0;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <Input
          type="date"
          value={selectedDate}
          onChange={e => setSelectedDate(e.target.value)}
          className="w-36 h-7 text-xs"
          max={new Date().toISOString().slice(0, 10)}
        />
        <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => refetch()}>
          <RefreshCw className="w-3 h-3" />تحديث
        </Button>
        {totalCount > 0 && (
          <Badge variant="outline" className={`text-xs mr-auto ${achievedCount === totalCount ? "border-emerald-700 text-emerald-400" : achievedCount > 0 ? "border-amber-700 text-amber-400" : "border-red-700 text-red-400"}`}>
            {achievedCount}/{totalCount} محقق
          </Badge>
        )}
      </div>

      {isLoading && <p className="text-center text-muted-foreground text-xs py-8 animate-pulse">جاري التحميل...</p>}

      {!isLoading && totalCount === 0 && (
        <div className="text-center py-10 text-muted-foreground border border-dashed border-border rounded-lg">
          <Target className="w-8 h-8 mx-auto mb-2 opacity-20" />
          <p className="text-sm">لا توجد مؤشرات نشطة.</p>
          <p className="text-xs mt-1">أضف مؤشرات من تاب «مؤشرات الأداء» أولاً.</p>
        </div>
      )}

      <div className="space-y-2">
        {(dailyData?.kpis ?? []).map(kpi => {
          const rawPct = kpi.dailyTarget > 0
            ? Math.min(100, ((kpi.actualValue ?? 0) / kpi.dailyTarget) * 100)
            : 0;
          const pct = kpi.direction === "lower_is_better"
            ? (kpi.achieved ? 100 : Math.max(0, 100 - rawPct))
            : rawPct;
          const isManual = kpi.metric === "manual";

          return (
            <Card key={kpi.id} className={`border ${kpi.achieved === true ? "border-emerald-700/50 bg-emerald-950/10" : kpi.achieved === false ? "border-red-800/30" : "border-border"}`}>
              <CardContent className="px-4 py-3 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    {kpi.achieved === true
                      ? <Check className="w-4 h-4 text-emerald-500 shrink-0" />
                      : kpi.achieved === false
                        ? <X className="w-4 h-4 text-red-400 shrink-0" />
                        : <Target className="w-4 h-4 text-muted-foreground shrink-0" />}
                    <p className="text-sm font-bold truncate">{kpi.name}</p>
                    {!isManual && <Badge variant="outline" className="text-[8px] h-3.5 shrink-0">تلقائي</Badge>}
                  </div>
                  <Badge variant="outline" className={`text-[9px] shrink-0 ${kpi.achieved === true ? "border-emerald-700 text-emerald-400" : kpi.achieved === false ? "border-red-700 text-red-400" : "border-border text-muted-foreground"}`}>
                    {kpi.achieved === true ? "✅ محقق" : kpi.achieved === false ? "❌ لم يُحقَّق" : "غير مسجل"}
                  </Badge>
                </div>

                <Progress value={pct} className={`h-1.5 ${kpi.achieved === true ? "[&>div]:bg-emerald-500" : kpi.achieved === false ? "[&>div]:bg-red-400" : "[&>div]:bg-primary"}`} />

                <div className="flex items-center gap-4 text-[10px] text-muted-foreground">
                  <span>الهدف اليومي: <span className="font-bold text-foreground">{fmtNum(Math.round(kpi.dailyTarget * 10) / 10)} {kpi.unit}</span></span>
                  <span>المحقق: <span className={`font-bold ${kpi.achieved === true ? "text-emerald-400" : kpi.achieved === false ? "text-red-400" : "text-foreground"}`}>
                    {kpi.actualValue !== null ? `${fmtNum(kpi.actualValue)} ${kpi.unit}` : "—"}
                  </span></span>
                </div>

                {isManual && (
                  <div className="flex items-center gap-2 pt-0.5">
                    <Input
                      type="number"
                      min="0"
                      value={logValues[kpi.id] ?? ""}
                      onChange={e => setLogValues(v => ({ ...v, [kpi.id]: e.target.value }))}
                      placeholder={`أدخل القيمة (${kpi.unit})`}
                      className="h-7 text-xs flex-1"
                    />
                    <Button
                      size="sm"
                      className="h-7 text-xs gap-1 shrink-0"
                      disabled={saving[kpi.id] || !logValues[kpi.id]}
                      onClick={() => handleSave(kpi)}
                    >
                      <Save className="w-3 h-3" />
                      {saving[kpi.id] ? "..." : "تسجيل"}
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {weekData && weekData.kpiWeeks.length > 0 && (
        <div className="pt-2">
          <p className="text-xs font-bold text-muted-foreground mb-3">آخر 7 أيام</p>
          <div className="space-y-3">
            {weekData.kpiWeeks.map(kpiWeek => (
              <div key={kpiWeek.kpiId}>
                <p className="text-[10px] text-muted-foreground mb-1.5">{kpiWeek.kpiName}</p>
                <div className="flex gap-1">
                  {kpiWeek.days.map(day => {
                    const d = new Date(day.date + "T12:00:00");
                    const dayName = d.toLocaleDateString("ar-EG", { weekday: "short" });
                    const isToday = day.date === new Date().toISOString().slice(0, 10);
                    return (
                      <div key={day.date} className={`flex-1 text-center rounded p-1.5 text-[8px] border transition-colors ${
                        day.achieved === true ? "bg-emerald-900/30 border-emerald-700/30 text-emerald-400" :
                        day.achieved === false ? "bg-red-900/20 border-red-700/20 text-red-400" :
                        "bg-muted/20 border-border text-muted-foreground"
                      } ${isToday ? "ring-1 ring-primary/40" : ""}`}>
                        <div className="font-bold text-[9px]">{day.achieved === true ? "✓" : day.achieved === false ? "✗" : "—"}</div>
                        <div className="mt-0.5">{dayName}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Add Member Wizard ────────────────────────────────────────────────────────
function AddMemberWizard({ open, onClose, onSuccess, availableUsers, existingProfiles }: {
  open: boolean; onClose: () => void; onSuccess: (profileId: number) => void;
  availableUsers: AppUser[]; existingProfiles: EmployeeProfile[];
}) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [mode, setMode] = useState<"system" | "team_only">("system");
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [selectedUser, setSelectedUser] = useState<AppUser | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [department, setDepartment] = useState("");
  const [monthlySalary, setMonthlySalary] = useState("0");
  const [hireDate, setHireDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [jobRole, setJobRole] = useState("employee");

  const reset = () => {
    setStep(1); setSaving(false); setSelectedUserId(""); setSelectedUser(null); setMode("system");
    setDisplayName(""); setJobTitle(""); setDepartment(""); setMonthlySalary("0");
    setHireDate(new Date().toISOString().slice(0, 10));
    setJobRole("employee");
  };

  const handleSelectSystemUser = () => {
    if (!selectedUser) {
      toast({ title: "اختر مستخدم أولاً", variant: "destructive" });
      return;
    }
    setStep(2);
  };

  const handleSaveProfile = async () => {
    if (!selectedUser) return;
    setSaving(true);
    try {
      const profile = await employeeApi.upsertProfile({
        userId: selectedUser.id,
        displayName: selectedUser.displayName,
        jobTitle: jobTitle || null,
        department: department || null,
        monthlySalary: parseFloat(monthlySalary) || 0,
        hireDate: hireDate || null,
      });
      qc.invalidateQueries({ queryKey: ["employee-profiles"] });
      toast({ title: `تم إضافة ${selectedUser.displayName} للفريق ✅` });
      reset(); onSuccess(profile.id);
    } catch (e: any) {
      toast({ title: "خطأ", description: e.message, variant: "destructive" });
    } finally { setSaving(false); }
  };

  const handleSystemUserChange = (value: string) => {
    setSelectedUserId(value);
    const user = availableUsers.find(u => String(u.id) === value) ?? null;
    setSelectedUser(user);
    setDisplayName(user?.displayName ?? "");
    setJobRole(user?.role ?? "employee");
    const existingProfile = user ? existingProfiles.find(p => p.userId === user.id) ?? null : null;
    setJobTitle(existingProfile?.jobTitle ?? user?.jobTitle ?? "");
    setDepartment(existingProfile?.department ?? user?.department ?? "");
    setMonthlySalary(existingProfile?.monthlySalary?.toString() ?? "0");
    setHireDate(existingProfile?.hireDate ?? new Date().toISOString().slice(0, 10));
  };

  // Team-only flow: single step — name + job info only
  const handleCreateTeamOnly = async () => {
    if (!displayName.trim()) {
      toast({ title: "الاسم مطلوب", variant: "destructive" }); return;
    }
    setSaving(true);
    try {
      const profile = await employeeApi.createProfile({
        displayName: displayName.trim(),
        jobTitle: jobTitle || null,
        department: department || null,
        monthlySalary: parseFloat(monthlySalary) || 0,
        hireDate: hireDate || null,
      });
      qc.invalidateQueries({ queryKey: ["employee-profiles"] });
      toast({ title: `تم إضافة ${displayName.trim()} للفريق ✅` });
      reset(); onSuccess(profile.id);
    } catch (e: any) {
      toast({ title: "خطأ", description: e.message, variant: "destructive" });
    } finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) { reset(); onClose(); }}}>
      <DialogContent className="max-w-md" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="w-4 h-4 text-primary" />
            إضافة عضو جديد
          </DialogTitle>
        </DialogHeader>

        {/* Mode toggle */}
        {step === 1 && (
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => setMode("system")}
              className={`p-3 rounded-lg border text-xs text-right transition-colors ${mode === "system" ? "border-primary bg-primary/5 text-primary font-bold" : "border-border hover:border-primary/40"}`}
            >
              <div className="font-bold mb-0.5">👤 عضو بحساب</div>
              <div className="text-[10px] text-muted-foreground">يدخل للنظام ويتتبع الطلبيات</div>
            </button>
            <button
              onClick={() => { setMode("team_only"); }}
              className={`p-3 rounded-lg border text-xs text-right transition-colors ${mode === "team_only" ? "border-amber-600 bg-amber-900/10 text-amber-400 font-bold" : "border-border hover:border-amber-700/40"}`}
            >
              <div className="font-bold mb-0.5">🏷️ عضو فريق فقط</div>
              <div className="text-[10px] text-muted-foreground">بدون حساب (مثل office boy)</div>
            </button>
          </div>
        )}

        {/* System user — step 1: account */}
        {mode === "system" && step === 1 && (
          <>
            <div className="flex items-center gap-2 text-[10px]">
              <div className="flex items-center gap-1 px-2.5 py-1 rounded-full font-bold bg-primary text-primary-foreground">١ اختيار المستخدم</div>
              <div className="flex-1 h-px bg-border" />
              <div className="flex items-center gap-1 px-2.5 py-1 rounded-full font-bold bg-muted text-muted-foreground">٢ بيانات الوظيفة</div>
            </div>
            <div className="space-y-3">
              <div>
                <Label className="text-xs font-bold">اختر المستخدم *</Label>
                <Select value={selectedUserId} onValueChange={handleSystemUserChange}>
                  <SelectTrigger className="h-9 text-xs mt-1">
                    <SelectValue placeholder="اختر مستخدمًا من إدارة المستخدمين" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableUsers.map(user => {
                      const linked = existingProfiles.some(p => p.userId === user.id);
                      return (
                        <SelectItem key={user.id} value={String(user.id)}>
                          <div className="flex flex-col items-start gap-0.5 w-full">
                            <span className="truncate font-medium">{user.displayName}</span>
                            <span className="text-[10px] text-muted-foreground shrink-0">
                              @{user.username} · {user.role}{linked ? " · مضاف" : ""}
                            </span>
                            {(user.jobTitle || user.department) && (
                              <span className="text-[10px] text-primary/70 truncate">
                                {user.jobTitle || "—"}{user.department ? ` — ${user.department}` : ""}
                              </span>
                            )}
                          </div>
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>
              {selectedUser && (
                <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 space-y-2 text-xs">
                  <div className="flex items-center justify-between gap-2">
                    <div className="font-bold truncate">{selectedUser.displayName}</div>
                    <Badge variant="outline" className="text-[10px] h-5 px-2 border-primary/30 text-primary">{jobRole}</Badge>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-muted-foreground">
                    <div className="truncate">اسم المستخدم: <span className="text-foreground font-medium">{selectedUser.username}</span></div>
                    <div className="truncate">الحالة: <span className="text-foreground font-medium">{selectedUser.isActive ? "نشط" : "غير نشط"}</span></div>
                  </div>
                  {(selectedUser.jobTitle || selectedUser.department) && (
                    <div className="grid grid-cols-2 gap-2 text-muted-foreground">
                      <div className="truncate">المسمى: <span className="text-foreground font-medium">{selectedUser.jobTitle || "—"}</span></div>
                      <div className="truncate">القسم: <span className="text-foreground font-medium">{selectedUser.department || "—"}</span></div>
                    </div>
                  )}
                  <div className="text-[10px] text-muted-foreground">
                    {existingProfiles.some(p => p.userId === selectedUser.id) ? "هذا المستخدم لديه ملف فريق بالفعل — سيتم تحديثه." : "هذا المستخدم غير مضاف للفريق بعد."}
                  </div>
                </div>
              )}
            </div>
          </>
        )}

        {/* System user — step 2: job info */}
        {mode === "system" && step === 2 && (
          <>
              <div className="flex items-center gap-2 text-[10px]">
                <div className="flex items-center gap-1 px-2.5 py-1 rounded-full font-bold bg-emerald-600/20 text-emerald-400"><Check className="w-3 h-3" /> بيانات الحساب</div>
                <div className="flex-1 h-px bg-border" />
                <div className="flex items-center gap-1 px-2.5 py-1 rounded-full font-bold bg-primary text-primary-foreground">٢ بيانات الوظيفة</div>
              </div>
              <div className="space-y-3">
                <div className="p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-xs text-emerald-400 flex items-center gap-2">
                  <Check className="w-3.5 h-3.5 shrink-0" />
                  تم اختيار <strong>{selectedUser?.displayName}</strong> — الدور: <strong>{jobRole}</strong>
                </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs font-bold">المسمى الوظيفي</Label>
                  <Input value={jobTitle} onChange={e => setJobTitle(e.target.value)} placeholder="مسؤول مبيعات" className="h-8 text-xs mt-1" />
                </div>
                <div>
                  <Label className="text-xs font-bold">القسم</Label>
                  <Input value={department} onChange={e => setDepartment(e.target.value)} placeholder="المبيعات" className="h-8 text-xs mt-1" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs font-bold">الراتب الشهري (ج.م)</Label>
                  <Input type="number" min="0" value={monthlySalary} onChange={e => setMonthlySalary(e.target.value)} className="h-8 text-xs mt-1" />
                </div>
                <div>
                  <Label className="text-xs font-bold">تاريخ التعيين</Label>
                  <Input type="date" value={hireDate} onChange={e => setHireDate(e.target.value)} className="h-8 text-xs mt-1" />
                </div>
              </div>
            </div>
          </>
        )}

        {/* Team-only — single step */}
        {mode === "team_only" && (
          <div className="space-y-3">
            <div className="p-2.5 rounded-lg bg-amber-900/10 border border-amber-700/30 text-xs text-amber-400 flex items-center gap-2">
              🏷️ هذا العضو لن يمتلك حساب دخول للنظام — يمكنك تتبع أداؤه يدوياً عبر المؤشرات
            </div>
            <div>
              <Label className="text-xs font-bold">الاسم الكامل *</Label>
              <Input value={displayName} onChange={e => setDisplayName(e.target.value)} placeholder="أحمد الساعي" className="h-8 text-xs mt-1" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-bold">المسمى الوظيفي</Label>
                <Input value={jobTitle} onChange={e => setJobTitle(e.target.value)} placeholder="office boy" className="h-8 text-xs mt-1" />
              </div>
              <div>
                <Label className="text-xs font-bold">القسم</Label>
                <Input value={department} onChange={e => setDepartment(e.target.value)} placeholder="الإدارة" className="h-8 text-xs mt-1" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-bold">الراتب الشهري (ج.م)</Label>
                <Input type="number" min="0" value={monthlySalary} onChange={e => setMonthlySalary(e.target.value)} className="h-8 text-xs mt-1" />
              </div>
              <div>
                <Label className="text-xs font-bold">تاريخ التعيين</Label>
                <Input type="date" value={hireDate} onChange={e => setHireDate(e.target.value)} className="h-8 text-xs mt-1" />
              </div>
            </div>
          </div>
        )}

        <DialogFooter>
          {mode === "system" && step === 1 && (
            <>
              <Button variant="outline" onClick={() => { reset(); onClose(); }} className="text-xs h-7">إلغاء</Button>
              <Button onClick={handleSelectSystemUser} disabled={saving || !selectedUserId} className="text-xs h-7 gap-1">
                {saving ? "..." : <><Check className="w-3 h-3" />التالي</>}
              </Button>
            </>
          )}
          {mode === "system" && step === 2 && (
            <>
              <Button variant="outline" onClick={() => setStep(1)} className="text-xs h-7">رجوع</Button>
              <Button onClick={handleSaveProfile} disabled={saving} className="text-xs h-7 gap-1">
                {saving ? "..." : <><Users className="w-3 h-3" />إضافة للفريق</>}
              </Button>
            </>
          )}
          {mode === "team_only" && (
            <>
              <Button variant="outline" onClick={() => { reset(); onClose(); }} className="text-xs h-7">إلغاء</Button>
              <Button onClick={handleCreateTeamOnly} disabled={saving || !displayName.trim()} className="text-xs h-7 gap-1 bg-amber-600 hover:bg-amber-700 text-white">
                {saving ? "..." : <><Users className="w-3 h-3" />إضافة للفريق</>}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Employee Detail ──────────────────────────────────────────────────────────
function EmployeeDetail({
  profileId, displayName, isSystemUser, username, onBack,
}: {
  profileId: number; displayName: string; isSystemUser: boolean; username?: string | null; onBack: () => void;
}) {
  const { isAdmin, can } = useAuth();
  const canSalaries   = isAdmin || can("team.salaries");
  const canPerformance = isAdmin || can("team.performance");
  const canManage     = isAdmin || can("team.manage");
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
    queryKey: ["employee-kpis", profileId],
    queryFn: () => employeeApi.listKpis(profileId),
  });

  const { data: fullProfile } = useQuery({
    queryKey: ["employee-profile", profileId],
    queryFn: () => employeeApi.getProfile(profileId),
  });

  const { data: report, isLoading: reportLoading } = useQuery({
    queryKey: ["employee-report", profileId, reportMonth],
    queryFn: () => employeeApi.getReport(profileId, reportMonth),
  });

  const deleteKpi = async (kpiId: number) => {
    if (!confirm("حذف هذا المؤشر؟")) return;
    try {
      await employeeApi.deleteKpi(kpiId);
      qc.invalidateQueries({ queryKey: ["employee-kpis", profileId] });
      qc.invalidateQueries({ queryKey: ["employee-report", profileId] });
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
          <h2 className="text-base font-bold">{displayName}</h2>
          <p className="text-xs text-muted-foreground">
            {fullProfile?.jobTitle && <span>{fullProfile.jobTitle}</span>}
            {fullProfile?.department && <span> — {fullProfile.department}</span>}
            {!fullProfile?.jobTitle && !fullProfile?.department && (
              isSystemUser && username ? <span>@{username}</span> : <span className="text-amber-400">عضو فريق · بدون حساب نظام</span>
            )}
          </p>
        </div>
        <div className="mr-auto flex items-center gap-2">
          {!isSystemUser && (
            <Badge variant="outline" className="text-[9px] h-5 border-amber-700 text-amber-400">فريق فقط</Badge>
          )}
          {isAdmin && (
            <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => setProfileOpen(true)}>
              <Edit2 className="w-3 h-3" />تعديل البيانات
            </Button>
          )}
        </div>
      </div>

      <Tabs defaultValue={canSalaries ? "attendance" : canPerformance ? "kpis" : "profile"}>
        {/* ── TabsList متجاوب — scroll أفقي على الموبايل ── */}
        <div className="overflow-x-auto no-scrollbar -mx-1 px-1">
          <TabsList className="h-9 text-xs flex w-max min-w-full sm:w-full gap-0.5 p-1 rounded-xl bg-muted/40 dark:bg-black/30 border border-border/50 backdrop-blur-sm">
            {canSalaries   && <TabsTrigger value="attendance" className="text-xs px-3 rounded-lg whitespace-nowrap transition-all duration-200 data-[state=active]:bg-background data-[state=active]:text-primary data-[state=active]:shadow-[0_0_12px_rgba(99,102,241,0.3),0_2px_8px_rgba(0,0,0,0.15)] dark:data-[state=active]:shadow-[0_0_16px_rgba(99,102,241,0.45),0_2px_10px_rgba(0,0,0,0.4)]">الحضور والمرتب</TabsTrigger>}
            {canManage     && <TabsTrigger value="daily"      className="text-xs px-3 rounded-lg whitespace-nowrap transition-all duration-200 data-[state=active]:bg-background data-[state=active]:text-primary data-[state=active]:shadow-[0_0_12px_rgba(99,102,241,0.3),0_2px_8px_rgba(0,0,0,0.15)] dark:data-[state=active]:shadow-[0_0_16px_rgba(99,102,241,0.45),0_2px_10px_rgba(0,0,0,0.4)]">متابعة يومية</TabsTrigger>}
            {canPerformance && <TabsTrigger value="kpis"      className="text-xs px-3 rounded-lg whitespace-nowrap transition-all duration-200 data-[state=active]:bg-background data-[state=active]:text-primary data-[state=active]:shadow-[0_0_12px_rgba(99,102,241,0.3),0_2px_8px_rgba(0,0,0,0.15)] dark:data-[state=active]:shadow-[0_0_16px_rgba(99,102,241,0.45),0_2px_10px_rgba(0,0,0,0.4)]">مؤشرات الأداء</TabsTrigger>}
            {canPerformance && <TabsTrigger value="report"    className="text-xs px-3 rounded-lg whitespace-nowrap transition-all duration-200 data-[state=active]:bg-background data-[state=active]:text-primary data-[state=active]:shadow-[0_0_12px_rgba(99,102,241,0.3),0_2px_8px_rgba(0,0,0,0.15)] dark:data-[state=active]:shadow-[0_0_16px_rgba(99,102,241,0.45),0_2px_10px_rgba(0,0,0,0.4)]">التقرير الشهري</TabsTrigger>}
            <TabsTrigger value="profile" className="text-xs px-3 rounded-lg whitespace-nowrap transition-all duration-200 data-[state=active]:bg-background data-[state=active]:text-primary data-[state=active]:shadow-[0_0_12px_rgba(99,102,241,0.3),0_2px_8px_rgba(0,0,0,0.15)] dark:data-[state=active]:shadow-[0_0_16px_rgba(99,102,241,0.45),0_2px_10px_rgba(0,0,0,0.4)]">الملف الشخصي</TabsTrigger>
          </TabsList>
        </div>

        {/* ─── Attendance Tab ─── */}
        {canSalaries && (
        <TabsContent value="attendance" className="space-y-3 mt-3">
          <AttendanceTab
            profileId={profileId}
            monthlySalary={fullProfile?.monthlySalary ?? 0}
            isAdmin={isAdmin}
          />
        </TabsContent>
        )}

        {/* ─── Daily Tracker Tab ─── */}
        {canManage && (
        <TabsContent value="daily" className="space-y-3 mt-3">
          <DailyTrackerTab profileId={profileId} />
        </TabsContent>
        )}

        {/* ─── KPIs Tab ─── */}
        {canPerformance && (
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
        )}

        {/* ─── Monthly Report Tab ─── */}
        {canPerformance && (
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
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {[
                  { label: "الطلبيات",      value: fmtNum(report.orderStats.total),          icon: Package,     color: "text-primary",                         bg: "bg-primary/5 dark:bg-primary/10",             glow: "shadow-[0_0_14px_rgba(99,102,241,0.18)] dark:shadow-[0_0_18px_rgba(99,102,241,0.3)]",  border: "border-primary/20 dark:border-primary/30",  gradient: "from-primary/5 to-transparent"         },
                  { label: "مُسلَّم",        value: fmtNum(report.orderStats.delivered),      icon: TrendingUp,  color: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-50 dark:bg-emerald-900/20",        glow: "shadow-[0_0_14px_rgba(16,185,129,0.18)] dark:shadow-[0_0_18px_rgba(16,185,129,0.3)]",   border: "border-emerald-200/60 dark:border-emerald-700/40", gradient: "from-emerald-500/5 to-transparent" },
                  { label: "مُرتجَع",        value: fmtNum(report.orderStats.returned),       icon: TrendingDown, color: "text-red-600 dark:text-red-400",        bg: "bg-red-50 dark:bg-red-900/20",                glow: "shadow-[0_0_14px_rgba(239,68,68,0.18)] dark:shadow-[0_0_18px_rgba(239,68,68,0.3)]",     border: "border-red-200/60 dark:border-red-700/40",  gradient: "from-red-500/5 to-transparent"          },
                  { label: "نسبة التسليم",  value: `${report.orderStats.deliveryRate}%`,     icon: Star,        color: "text-amber-600 dark:text-amber-400",     bg: "bg-amber-50 dark:bg-amber-900/20",            glow: "shadow-[0_0_14px_rgba(245,158,11,0.18)] dark:shadow-[0_0_18px_rgba(245,158,11,0.3)]",   border: "border-amber-200/60 dark:border-amber-700/40", gradient: "from-amber-500/5 to-transparent"      },
                ].map(s => (
                  <Card key={s.label} className={`relative overflow-hidden border-border ${s.bg} ${s.glow} ${s.border} transition-all duration-200`}>
                    <div className={`absolute inset-0 bg-gradient-to-br ${s.gradient} pointer-events-none`} />
                    <CardContent className="relative px-3 py-3 flex items-center gap-2">
                      <s.icon className={`w-4 h-4 shrink-0 ${s.color}`} />
                      <div>
                        <p className={`text-base font-bold ${s.color}`}>{s.value}</p>
                        <p className="text-[9px] text-muted-foreground">{s.label}</p>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {/* KPI Evaluation */}
              {report.kpis.length > 0 && (
                <div className="space-y-2">
                  <h3 className="text-xs font-bold text-muted-foreground flex items-center gap-1.5">
                    <Target className="w-3.5 h-3.5" />تقييم المؤشرات
                  </h3>
                  {report.kpis.map(kpi => (
                    <div key={kpi.id} className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${
                      kpi.achieved === true  ? "border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-900/20" :
                      kpi.achieved === false ? "border-red-200 dark:border-red-800/50 bg-red-50 dark:bg-red-900/10" :
                                               "border-border bg-card"
                    }`}>
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${
                        kpi.achieved === true  ? "bg-emerald-100 dark:bg-emerald-900/50" :
                        kpi.achieved === false ? "bg-red-100 dark:bg-red-900/40" :
                                                 "bg-muted/40"
                      }`}>
                        {kpi.achieved === true  ? <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" /> :
                         kpi.achieved === false ? <X className="w-3.5 h-3.5 text-red-600 dark:text-red-400" /> :
                                                  <AlertCircle className="w-3.5 h-3.5 text-muted-foreground" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2 mb-1.5">
                          <p className="text-xs font-bold">{kpi.name}</p>
                          <span className="text-[10px] text-muted-foreground shrink-0">
                            الفعلي: <strong className={kpi.achieved === true ? "text-emerald-600 dark:text-emerald-400" : kpi.achieved === false ? "text-red-600 dark:text-red-400" : "text-foreground"}>
                              {kpi.actualValue !== null ? `${fmtNum(kpi.actualValue)} ${kpi.unit}` : "—"}
                            </strong>
                            {" / هدف: "}{kpi.direction === "lower_is_better" ? "≤" : "≥"}{fmtNum(kpi.targetValue)} {kpi.unit}
                          </span>
                        </div>
                        <Progress
                          value={kpi.score ?? 0}
                          className={`h-1.5 ${kpi.achieved === true ? "[&>div]:bg-emerald-500" : kpi.achieved === false ? "[&>div]:bg-red-400" : "[&>div]:bg-primary"}`}
                        />
                      </div>
                      <Badge
                        variant="outline"
                        className={`text-[10px] shrink-0 ${
                          kpi.achieved === true  ? "border-emerald-500 dark:border-emerald-700 text-emerald-700 dark:text-emerald-400" :
                          kpi.achieved === false ? "border-red-500 dark:border-red-700 text-red-700 dark:text-red-400" :
                                                   "border-border text-muted-foreground"
                        }`}
                      >
                        {kpi.score !== null ? `${kpi.score}%` : "—"}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}

              {/* Salary card */}
              <Card className="relative overflow-hidden border-emerald-200 dark:border-emerald-900/40 bg-emerald-50 dark:bg-emerald-900/10 shadow-[0_0_20px_rgba(16,185,129,0.12)] dark:shadow-[0_0_24px_rgba(16,185,129,0.2)] transition-all duration-200">
                <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/8 to-transparent pointer-events-none" />
                <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-emerald-400/50 to-transparent" />
                <CardContent className="relative px-4 py-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <DollarSign className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    <div>
                      <p className="text-xs font-bold">الراتب المستحق</p>
                      <p className="text-[10px] text-muted-foreground">
                        {new Date(parseInt(reportMonth.split("-")[0]), parseInt(reportMonth.split("-")[1]) - 1, 1)
                          .toLocaleDateString("ar-EG", { month: "long", year: "numeric" })}
                      </p>
                    </div>
                  </div>
                  <span className="text-xl font-black text-emerald-600 dark:text-emerald-400">{fmt(report.salary)}</span>
                </CardContent>
              </Card>

              <MonthlyReport report={report} />
            </>
          )}
        </TabsContent>
        )}
        {/* ─── Profile Tab ─── */}
        <TabsContent value="profile" className="mt-3">
          <Card className="border-border bg-card">
            <CardContent className="px-4 py-4 space-y-3">
              {[
                { label: "الاسم الكامل", value: displayName, icon: <Users className="w-3.5 h-3.5" /> },
                ...(isSystemUser && username ? [{ label: "اسم المستخدم", value: `@${username}`, icon: null }] : []),
                ...(isSystemUser ? [] : [{ label: "نوع العضوية", value: "فريق فقط (بدون حساب)", icon: null }]),
                { label: "المسمى الوظيفي", value: fullProfile?.jobTitle || "—", icon: <Briefcase className="w-3.5 h-3.5" /> },
                { label: "القسم", value: fullProfile?.department || "—", icon: null },
                { label: "الراتب الشهري", value: fullProfile?.monthlySalary ? fmt(fullProfile.monthlySalary) : "—", icon: <DollarSign className="w-3.5 h-3.5" /> },
                { label: "تاريخ التعيين", value: fullProfile?.hireDate ? new Date(fullProfile.hireDate).toLocaleDateString("ar-EG") : "—", icon: <Calendar className="w-3.5 h-3.5" /> },
              ].map(row => (
                <div key={row.label} className="flex items-center justify-between py-1 border-b border-border/30 last:border-0">
                  <span className="text-xs text-muted-foreground flex items-center gap-1">{row.icon}{row.label}</span>
                  <span className="text-xs font-bold">{row.value}</span>
                </div>
              ))}
              {fullProfile?.notes && (
                <div className="pt-1">
                  <p className="text-[10px] text-muted-foreground">ملاحظات:</p>
                  <p className="text-xs mt-1">{fullProfile.notes}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {profileOpen && (
        <ProfileFormDialog
          open={profileOpen}
          onClose={() => { setProfileOpen(false); qc.invalidateQueries({ queryKey: ["employee-profile", profileId] }); qc.invalidateQueries({ queryKey: ["employee-profiles"] }); }}
          profileId={profileId}
          displayName={displayName}
          isSystemUser={isSystemUser}
          existing={fullProfile ?? null}
        />
      )}

      {kpiDialogOpen && (
        <KpiFormDialog
          open={kpiDialogOpen}
          onClose={() => { setKpiDialogOpen(false); setEditingKpi(undefined); }}
          profileId={profileId}
          isSystemUser={isSystemUser}
          existing={editingKpi}
        />
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function TeamPage() {
  const { isAdmin, can, user } = useAuth();
  const isSuperAdmin = user?.role === "super_admin";
  // ── Team permission shortcuts ──────────────────────────────────────────────
  const canManage     = isAdmin || can("team.manage");
  const canSalaries   = isAdmin || can("team.salaries");
  const canPerformance = isAdmin || can("team.performance");
  const canAddMember  = isAdmin || can("add_team_member");

  // ── Access guard — لازم يكون عنده على الأقل واحدة ──────────────────────────
  if (!isAdmin && !can("team.view") && !can("team.manage") && !can("team.salaries") && !can("team.performance")) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-center px-4">
        <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center">
          <span className="text-3xl">🔒</span>
        </div>
        <h2 className="text-xl font-bold">غير مصرح بالوصول</h2>
        <p className="text-muted-foreground text-sm max-w-xs">ليس لديك صلاحية لعرض صفحة الفريق. تواصل مع المدير.</p>
      </div>
    );
  }
  const { toast } = useToast();
  const qc = useQueryClient();
  const [selectedProfileId, setSelectedProfileId] = useState<number | null>(null);
  const [addProfileOpen, setAddProfileOpen] = useState(false);
  const [addingUser, setAddingUser] = useState<AppUser | null>(null);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);
  const [deleting, setDeleting] = useState(false);

  const { data: appSettings } = useQuery({
    queryKey: ["app-settings"],
    queryFn: appSettingsApi.get,
  });

  const showAddMemberBtn = appSettings?.showAddTeamMember ?? true;
  // لو عنده صلاحية add_team_member → يظهر الزرار بغض النظر عن appSettings
  const canShowWizard = canAddMember && (showAddMemberBtn || can("add_team_member"));

  const { data: profiles = [], isLoading: profilesLoading } = useQuery({
    queryKey: ["employee-profiles"],
    queryFn: employeeApi.listProfiles,
  });
  
  const { data: allUsers = [] } = useQuery({
    queryKey: ["users"],
    queryFn: usersApi.list,
  });

  const profiledUserIds2 = new Set(profiles.map(p => (p as any).userId).filter(Boolean));
  const unprofiledUsers = allUsers.filter((u: any) => !profiledUserIds2.has(u.id) && u.isActive);

  const profileToDelete = profiles.find(p => p.id === deleteConfirmId);

  const handleDeleteProfile = async () => {
    if (!deleteConfirmId) return;
    setDeleting(true);
    try {
      await employeeApi.deleteProfile(deleteConfirmId);
      qc.invalidateQueries({ queryKey: ["employee-profiles"] });
      toast({ title: "تم حذف العضو بنجاح" });
      setDeleteConfirmId(null);
    } catch (e: any) {
      toast({ title: "خطأ", description: e.message, variant: "destructive" });
    } finally {
      setDeleting(false);
    }
  };

  const selectedProfile = profiles.find(p => p.id === selectedProfileId);

  if (selectedProfileId !== null && selectedProfile) {
    return (
      <div className="max-w-3xl mx-auto animate-in fade-in duration-300">
        <EmployeeDetail
          profileId={selectedProfileId}
          displayName={selectedProfile.displayName ?? "—"}
          isSystemUser={!!(selectedProfile as any).isSystemUser}
          username={(selectedProfile as any).username}
          onBack={() => setSelectedProfileId(null)}
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
        {canAddMember && unprofiledUsers.length > 0 && (
          <Button size="sm" variant="outline" className="gap-1 h-8 text-xs" onClick={() => setAddProfileOpen(true)}>
            <UserPlus className="w-3.5 h-3.5" />موظف موجود
          </Button>
        )}
        {canShowWizard && (
          <Button size="sm" className="gap-1 h-8 text-xs" onClick={() => setWizardOpen(true)}>
            <Plus className="w-3.5 h-3.5" />عضو جديد
          </Button>
        )}
      </div>

      {profilesLoading && <p className="text-center text-muted-foreground py-12 text-sm">جاري التحميل...</p>}

      {!profilesLoading && profiles.length === 0 && (
        <div className="text-center py-16 text-muted-foreground">
          <Users className="w-10 h-10 mx-auto mb-3 opacity-20" />
          <p className="text-sm">لا توجد ملفات موظفين بعد.</p>
          {canAddMember && unprofiledUsers.length > 0 && (
            <Button size="sm" className="mt-3 text-xs" onClick={() => setAddProfileOpen(true)}>
              إضافة موظف
            </Button>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {profiles.map(profile => {
          const isSystemUser = !!(profile as any).isSystemUser;
          const roleMap: Record<string, string> = { super_admin: "سوبر أدمن", admin: "مدير", warehouse: "مخزن", employee: "موظف" };
          const roleLabel = (profile as any).role ? (roleMap[(profile as any).role] ?? (profile as any).role) : (isSystemUser ? "موظف" : "فريق فقط");
          const name = profile.displayName ?? "—";
          const att = (profile as any).attendanceSummary ?? { workedDays: 0, absentDays: 0, lateDays: 0 };
          const kpiCount = (profile as any).kpiCount ?? 0;
          const totalDaysInMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate();
          const attPct = Math.min(100, Math.round((att.workedDays / Math.max(totalDaysInMonth, 1)) * 100));

          // لون بناءً على نسبة الحضور
          const attColor = att.workedDays === 0
            ? { text: "text-muted-foreground", bar: "#6B7280", glow: "rgba(107,114,128,0.3)" }
            : attPct >= 80
            ? { text: "text-emerald-400", bar: "#10B981", glow: "rgba(16,185,129,0.35)" }
            : attPct >= 50
            ? { text: "text-amber-400", bar: "#F59E0B", glow: "rgba(245,158,11,0.35)" }
            : { text: "text-red-400", bar: "#EF4444", glow: "rgba(239,68,68,0.35)" };

          return (
            <div
              key={profile.id}
              className="group relative overflow-hidden rounded-[22px] cursor-pointer transition-all duration-200 hover:-translate-y-1 dark:border-white/10 border-black/10"
              style={{
                background: "hsl(var(--card))",
                border: "1px solid hsl(var(--border))",
                boxShadow: "0 2px 12px rgba(0,0,0,0.08), 0 4px 24px rgba(0,0,0,0.06)",
              }}
              onClick={() => setSelectedProfileId(profile.id)}
            >
              {/* خط ضوء علوي */}
              <div className="absolute inset-x-0 top-0 h-px"
                style={{ background: isSystemUser
                  ? "linear-gradient(90deg, transparent, rgba(201,162,39,0.6), transparent)"
                  : "linear-gradient(90deg, transparent, rgba(245,158,11,0.4), transparent)" }} />

              {/* كرة ضوء خلفية */}
              <div className="absolute -top-10 -right-10 w-32 h-32 rounded-full pointer-events-none"
                style={{ background: isSystemUser ? "rgba(201,162,39,0.06)" : "rgba(245,158,11,0.04)", filter: "blur(20px)" }} />

              <div className="p-5">
                {/* ── الهيدر ── */}
                <div className="flex items-start justify-between gap-3 mb-4">
                  <div className="flex items-center gap-3">
                    {/* الأفاتار */}
                    {profile.avatar ? (
                      <img src={profile.avatar} alt={name}
                        className="w-12 h-12 rounded-2xl object-cover shrink-0"
                        style={{ border: "2px solid rgba(255,255,255,0.12)" }} />
                    ) : (
                      <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-lg font-black shrink-0"
                        style={{
                          background: isSystemUser ? "rgba(201,162,39,0.15)" : "rgba(245,158,11,0.10)",
                          border: `2px solid ${isSystemUser ? "rgba(201,162,39,0.35)" : "rgba(245,158,11,0.25)"}`,
                          color: isSystemUser ? "#c9a227" : "#F59E0B",
                        }}>
                        {name.charAt(0)}
                      </div>
                    )}

                    <div className="min-w-0">
                      <p className="text-sm font-bold truncate" style={{ color: "hsl(var(--foreground))" }}>{name}</p>
                      <p className="text-[11px] truncate mt-0.5" style={{ color: "hsl(var(--muted-foreground))" }}>
                        {profile.jobTitle || (isSystemUser ? "موظف" : "عضو فريق")}
                        {profile.department && (
                          <span style={{ color: "rgba(255,255,255,0.35)" }}> · {profile.department}</span>
                        )}
                      </p>
                    </div>
                  </div>

                  {/* Badge الدور + زرار حذف للسوبر ادمن */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="text-[9px] font-bold px-2 py-0.5 rounded-full"
                      style={{
                        background: isSystemUser ? "rgba(201,162,39,0.15)" : "rgba(245,158,11,0.10)",
                        color: isSystemUser ? "#c9a227" : "#F59E0B",
                        border: `1px solid ${isSystemUser ? "rgba(201,162,39,0.30)" : "rgba(245,158,11,0.20)"}`,
                      }}>
                      {roleLabel}
                    </span>
                    {isSuperAdmin && (
                      <button
                        onClick={(e) => { e.stopPropagation(); setDeleteConfirmId(profile.id); }}
                        className="w-6 h-6 rounded-lg flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                        title="حذف العضو"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </div>

                {/* ── الإحصائيات ── */}
                <div className="grid grid-cols-2 gap-3 mb-4">
                  {/* الحضور */}
                  <div className="rounded-xl p-3 bg-muted/40 dark:bg-white/[0.04] border border-border/60 dark:border-white/[0.07]">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-[10px] font-bold text-muted-foreground">الحضور</p>
                      <span className={`text-sm font-black ${attColor.text}`}>
                        {att.workedDays > 0 ? att.workedDays : "—"}
                      </span>
                    </div>
                    {/* شريط الحضور */}
                    <div className="w-full h-1.5 rounded-full bg-muted/60 dark:bg-white/[0.08]">
                      <div className="h-1.5 rounded-full transition-all duration-500"
                        style={{
                          width: `${attPct}%`,
                          background: attColor.bar,
                          boxShadow: att.workedDays > 0 ? `0 0 6px ${attColor.glow}` : "none",
                        }} />
                    </div>
                    <p className="text-[9px] mt-1 text-muted-foreground/70">
                      {att.workedDays > 0 ? `${attPct}% من الشهر` : "لا يوجد سجل"}
                    </p>
                  </div>

                  {/* مؤشرات الأداء */}
                  <div className="rounded-xl p-3 bg-muted/40 dark:bg-white/[0.04] border border-border/60 dark:border-white/[0.07]">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-[10px] font-bold text-muted-foreground">مؤشرات الأداء</p>
                      <span className={`text-sm font-black ${kpiCount > 0 ? "text-indigo-500 dark:text-indigo-400" : "text-muted-foreground/40"}`}>
                        {kpiCount > 0 ? kpiCount : "—"}
                      </span>
                    </div>
                    {/* نقاط المؤشرات */}
                    <div className="flex gap-1 flex-wrap">
                      {kpiCount > 0
                        ? Array.from({ length: Math.min(kpiCount, 6) }).map((_, i) => (
                            <div key={i} className="w-2 h-2 rounded-full"
                              style={{ background: "#6366F1", boxShadow: "0 0 4px rgba(99,102,241,0.5)" }} />
                          ))
                        : <p className="text-[9px] text-muted-foreground/50">لم تُضف بعد</p>
                      }
                      {kpiCount > 6 && (
                        <span className="text-[9px] text-indigo-500 dark:text-indigo-400/70">+{kpiCount - 6}</span>
                      )}
                    </div>
                    <p className="text-[9px] mt-1 text-muted-foreground/70">
                      {kpiCount > 0 ? `${kpiCount} مؤشر نشط` : "أضف مؤشرات أداء"}
                    </p>
                  </div>
                </div>

                {/* ── الفوتر ── */}
                <div className="flex items-center justify-between pt-3 border-t border-border/50">
                  <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground/60">
                    <Target className="w-3 h-3" />
                    <span>عرض المؤشرات والتقرير</span>
                  </div>
                  {/* غياب لو فيه */}
                  {att.absentDays > 0 && (
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-red-500/15 text-red-500 dark:text-red-400 border border-red-500/25">
                      غياب: {att.absentDays}
                    </span>
                  )}
                  <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/30" />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Add member wizard */}
      <AddMemberWizard
        open={wizardOpen}
        onClose={() => setWizardOpen(false)}
        onSuccess={(profileId) => { setWizardOpen(false); setSelectedProfileId(profileId); }}
        availableUsers={allUsers}
        existingProfiles={profiles}
      />

      {/* Add profile dialog (existing users without profile) */}
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
                onClick={async () => {
                  if (addingUser) {
                    try {
                      const created = await employeeApi.upsertProfile({ userId: addingUser.id });
                      qc.invalidateQueries({ queryKey: ["employee-profiles"] });
                      setAddProfileOpen(false);
                      setAddingUser(null);
                      setSelectedProfileId(created.id);
                    } catch {
                      setAddProfileOpen(false);
                    }
                  }
                }}
                className="text-xs h-7"
              >
                إضافة للفريق
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* ── Delete Confirm Dialog — super_admin فقط ── */}
      {deleteConfirmId !== null && (
        <Dialog open onOpenChange={() => setDeleteConfirmId(null)}>
          <DialogContent className="max-w-sm" dir="rtl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-destructive">
                <Trash2 className="w-4 h-4" />
                حذف العضو
              </DialogTitle>
            </DialogHeader>
            <div className="py-2 space-y-2">
              <p className="text-sm">
                هل أنت متأكد من حذف{" "}
                <strong>{profileToDelete?.displayName ?? "هذا العضو"}</strong>؟
              </p>
              <p className="text-xs text-muted-foreground">
                سيتم حذف الملف الشخصي ومؤشرات الأداء وسجل الحضور. هذا الإجراء لا يمكن التراجع عنه.
              </p>
            </div>
            <DialogFooter className="gap-2">
              <Button variant="outline" size="sm" onClick={() => setDeleteConfirmId(null)} className="text-xs">إلغاء</Button>
              <Button variant="destructive" size="sm" onClick={handleDeleteProfile} disabled={deleting} className="text-xs gap-1">
                {deleting ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
                {deleting ? "جارٍ الحذف..." : "حذف نهائي"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
