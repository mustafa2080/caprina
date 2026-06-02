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
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell, ReferenceLine, PieChart, Pie,
} from "recharts";
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
  open, onClose, profileId, isSystemUser, existing, monthlySalary = 0,
}: {
  open: boolean; onClose: () => void; profileId: number; isSystemUser: boolean; existing?: EmployeeKpi; monthlySalary?: number;
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
  const [salaryWeight, setSalaryWeight] = useState<string>(existing?.salaryWeight?.toString() ?? "0");
  const [overtargetBonus, setOvertargetBonus] = useState<string>(existing?.overtargetBonus?.toString() ?? "0");
  const [description, setDescription] = useState(existing?.description ?? "");
  const [isActive, setIsActive] = useState(existing?.isActive ?? true);
  const [saving, setSaving] = useState(false);

  const salaryWeightNum = parseFloat(salaryWeight) || 0;
  const overtargetBonusNum = parseFloat(overtargetBonus) || 0;
  const kpiSalaryValue = monthlySalary > 0 ? Math.round((salaryWeightNum / 100) * monthlySalary) : null;
  const overtargetValue = monthlySalary > 0 ? Math.round((overtargetBonusNum / 100) * monthlySalary) : null;

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
      const payload = {
        name, metric, targetValue: parseFloat(targetValue), unit,
        direction, weight: parseFloat(weight), isActive, description: description || null,
        salaryWeight: salaryWeightNum,
        overtargetBonus: overtargetBonusNum,
      };
      if (existing) {
        await employeeApi.updateKpi(existing.id, payload as any);
        toast({ title: "تم تحديث المؤشر" });
      } else {
        await employeeApi.createKpi({ profileId, ...payload } as any);
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
      <DialogContent className="max-w-lg" dir="rtl">
        <DialogHeader><DialogTitle className="flex items-center gap-2">
          <Target className="w-4 h-4 text-primary" />
          {existing ? "تعديل المؤشر" : "إضافة مؤشر أداء KPI"}
        </DialogTitle></DialogHeader>
        <div className="space-y-3 py-2 max-h-[70vh] overflow-y-auto pr-1">

          {/* نوع المؤشر */}
          <div className="space-y-1">
            <Label className="text-xs font-bold">نوع المؤشر</Label>
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

          {/* اسم + هدف + وحدة */}
          <div className="space-y-1">
            <Label className="text-xs font-bold">اسم المؤشر *</Label>
            <Input value={name} onChange={e => setName(e.target.value)} className="h-8 text-xs" placeholder="مثال: نسبة التسليم الشهرية" />
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

          {/* الاتجاه */}
          <div className="space-y-1">
            <Label className="text-xs font-bold">الاتجاه</Label>
            <Select value={direction} onValueChange={v => setDirection(v as any)}>
              <SelectTrigger className="h-8 text-xs bg-card"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="higher_is_better">↑ كلما زاد كلما كان أفضل</SelectItem>
                <SelectItem value="lower_is_better">↓ كلما قلّ كلما كان أفضل</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* ── قسم ربط KPI بالراتب ── */}
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-3 space-y-3">
            <p className="text-xs font-bold text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
              <DollarSign className="w-3.5 h-3.5" />
              ربط المؤشر بالراتب
            </p>
            <div className="grid grid-cols-2 gap-3">
              {/* نسبة الخصم */}
              <div className="space-y-1">
                <Label className="text-[10px] font-bold text-muted-foreground">نسبة المؤشر من الراتب (%)</Label>
                <div className="relative">
                  <Input
                    type="number" min="0" max="100" step="0.5"
                    value={salaryWeight}
                    onChange={e => setSalaryWeight(e.target.value)}
                    className="h-8 text-xs pl-8"
                    placeholder="10"
                  />
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground font-bold">%</span>
                </div>
                {kpiSalaryValue !== null && salaryWeightNum > 0 && (
                  <p className="text-[9px] text-amber-600 dark:text-amber-400 font-medium">= {fmt(kpiSalaryValue)} من الراتب</p>
                )}
                <p className="text-[9px] text-muted-foreground/70">لو لم يتحقق → يُخصم هذا المبلغ تلقائياً</p>
              </div>
              {/* مكافأة Over Target */}
              <div className="space-y-1">
                <Label className="text-[10px] font-bold text-muted-foreground">مكافأة Over Target (%)</Label>
                <div className="relative">
                  <Input
                    type="number" min="0" max="100" step="0.5"
                    value={overtargetBonus}
                    onChange={e => setOvertargetBonus(e.target.value)}
                    className="h-8 text-xs pl-8"
                    placeholder="5"
                  />
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground font-bold">%</span>
                </div>
                {overtargetValue !== null && overtargetBonusNum > 0 && (
                  <p className="text-[9px] text-emerald-600 dark:text-emerald-400 font-medium">= +{fmt(overtargetValue)} مكافأة</p>
                )}
                <p className="text-[9px] text-muted-foreground/70">لو تجاوز الهدف → مكافأة إضافية</p>
              </div>
            </div>
            {/* معاينة حية */}
            {(salaryWeightNum > 0 || overtargetBonusNum > 0) && monthlySalary > 0 && (
              <div className="rounded-lg bg-background/60 border border-border/50 p-2.5 space-y-1.5">
                <p className="text-[10px] font-bold text-muted-foreground">📊 معاينة التأثير على الراتب:</p>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="rounded-lg bg-muted/40 p-2">
                    <p className="text-[9px] text-muted-foreground">الراتب الأساسي</p>
                    <p className="text-xs font-black text-foreground">{fmt(monthlySalary)}</p>
                  </div>
                  <div className="rounded-lg bg-red-500/10 border border-red-500/20 p-2">
                    <p className="text-[9px] text-red-500">حالة القصور</p>
                    <p className="text-xs font-black text-red-500">{fmt(monthlySalary - (kpiSalaryValue ?? 0))}</p>
                  </div>
                  <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/20 p-2">
                    <p className="text-[9px] text-emerald-500">Over Target</p>
                    <p className="text-xs font-black text-emerald-500">{fmt(monthlySalary + (overtargetValue ?? 0))}</p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* وصف + تفعيل */}
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
          <Button onClick={handleSave} disabled={saving} className="text-xs h-7 gap-1">
            {saving ? <><RefreshCw className="w-3 h-3 animate-spin" />جاري الحفظ...</> : <><Save className="w-3 h-3" />حفظ المؤشر</>}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Monthly Report ───────────────────────────────────────────────────────────
function MonthlyReport({ report }: { report: EmployeeReport }) {
  const printRef = useRef<HTMLDivElement>(null);
  const ratingCfg = RATING_CONFIG[report.rating] ?? RATING_CONFIG["غير محدد"];

  const { data: salaryReport } = useQuery({
    queryKey: ["salary-report", report.profile?.id, report.period.month],
    queryFn: () => {
      const profileId = report.profile?.id;
      if (!profileId) return null;
      return attendanceApi.salaryReport(profileId, report.period.month);
    },
    enabled: !!report.profile?.id,
  });

  // ── حساب تأثير KPI على الراتب ─────────────────────────────────────────────
  const baseSalary = salaryReport?.baseSalary ?? report.salary ?? 0;
  const kpiFinancials = report.kpiFinancials ?? {
    totalSalaryWeight: report.kpis.reduce((sum, k) => sum + (k.salaryWeight ?? 0), 0),
    salaryAtRiskPercent: report.kpis.reduce((sum, k) => sum + (k.salaryWeight ?? 0), 0),
    totalDeduction: report.kpis
      .filter(k => k.achieved === false && (k.salaryWeight ?? 0) > 0)
      .reduce((sum, k) => sum + Math.round(((k.salaryWeight ?? 0) / 100) * baseSalary), 0),
    totalBonus: report.kpis
      .filter(k => k.score !== null && k.score > 100 && (k.overtargetBonus ?? 0) > 0)
      .reduce((sum, k) => sum + Math.round(((k.overtargetBonus ?? 0) / 100) * baseSalary), 0),
    achievedCount: report.kpis.filter(k => k.achieved === true).length,
    failedCount: report.kpis.filter(k => k.achieved === false).length,
    overTargetCount: report.kpis.filter(k => k.score !== null && k.score > 100).length,
  };
  const kpiDeductions = kpiFinancials.totalDeduction;
  const kpiBonuses = kpiFinancials.totalBonus;
  const kpiAchievedCount = kpiFinancials.achievedCount;
  const kpiFailedCount = kpiFinancials.failedCount;
  const kpiOverTargetCount = kpiFinancials.overTargetCount;

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
            <div className="bg-muted/20 border border-border/50 rounded-lg p-3">
              <h3 className="text-[10px] text-muted-foreground uppercase mb-2 font-semibold">بيانات الموظف</h3>
              {[
                ["الاسم", report.displayName],
                ["المسمى الوظيفي", report.profile?.jobTitle || "—"],
                ["القسم", report.profile?.department || "—"],
                ["تاريخ التعيين", report.profile?.hireDate ? new Date(report.profile.hireDate).toLocaleDateString("ar-EG") : "—"],
              ].map(([label, value]) => (
                <div key={label} className="flex justify-between text-xs mb-1">
                  <span className="text-muted-foreground">{label}</span>
                  <span className="font-semibold">{value}</span>
                </div>
              ))}
            </div>
            <div className="bg-muted/20 border border-border/50 rounded-lg p-3">
              <h3 className="text-[10px] text-muted-foreground uppercase mb-2 font-semibold">فترة التقرير</h3>
              {[
                ["الشهر", periodLabel],
                ["من", new Date(report.period.from).toLocaleDateString("ar-EG")],
                ["إلى", new Date(report.period.to).toLocaleDateString("ar-EG")],
                ["إجمالي الطلبيات", fmtNum(report.orderStats.total)],
              ].map(([label, value]) => (
                <div key={label} className="flex justify-between text-xs mb-1">
                  <span className="text-muted-foreground">{label}</span>
                  <span className="font-semibold">{value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Order Stats */}
          <div className="grid grid-cols-4 gap-2 mb-5">
            {[
              { label: "إجمالي الطلبيات", value: fmtNum(report.orderStats.total), colorCls: "text-foreground", bgCls: "bg-muted/20 border-border/50" },
              { label: "مُسلَّم", value: fmtNum(report.orderStats.delivered), colorCls: "text-emerald-500", bgCls: "bg-emerald-500/10 border-emerald-500/20" },
              { label: "مُرتجَع", value: fmtNum(report.orderStats.returned), colorCls: "text-red-500", bgCls: "bg-red-500/10 border-red-500/20" },
              { label: "نسبة التسليم", value: `${report.orderStats.deliveryRate}%`, colorCls: "text-[#c9a227]", bgCls: "bg-[#c9a227]/10 border-[#c9a227]/20" },
            ].map(s => (
              <div key={s.label} className={`border rounded-xl p-2.5 text-center ${s.bgCls}`}>
                <div className={`text-xl font-black ${s.colorCls}`}>{s.value}</div>
                <div className="text-[10px] text-muted-foreground mt-0.5">{s.label}</div>
              </div>
            ))}
          </div>

          {/* KPIs Table */}
          {report.kpis.length > 0 && (
            <div style={{ marginBottom: 20 }}>
              <h3 style={{ fontSize: 13, fontWeight: 700, marginBottom: 8, borderRight: "3px solid #c9a227", paddingRight: 8 }}>مؤشرات الأداء الرئيسية</h3>

              {/* ملخص KPI المالي */}
              {(kpiDeductions > 0 || kpiBonuses > 0) && (
                <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
                  {kpiDeductions > 0 && (
                    <div style={{ flex: 1, background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8, padding: "8px 12px", textAlign: "center" }}>
                      <div style={{ fontSize: 10, color: "#888", marginBottom: 2 }}>إجمالي خصم KPI</div>
                      <div style={{ fontSize: 16, fontWeight: 900, color: "#dc2626" }}>−{fmt(kpiDeductions)}</div>
                      <div style={{ fontSize: 9, color: "#999" }}>{kpiFailedCount} مؤشر لم يتحقق</div>
                    </div>
                  )}
                  {kpiBonuses > 0 && (
                    <div style={{ flex: 1, background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 8, padding: "8px 12px", textAlign: "center" }}>
                      <div style={{ fontSize: 10, color: "#888", marginBottom: 2 }}>إجمالي مكافأة Over Target</div>
                      <div style={{ fontSize: 16, fontWeight: 900, color: "#16a34a" }}>+{fmt(kpiBonuses)}</div>
                      <div style={{ fontSize: 9, color: "#999" }}>🏆 {kpiOverTargetCount} مؤشر</div>
                    </div>
                  )}
                </div>
              )}

              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    {["المؤشر", "الهدف", "الفعلي", "الدرجة", "الحالة", "التأثير المالي"].map(h => (
                      <th key={h} style={{ background: "#c9a227", color: "white", padding: "8px 10px", textAlign: "right", fontSize: 11 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {report.kpis.map((kpi, i) => {
                    const sw = kpi.salaryWeight ?? 0;
                    const ot = kpi.overtargetBonus ?? 0;
                    const kpiAmt = sw > 0 && baseSalary > 0 ? Math.round((sw / 100) * baseSalary) : 0;
                    const otAmt  = ot > 0 && baseSalary > 0 ? Math.round((ot / 100) * baseSalary) : 0;
                    const isOT   = kpi.score !== null && kpi.score > 100;
                    return (
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
                      <td style={{ padding: "8px 10px", borderBottom: "1px solid #eee", background: i % 2 === 0 ? "white" : "#fafafa", fontSize: 12, fontWeight: 700, color: isOT ? "#2563eb" : kpi.achieved ? "#16a34a" : kpi.achieved === false ? "#dc2626" : "#888" }}>
                        {isOT ? "🏆 Over Target" : kpi.achieved === true ? "✓ محقق" : kpi.achieved === false ? "✗ لم يتحقق" : "—"}
                      </td>
                      <td style={{ padding: "8px 10px", borderBottom: "1px solid #eee", background: i % 2 === 0 ? "white" : "#fafafa", fontSize: 11, fontWeight: 700 }}>
                        {isOT && otAmt > 0 ? (
                          <span style={{ color: "#16a34a" }}>+{fmt(otAmt)}</span>
                        ) : kpi.achieved === false && kpiAmt > 0 ? (
                          <span style={{ color: "#dc2626" }}>−{fmt(kpiAmt)}</span>
                        ) : kpi.achieved === true ? (
                          <span style={{ color: "#888" }}>لا خصم</span>
                        ) : (
                          <span style={{ color: "#ccc" }}>—</span>
                        )}
                      </td>
                    </tr>
                    );
                  })}
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
              <div className="grid grid-cols-3 gap-1.5 mb-3">
                {[
                  { label: "أيام الحضور",  val: salaryReport.workedDays,        colorCls: "text-emerald-500", bgCls: "bg-emerald-500/10 border-emerald-500/20" },
                  { label: "أيام الغياب",  val: salaryReport.absentDays,        colorCls: "text-red-500",     bgCls: "bg-red-500/10 border-red-500/20" },
                  { label: "أيام التأخير", val: salaryReport.lateDays,          colorCls: "text-amber-500",   bgCls: "bg-amber-500/10 border-amber-500/20" },
                  { label: "نصف يوم",      val: salaryReport.halfDays,          colorCls: "text-blue-500",    bgCls: "bg-blue-500/10 border-blue-500/20" },
                  { label: "إجمالي الأيام", val: salaryReport.totalWorkingDays, colorCls: "text-muted-foreground", bgCls: "bg-muted/20 border-border/50" },
                  { label: "أيام العمل الفعلية", val: salaryReport.workedDays + salaryReport.halfDays * 0.5, colorCls: "text-[#c9a227]", bgCls: "bg-[#c9a227]/10 border-[#c9a227]/20" },
                ].map(s => (
                  <div key={s.label} className={`border rounded-xl p-2.5 text-center ${s.bgCls}`}>
                    <div className={`text-2xl font-black leading-none ${s.colorCls}`}>{s.val}</div>
                    <div className="text-[9px] text-muted-foreground mt-1 font-medium">{s.label}</div>
                  </div>
                ))}
              </div>

              {/* Salary breakdown */}
              <div className="border border-border/50 rounded-xl overflow-hidden mb-2.5">
                <div className="bg-[#c9a227] px-3 py-2 flex justify-between items-center">
                  <span className="text-white font-bold text-xs">البند</span>
                  <span className="text-white font-bold text-xs">المبلغ</span>
                </div>
                {/* الراتب الأساسي */}
                <div className="flex justify-between items-center px-3 py-2 border-b border-border/30 bg-muted/10">
                  <span className="text-xs text-muted-foreground">الراتب الأساسي</span>
                  <span className="text-sm font-bold text-foreground">{fmt(salaryReport.baseSalary)}</span>
                </div>
                {/* خصم الغياب */}
                <div className={`flex justify-between items-center px-3 py-2 border-b border-border/30 ${salaryReport.attendanceDeduction > 0 ? "bg-red-500/5" : "bg-muted/10"}`}>
                  <span className="text-xs text-muted-foreground">خصم الغياب / نصف اليوم</span>
                  <span className={`text-sm font-bold ${salaryReport.attendanceDeduction > 0 ? "text-red-500" : "text-muted-foreground"}`}>
                    {salaryReport.attendanceDeduction > 0 ? `−${fmt(salaryReport.attendanceDeduction)}` : "—"}
                  </span>
                </div>
                {/* خصم KPI */}
                <div className={`flex justify-between items-center px-3 py-2 border-b border-border/30 ${kpiDeductions > 0 ? "bg-red-500/5" : "bg-muted/10"}`}>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs text-muted-foreground">خصم مؤشرات KPI</span>
                    {kpiDeductions > 0 && (
                      <span className="text-[9px] bg-red-500/15 text-red-600 dark:text-red-400 rounded-full px-1.5 py-0.5 font-bold">{kpiFailedCount} مؤشر لم يتحقق</span>
                    )}
                  </div>
                  <span className={`text-sm font-bold ${kpiDeductions > 0 ? "text-red-500" : "text-muted-foreground"}`}>
                    {kpiDeductions > 0 ? `−${fmt(kpiDeductions)}` : "—"}
                  </span>
                </div>
                {/* مكافأة بونص */}
                <div className={`flex justify-between items-center px-3 py-2 border-b border-border/30 ${salaryReport.bonuses > 0 ? "bg-emerald-500/5" : "bg-muted/10"}`}>
                  <span className="text-xs text-muted-foreground">بونص إضافي</span>
                  <span className={`text-sm font-bold ${salaryReport.bonuses > 0 ? "text-emerald-500" : "text-muted-foreground"}`}>
                    {salaryReport.bonuses > 0 ? `+${fmt(salaryReport.bonuses)}` : "—"}
                  </span>
                </div>
                {/* مكافأة Over Target */}
                <div className={`flex justify-between items-center px-3 py-2 border-b border-border/30 ${kpiBonuses > 0 ? "bg-emerald-500/5" : "bg-muted/10"}`}>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs text-muted-foreground">مكافأة Over Target</span>
                    {kpiBonuses > 0 && (
                      <span className="text-[9px] bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 rounded-full px-1.5 py-0.5 font-bold">🏆 {kpiOverTargetCount} مؤشر</span>
                    )}
                  </div>
                  <span className={`text-sm font-bold ${kpiBonuses > 0 ? "text-emerald-500" : "text-muted-foreground"}`}>
                    {kpiBonuses > 0 ? `+${fmt(kpiBonuses)}` : "—"}
                  </span>
                </div>
                {/* خصومات إضافية */}
                {salaryReport.extraDeductions > 0 && (
                  <div className="flex justify-between items-center px-3 py-2 border-b border-border/30 bg-red-500/5">
                    <span className="text-xs text-muted-foreground">خصومات إضافية</span>
                    <span className="text-sm font-bold text-red-500">−{fmt(salaryReport.extraDeductions)}</span>
                  </div>
                )}
                {/* صافي المرتب النهائي */}
                {(() => {
                  const finalNet = salaryReport.netSalary - kpiDeductions + kpiBonuses;
                  return (
                    <div className={`flex justify-between items-center px-3 py-3 border-t-2 border-[#c9a227] ${finalNet >= salaryReport.baseSalary ? "bg-emerald-500/8" : finalNet < salaryReport.baseSalary * 0.9 ? "bg-red-500/5" : "bg-amber-500/8"}`}>
                      <div>
                        <p className="text-sm font-black">صافي المرتب</p>
                        <p className="text-[9px] text-muted-foreground mt-0.5">
                          {salaryReport.baseSalary} − {salaryReport.attendanceDeduction + kpiDeductions} + {salaryReport.bonuses + kpiBonuses}
                        </p>
                      </div>
                      <span className={`text-2xl font-black ${finalNet >= salaryReport.baseSalary ? "text-emerald-500" : finalNet < salaryReport.baseSalary * 0.9 ? "text-red-500" : "text-amber-500"}`}>
                        {fmt(finalNet)}
                      </span>
                    </div>
                  );
                })()}
              </div>

              {/* Adjustments list */}
              {salaryReport.adjustments.length > 0 && (
                <div>
                  <p className="text-[11px] text-muted-foreground mb-1.5 font-semibold">تفاصيل البونص والخصومات:</p>
                  {salaryReport.adjustments.map(adj => (
                    <div key={adj.id} className={`flex justify-between items-center text-xs px-2.5 py-1.5 rounded-lg border mb-1 ${adj.type === "bonus" ? "bg-emerald-500/8 border-emerald-500/20" : "bg-red-500/8 border-red-500/20"}`}>
                      <span className="text-muted-foreground">{adj.reason}</span>
                      <span className={`font-bold text-sm ${adj.type === "bonus" ? "text-emerald-500" : "text-red-500"}`}>
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
            <div className="border border-emerald-500/20 bg-emerald-500/8 rounded-xl p-3 mb-5">
              <h3 className="text-[11px] text-muted-foreground mb-2">الراتب الشهري</h3>
              <div className="flex justify-between items-center">
                <span className="text-xs">الراتب المستحق عن شهر {periodLabel}</span>
                <span className="text-xl font-black text-emerald-500">{fmt(report.salary)}</span>
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
  const [teamOnlyAvatar, setTeamOnlyAvatar] = useState<string | null>(null);

  const reset = () => {
    setStep(1); setSaving(false); setSelectedUserId(""); setSelectedUser(null); setMode("system");
    setDisplayName(""); setJobTitle(""); setDepartment(""); setMonthlySalary("0");
    setHireDate(new Date().toISOString().slice(0, 10));
    setJobRole("employee"); setTeamOnlyAvatar(null);
  };

  const handleTeamOnlyAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
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
        canvas.getContext("2d")!.drawImage(img, 0, 0, w, h);
        setTeamOnlyAvatar(canvas.toDataURL("image/jpeg", 0.8));
      };
      img.src = ev.target?.result as string;
    };
    reader.readAsDataURL(file);
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
        avatar: teamOnlyAvatar || null,
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

            {/* Avatar upload */}
            <div className="flex items-center gap-3">
              <div className="relative shrink-0">
                {teamOnlyAvatar ? (
                  <img src={teamOnlyAvatar} className="w-16 h-16 rounded-2xl object-cover border-2 border-amber-600/40" alt="صورة العضو" />
                ) : (
                  <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-2xl font-black bg-amber-900/20 border-2 border-amber-700/30 text-amber-500">
                    {displayName ? displayName.charAt(0).toUpperCase() : "؟"}
                  </div>
                )}
                {teamOnlyAvatar && (
                  <button
                    onClick={() => setTeamOnlyAvatar(null)}
                    className="absolute -top-1.5 -left-1.5 w-5 h-5 rounded-full bg-destructive text-white flex items-center justify-center text-[10px] hover:bg-destructive/80 transition-colors"
                  >✕</button>
                )}
              </div>
              <div className="flex-1">
                <Label className="text-xs font-bold mb-1 block">صورة العضو (اختياري)</Label>
                <label className="flex items-center gap-2 cursor-pointer h-8 px-3 rounded-lg border border-dashed border-amber-700/40 bg-amber-900/10 hover:bg-amber-900/20 transition-colors text-xs text-amber-400 font-medium">
                  <input type="file" accept="image/*" className="hidden" onChange={handleTeamOnlyAvatarChange} />
                  📷 {teamOnlyAvatar ? "تغيير الصورة" : "رفع صورة"}
                </label>
                <p className="text-[10px] text-muted-foreground mt-1">PNG أو JPG — الحد الأقصى 5MB</p>
              </div>
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

  const { data: salaryReport } = useQuery({
    queryKey: ["salary-report", profileId, reportMonth],
    queryFn: () => {
      if (!profileId) return null;
      return attendanceApi.salaryReport(profileId, reportMonth);
    },
    enabled: !!profileId,
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
  const periodLabel = report?.period.month
    ? new Date(
        parseInt(report.period.month.split("-")[0]),
        parseInt(report.period.month.split("-")[1]) - 1,
        1
      ).toLocaleDateString("ar-EG", { month: "long", year: "numeric" })
    : "—";

  // ── حساب تأثير KPI على الراتب ─────────────────────────────────────────────
  const baseSalary = report?.salary ?? 0;
  const kpiFinancials = report?.kpiFinancials ?? {
    totalSalaryWeight: (report?.kpis ?? []).reduce((sum, k) => sum + (k.salaryWeight ?? 0), 0),
    salaryAtRiskPercent: (report?.kpis ?? []).reduce((sum, k) => sum + (k.salaryWeight ?? 0), 0),
    totalDeduction: (report?.kpis ?? [])
      .filter(k => k.achieved === false && (k.salaryWeight ?? 0) > 0)
      .reduce((sum, k) => sum + Math.round(((k.salaryWeight ?? 0) / 100) * baseSalary), 0),
    totalBonus: (report?.kpis ?? [])
      .filter(k => k.score !== null && k.score > 100 && (k.overtargetBonus ?? 0) > 0)
      .reduce((sum, k) => sum + Math.round(((k.overtargetBonus ?? 0) / 100) * baseSalary), 0),
    achievedCount: (report?.kpis ?? []).filter(k => k.achieved === true).length,
    failedCount: (report?.kpis ?? []).filter(k => k.achieved === false).length,
    overTargetCount: (report?.kpis ?? []).filter(k => k.score !== null && k.score > 100).length,
  };
  const kpiDeductions = kpiFinancials.totalDeduction;
  const kpiBonuses = kpiFinancials.totalBonus;
  const kpiAchievedCount = kpiFinancials.achievedCount;
  const kpiFailedCount = kpiFinancials.failedCount;
  const kpiOverTargetCount = kpiFinancials.overTargetCount;

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
        <TabsContent value="kpis" className="space-y-4 mt-3">

          {/* ── Header ── */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-bold">لوحة مؤشرات الأداء</p>
              <p className="text-[10px] text-muted-foreground">نظرة شاملة على أداء الموظف ومؤشراته الشهرية</p>
            </div>
            {isAdmin && (
              <Button size="sm" className="h-7 text-xs gap-1" onClick={() => { setEditingKpi(undefined); setKpiDialogOpen(true); }}>
                <Plus className="w-3 h-3" />إضافة مؤشر
              </Button>
            )}
          </div>

          {kpisLoading && <p className="text-center text-muted-foreground text-xs py-6">جاري التحميل...</p>}

          {!kpisLoading && kpis.length === 0 && (
            <div className="text-center py-10 text-muted-foreground border border-dashed border-border rounded-xl">
              <Target className="w-10 h-10 mx-auto mb-3 opacity-20" />
              <p className="text-sm font-bold">لا توجد مؤشرات أداء بعد</p>
              {isAdmin && <p className="text-xs mt-1 text-muted-foreground/70">أضف مؤشرات لتتبع وتقييم أداء هذا الموظف</p>}
            </div>
          )}

          {!kpisLoading && kpis.length > 0 && (() => {
            const salary = fullProfile?.monthlySalary ?? 0;
            const activeKpis = kpis.filter(k => k.isActive);
            const evaluatedKpis = report?.kpis ?? [];
            const evaluatedById = new Map(evaluatedKpis.map(k => [k.id, k]));
            const totalSW = activeKpis.reduce((s, k) => s + (k.salaryWeight ?? 0), 0);
            const totalOT = activeKpis.reduce((s, k) => s + (k.overtargetBonus ?? 0), 0);
            const totalDeduction = salary > 0 ? Math.round((totalSW / 100) * salary) : 0;
            const totalBonus = salary > 0 ? Math.round((totalOT / 100) * salary) : 0;
            const achievedCount = evaluatedKpis.filter(k => k.achieved === true).length;
            const failedCount = evaluatedKpis.filter(k => k.achieved === false).length;
            const overTargetCount = evaluatedKpis.filter(k => k.score !== null && k.score > 100).length;
            const scoredKpis = evaluatedKpis.filter(k => k.score !== null && Number.isFinite(k.score));
            const overallScore = scoredKpis.length > 0
              ? Math.round(scoredKpis.reduce((s, k) => s + Math.min(k.score ?? 0, 100), 0) / scoredKpis.length)
              : null;

            // Radar data — كفاءات المؤشرات
            const radarData = activeKpis.map(k => ({
              subject: k.name.length > 6 ? k.name.slice(0, 6) + "…" : k.name,
              value: Math.min(evaluatedById.get(k.id)?.score ?? (k.salaryWeight ?? 0), 100),
              fullName: k.name,
            }));

            // Bar data — تقييم ربعي
            const barData = activeKpis.slice(0, 4).map(k => ({
              name: k.name.length > 8 ? k.name.slice(0, 8) + "…" : k.name,
              "تقييم الأداء الحالي": Math.min(evaluatedById.get(k.id)?.score ?? 0, 100),
              "المتوسط العام": 70,
            }));

            // مؤشرات تشغيلية للبطاقة 4
            const opMetrics = activeKpis.slice(0, 3).map(k => ({
              label: k.name,
              value: evaluatedById.get(k.id)?.score !== null && evaluatedById.get(k.id)?.score !== undefined
                ? `${Math.min(Math.round(evaluatedById.get(k.id)!.score ?? 0), 100)}%`
                : "—",
              achieved: evaluatedById.get(k.id)?.achieved,
              isOT: (evaluatedById.get(k.id)?.score ?? 0) > 100,
              icon: k.direction === "higher_is_better" ? TrendingUp : TrendingDown,
            }));
            const kpiOverviewCards = [
              { label: "إجمالي KPI", value: kpis.length, note: `${activeKpis.length} نشط`, color: "text-primary", bg: "bg-primary/5", border: "border-primary/20" },
              { label: "وزن الراتب", value: `${totalSW}%`, note: fmt(totalDeduction), color: "text-amber-500", bg: "bg-amber-500/8", border: "border-amber-500/20" },
              { label: "محقق", value: achievedCount, note: `${Math.min(Math.round((achievedCount / Math.max(evaluatedKpis.length, 1)) * 100), 100)}%`, color: "text-emerald-500", bg: "bg-emerald-500/8", border: "border-emerald-500/20" },
              { label: "يحتاج تحسين", value: failedCount, note: `${overTargetCount} OT`, color: "text-red-500", bg: "bg-red-500/8", border: "border-red-500/20" },
            ];

            return (
              <>
                <Card className="border-border/60 bg-gradient-to-br from-background via-card to-primary/5 overflow-hidden">
                  <CardContent className="p-4 sm:p-5">
                    <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
                      <div className="space-y-1">
                        <div className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-background/70 px-3 py-1 text-[10px] font-bold text-muted-foreground">
                          <Target className="w-3 h-3 text-primary" />
                          لوحة مؤشرات الأداء الشهرية
                        </div>
                        <h3 className="text-lg font-black leading-tight">مراجعة سريعة لأداء {displayName}</h3>
                        <p className="text-xs text-muted-foreground max-w-2xl">
                          عرض احترافي يربط الأداء التشغيلي بالمؤشرات المالية، مع تتبع واضح للمحقق وغير المحقق والمكافآت.
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <div className="rounded-2xl border border-border/60 bg-background/80 px-3 py-2 text-center min-w-[110px]">
                          <p className="text-[10px] text-muted-foreground">التقييم الإجمالي</p>
                          <p className="text-lg font-black text-primary">{overallScore !== null ? `${overallScore}%` : "—"}</p>
                        </div>
                        <div className={`rounded-2xl border px-3 py-2 text-center min-w-[110px] ${ratingCfg.bg} ${ratingCfg.color}`}>
                          <p className="text-[10px] opacity-80">النتيجة</p>
                          <p className="text-sm font-black">{ratingCfg.label}</p>
                        </div>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 mt-4">
                      {kpiOverviewCards.map(card => (
                        <div key={card.label} className={`rounded-2xl border ${card.border} ${card.bg} px-3 py-3`}>
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <p className="text-[10px] text-muted-foreground">{card.label}</p>
                              <p className={`text-lg font-black ${card.color}`}>{card.value}</p>
                            </div>
                            <div className={`w-8 h-8 rounded-xl flex items-center justify-center bg-background/70 border border-border/50`}>
                              <div className={`w-2.5 h-2.5 rounded-full ${card.color.replace("text-", "bg-")}`} />
                            </div>
                          </div>
                          <p className="text-[10px] text-muted-foreground mt-1">{card.note}</p>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                {/* ══ ROW 1: 3 بطاقات متجاورة — مستوحاة من الصورة ══ */}
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">

                  {/* بطاقة 1 — التقدم نحو الأهداف (Progress Ring) */}
                  <Card className="relative overflow-hidden border-border bg-card">
                    <div className="absolute top-2 right-2.5 text-[9px] font-black text-muted-foreground/40">1</div>
                    <CardContent className="px-4 py-4 flex flex-col items-center gap-2">
                      <p className="text-xs font-bold text-foreground self-end w-full text-right">التقدم نحو الأهداف</p>
                      {/* Ring */}
                      <div className="relative w-24 h-24 my-1">
                        <svg viewBox="0 0 96 96" className="w-full h-full -rotate-90">
                          <circle cx="48" cy="48" r="38" fill="none" stroke="hsl(var(--muted))" strokeWidth="8" />
                          <circle cx="48" cy="48" r="38" fill="none"
                            stroke={overallScore !== null && overallScore >= 80 ? "#10B981" : overallScore !== null && overallScore >= 60 ? "#c9a227" : "#EF4444"}
                            strokeWidth="8"
                            strokeDasharray={`${(overallScore ?? 0) * 2.388} 238.8`}
                            strokeLinecap="round" />
                        </svg>
                        <div className="absolute inset-0 flex flex-col items-center justify-center">
                          <span className="text-lg font-black leading-none">{overallScore !== null ? `${overallScore}%` : "—"}</span>
                          <span className="text-[9px] text-muted-foreground mt-0.5">
                            {overallScore !== null && overallScore >= 80 ? "ممتاز" : overallScore !== null && overallScore >= 60 ? "جيد" : "يحتاج تحسين"}
                          </span>
                        </div>
                      </div>
                      {/* تفاصيل أسفل الـ ring */}
                      <div className="w-full space-y-1.5">
                        {activeKpis.slice(0, 3).map(k => {
                          const sc = Math.min(evaluatedById.get(k.id)?.score ?? 0, 100);
                          return (
                            <div key={k.id}>
                              <div className="flex justify-between text-[9px] mb-0.5">
                                <span className="text-muted-foreground truncate max-w-[60%]">{k.name}</span>
                                <span className="font-bold">{sc}%</span>
                              </div>
                              <div className="w-full h-1 rounded-full bg-muted/40 overflow-hidden">
                                <div className="h-full rounded-full transition-all duration-700"
                                  style={{ width: `${sc}%`, background: sc >= 80 ? "#10B981" : sc >= 60 ? "#c9a227" : "#EF4444" }} />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </CardContent>
                  </Card>

                  {/* بطاقة 2 — تقييم الأداء الربعي (Bar Chart) */}
                  {barData.length > 0 && (
                    <Card className="relative overflow-hidden border-border bg-card">
                      <div className="absolute top-2 right-2.5 text-[9px] font-black text-muted-foreground/40">2</div>
                      <CardContent className="px-3 py-4">
                        <div className="flex items-start justify-between mb-2">
                          <p className="text-xs font-bold text-foreground">تقييم الأداء الربعي</p>
                          <div className="flex flex-col items-end gap-0.5">
                            <div className="flex items-center gap-1 text-[9px] text-muted-foreground">
                              <span className="w-2 h-2 rounded-sm bg-primary inline-block" />تقييم الأداء الحالي
                            </div>
                            <div className="flex items-center gap-1 text-[9px] text-muted-foreground">
                              <span className="w-2 h-2 rounded-sm bg-emerald-500 inline-block" />المتوسط العام
                            </div>
                          </div>
                        </div>
                        {/* Rating stars */}
                        {overallScore !== null && (
                          <div className="flex items-center gap-0.5 mb-2 justify-end">
                            {[1,2,3,4,5].map(s => (
                              <Star key={s} className={`w-3 h-3 ${s <= Math.round(overallScore / 20) ? "fill-amber-400 text-amber-400" : "text-muted-foreground/30"}`} />
                            ))}
                            <span className="text-[9px] text-muted-foreground mr-1">
                              {overallScore >= 90 ? "ممتاز" : overallScore >= 75 ? "جيد جداً" : overallScore >= 60 ? "جيد" : "مقبول"}
                            </span>
                          </div>
                        )}
                        <ResponsiveContainer width="100%" height={130}>
                          <BarChart data={barData} margin={{ top: 2, right: 2, bottom: 2, left: -25 }} barGap={2}>
                            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                            <XAxis dataKey="name" tick={{ fontSize: 8, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                            <YAxis tick={{ fontSize: 7, fill: "hsl(var(--muted-foreground))" }} domain={[0, 100]} axisLine={false} tickLine={false} />
                            <Tooltip
                              formatter={(v: any, n: string) => [`${v}%`, n]}
                              contentStyle={{ fontSize: 10, background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, direction: "rtl" }}
                            />
                            <Bar dataKey="تقييم الأداء الحالي" fill="hsl(var(--primary))" radius={[3, 3, 0, 0]} maxBarSize={16} />
                            <Bar dataKey="المتوسط العام" fill="#10B981" radius={[3, 3, 0, 0]} maxBarSize={16} />
                          </BarChart>
                        </ResponsiveContainer>
                        {/* نسب أسفل الـ chart */}
                        <div className="flex justify-around mt-1 border-t border-border/30 pt-2">
                          {activeKpis.slice(0, 3).map(k => (
                            <div key={k.id} className="text-center">
                              <p className="text-[9px] font-black">{Math.min(evaluatedById.get(k.id)?.score ?? 0, 100)}%</p>
                              <p className="text-[8px] text-muted-foreground truncate max-w-[40px]">{k.name.slice(0, 6)}</p>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {/* بطاقة 3 — تطور الكفاءات (Radar) */}
                  {radarData.length >= 3 && (
                    <Card className="relative overflow-hidden border-border bg-card">
                      <div className="absolute top-2 right-2.5 text-[9px] font-black text-muted-foreground/40">3</div>
                      <CardContent className="px-3 py-4">
                        <p className="text-xs font-bold text-foreground mb-1">تطور الكفاءات الأساسية</p>
                        <ResponsiveContainer width="100%" height={180}>
                          <RadarChart data={radarData} margin={{ top: 5, right: 20, bottom: 5, left: 20 }}>
                            <PolarGrid stroke="hsl(var(--border))" />
                            <PolarAngleAxis dataKey="subject" tick={{ fontSize: 8, fill: "hsl(var(--muted-foreground))" }} />
                            <Radar name="الأداء" dataKey="value" stroke="#c9a227" fill="#c9a227" fillOpacity={0.3} strokeWidth={2} dot={{ fill: "#c9a227", r: 2 }} />
                          </RadarChart>
                        </ResponsiveContainer>
                      </CardContent>
                    </Card>
                  )}
                </div>

                {/* ══ ROW 2: بطاقتان — مؤشرات تشغيلية + ملخص مالي ══ */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">

                  {/* بطاقة 4 — مؤشرات الأداء التشغيلي */}
                  <Card className="relative overflow-hidden border-border bg-card">
                    <div className="absolute top-2 right-2.5 text-[9px] font-black text-muted-foreground/40">4</div>
                    <CardContent className="px-4 py-4">
                      <p className="text-xs font-bold text-foreground mb-3">مؤشرات الأداء التشغيلي</p>
                      <div className="space-y-2.5">
                        {opMetrics.map((m, i) => (
                          <div key={i} className="flex items-center justify-between">
                            <span className="text-xs text-muted-foreground truncate max-w-[55%]">{m.label}</span>
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-black">{m.value}</span>
                              <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${
                                m.isOT ? "bg-blue-500/15" : m.achieved === true ? "bg-emerald-500/15" : m.achieved === false ? "bg-red-500/15" : "bg-muted/30"
                              }`}>
                                <m.icon className={`w-3 h-3 ${
                                  m.isOT ? "text-blue-500" : m.achieved === true ? "text-emerald-500" : m.achieved === false ? "text-red-500" : "text-muted-foreground"
                                }`} />
                              </div>
                            </div>
                          </div>
                        ))}
                        {opMetrics.length === 0 && (
                          <p className="text-xs text-muted-foreground text-center py-4">لا توجد بيانات بعد</p>
                        )}
                      </div>
                      {/* ملاحظة */}
                      {overallScore !== null && (
                        <div className="mt-3 pt-2.5 border-t border-border/30">
                          <p className="text-[10px] font-bold text-muted-foreground mb-0.5">التعليقات والملاحظات</p>
                          <p className="text-[10px] text-muted-foreground/80">
                            {overallScore >= 90 ? "🌟 أداء استثنائي هذا الشهر، استمر في الإبداع!" :
                             overallScore >= 75 ? "👍 أداء فوق المتوسط، يحتاج تعزيز بعض الجوانب" :
                             overallScore >= 60 ? "✅ أداء مقبول، مع وجود فرص للتطوير" :
                             "⚠️ يحتاج الموظف إلى دعم وتحسين في المؤشرات"}
                          </p>
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* بطاقة 5 — الملخص المالي KPI */}
                  <Card className="relative overflow-hidden border-border bg-card">
                    <div className="absolute top-2 right-2.5 text-[9px] font-black text-muted-foreground/40">5</div>
                    <CardContent className="px-4 py-4">
                      <p className="text-xs font-bold text-foreground mb-3">الملخص المالي للمؤشرات</p>
                      {salary > 0 ? (
                        <div className="space-y-2">
                          {[
                            { label: "الراتب الأساسي", value: fmt(salary), color: "text-foreground", bg: "bg-muted/20" },
                            { label: "إجمالي KPI من الراتب", value: `${totalSW}%`, sub: fmt(totalDeduction), color: "text-amber-600 dark:text-amber-400", bg: "bg-amber-500/8" },
                            { label: "عند قصور كامل", value: fmt(salary - totalDeduction), color: "text-red-500", bg: "bg-red-500/8" },
                            ...(totalBonus > 0 ? [{ label: "مع Over Target", value: fmt(salary + totalBonus), color: "text-blue-600 dark:text-blue-400", bg: "bg-blue-500/8" }] : []),
                          ].map((row, i) => (
                            <div key={i} className={`flex items-center justify-between rounded-lg px-3 py-2 ${row.bg}`}>
                              <span className="text-[10px] text-muted-foreground">{row.label}</span>
                              <div className="text-right">
                                <span className={`text-xs font-black ${row.color}`}>{row.value}</span>
                                {(row as any).sub && <p className="text-[8px] text-muted-foreground">{(row as any).sub}</p>}
                              </div>
                            </div>
                          ))}
                          {/* KPI status summary */}
                          <div className="grid grid-cols-3 gap-1.5 pt-1">
                            {[
                              { label: "محقق", val: achievedCount, color: "text-emerald-600", bg: "bg-emerald-500/10" },
                              { label: "لم يتحقق", val: failedCount, color: "text-red-500", bg: "bg-red-500/10" },
                              { label: "Over Target", val: overTargetCount, color: "text-blue-600", bg: "bg-blue-500/10" },
                            ].map(s => (
                              <div key={s.label} className={`rounded-lg py-2 text-center ${s.bg}`}>
                                <p className={`text-base font-black ${s.color}`}>{s.val}</p>
                                <p className="text-[8px] text-muted-foreground">{s.label}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <div className="text-center py-6">
                          <DollarSign className="w-8 h-8 mx-auto mb-2 opacity-20" />
                          <p className="text-xs text-muted-foreground">لم يُحدد الراتب الأساسي بعد</p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>

                {/* ══ KPI Detail Cards ══ */}
                <div>
                  <h3 className="text-xs font-bold text-muted-foreground mb-3 flex items-center gap-1.5">
                    <Settings className="w-3.5 h-3.5" />مؤشرات الأداء التفصيلية
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {kpis.map((kpi, idx) => {
                      const salaryW = kpi.salaryWeight ?? 0;
                      const otBonus = kpi.overtargetBonus ?? 0;
                      const kpiAmt = salary > 0 && salaryW > 0 ? Math.round((salaryW / 100) * salary) : 0;
                      const bonusAmt = salary > 0 && otBonus > 0 ? Math.round((otBonus / 100) * salary) : 0;
                      const evalKpi = evaluatedById.get(kpi.id);
                      const isOT = (evalKpi?.score ?? 0) > 100;
                      const isAchieved = evalKpi?.achieved === true;
                      const isFailed = evalKpi?.achieved === false;

                      const colorMap: Record<string, { accent: string; iconBg: string; iconColor: string; badgeBg: string; badgeText: string }> = {
                        delivery_rate: { accent: "bg-emerald-500", iconBg: "bg-emerald-50 dark:bg-emerald-900/30", iconColor: "text-emerald-600 dark:text-emerald-400", badgeBg: "bg-emerald-50 dark:bg-emerald-900/30 border-emerald-200 dark:border-emerald-700/40", badgeText: "text-emerald-700 dark:text-emerald-300" },
                        return_rate:   { accent: "bg-red-500",     iconBg: "bg-red-50 dark:bg-red-900/30",         iconColor: "text-red-600 dark:text-red-400",         badgeBg: "bg-red-50 dark:bg-red-900/30 border-red-200 dark:border-red-700/40",         badgeText: "text-red-700 dark:text-red-300" },
                        total_orders:  { accent: "bg-blue-500",    iconBg: "bg-blue-50 dark:bg-blue-900/30",        iconColor: "text-blue-600 dark:text-blue-400",        badgeBg: "bg-blue-50 dark:bg-blue-900/30 border-blue-200 dark:border-blue-700/40",        badgeText: "text-blue-700 dark:text-blue-300" },
                        profit:        { accent: "bg-violet-500",  iconBg: "bg-violet-50 dark:bg-violet-900/30",    iconColor: "text-violet-600 dark:text-violet-400",    badgeBg: "bg-violet-50 dark:bg-violet-900/30 border-violet-200 dark:border-violet-700/40", badgeText: "text-violet-700 dark:text-violet-300" },
                        revenue:       { accent: "bg-amber-500",   iconBg: "bg-amber-50 dark:bg-amber-900/30",      iconColor: "text-amber-600 dark:text-amber-400",      badgeBg: "bg-amber-50 dark:bg-amber-900/30 border-amber-200 dark:border-amber-700/40",      badgeText: "text-amber-700 dark:text-amber-300" },
                        manual:        { accent: "bg-primary",     iconBg: "bg-primary/10",                         iconColor: "text-primary",                            badgeBg: "bg-primary/5 border-primary/20",                                                      badgeText: "text-primary" },
                      };
                      const colors = colorMap[kpi.metric] ?? colorMap.manual;

                      const iconForMetric: Record<string, React.ReactNode> = {
                        delivery_rate: <TrendingUp className="w-4 h-4" />,
                        return_rate:   <TrendingDown className="w-4 h-4" />,
                        total_orders:  <Package className="w-4 h-4" />,
                        profit:        <DollarSign className="w-4 h-4" />,
                        revenue:       <BarChart2 className="w-4 h-4" />,
                        manual:        <Target className="w-4 h-4" />,
                      };

                      return (
                        <div key={kpi.id} className={`relative rounded-xl border border-border bg-card overflow-hidden transition-all duration-200 ${!kpi.isActive ? "opacity-40 grayscale" : "hover:shadow-lg hover:-translate-y-0.5"}`}>
                          <div className={`h-1 w-full ${colors.accent} opacity-80`} />
                          {(isOT || isAchieved || isFailed) && (
                            <div className={`px-3 py-1.5 flex items-center gap-1.5 text-[10px] font-bold border-b border-border/20 ${
                              isOT ? "bg-blue-500/10 text-blue-600 dark:text-blue-400" :
                              isAchieved ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400" :
                                          "bg-red-500/10 text-red-700 dark:text-red-400"
                            }`}>
                              {isOT ? <><Trophy className="w-3 h-3" />Over Target — تجاوز الهدف 🏆</> :
                               isAchieved ? <><CheckCircle2 className="w-3 h-3" />تم تحقيق المؤشر ✅</> :
                                            <><XCircle className="w-3 h-3" />لم يتحقق المؤشر ❌</>}
                            </div>
                          )}
                          <div className="p-4">
                            <div className="flex items-start justify-between gap-2 mb-3">
                              <div className="flex items-center gap-3 min-w-0">
                                <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${colors.iconBg}`}>
                                  <span className={colors.iconColor}>{iconForMetric[kpi.metric] ?? <Target className="w-4 h-4" />}</span>
                                </div>
                                <div className="min-w-0">
                                  <p className="text-sm font-bold leading-tight truncate">{kpi.name}</p>
                                  <p className="text-[10px] text-muted-foreground mt-0.5">
                                    {kpi.direction === "higher_is_better" ? "↑ الأعلى أفضل" : "↓ الأدنى أفضل"}
                                    {" · "}وزن {kpi.weight}%
                                  </p>
                                </div>
                              </div>
                              <div className="flex items-center gap-0.5 shrink-0">
                                {!kpi.isActive && <span className="text-[9px] bg-muted text-muted-foreground rounded-full px-2 py-0.5 border border-border">معطل</span>}
                                {isAdmin && (
                                  <>
                                    <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground/60 hover:text-primary hover:bg-primary/5 rounded-lg"
                                      onClick={() => { setEditingKpi(kpi); setKpiDialogOpen(true); }}>
                                      <Edit2 className="w-3 h-3" />
                                    </Button>
                                    <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground/60 hover:text-destructive hover:bg-destructive/5 rounded-lg"
                                      onClick={() => deleteKpi(kpi.id)}>
                                      <Trash2 className="w-3 h-3" />
                                    </Button>
                                  </>
                                )}
                              </div>
                            </div>

                            {/* Row 2: الهدف الكمي */}
                            <div className={`flex items-center justify-between rounded-lg px-3 py-2 mb-3 border ${colors.badgeBg}`}>
                              <span className="text-[10px] text-muted-foreground">الهدف المطلوب</span>
                              <span className={`text-sm font-black ${colors.badgeText}`}>
                                {kpi.direction === "lower_is_better" ? "≤" : "≥"}{fmtNum(kpi.targetValue)} <span className="text-[10px] font-normal opacity-70">{kpi.unit}</span>
                              </span>
                            </div>

                            {/* Row 3: التأثير المالي — صف مقسم */}
                            {(salaryW > 0 || otBonus > 0) && (
                              <div className="grid grid-cols-2 gap-2 mb-3">
                                {salaryW > 0 ? (
                                  <div className="rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200/60 dark:border-red-700/30 px-2.5 py-2 text-center">
                                    <p className="text-[9px] text-red-500/80 mb-0.5">عند قصور</p>
                                    <p className="text-xs font-black text-red-600 dark:text-red-400">−{fmt(kpiAmt)}</p>
                                    <p className="text-[9px] text-red-400/70">{salaryW}% من الراتب</p>
                                  </div>
                                ) : (
                                  <div className="rounded-lg bg-muted/20 border border-border px-2.5 py-2 text-center opacity-40">
                                    <p className="text-[9px] text-muted-foreground mb-0.5">عند قصور</p>
                                    <p className="text-xs font-bold text-muted-foreground">—</p>
                                  </div>
                                )}
                                {otBonus > 0 ? (
                                  <div className="rounded-lg bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200/60 dark:border-emerald-700/30 px-2.5 py-2 text-center">
                                    <p className="text-[9px] text-emerald-500/80 mb-0.5">Over Target</p>
                                    <p className="text-xs font-black text-emerald-600 dark:text-emerald-400">+{fmt(bonusAmt)}</p>
                                    <p className="text-[9px] text-emerald-400/70">+{otBonus}% مكافأة</p>
                                  </div>
                                ) : (
                                  <div className="rounded-lg bg-muted/20 border border-border px-2.5 py-2 text-center opacity-40">
                                    <p className="text-[9px] text-muted-foreground mb-0.5">Over Target</p>
                                    <p className="text-xs font-bold text-muted-foreground">—</p>
                                  </div>
                                )}
                              </div>
                            )}

                            {/* Row 4: Progress bar — نسبة وزن المؤشر */}
                            {salaryW > 0 && (
                              <div className="space-y-1">
                                <div className="flex items-center justify-between">
                                  <span className="text-[9px] text-muted-foreground">نسبة تأثير المؤشر على الراتب</span>
                                  <span className="text-[9px] font-bold text-amber-600 dark:text-amber-400">{salaryW}%</span>
                                </div>
                                <div className="w-full h-1.5 rounded-full bg-muted/40 overflow-hidden">
                                  <div
                                    className={`h-full rounded-full ${colors.accent} opacity-70 transition-all duration-700`}
                                    style={{ width: `${Math.min(100, salaryW)}%` }}
                                  />
                                </div>
                              </div>
                            )}

                            {/* ملاحظة */}
                            {kpi.description && (
                              <p className="text-[9px] text-muted-foreground/60 mt-2.5 italic leading-relaxed border-t border-border/30 pt-2">
                                {kpi.description}
                              </p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </>
            );
          })()}
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
              <Card className="relative overflow-hidden border-border/60 bg-gradient-to-br from-card via-card to-emerald-500/5">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(201,162,39,0.12),transparent_35%),radial-gradient(circle_at_bottom_left,rgba(16,185,129,0.10),transparent_28%)] pointer-events-none" />
                <CardContent className="relative p-4 sm:p-5 space-y-4">
                  <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-3">
                    <div className="space-y-1">
                      <div className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-background/70 px-3 py-1 text-[10px] font-bold text-muted-foreground">
                        <FileText className="w-3 h-3 text-primary" />
                        التقرير الشهري التفصيلي
                      </div>
                      <h3 className="text-lg font-black leading-tight">ملخص أداء {report.displayName}</h3>
                      <p className="text-xs text-muted-foreground max-w-2xl">
                        نظرة مالية وتشغيلية متكاملة تجمع بين الطلبيات، مؤشرات الأداء، والحضور — بصورة سهلة القراءة وعرض احترافي.
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <div className="rounded-2xl border border-border/60 bg-background/80 px-3 py-2 min-w-[115px]">
                        <p className="text-[10px] text-muted-foreground">الشهر</p>
                        <p className="text-sm font-black">{periodLabel}</p>
                      </div>
                      <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/8 px-3 py-2 min-w-[115px]">
                        <p className="text-[10px] text-muted-foreground">الحالة</p>
                        <p className="text-sm font-black text-emerald-500">{report.rating}</p>
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    {[
                      { label: "الطلبيات", value: fmtNum(report.orderStats.total), color: "text-primary" },
                      { label: "نسبة التسليم", value: `${report.orderStats.deliveryRate}%`, color: "text-amber-500" },
                      { label: "خصم KPI", value: fmt(kpiDeductions), color: "text-red-500" },
                      { label: "مكافأة KPI", value: fmt(kpiBonuses), color: "text-emerald-500" },
                    ].map(item => (
                      <div key={item.label} className="rounded-2xl border border-border/60 bg-background/75 px-3 py-3">
                        <p className="text-[10px] text-muted-foreground">{item.label}</p>
                        <p className={`text-lg font-black ${item.color}`}>{item.value}</p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

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

              {report.kpis.length > 0 && (
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-3 mt-3">
                  <Card className="border-border bg-card/80">
                    <CardHeader className="px-4 pt-4 pb-2">
                      <CardTitle className="text-sm flex items-center justify-between gap-2">
                        <span className="flex items-center gap-1.5">
                          <Target className="w-4 h-4 text-primary" />توزيع حالة KPI
                        </span>
                        <Badge variant="outline" className="text-[10px] h-5 px-2">
                          {kpiFinancials.salaryAtRiskPercent}% من الراتب
                        </Badge>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="px-4 pb-4">
                      <div className="grid grid-cols-1 sm:grid-cols-[180px_1fr] gap-3 items-center">
                        <div className="h-[220px] w-full">
                          <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                              <Pie
                                data={[
                                  { name: "محقق", value: kpiAchievedCount, fill: "#10B981" },
                                  { name: "لم يتحقق", value: kpiFailedCount, fill: "#EF4444" },
                                  { name: "Over Target", value: kpiOverTargetCount, fill: "#2563EB" },
                                ].filter(item => item.value > 0)}
                                dataKey="value"
                                nameKey="name"
                                cx="50%"
                                cy="50%"
                                innerRadius={54}
                                outerRadius={82}
                                paddingAngle={3}
                              >
                                {[
                                  { name: "محقق", value: kpiAchievedCount, fill: "#10B981" },
                                  { name: "لم يتحقق", value: kpiFailedCount, fill: "#EF4444" },
                                  { name: "Over Target", value: kpiOverTargetCount, fill: "#2563EB" },
                                ].filter(item => item.value > 0).map((entry, index) => (
                                  <Cell key={`status-${index}`} fill={entry.fill} />
                                ))}
                              </Pie>
                              <Tooltip
                                formatter={(value: any, name: string) => [`${value}`, name]}
                                contentStyle={{ fontSize: 10, background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, direction: "rtl" }}
                              />
                            </PieChart>
                          </ResponsiveContainer>
                        </div>
                        <div className="space-y-2">
                          {[
                            { label: "محقق", value: kpiAchievedCount, color: "text-emerald-500", bg: "bg-emerald-500/10" },
                            { label: "لم يتحقق", value: kpiFailedCount, color: "text-red-500", bg: "bg-red-500/10" },
                            { label: "Over Target", value: kpiOverTargetCount, color: "text-blue-500", bg: "bg-blue-500/10" },
                            { label: "إجمالي وزن KPI", value: `${kpiFinancials.totalSalaryWeight}%`, color: "text-amber-500", bg: "bg-amber-500/10" },
                          ].map(item => (
                            <div key={item.label} className={`rounded-xl px-3 py-2 flex items-center justify-between ${item.bg}`}>
                              <span className="text-xs text-muted-foreground">{item.label}</span>
                              <span className={`text-sm font-black ${item.color}`}>{item.value}</span>
                            </div>
                          ))}
                          <div className="rounded-xl border border-border/50 bg-muted/20 p-3">
                            <p className="text-[10px] text-muted-foreground mb-1">مؤشر الراتب المعرض للخطر</p>
                            <Progress value={Math.min(kpiFinancials.salaryAtRiskPercent, 100)} className="h-2" />
                            <div className="mt-2 flex items-center justify-between text-[10px]">
                              <span className="text-muted-foreground">محتمل الخصم</span>
                              <span className="font-bold text-amber-600 dark:text-amber-400">{fmt(kpiFinancials.totalDeduction)}</span>
                            </div>
                            {kpiFinancials.totalSalaryWeight > 100 && (
                              <p className="mt-1 text-[10px] font-medium text-red-500">
                                إجمالي الأوزان أكبر من 100%، راجع إعدادات KPI حتى لا يتجاوز الخصم الراتب الأساسي.
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="border-border bg-card/80">
                    <CardHeader className="px-4 pt-4 pb-2">
                      <CardTitle className="text-sm flex items-center gap-1.5">
                        <BarChart2 className="w-4 h-4 text-primary" />توزيع الراتب الشهري
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="px-4 pb-4">
                      <ResponsiveContainer width="100%" height={250}>
                        <BarChart
                          data={[
                            { name: "الأساسي", value: baseSalary, fill: "#3b82f6" },
                            { name: "خصم الحضور", value: salaryReport?.attendanceDeduction ?? 0, fill: "#ef4444" },
                            { name: "خصم KPI", value: kpiDeductions, fill: "#dc2626" },
                            { name: "البونص", value: (salaryReport?.bonuses ?? 0) + kpiBonuses, fill: "#10b981" },
                            { name: "الصافي", value: Math.max((salaryReport?.netSalary ?? baseSalary) - kpiDeductions + kpiBonuses, 0), fill: "#c9a227" },
                          ]}
                          layout="vertical"
                          margin={{ top: 8, right: 12, left: 8, bottom: 8 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
                          <XAxis type="number" tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                          <YAxis type="category" dataKey="name" tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} width={72} />
                          <Tooltip
                            formatter={(v: any) => fmt(Number(v))}
                            contentStyle={{ fontSize: 10, background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, direction: "rtl" }}
                          />
                          <Bar dataKey="value" radius={[0, 8, 8, 0]} maxBarSize={28}>
                            {[
                              { name: "الأساسي", value: baseSalary, fill: "#3b82f6" },
                              { name: "خصم الحضور", value: salaryReport?.attendanceDeduction ?? 0, fill: "#ef4444" },
                              { name: "خصم KPI", value: kpiDeductions, fill: "#dc2626" },
                              { name: "البونص", value: (salaryReport?.bonuses ?? 0) + kpiBonuses, fill: "#10b981" },
                              { name: "الصافي", value: Math.max((salaryReport?.netSalary ?? baseSalary) - kpiDeductions + kpiBonuses, 0), fill: "#c9a227" },
                            ].map((entry, idx) => (
                              <Cell key={`salary-${idx}`} fill={entry.fill} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>
                </div>
              )}

              {/* KPI Charts */}
              {report.kpis.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {/* Radar Chart */}
                  <Card className="border-border bg-card/90 overflow-hidden">
                    <CardHeader className="pb-1 pt-3 px-4 border-b border-border/40 bg-muted/20">
                      <CardTitle className="text-xs flex items-center gap-1.5 text-muted-foreground">
                        <BarChart2 className="w-3.5 h-3.5" />مؤشرات الأداء — نسبة التحقق
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="px-2 pb-3">
                      <ResponsiveContainer width="100%" height={200}>
                        <RadarChart data={report.kpis.filter(k => k.score !== null).map(k => ({
                          subject: k.name.length > 8 ? k.name.slice(0, 8) + "…" : k.name,
                          score: Math.min(k.score ?? 0, 120),
                          fullName: k.name,
                        }))}>
                          <PolarGrid stroke="hsl(var(--border))" />
                          <PolarAngleAxis dataKey="subject" tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }} />
                          <Radar name="الأداء" dataKey="score" stroke="#c9a227" fill="#c9a227" fillOpacity={0.25} strokeWidth={2} />
                        </RadarChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>

                  {/* Bar Chart — KPI vs Target */}
                  <Card className="border-border bg-card/90 overflow-hidden">
                    <CardHeader className="pb-1 pt-3 px-4 border-b border-border/40 bg-muted/20">
                      <CardTitle className="text-xs flex items-center gap-1.5 text-muted-foreground">
                        <Target className="w-3.5 h-3.5" />نسبة التحقق لكل مؤشر
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="px-2 pb-3">
                      <ResponsiveContainer width="100%" height={200}>
                        <BarChart
                          data={report.kpis.filter(k => k.score !== null).map(k => ({
                            name: k.name.length > 7 ? k.name.slice(0, 7) + "…" : k.name,
                            score: Math.min(k.score ?? 0, 130),
                            achieved: k.achieved,
                          }))}
                          margin={{ top: 5, right: 5, bottom: 5, left: -20 }}
                          layout="vertical"
                        >
                          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
                          <XAxis type="number" domain={[0, 120]} tick={{ fontSize: 8, fill: "hsl(var(--muted-foreground))" }} />
                          <YAxis type="category" dataKey="name" tick={{ fontSize: 8, fill: "hsl(var(--muted-foreground))" }} width={55} />
                          <Tooltip
                            formatter={(v: any) => [`${v}%`, "الأداء"]}
                            contentStyle={{ fontSize: 11, background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, direction: "rtl" }}
                          />
                          <ReferenceLine x={100} stroke="#10B981" strokeDasharray="4 2" strokeWidth={1.5} label={{ value: "الهدف", fill: "#10B981", fontSize: 9 }} />
                          <Bar dataKey="score" radius={[0, 4, 4, 0]} maxBarSize={18}>
                            {report.kpis.filter(k => k.score !== null).map((k, i) => (
                              <Cell key={i} fill={k.score !== null && k.score >= 100 ? "#10B981" : k.achieved === false ? "#EF4444" : "#c9a227"} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>
                </div>
              )}

              {/* KPI Evaluation */}
              {report.kpis.length > 0 && (
                <div className="space-y-2">
                  <h3 className="text-xs font-bold text-muted-foreground flex items-center gap-1.5">
                    <Target className="w-3.5 h-3.5" />تقييم المؤشرات
                  </h3>

                  {/* ملخص التأثير المالي للـ KPIs */}
                  {(() => {
                    const salary = report.salary || fullProfile?.monthlySalary || 0;
                    const kpiDeductions = report.kpis
                      .filter(k => k.achieved === false && (k.salaryWeight ?? 0) > 0)
                      .reduce((sum, k) => sum + Math.round(((k.salaryWeight ?? 0) / 100) * salary), 0);
                    const kpiBonuses = report.kpis
                      .filter(k => k.score !== null && k.score > 100 && (k.overtargetBonus ?? 0) > 0)
                      .reduce((sum, k) => sum + Math.round(((k.overtargetBonus ?? 0) / 100) * salary), 0);
                    const hasImpact = kpiDeductions > 0 || kpiBonuses > 0;
                    if (!hasImpact) return null;
                    return (
                      <div className="rounded-xl border border-border bg-card p-3 space-y-2">
                        <p className="text-[10px] font-bold text-muted-foreground">💼 التأثير المالي لمؤشرات الأداء هذا الشهر:</p>
                        <div className="grid grid-cols-3 gap-2">
                          <div className="rounded-lg bg-muted/30 p-2 text-center">
                            <p className="text-[9px] text-muted-foreground">الراتب الأساسي</p>
                            <p className="text-xs font-black">{fmt(salary)}</p>
                          </div>
                          {kpiDeductions > 0 && (
                            <div className="rounded-lg bg-red-500/10 border border-red-500/20 p-2 text-center">
                              <p className="text-[9px] text-red-500">خصم KPI</p>
                              <p className="text-xs font-black text-red-500">−{fmt(kpiDeductions)}</p>
                            </div>
                          )}
                          {kpiBonuses > 0 && (
                            <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/20 p-2 text-center">
                              <p className="text-[9px] text-emerald-500">مكافأة OT</p>
                              <p className="text-xs font-black text-emerald-500">+{fmt(kpiBonuses)}</p>
                            </div>
                          )}
                          <div className={`rounded-lg p-2 text-center col-span-${kpiDeductions > 0 && kpiBonuses > 0 ? "3" : "1"} ${(salary - kpiDeductions + kpiBonuses) < salary ? "bg-amber-500/10 border border-amber-500/20" : "bg-emerald-500/10 border border-emerald-500/20"}`}>
                            <p className="text-[9px] text-muted-foreground">صافي بعد KPI</p>
                            <p className={`text-sm font-black ${(salary - kpiDeductions + kpiBonuses) < salary ? "text-amber-500" : "text-emerald-500"}`}>
                              {fmt(salary - kpiDeductions + kpiBonuses)}
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  })()}

                  {report.kpis.map(kpi => {
                    const salaryW = kpi.salaryWeight ?? 0;
                    const otBonus = kpi.overtargetBonus ?? 0;
                    const salary = report.salary || fullProfile?.monthlySalary || 0;
                    const kpiAmt = salary > 0 && salaryW > 0 ? Math.round((salaryW / 100) * salary) : 0;
                    const bonusAmt = salary > 0 && otBonus > 0 ? Math.round((otBonus / 100) * salary) : 0;
                    const isOverTarget = kpi.score !== null && kpi.score > 100;

                    return (
                      <div key={kpi.id} className={`p-3 rounded-lg border transition-colors ${
                        kpi.achieved === true  ? "border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-900/20" :
                        kpi.achieved === false ? "border-red-200 dark:border-red-800/50 bg-red-50 dark:bg-red-900/10" :
                                                 "border-border bg-card"
                      }`}>
                        <div className="flex items-center gap-3">
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
                            <div className="flex items-center justify-between gap-2 mb-1">
                              <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                                <p className="text-xs font-bold truncate">{kpi.name}</p>
                                {isOverTarget && otBonus > 0 && (
                                  <Badge className="text-[9px] h-4 bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border-0 shrink-0">
                                    🏆 Over Target
                                  </Badge>
                                )}
                                {kpi.achieved === false && salaryW > 0 && (
                                  <Badge className="text-[9px] h-4 bg-red-500/15 text-red-600 dark:text-red-400 border-0 shrink-0">
                                    ⚠️ خصم مطبّق
                                  </Badge>
                                )}
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
                            <div className="flex items-center justify-between gap-2 mb-1.5">
                              <span className="text-[10px] text-muted-foreground">
                                الفعلي: <strong className={kpi.achieved === true ? "text-emerald-600 dark:text-emerald-400" : kpi.achieved === false ? "text-red-600 dark:text-red-400" : "text-foreground"}>
                                  {kpi.actualValue !== null ? `${fmtNum(kpi.actualValue)} ${kpi.unit}` : "—"}
                                </strong>
                                {" / هدف: "}{kpi.direction === "lower_is_better" ? "≤" : "≥"}{fmtNum(kpi.targetValue)} {kpi.unit}
                              </span>
                            </div>
                            <Progress
                              value={Math.min(kpi.score ?? 0, 100)}
                              className={`h-1.5 ${kpi.achieved === true ? "[&>div]:bg-emerald-500" : kpi.achieved === false ? "[&>div]:bg-red-400" : "[&>div]:bg-primary"}`}
                            />
                            {/* تأثير على الراتب */}
                            {(salaryW > 0 || otBonus > 0) && salary > 0 && (
                              <div className="flex gap-2 mt-1.5 flex-wrap">
                                {salaryW > 0 && (
                                  <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                                    kpi.achieved === false
                                      ? "bg-red-500/15 text-red-500"
                                      : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 line-through opacity-60"
                                  }`}>
                                    {kpi.achieved === false ? `−${fmt(kpiAmt)} خصم KPI` : `✓ لا خصم (${salaryW}%)`}
                                  </span>
                                )}
                                {otBonus > 0 && (
                                  <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                                    isOverTarget
                                      ? "bg-emerald-500/15 text-emerald-500"
                                      : "bg-muted/40 text-muted-foreground opacity-50"
                                  }`}>
                                    {isOverTarget ? `+${fmt(bonusAmt)} مكافأة OT` : `مكافأة OT: ${fmt(bonusAmt)} (لم تُحقق)`}
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
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
          monthlySalary={fullProfile?.monthlySalary ?? 0}
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

          // الصورة: أولوية لصورة الـ profile، ثم صورة الـ user من allUsers
          const linkedUser = isSystemUser ? allUsers.find((u: any) => u.id === (profile as any).userId) : null;
          const avatarSrc = profile.avatar || (linkedUser as any)?.avatar || null;

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
                    {avatarSrc ? (
                      <img src={avatarSrc} alt={name}
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
                        {profile.jobTitle || (isSystemUser ? null : "عضو فريق")}
                        {profile.department && (
                          <span style={{ color: "rgba(255,255,255,0.35)" }}>{profile.jobTitle ? ` · ${profile.department}` : profile.department}</span>
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
