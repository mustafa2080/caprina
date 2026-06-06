import { useState, useRef, useCallback, useMemo } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format, startOfMonth, endOfMonth, subMonths } from "date-fns";
import { ar } from "date-fns/locale";
import {
  User, KeyRound, Camera, TrendingUp, TrendingDown,
  Package, CheckCircle2, XCircle, Hourglass, Star,
  Flame, Zap, Trophy, BarChart3, Clock, Target,
  Shield, Save, Eye, EyeOff, Upload, LayoutDashboard,
  ListOrdered, Activity, FileText, ChevronRight,
  ChevronDown, AlertCircle, Coins, Percent, ArrowUp,
  ArrowDown, CalendarDays, Wallet, BadgeCheck, Info,
  RefreshCw, CalendarCheck2, Gauge, Award, ShieldAlert,
  Medal, GanttChart, Sparkles, BarChart2,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/contexts/AuthContext";
import {
  authApi, teamAnalyticsApi, employeeApi, ordersApi, apiFetch, attendanceApi,
  type TeamMemberExtStats, type EmployeeProfile,
  type EmployeeReport, type EvaluatedKpi,
  type Attendance, type AttendanceSalaryReport, type PayrollAdjustment,
} from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, PieChart, Pie, RadarChart, Radar, PolarGrid, PolarAngleAxis, ReferenceLine } from "recharts";

/* ── helpers ── */
const fmt = (n: number) =>
  new Intl.NumberFormat("ar-EG", { style: "currency", currency: "EGP", maximumFractionDigits: 0 }).format(n);
const fmtNum = (n: number) => new Intl.NumberFormat("ar-EG").format(n);
const pct = (n: number) => `${n.toFixed(1)}%`;

const STATUS_LABELS: Record<string, string> = {
  delivered: "مسلّم", returned: "مرتجع", pending: "معلق",
  in_shipping: "في الشحن", cancelled: "ملغي", processing: "قيد المعالجة",
};
const STATUS_COLORS: Record<string, string> = {
  delivered: "text-emerald-400 bg-emerald-500/10 border-emerald-500/30",
  returned: "text-rose-400 bg-rose-500/10 border-rose-500/30",
  pending: "text-amber-400 bg-amber-500/10 border-amber-500/30",
  in_shipping: "text-blue-400 bg-blue-500/10 border-blue-500/30",
  cancelled: "text-muted-foreground bg-muted/30",
  processing: "text-violet-400 bg-violet-500/10 border-violet-500/30",
};

const ROLE_LABELS: Record<string, string> = {
  super_admin: "سوبر أدمن", admin: "مدير", employee: "موظف مبيعات", warehouse: "مسؤول مخزون",
};

function getRoleColor(role: string) {
  if (role === "super_admin") return "from-yellow-500/20 to-amber-500/10 border-yellow-500/30 text-yellow-400";
  if (role === "admin") return "from-blue-500/20 to-blue-600/10 border-blue-500/30 text-blue-400";
  if (role === "employee") return "from-emerald-500/20 to-green-500/10 border-emerald-500/30 text-emerald-400";
  return "from-violet-500/20 to-purple-500/10 border-violet-500/30 text-violet-400";
}

function ScoreBadge({ score }: { score: number }) {
  if (score >= 80) return <span className="flex items-center gap-1 text-emerald-400 font-bold text-xs"><Trophy className="w-3 h-3" />ممتاز</span>;
  if (score >= 60) return <span className="flex items-center gap-1 text-blue-400 font-bold text-xs"><Star className="w-3 h-3" />جيد</span>;
  if (score >= 40) return <span className="flex items-center gap-1 text-amber-400 font-bold text-xs"><Flame className="w-3 h-3" />متوسط</span>;
  return <span className="flex items-center gap-1 text-rose-400 font-bold text-xs"><Zap className="w-3 h-3" />يحتاج تحسين</span>;
}

function AnimatedBar({ pct: p, color }: { pct: number; color: string }) {
  return (
    <div className="h-2 bg-muted/30 rounded-full overflow-hidden">
      <div className={`h-full rounded-full ${color} transition-all duration-700`} style={{ width: `${Math.min(100, p)}%` }} />
    </div>
  );
}

function MiniCard({ icon: Icon, label, value, sub, color }: {
  icon: any; label: string; value: string | number; sub?: string; color: string;
}) {
  return (
    <div className={`rounded-xl p-3.5 border bg-gradient-to-br ${color} flex flex-col gap-0.5`}>
      <div className="flex items-center justify-between mb-1">
        <span className="text-[11px] text-muted-foreground">{label}</span>
        <Icon className="w-3.5 h-3.5 opacity-60" />
      </div>
      <p className="text-lg font-black">{value}</p>
      {sub && <p className="text-[11px] text-muted-foreground">{sub}</p>}
    </div>
  );
}

function LoadingSpinner({ text = "جاري التحميل..." }: { text?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground">
      <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      <span className="text-sm">{text}</span>
    </div>
  );
}

function EmptyState({ icon: Icon, title, sub }: { icon: any; title: string; sub?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground">
      <Icon className="w-12 h-12 opacity-20" />
      <p className="font-semibold">{title}</p>
      {sub && <p className="text-xs text-center max-w-xs">{sub}</p>}
    </div>
  );
}

/* ── Avatar Upload ── */
function AvatarUpload({ currentAvatar, displayName, onUpload }: {
  currentAvatar?: string | null; displayName: string; onUpload: (b64: string | null) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(currentAvatar ?? null);
  const [dragging, setDragging] = useState(false);
  const processFile = useCallback((file: File) => {
    if (!file.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const MAX = 300;
        const scale = Math.min(1, MAX / Math.max(img.width, img.height));
        const canvas = document.createElement("canvas");
        canvas.width = img.width * scale; canvas.height = img.height * scale;
        const ctx = canvas.getContext("2d")!;
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        const b64 = canvas.toDataURL("image/jpeg", 0.85);
        setPreview(b64); onUpload(b64);
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  }, [onUpload]);
  return (
    <div className="flex flex-col items-center gap-3">
      <div className={`relative group cursor-pointer rounded-full transition-all duration-200 ${dragging ? "ring-4 ring-primary/60 scale-105" : "hover:ring-2 hover:ring-primary/40"}`}
        style={{ width: 100, height: 100 }}
        onClick={() => inputRef.current?.click()}
        onDragOver={e => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={e => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files[0]; if (f) processFile(f); }}>
        {preview
          ? <img src={preview} alt={displayName} className="w-full h-full rounded-full object-cover border-4 border-primary/30" />
          : <div className="w-full h-full rounded-full flex items-center justify-center text-3xl font-black border-4 border-primary/30"
              style={{ background: "linear-gradient(135deg,hsl(var(--primary)/0.8),hsl(var(--primary)/0.4))", color: "hsl(var(--primary-foreground))" }}>
              {displayName.charAt(0).toUpperCase()}
            </div>}
        <div className="absolute inset-0 rounded-full bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
          <Camera className="w-7 h-7 text-white" />
        </div>
      </div>
      <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) processFile(f); }} />
      {preview && <button type="button" className="text-xs text-muted-foreground hover:text-rose-400 transition-colors" onClick={() => { setPreview(null); onUpload(null); }}>إزالة الصورة</button>}
    </div>
  );
}

/* ── Tab: Dashboard (لوحتي) ── */
function DashboardTab({ myStats, profile, externalViewMode, externalDate, onViewModeChange, onDateChange }: {
  myStats?: TeamMemberExtStats;
  profile?: EmployeeProfile;
  externalViewMode?: "monthly" | "daily";
  externalDate?: string;
  onViewModeChange?: (m: "monthly" | "daily") => void;
  onDateChange?: (d: string) => void;
}) {
  const [_viewMode, _setViewMode] = useState<"monthly" | "daily">("daily");
  const [_selectedDate, _setSelectedDate] = useState(format(new Date(), "yyyy-MM-dd"));

  // استخدم الـ external state لو موجود، وإلا الـ internal
  const viewMode = externalViewMode ?? _viewMode;
  const selectedDate = externalDate ?? _selectedDate;
  const setViewMode = (m: "monthly" | "daily") => { _setViewMode(m); onViewModeChange?.(m); };
  const setSelectedDate = (d: string) => { _setSelectedDate(d); onDateChange?.(d); };

  const currentMonth = format(new Date(), "yyyy-MM");
  const prevMonth = format(subMonths(new Date(), 1), "yyyy-MM");
  const todayStr = format(new Date(), "yyyy-MM-dd");
  const selectedMonth = selectedDate.slice(0, 7);

  const { data: currReport } = useQuery({
    queryKey: ["emp-report-curr-mine", currentMonth],
    queryFn: () => employeeApi.getMyReport(currentMonth),
  });
  const { data: prevReport } = useQuery({
    queryKey: ["emp-report-prev-mine", prevMonth],
    queryFn: () => employeeApi.getMyReport(prevMonth),
  });

  // ── الأداء اليومي: طلبات اليوم أو التاريخ المختار ──
  const activeDate = viewMode === "daily" ? selectedDate : todayStr;
  const { data: dayOrders = [] } = useQuery({
    queryKey: ["my-orders-day", activeDate],
    queryFn: () => apiFetch<any[]>(`/orders/my-orders?month=${activeDate.slice(0,7)}`),
    select: (orders) => orders.filter((o: any) => {
      const d = o.createdAt?.slice(0, 10) ?? o.date?.slice(0, 10);
      return d === activeDate;
    }),
    staleTime: 30_000,
  });

  // ── daily report للتاريخ المختار ──
  const { data: dailyReport } = useQuery({
    queryKey: ["emp-report-daily", selectedDate],
    queryFn: () => employeeApi.getMyReport(undefined, "daily", selectedDate),
    enabled: viewMode === "daily",
    staleTime: 60_000,
  });

  // ── الأداء اليومي: KPI logs ──
  const { data: dailyLogs } = useQuery({
    queryKey: ["daily-logs", profile?.id, activeDate],
    queryFn: () => employeeApi.getDailyLogs(profile!.id, activeDate),
    enabled: !!profile?.id,
    staleTime: 30_000,
  });

  // احسب إحصائيات الطلبات
  const dayDelivered = dayOrders.filter((o: any) => o.status === "received" || o.status === "partial_received").length;
  const dayReturned  = dayOrders.filter((o: any) => o.status === "returned").length;
  const dayPending   = dayOrders.filter((o: any) => !["received","partial_received","returned"].includes(o.status)).length;

  // KPI entries من daily logs — الـ backend بيرجع { kpis: [...] }
  const kpiEntries: { label: string; value: number; target: number; unit: string; weight: number; score: number | null }[] = useMemo(() => {
    const logs = dailyLogs as any;
    const kpis = logs?.kpis ?? logs?.entries ?? [];
    if (!kpis.length) return [];
    return kpis.map((e: any) => ({
      label: e.displayName ?? e.kpiName ?? e.name ?? e.label ?? "مؤشر",
      value: e.actualValue ?? e.todayValue ?? e.value ?? 0,
      target: e.dailyTarget ?? e.targetValue ?? e.target ?? 0,
      unit: e.unit ?? "",
      weight: e.weight ?? 1,
      score: e.score ?? null,
    }));
  }, [dailyLogs]);

  // Build comparison data for mini bar chart
  const compData = useMemo(() => {
    if (!currReport || !prevReport) return [];
    return [
      { name: "الشهر السابق", orders: prevReport.orderStats.total, delivered: prevReport.orderStats.delivered, returned: prevReport.orderStats.returned },
      { name: "الشهر الحالي", orders: currReport.orderStats.total, delivered: currReport.orderStats.delivered, returned: currReport.orderStats.returned },
    ];
  }, [currReport, prevReport]);

  const stats = currReport?.orderStats;
  const score = currReport?.overallScore;
  // نحسب التقييم محلياً لتجنب encoding مكسور من الـ API
  const localRating = score == null ? null
    : score >= 80 ? "ممتاز"
    : score >= 65 ? "جيد جداً"
    : score >= 50 ? "جيد"
    : score >= 35 ? "مقبول"
    : score > 0   ? "ضعيف" : null;

  // في الـ daily mode: استخدم dailyReport، وإلا currReport
  const activeReport  = viewMode === "daily" ? dailyReport : currReport;
  const activeStats   = activeReport?.orderStats;

  // احسب score اليوم من KPIs متابعة يومية (dailyLogs.kpis) — المصدر الأساسي
  // fallback: من الطلبات المغلقة لو مفيش KPIs مدخلة
  const dailyScoreLocal = useMemo(() => {
    if (viewMode !== "daily") return null;

    // 1) من dailyLogs.kpis (متابعة يومية)
    const logsKpis: any[] = (dailyLogs as any)?.kpis ?? [];
    const scoredDailyKpis = logsKpis.filter((k: any) => k.score !== null && k.score !== undefined);
    if (scoredDailyKpis.length > 0) {
      const totalWeight = scoredDailyKpis.reduce((s: number, k: any) => s + (k.weight ?? 1), 0);
      const weightedSum = scoredDailyKpis.reduce((s: number, k: any) => s + (k.score ?? 0) * (k.weight ?? 1), 0);
      return Math.round(weightedSum / (totalWeight || 1));
    }

    // 2) Fallback من الطلبات المغلقة لو مفيش KPIs
    const closedCount = dayDelivered + dayReturned;
    if (closedCount === 0) return null;
    const closedDeliveryRate = Math.round((dayDelivered / closedCount) * 100);
    const closedReturnRate   = Math.round((dayReturned  / closedCount) * 100);
    const returnPenalty      = Math.max(0, 100 - closedReturnRate * 2);
    return Math.round(closedDeliveryRate * 0.6 + returnPenalty * 0.4);
  }, [viewMode, dailyLogs, dayDelivered, dayReturned]);

  // في daily mode: استخدم dailyReport?.overallScore (من getMyReport) — نفس مصدر KpisTab
  // fallback: dailyScoreLocal (من getDailyLogs) لو مفيش report
  const activeScore   = viewMode === "daily"
    ? (activeReport?.overallScore ?? dailyScoreLocal)
    : score;
  const activeRating  = activeScore == null ? null
    : activeScore >= 80 ? "ممتاز" : activeScore >= 65 ? "جيد جداً"
    : activeScore >= 50 ? "جيد"   : activeScore >= 35 ? "مقبول" : "ضعيف";
  const activeDateLabel = viewMode === "daily"
    ? format(new Date(selectedDate), "d MMMM yyyy", { locale: ar })
    : format(new Date(currentMonth + "-01"), "MMMM yyyy", { locale: ar });

  // دايماً نعرض اللوحة
  return (
    <div className="space-y-4">

      {/* ── Toggle يومي / شهري ── */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-1 p-1 rounded-xl border border-border bg-muted/20">
          {(["monthly", "daily"] as const).map(mode => (
            <button key={mode} type="button" onClick={() => setViewMode(mode)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                viewMode === mode ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              }`}>
              {mode === "monthly" ? "شهري" : "يومي"}
            </button>
          ))}
        </div>
        {viewMode === "daily" ? (
          <input type="date" value={selectedDate} max={format(new Date(), "yyyy-MM-dd")}
            onChange={e => setSelectedDate(e.target.value)}
            className="rounded-lg border border-border bg-muted/20 px-3 py-1.5 text-xs font-medium focus:outline-none focus:border-primary" />
        ) : (
          <span className="text-xs text-muted-foreground font-medium">{activeDateLabel}</span>
        )}
      </div>

      {/* Quick KPI Cards */}
      <div className="grid grid-cols-3 gap-3">
        <MiniCard icon={Package}
          label={viewMode === "daily" ? "طلبات اليوم" : "طلبات الشهر"}
          value={fmtNum(viewMode === "daily" ? dayOrders.length : (activeStats?.total ?? myStats?.total ?? 0))}
          color="from-blue-500/15 to-blue-600/5 border-blue-500/20 text-blue-400" />
        <MiniCard icon={CheckCircle2} label="مسلّمة"
          value={fmtNum(viewMode === "daily" ? dayDelivered : (activeStats?.delivered ?? myStats?.delivered ?? 0))}
          sub={pct(viewMode === "daily" ? (dayOrders.length > 0 ? dayDelivered / dayOrders.length * 100 : 0) : (activeStats?.deliveryRate ?? myStats?.deliveryRate ?? 0))}
          color="from-emerald-500/15 to-green-600/5 border-emerald-500/20 text-emerald-400" />
        <MiniCard icon={XCircle} label="مرتجعات"
          value={fmtNum(viewMode === "daily" ? dayReturned : (activeStats?.returned ?? myStats?.returned ?? 0))}
          sub={pct(viewMode === "daily" ? (dayOrders.length > 0 ? dayReturned / dayOrders.length * 100 : 0) : (activeStats?.returnRate ?? myStats?.returnRate ?? 0))}
          color="from-rose-500/15 to-red-600/5 border-rose-500/20 text-rose-400" />
      </div>

      {/* ── بيانات اليوم ── */}
      <Card className="border border-amber-500/20 bg-gradient-to-br from-amber-500/5 to-transparent">
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Flame className="w-4 h-4 text-amber-400" />
            <span className="font-bold text-sm">
              {viewMode === "daily" ? `أداء يوم — ${activeDateLabel}` : `الأداء اليومي — ${format(new Date(), "d MMMM yyyy", { locale: ar })}`}
            </span>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-xl border border-border bg-muted/20 p-3 text-center">
              <p className="text-2xl font-black">{dayOrders.length}</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">طلبات</p>
            </div>
            <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-3 text-center">
              <p className="text-2xl font-black text-emerald-400">{dayDelivered}</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">مسلّمة</p>
            </div>
            <div className="rounded-xl border border-rose-500/30 bg-rose-500/5 p-3 text-center">
              <p className="text-2xl font-black text-rose-400">{dayReturned}</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">مرتجعة</p>
            </div>
          </div>
          {dayPending > 0 && (
            <p className="text-[11px] text-amber-400/80 flex items-center gap-1">
              <Hourglass className="w-3 h-3" />{dayPending} طلب قيد الانتظار
            </p>
          )}
          {kpiEntries.length > 0 && (
            <div className="space-y-2 pt-1 border-t border-border/50">
              <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">مؤشرات اليوم</p>
              {kpiEntries.map((k, i) => {
                const pctVal = k.target > 0 ? Math.min(100, (k.value / k.target) * 100) : 0;
                return (
                  <div key={i} className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">{k.label}</span>
                      <span className="font-bold">{fmtNum(k.value)}{k.unit ? ` ${k.unit}` : ""} {k.target > 0 && <span className="text-muted-foreground font-normal">/ {fmtNum(k.target)}</span>}</span>
                    </div>
                    {k.target > 0 && <AnimatedBar pct={pctVal} color={pctVal >= 100 ? "bg-emerald-500" : pctVal >= 60 ? "bg-blue-500" : "bg-amber-500"} />}
                  </div>
                );
              })}
            </div>
          )}
          {dayOrders.length === 0 && kpiEntries.length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-2">لا توجد نشاطات مسجلة</p>
          )}
        </CardContent>
      </Card>

      {/* Score + Comparison — شهري فقط */}
      {viewMode === "monthly" && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Card className="border">
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Trophy className="w-4 h-4 text-amber-400" />
                  <span className="font-bold text-sm">نقاط الأداء</span>
                </div>
                {activeScore != null && <ScoreBadge score={activeScore} />}
              </div>
              {activeScore != null ? (
                <>
                  <div className="text-center py-2">
                    <span className="text-5xl font-black">{activeScore}</span>
                    <span className="text-sm text-muted-foreground">/100</span>
                  </div>
                  <div className="h-3 bg-muted/30 rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all duration-700" style={{
                      width: `${activeScore}%`,
                      background: activeScore >= 80 ? "linear-gradient(90deg,#10b981,#34d399)" : activeScore >= 60 ? "linear-gradient(90deg,#3b82f6,#60a5fa)" : activeScore >= 40 ? "linear-gradient(90deg,#f59e0b,#fbbf24)" : "linear-gradient(90deg,#ef4444,#f87171)",
                    }} />
                  </div>
                  {activeRating && <p className="text-xs text-center text-muted-foreground">التقييم: <span className="font-bold text-foreground">{activeRating}</span></p>}
                  {!currReport?.kpis?.length && (
                    <p className="text-[11px] text-center text-muted-foreground/70 mt-1 flex items-center justify-center gap-1">
                      <Info className="w-3 h-3" />محسوبة من معدل التسليم والإرجاع
                    </p>
                  )}
                </>
              ) : (
                <div className="flex flex-col items-center justify-center py-4 gap-2">
                  <Target className="w-8 h-8 text-muted-foreground/30" />
                  <p className="text-sm text-muted-foreground text-center">لا توجد طلبات هذا الشهر</p>
                </div>
              )}
            </CardContent>
          </Card>
          <Card className="border">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <BarChart3 className="w-4 h-4 text-blue-400" />
                <span className="font-bold text-sm">هذا الشهر مقابل السابق</span>
              </div>
              {compData.length > 0 ? (
                <ResponsiveContainer width="100%" height={110}>
                  <LineChart data={compData}>
                    <XAxis dataKey="name" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                    <Tooltip formatter={(v: any) => [fmtNum(v), ""]}
                      contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 11 }}
                      itemStyle={{ color: "hsl(var(--foreground))" }} cursor={{ stroke: "hsl(var(--border))", strokeWidth: 1 }} />
                    <Line type="monotone" dataKey="delivered" name="مسلّمة" stroke="#10b981" strokeWidth={2.5} dot={{ r: 4, fill: "#10b981", strokeWidth: 0 }} />
                    <Line type="monotone" dataKey="returned" name="مرتجعة" stroke="#ef4444" strokeWidth={2.5} dot={{ r: 4, fill: "#ef4444", strokeWidth: 0 }} />
                  </LineChart>
                </ResponsiveContainer>
              ) : <div className="h-[110px] flex items-center justify-center text-muted-foreground text-sm">لا بيانات كافية</div>}
            </CardContent>
          </Card>
        </div>
      )}

      {/* نقاط الأداء في الـ daily mode */}
      {viewMode === "daily" && activeScore != null && (
        <Card className="border">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Trophy className="w-4 h-4 text-amber-400" />
                <span className="font-bold text-sm">نقاط أداء اليوم</span>
              </div>
              <ScoreBadge score={activeScore} />
            </div>
            <div className="text-center py-1">
              <span className="text-5xl font-black">{activeScore}</span>
              <span className="text-sm text-muted-foreground">/100</span>
            </div>
            <div className="h-3 bg-muted/30 rounded-full overflow-hidden">
              <div className="h-full rounded-full transition-all duration-700" style={{
                width: `${activeScore}%`,
                background: activeScore >= 80 ? "linear-gradient(90deg,#10b981,#34d399)" : activeScore >= 60 ? "linear-gradient(90deg,#3b82f6,#60a5fa)" : activeScore >= 40 ? "linear-gradient(90deg,#f59e0b,#fbbf24)" : "linear-gradient(90deg,#ef4444,#f87171)",
              }} />
            </div>
            {activeRating && <p className="text-xs text-center text-muted-foreground">التقييم: <span className="font-bold text-foreground">{activeRating}</span></p>}
          </CardContent>
        </Card>
      )}

      {/* Financial + Speed — شهري فقط */}
      {viewMode === "monthly" && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Card className="border">
            <CardContent className="p-4 space-y-2.5">
              <div className="flex items-center gap-2"><TrendingUp className="w-4 h-4 text-emerald-400" /><span className="font-bold text-sm">الأداء المالي</span></div>
              <div><div className="flex justify-between text-xs mb-1"><span className="text-muted-foreground">إجمالي الإيرادات</span><span className="font-bold">{fmt(activeStats?.totalRevenue ?? 0)}</span></div><AnimatedBar pct={100} color="bg-blue-500" /></div>
              <div><div className="flex justify-between text-xs mb-1"><span className="text-muted-foreground">معدل التسليم</span><span className="font-bold text-blue-400">{pct(activeStats?.deliveryRate ?? 0)}</span></div><AnimatedBar pct={activeStats?.deliveryRate ?? 0} color="bg-blue-500" /></div>
              <div><div className="flex justify-between text-xs mb-1"><span className="text-muted-foreground">معدل الإرجاع</span><span className="font-bold text-rose-400">{pct(activeStats?.returnRate ?? 0)}</span></div><AnimatedBar pct={activeStats?.returnRate ?? 0} color="bg-rose-500" /></div>
            </CardContent>
          </Card>
          <Card className="border">
            <CardContent className="p-4 space-y-2.5">
              <div className="flex items-center gap-2"><Zap className="w-4 h-4 text-amber-400" /><span className="font-bold text-sm">السرعة والكفاءة</span></div>
              <div className="flex flex-col divide-y divide-border/30">
                {myStats?.avgProcessingHours != null && <div className="flex justify-between py-2 text-xs"><span className="text-muted-foreground flex items-center gap-1"><Clock className="w-3 h-3" />متوسط وقت المعالجة</span><span className="font-bold">{myStats.avgProcessingHours.toFixed(1)} ساعة</span></div>}
                <div className="flex justify-between py-2 text-xs"><span className="text-muted-foreground flex items-center gap-1"><Target className="w-3 h-3" />طلبات يومياً</span><span className="font-bold">{(myStats?.ordersPerDay ?? 0).toFixed(1)}</span></div>
                {myStats?.topSource && <div className="flex justify-between py-2 text-xs"><span className="text-muted-foreground">المصدر الأعلى</span><Badge variant="outline" className="text-xs">{myStats.topSource}</Badge></div>}
                {profile?.hireDate && <div className="flex justify-between py-2 text-xs"><span className="text-muted-foreground flex items-center gap-1"><CalendarDays className="w-3 h-3" />تاريخ التعيين</span><span className="font-bold">{format(new Date(profile.hireDate), "d MMM yyyy", { locale: ar })}</span></div>}
                {profile?.jobTitle && <div className="flex justify-between py-2 text-xs"><span className="text-muted-foreground">المسمى الوظيفي</span><span className="font-bold">{profile.jobTitle}</span></div>}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

/* ── Tab: My Orders (طلباتي) ── */
function OrdersTab({ profile, userId }: { profile?: EmployeeProfile; userId: number }) {
  const [selectedMonth, setSelectedMonth] = useState(format(new Date(), "yyyy-MM"));
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const monthOptions = useMemo(() => Array.from({ length: 6 }, (_, i) => {
    const d = subMonths(new Date(), i);
    return { value: format(d, "yyyy-MM"), label: format(d, "MMMM yyyy", { locale: ar }) };
  }), []);

  // نجيب الطلبات مباشرة من /orders/my-orders — بدون الحاجة لـ profileId أو userId
  const { data: orders = [], isLoading } = useQuery({
    queryKey: ["my-orders", userId, selectedMonth],
    queryFn: () => apiFetch<any[]>(`/orders/my-orders?month=${selectedMonth}`),
    staleTime: 60_000,
  });

  // فلترة بالحالة في الـ frontend
  const filtered = useMemo(() => {
    if (statusFilter === "all") return orders;
    // received/partial_received = delivered
    if (statusFilter === "delivered") return orders.filter((o: any) => o.status === "received" || o.status === "partial_received");
    if (statusFilter === "returned") return orders.filter((o: any) => o.status === "returned");
    if (statusFilter === "pending") return orders.filter((o: any) => !["received","partial_received","returned","in_shipping"].includes(o.status));
    if (statusFilter === "in_shipping") return orders.filter((o: any) => o.status === "in_shipping");
    return orders;
  }, [orders, statusFilter]);

  // احسب الإحصائيات من البيانات
  const stats = useMemo(() => {
    const delivered = orders.filter((o: any) => o.status === "received" || o.status === "partial_received");
    const returned = orders.filter((o: any) => o.status === "returned");
    const inShipping = orders.filter((o: any) => o.status === "in_shipping");
    const total = orders.length;
    const totalProfit = orders.reduce((s: number, o: any) => s + (o.profit ?? 0), 0);
    const totalRevenue = delivered.reduce((s: number, o: any) => s + (o.totalPrice ?? 0), 0);
    return {
      total, delivered: delivered.length, returned: returned.length, inShipping: inShipping.length,
      deliveryRate: total > 0 ? (delivered.length / total) * 100 : 0,
      returnRate: total > 0 ? (returned.length / total) * 100 : 0,
      totalProfit, totalRevenue,
    };
  }, [orders]);

  const STATUS_FILTERS = [
    { key: "all", label: "الكل", count: stats.total },
    { key: "delivered", label: "مسلّمة", count: stats.delivered },
    { key: "in_shipping", label: "في الشحن", count: stats.inShipping },
    { key: "returned", label: "مرتجعة", count: stats.returned },
    { key: "pending", label: "معلقة", count: stats.total - stats.delivered - stats.returned - stats.inShipping },
  ];

  return (
    <div className="space-y-4">
      {/* Month Filter */}
      <div className="flex items-center gap-3 flex-wrap">
        <CalendarDays className="w-4 h-4 text-muted-foreground shrink-0" />
        <div className="flex gap-1.5 flex-wrap">
          {monthOptions.map(m => (
            <button key={m.value} type="button" onClick={() => setSelectedMonth(m.value)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${selectedMonth === m.value ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:text-foreground"}`}>
              {m.label}
            </button>
          ))}
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <MiniCard icon={Package} label="إجمالي" value={fmtNum(stats.total)} color="from-blue-500/15 to-blue-600/5 border-blue-500/20 text-blue-400" />
        <MiniCard icon={CheckCircle2} label="مسلّمة" value={fmtNum(stats.delivered)} sub={pct(stats.deliveryRate)} color="from-emerald-500/15 to-green-600/5 border-emerald-500/20 text-emerald-400" />
        <MiniCard icon={XCircle} label="مرتجعة" value={fmtNum(stats.returned)} sub={pct(stats.returnRate)} color="from-rose-500/15 to-red-600/5 border-rose-500/20 text-rose-400" />
        <MiniCard icon={Coins} label="الإيرادات" value={fmt(stats.totalRevenue)} color="from-violet-500/15 to-purple-600/5 border-violet-500/20 text-violet-400" />
      </div>

      {/* Status Filter Tabs */}
      <div className="flex gap-1.5 flex-wrap">
        {STATUS_FILTERS.map(f => (
          <button key={f.key} type="button" onClick={() => setStatusFilter(f.key)}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium transition-all border ${statusFilter === f.key ? "bg-foreground text-background border-foreground" : "border-border text-muted-foreground hover:text-foreground"}`}>
            {f.label}
            {f.count > 0 && <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${statusFilter === f.key ? "bg-background/20" : "bg-muted"}`}>{f.count}</span>}
          </button>
        ))}
      </div>

      {/* Orders Table */}
      {isLoading ? (
        <LoadingSpinner text="جاري تحميل طلباتك..." />
      ) : filtered.length === 0 ? (
        <EmptyState icon={Package} title={orders.length === 0 ? "لا توجد طلبات في هذا الشهر" : "لا توجد طلبات بهذا الفلتر"} sub="جرب تغيير الشهر أو الفلتر" />
      ) : (
        <Card className="border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm" dir="rtl">
              <thead>
                <tr className="border-b border-border/50 bg-muted/20">
                  <th className="text-right py-2.5 px-3 text-xs text-muted-foreground font-medium">الفاتورة</th>
                  <th className="text-right py-2.5 px-3 text-xs text-muted-foreground font-medium">العميل</th>
                  <th className="text-right py-2.5 px-3 text-xs text-muted-foreground font-medium">المنتج</th>
                  <th className="text-center py-2.5 px-3 text-xs text-muted-foreground font-medium">الكمية</th>
                  <th className="text-right py-2.5 px-3 text-xs text-muted-foreground font-medium">الإجمالي</th>
                  <th className="text-right py-2.5 px-3 text-xs text-muted-foreground font-medium">الحالة</th>
                  <th className="text-right py-2.5 px-3 text-xs text-muted-foreground font-medium">التاريخ</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((o: any, i: number) => (
                  <tr key={o.id} className={`border-b border-border/30 hover:bg-muted/10 transition-colors ${i % 2 === 0 ? "" : "bg-muted/5"}`}>
                    <td className="py-2.5 px-3 text-xs font-mono text-muted-foreground">{o.invoiceNumber ?? `#${o.id}`}</td>
                    <td className="py-2.5 px-3 text-xs font-medium max-w-[110px] truncate">{o.customerName}</td>
                    <td className="py-2.5 px-3 text-xs text-muted-foreground max-w-[100px] truncate">
                      {o.product}{o.color ? ` - ${o.color}` : ""}{o.size ? ` / ${o.size}` : ""}
                    </td>
                    <td className="py-2.5 px-3 text-xs text-center">{o.quantity}</td>
                    <td className="py-2.5 px-3 text-xs font-bold">{fmt(o.totalPrice)}</td>
                    <td className="py-2.5 px-3">
                      <span className={`inline-flex text-[10px] px-2 py-0.5 rounded-full border font-medium ${STATUS_COLORS[o.status] ?? STATUS_COLORS.pending}`}>
                        {STATUS_LABELS[o.status] ?? o.status}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-xs text-muted-foreground whitespace-nowrap">
                      {format(new Date(o.createdAt), "d MMM", { locale: ar })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-3 py-2 border-t border-border/30 bg-muted/10 text-xs text-muted-foreground flex justify-between">
            <span>يعرض {fmtNum(filtered.length)} من {fmtNum(orders.length)} طلب</span>
            <span>{format(new Date(selectedMonth + "-01"), "MMMM yyyy", { locale: ar })}</span>
          </div>
        </Card>
      )}
    </div>
  );
}

/* ── Tab: KPIs (مؤشرات الأداء) ── */
function KpisTab({ myStats, profile, externalViewMode, externalDate, onViewModeChange, onDateChange }: {
  myStats?: TeamMemberExtStats;
  profile?: EmployeeProfile;
  externalViewMode?: "monthly" | "daily";
  externalDate?: string;
  onViewModeChange?: (m: "monthly" | "daily") => void;
  onDateChange?: (d: string) => void;
}) {
  const [_viewMode, _setViewMode]       = useState<"monthly" | "daily">("monthly");
  const [selectedMonth, setSelectedMonth] = useState(format(new Date(), "yyyy-MM"));
  const [_selectedDate, _setSelectedDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const viewMode      = externalViewMode ?? _viewMode;
  const selectedDate  = externalDate ?? _selectedDate;
  const setViewMode   = (m: "monthly" | "daily") => { _setViewMode(m); onViewModeChange?.(m); };
  const setSelectedDate = (d: string) => { _setSelectedDate(d); onDateChange?.(d); };

  const monthOptions = useMemo(() => Array.from({ length: 6 }, (_, i) => {
    const d = subMonths(new Date(), i);
    return { value: format(d, "yyyy-MM"), label: format(d, "MMMM yyyy", { locale: ar }) };
  }), []);

  // استخدم getMyReport بدل getReport — يشتغل حتى بدون profile
  const { data: report, isLoading: reportLoading } = useQuery({
    queryKey: ["emp-report-kpis-mine", viewMode, viewMode === "monthly" ? selectedMonth : selectedDate],
    queryFn: () => viewMode === "daily"
      ? employeeApi.getMyReport(selectedMonth, "daily", selectedDate)
      : employeeApi.getMyReport(selectedMonth),
  });

  const kpis = report?.kpis ?? [];
  const fin = report?.kpiFinancials;

  const periodLabel = viewMode === "daily"
    ? format(new Date(selectedDate), "d MMMM yyyy", { locale: ar })
    : (monthOptions.find(m => m.value === selectedMonth)?.label ?? selectedMonth);

  // ── مؤشرات من التقرير ──
  const teamKpiItems = useMemo(() => {
    const os = report?.orderStats;
    const deliveryRate = os?.deliveryRate ?? myStats?.deliveryRate ?? 0;
    const returnRate   = os?.returnRate   ?? myStats?.returnRate   ?? 0;
    const ordersPerDay = viewMode === "daily"
      ? (os?.total ?? 0)
      : (myStats?.ordersPerDay ?? (os ? os.total / 26 : 0));
    const score        = report?.overallScore ?? myStats?.score ?? 0;
    if (!os && !myStats) return [];
    return [
      {
        id: "delivery",
        name: "معدل التسليم",
        icon: CheckCircle2, color: "text-emerald-400", bg: "from-emerald-500/15 to-green-600/5 border-emerald-500/20",
        progress: deliveryRate, value: `${deliveryRate.toFixed(1)}%`, target: "80%",
        achieved: deliveryRate >= 80, description: "نسبة الطلبات المسلّمة من الإجمالي",
      },
      {
        id: "return",
        name: "معدل الإرجاع",
        icon: XCircle, color: "text-rose-400", bg: "from-rose-500/15 to-red-600/5 border-rose-500/20",
        progress: Math.max(0, 20 - returnRate) / 20 * 100, value: `${returnRate.toFixed(1)}%`, target: "< 20%",
        achieved: returnRate < 20, description: "نسبة الطلبات المرتجعة (كلما قلّت كان أفضل)",
      },
      {
        id: "score",
        name: "نقاط الأداء الكلية",
        icon: Trophy, color: "text-amber-400", bg: "from-amber-500/15 to-yellow-600/5 border-amber-500/20",
        progress: score, value: `${score} / 100`, target: "80 نقطة",
        achieved: score >= 80, description: "النقاط الإجمالية بناءً على كل المؤشرات",
      },
      {
        id: "volume",
        name: viewMode === "daily" ? "طلبات اليوم" : "حجم المبيعات",
        icon: Package, color: "text-blue-400", bg: "from-blue-500/15 to-blue-600/5 border-blue-500/20",
        progress: viewMode === "daily" ? Math.min(100, ordersPerDay * 10) : Math.min(100, ordersPerDay * 10),
        value: viewMode === "daily" ? `${ordersPerDay} طلب` : `${ordersPerDay.toFixed(1)} / يوم`,
        target: viewMode === "daily" ? "10 طلبات" : "10 يومياً",
        achieved: ordersPerDay >= (viewMode === "daily" ? 10 : 10),
        description: viewMode === "daily" ? "عدد الطلبات اليوم" : "متوسط الطلبات اليومية",
      },
      {
        id: "speed",
        name: "سرعة المعالجة",
        icon: Zap, color: "text-violet-400", bg: "from-violet-500/15 to-purple-600/5 border-violet-500/20",
        progress: myStats?.avgProcessingHours != null ? Math.max(0, (48 - myStats.avgProcessingHours) / 48 * 100) : 0,
        value: myStats?.avgProcessingHours != null ? `${myStats.avgProcessingHours.toFixed(1)} ساعة` : "—",
        target: "< 24 ساعة",
        achieved: myStats?.avgProcessingHours != null && myStats.avgProcessingHours < 24,
        description: "متوسط الوقت من إنشاء الطلب للتسليم",
      },
    ];
  }, [myStats, report, viewMode]);

  const achieved = teamKpiItems.filter(k => k.achieved).length;

  return (
    <div className="space-y-4">

      {/* ── Toggle يومي / شهري ── */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-1 p-1 rounded-xl border border-border bg-muted/20">
          {(["monthly", "daily"] as const).map(mode => (
            <button key={mode} type="button" onClick={() => setViewMode(mode)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                viewMode === mode ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              }`}>
              {mode === "monthly" ? "شهري" : "يومي"}
            </button>
          ))}
        </div>
        <span className="text-xs text-muted-foreground font-medium">{periodLabel}</span>
      </div>

      {/* ── Period Selector ── */}
      {viewMode === "monthly" ? (
        <div className="flex gap-2 flex-wrap">
          {monthOptions.map(m => (
            <button key={m.value} type="button" onClick={() => setSelectedMonth(m.value)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${
                selectedMonth === m.value ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:text-foreground"
              }`}>
              {m.label}
            </button>
          ))}
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <CalendarDays className="w-4 h-4 text-muted-foreground shrink-0" />
          <input
            type="date"
            value={selectedDate}
            max={format(new Date(), "yyyy-MM-dd")}
            onChange={e => {
              setSelectedDate(e.target.value);
              setSelectedMonth(e.target.value.slice(0, 7));
            }}
            className="flex-1 rounded-lg border border-border bg-muted/20 px-3 py-1.5 text-xs font-medium focus:outline-none focus:border-primary"
          />
        </div>
      )}

      {/* ── Quick Stats ── */}
      {myStats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <MiniCard icon={Trophy} label="النقاط الكلية" value={`${report?.overallScore ?? myStats.score}/100`}
            color="from-amber-500/15 to-yellow-600/5 border-amber-500/20 text-amber-400" />
          <MiniCard icon={CheckCircle2} label="معدل التسليم"
            value={`${(report?.orderStats?.deliveryRate ?? myStats.deliveryRate).toFixed(1)}%`}
            color="from-emerald-500/15 to-green-600/5 border-emerald-500/20 text-emerald-400" />
          <MiniCard icon={XCircle} label="معدل الإرجاع"
            value={`${(report?.orderStats?.returnRate ?? myStats.returnRate).toFixed(1)}%`}
            color="from-rose-500/15 to-red-600/5 border-rose-500/20 text-rose-400" />
          <MiniCard icon={BadgeCheck} label="محقق" value={`${achieved} / ${teamKpiItems.length}`}
            color="from-blue-500/15 to-blue-600/5 border-blue-500/20 text-blue-400" />
        </div>
      )}

      {/* ── مؤشرات أداء الفريق ── */}
      {teamKpiItems.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">مؤشرات أداء الفريق</p>
          <div className="space-y-2.5">
            {teamKpiItems.map(kpi => (
              <Card key={kpi.id} className={`border transition-all ${kpi.achieved ? "border-emerald-500/30" : "border-border"}`}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <kpi.icon className={`w-4 h-4 ${kpi.color} shrink-0`} />
                        <span className="font-bold text-sm">{kpi.name}</span>
                        {kpi.achieved
                          ? <BadgeCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                          : <XCircle className="w-4 h-4 text-rose-400 shrink-0" />}
                      </div>
                      <p className="text-xs text-muted-foreground">{kpi.description}</p>
                    </div>
                    <span className={`text-lg font-black shrink-0 ${kpi.color}`}>{kpi.value}</span>
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-[10px] text-muted-foreground">
                      <span>التقدم</span><span>الهدف: {kpi.target}</span>
                    </div>
                    <div className="h-2.5 bg-muted/30 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full transition-all duration-700 ${kpi.achieved ? "bg-emerald-500" : kpi.progress >= 60 ? "bg-amber-500" : "bg-rose-500"}`}
                        style={{ width: `${Math.min(100, kpi.progress)}%` }} />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* ── مصادر الإعلانات (شهري فقط) ── */}
      {viewMode === "monthly" && myStats?.sourceCounts && Object.keys(myStats.sourceCounts).length > 0 && (
        <Card className="border">
          <CardContent className="p-4">
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3">توزيع مصادر الطلبات</p>
            <div className="space-y-2">
              {Object.entries(myStats.sourceCounts)
                .sort((a, b) => b[1] - a[1]).slice(0, 5)
                .map(([source, count]) => {
                  const total = Object.values(myStats.sourceCounts).reduce((s, v) => s + v, 0);
                  const pctVal = total > 0 ? (count / total) * 100 : 0;
                  return (
                    <div key={source} className="flex items-center gap-3">
                      <span className="text-xs text-muted-foreground w-20 shrink-0 truncate">{source}</span>
                      <div className="flex-1 h-2 bg-muted/30 rounded-full overflow-hidden">
                        <div className="h-full bg-primary/60 rounded-full transition-all duration-700" style={{ width: `${pctVal}%` }} />
                      </div>
                      <span className="text-xs font-bold w-10 text-right shrink-0">{fmtNum(count)}</span>
                    </div>
                  );
                })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── KPIs المخصصة من employee profile ── */}
      {profile?.id && (
        reportLoading ? (
          <LoadingSpinner text="جاري تحميل مؤشرات الأداء المخصصة..." />
        ) : kpis.length > 0 ? (
          <div className="space-y-2">
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">KPIs مخصصة</p>
            {fin && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-2">
                <MiniCard icon={BadgeCheck} label="KPIs محققة" value={`${fin.achievedCount} / ${kpis.length}`} color="from-emerald-500/15 to-green-600/5 border-emerald-500/20 text-emerald-400" />
                <MiniCard icon={Coins} label="مكافآت" value={fmt(fin.totalBonus)} color="from-amber-500/15 to-yellow-600/5 border-amber-500/20 text-amber-400" />
                <MiniCard icon={TrendingDown} label="خصومات" value={fmt(fin.totalDeduction)} color="from-rose-500/15 to-red-600/5 border-rose-500/20 text-rose-400" />
                <MiniCard icon={Wallet} label="الراتب بعد التعديل" value={fmt((report?.salary ?? 0) + fin.totalBonus - fin.totalDeduction)} color="from-blue-500/15 to-blue-600/5 border-blue-500/20 text-blue-400" />
              </div>
            )}
            <div className="space-y-2.5">
              {kpis.map((kpi) => {
                const actual = kpi.actualValue ?? 0;
                const target = kpi.targetValue;
                const progress = target > 0 ? Math.min(100, (actual / target) * 100) : 0;
                const achv = kpi.achieved;
                const progressColor = achv ? "bg-emerald-500" : progress >= 70 ? "bg-amber-500" : "bg-rose-500";
                return (
                  <Card key={kpi.id} className={`border transition-all ${achv ? "border-emerald-500/30" : "border-border"}`}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className="font-bold text-sm">{kpi.name}</span>
                            {achv === true && <BadgeCheck className="w-4 h-4 text-emerald-400 shrink-0" />}
                            {achv === false && <XCircle className="w-4 h-4 text-rose-400 shrink-0" />}
                          </div>
                          {kpi.description && <p className="text-xs text-muted-foreground">{kpi.description}</p>}
                        </div>
                        {kpi.score != null && (
                          <span className={`text-lg font-black shrink-0 ${kpi.score >= 80 ? "text-emerald-400" : kpi.score >= 60 ? "text-blue-400" : kpi.score >= 40 ? "text-amber-400" : "text-rose-400"}`}>
                            {kpi.score.toFixed(0)}<span className="text-xs text-muted-foreground">/100</span>
                          </span>
                        )}
                      </div>
                      <div className="space-y-1.5">
                        <div className="flex justify-between text-xs">
                          <span className="text-muted-foreground">الفعلي: <span className="font-bold text-foreground">{fmtNum(actual)} {kpi.unit}</span></span>
                          <span className="text-muted-foreground">الهدف: <span className="font-bold text-foreground">{fmtNum(target)} {kpi.unit}</span></span>
                        </div>
                        <div className="h-2.5 bg-muted/30 rounded-full overflow-hidden">
                          <div className={`h-full rounded-full transition-all duration-700 ${progressColor}`} style={{ width: `${progress}%` }} />
                        </div>
                        <div className="flex justify-between text-[10px] text-muted-foreground">
                          <span>{progress.toFixed(1)}% من الهدف</span>
                          <span>الوزن: {kpi.weight}%</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        ) : null
      )}

      {/* ── فارغ لو مفيش بيانات ── */}
      {!myStats && !profile?.id && (
        <EmptyState icon={Activity} title="لا توجد بيانات أداء" sub="لا توجد بيانات في أداء الفريق" />
      )}
    </div>
  );
}
/* ── Tab: Monthly Report (تقرير شهري) ── */
function ScoreRing({ score, size = 80 }: { score: number; size?: number }) {
  const r = (size - 12) / 2;
  const circ = 2 * Math.PI * r;
  const dash = (score / 100) * circ;
  const color = score >= 80 ? "#10b981" : score >= 60 ? "#3b82f6" : score >= 40 ? "#f59e0b" : "#ef4444";
  return (
    <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="hsl(var(--muted)/0.3)" strokeWidth={10} />
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={10}
        strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
        style={{ transition: "stroke-dasharray 1s ease" }} />
    </svg>
  );
}

function MonthlyReportTab({ profile, externalViewMode, externalDate, onViewModeChange, onDateChange }: {
  profile?: EmployeeProfile;
  externalViewMode?: "monthly" | "daily";
  externalDate?: string;
  onViewModeChange?: (m: "monthly" | "daily") => void;
  onDateChange?: (d: string) => void;
}) {
  const { user } = useAuth();
  const isSuperAdmin = user?.role === "super_admin";
  const [_viewMode, _setViewMode] = useState<"monthly" | "daily">("monthly");
  const [_selectedDate, _setSelectedDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const viewMode     = externalViewMode ?? _viewMode;
  const selectedDate = externalDate ?? _selectedDate;
  const setViewMode  = (m: "monthly" | "daily") => { _setViewMode(m); onViewModeChange?.(m); };
  const setSelectedDate = (d: string) => { _setSelectedDate(d); onDateChange?.(d); };
  const [selectedMonth, setSelectedMonth] = useState(format(new Date(), "yyyy-MM"));

  const monthOptions = useMemo(() => Array.from({ length: 12 }, (_, i) => {
    const d = subMonths(new Date(), i);
    return { value: format(d, "yyyy-MM"), label: format(d, "MMMM yyyy", { locale: ar }) };
  }), []);

  const profileId = profile?.id;

  const { data: report, isLoading } = useQuery({
    queryKey: ["emp-report", profileId, viewMode, viewMode === "daily" ? selectedDate : selectedMonth],
    queryFn: () => {
      if (viewMode === "daily") {
        return profileId
          ? employeeApi.getReport(profileId, undefined, "daily", selectedDate)
          : employeeApi.getMyReport(selectedDate.slice(0, 7));
      }
      return profileId
        ? employeeApi.getReport(profileId, selectedMonth)
        : employeeApi.getMyReport(selectedMonth);
    },
  });

  // ── Adjustments (بونص/خصم يدوي) ──
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data: adjustments = [], isLoading: adjLoading } = useQuery({
    queryKey: ["adjustments", profileId, selectedMonth],
    queryFn: () => profileId
      ? attendanceApi.listAdjustments(profileId, selectedMonth)
      : Promise.resolve([] as PayrollAdjustment[]),
    enabled: !!profileId,
  });

  const [adjForm, setAdjForm] = useState<{
    show: boolean; type: "bonus" | "deduction"; amount: string; reason: string; editId: number | null;
  }>({ show: false, type: "bonus", amount: "", reason: "", editId: null });

  const addAdjMutation = useMutation({
    mutationFn: (data: { type: "bonus" | "deduction"; amount: number; reason: string }) =>
      attendanceApi.addAdjustment({ profileId: profileId!, month: selectedMonth, ...data }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["adjustments", profileId, selectedMonth] });
      queryClient.invalidateQueries({ queryKey: ["emp-report-monthly", profileId, selectedMonth] });
      setAdjForm({ show: false, type: "bonus", amount: "", reason: "", editId: null });
      toast({ title: "تم الحفظ", description: "تمت إضافة التسوية بنجاح" });
    },
    onError: (e: any) => toast({ title: "خطأ", description: e.message, variant: "destructive" }),
  });

  const deleteAdjMutation = useMutation({
    mutationFn: (id: number) => attendanceApi.deleteAdjustment(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["adjustments", profileId, selectedMonth] });
      queryClient.invalidateQueries({ queryKey: ["emp-report-monthly", profileId, selectedMonth] });
      toast({ title: "تم الحذف", description: "تم حذف التسوية" });
    },
    onError: (e: any) => toast({ title: "خطأ", description: e.message, variant: "destructive" }),
  });

  const handleSaveAdj = () => {
    const amount = parseFloat(adjForm.amount);
    if (!amount || amount <= 0 || !adjForm.reason.trim()) {
      toast({ title: "بيانات ناقصة", description: "ادخل المبلغ والسبب", variant: "destructive" });
      return;
    }
    addAdjMutation.mutate({ type: adjForm.type, amount, reason: adjForm.reason.trim() });
  };

  if (isLoading) return <LoadingSpinner text={viewMode === "daily" ? "جاري تحميل تقرير اليوم..." : "جاري تحميل التقرير الشهري..."} />;
  if (!report) return <EmptyState icon={FileText} title="لا يوجد تقرير" sub={viewMode === "daily" ? "لا توجد بيانات لهذا اليوم" : "لا توجد بيانات لهذا الشهر"} />;

  const { orderStats: os, kpis, kpiFinancials: fin, overallScore, salary } = report;
  const netSalary = salary + (fin?.totalBonus ?? 0) - (fin?.totalDeduction ?? 0);
  const monthLabel = viewMode === "daily"
    ? format(new Date(selectedDate), "d MMMM yyyy", { locale: ar })
    : (monthOptions.find(m => m.value === selectedMonth)?.label ?? selectedMonth);

  // نحسب التقييم محلياً من النقاط لتجنب مشكلة encoding القادم من الـ API
  const score = overallScore ?? 0;
  const rating =
    score >= 80 ? "ممتاز" :
    score >= 65 ? "جيد جداً" :
    score >= 50 ? "جيد" :
    score >= 35 ? "مقبول" :
    score > 0   ? "ضعيف" : null;

  const ratingMeta: Record<string, { color: string; bg: string; border: string; icon: any }> = {
    "ممتاز":    { color: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/30", icon: Trophy },
    "جيد جداً": { color: "text-blue-400",    bg: "bg-blue-500/10",    border: "border-blue-500/30",    icon: Star },
    "جيد":      { color: "text-sky-400",      bg: "bg-sky-500/10",     border: "border-sky-500/30",     icon: Star },
    "مقبول":    { color: "text-amber-400",    bg: "bg-amber-500/10",   border: "border-amber-500/30",   icon: Flame },
    "ضعيف":     { color: "text-rose-400",     bg: "bg-rose-500/10",    border: "border-rose-500/30",    icon: Zap },
  };
  const rm = ratingMeta[rating ?? ""] ?? { color: "text-muted-foreground", bg: "bg-muted/20", border: "border-border", icon: Star };
  const RatingIcon = rm.icon;

  const pieData = [
    { name: "مسلّمة",    value: os.delivered, color: "#10b981" },
    { name: "مرتجعة",    value: os.returned,  color: "#ef4444" },
    { name: "قيد التنفيذ", value: os.pending,   color: "#f59e0b" },
  ].filter(d => d.value > 0);

  return (
    <div className="space-y-4" dir="rtl">

      {/* ── Mode Toggle: شهري / يومي ── */}
      <div className="flex items-center gap-2">
        <button type="button" onClick={() => setViewMode("monthly")}
          className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all border ${
            viewMode === "monthly"
              ? "bg-primary text-primary-foreground border-primary shadow-sm"
              : "border-border text-muted-foreground hover:text-foreground"
          }`}>
          شهري
        </button>
        <button type="button" onClick={() => setViewMode("daily")}
          className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all border ${
            viewMode === "daily"
              ? "bg-primary text-primary-foreground border-primary shadow-sm"
              : "border-border text-muted-foreground hover:text-foreground"
          }`}>
          يومي
        </button>
      </div>

      {/* ── Date/Month Selector ── */}
      {viewMode === "monthly" ? (
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
        {monthOptions.slice(0, 6).map(m => (
          <button key={m.value} type="button" onClick={() => setSelectedMonth(m.value)}
            className={`shrink-0 px-3.5 py-1.5 rounded-full text-xs font-bold transition-all border whitespace-nowrap ${
              selectedMonth === m.value
                ? "bg-primary text-primary-foreground border-primary shadow-sm"
                : "border-border text-muted-foreground hover:text-foreground hover:border-foreground/30"
            }`}>
            {m.label}
          </button>
        ))}
      </div>
      ) : (
      <div className="flex items-center gap-2">
        <label className="text-xs text-muted-foreground font-bold">اختر يوم:</label>
        <input
          type="date"
          value={selectedDate}
          max={format(new Date(), "yyyy-MM-dd")}
          onChange={e => setSelectedDate(e.target.value)}
          className="px-3 py-1.5 rounded-lg border border-border bg-card text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
        />
      </div>
      )}

      {/* ── Hero Card: Score + Rating + Name ── */}
      <div className="relative overflow-hidden rounded-2xl border border-border bg-card">
        {/* Decorative gradient bg */}
        <div className="absolute inset-0 pointer-events-none"
          style={{ background: "radial-gradient(ellipse at 10% 50%, hsl(var(--primary)/0.12) 0%, transparent 60%)" }} />
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent" />

        <div className="relative p-5 flex items-center gap-5 flex-wrap">
          {/* Score Ring */}
          {overallScore != null ? (
            <div className="relative shrink-0">
              <ScoreRing score={overallScore} size={88} />
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-xl font-black leading-none">{overallScore}</span>
                <span className="text-[9px] text-muted-foreground">/ 100</span>
              </div>
            </div>
          ) : (
            <div className="w-[88px] h-[88px] rounded-full border-4 border-dashed border-border/40 flex items-center justify-center shrink-0">
              <span className="text-xs text-muted-foreground text-center leading-tight">لا يوجد<br/>تقييم</span>
            </div>
          )}

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className="font-black text-lg leading-tight">{report.displayName}</span>
              {rating && (
                <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold border ${rm.bg} ${rm.border} ${rm.color}`}>
                  <RatingIcon className="w-3 h-3" />{rating}
                </span>
              )}
            </div>
            <p className="text-sm text-muted-foreground flex items-center gap-1.5">
              <CalendarDays className="w-3.5 h-3.5 shrink-0" />{monthLabel}
            </p>

            {/* Mini stats row */}
            <div className="flex gap-4 mt-3 flex-wrap">
              <div className="flex flex-col">
                <span className="text-[10px] text-muted-foreground">إجمالي الطلبات</span>
                <span className="text-base font-black">{fmtNum(os.total)}</span>
              </div>
              <div className="w-px bg-border/50 self-stretch" />
              <div className="flex flex-col">
                <span className="text-[10px] text-muted-foreground">معدل التسليم</span>
                <span className="text-base font-black text-emerald-400">
                  {os.total > 0 ? pct(os.delivered / os.total * 100) : "0.0%"}
                </span>
              </div>
              <div className="w-px bg-border/50 self-stretch" />
              {isSuperAdmin && (
              <div className="flex flex-col">
                <span className="text-[10px] text-muted-foreground">صافي الأرباح</span>
                <span className="text-base font-black text-violet-400">{fmt(os.totalProfit)}</span>
              </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Order Stats Grid ── */}
      <div>
        <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest mb-2.5 px-0.5">إحصائيات الطلبات</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
          {[
            { label: "إجمالي الطلبات",   value: fmtNum(os.total),      icon: Package,      grad: "from-slate-500/15 to-slate-600/5 border-slate-500/20",   val: "text-foreground" },
            { label: "مسلّمة",            value: fmtNum(os.delivered),  icon: CheckCircle2, grad: "from-emerald-500/15 to-green-600/5 border-emerald-500/20", val: "text-emerald-400" },
            { label: "مرتجعة",           value: fmtNum(os.returned),   icon: XCircle,      grad: "from-rose-500/15 to-red-600/5 border-rose-500/20",        val: "text-rose-400" },
            { label: "قيد التنفيذ",      value: fmtNum(os.pending),    icon: Hourglass,    grad: "from-amber-500/15 to-yellow-600/5 border-amber-500/20",   val: "text-amber-400" },
            { label: "إجمالي الإيرادات", value: fmt(os.totalRevenue),  icon: Coins,        grad: "from-blue-500/15 to-blue-600/5 border-blue-500/20",       val: "text-blue-400" },
            { label: "صافي الأرباح",     value: fmt(os.totalProfit),   icon: TrendingUp,   grad: "from-violet-500/15 to-purple-600/5 border-violet-500/20", val: "text-violet-400" },
          ].map(({ label, value, icon: Icon, grad, val }) => (
            <div key={label} className={`rounded-xl p-3.5 border bg-gradient-to-br ${grad} flex flex-col gap-1`}>
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-muted-foreground leading-tight">{label}</span>
                <Icon className="w-3.5 h-3.5 opacity-50 shrink-0" />
              </div>
              <span className={`text-base font-black leading-tight ${val}`}>{value}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Delivery vs Return Bars ── */}
      <div className="rounded-xl border border-border bg-card p-4 space-y-3.5">
        <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest">أداء التسليم والإرجاع</p>

        <div className="space-y-1.5">
          <div className="flex justify-between text-xs font-semibold">
            <span className="flex items-center gap-1.5 text-emerald-400"><CheckCircle2 className="w-3.5 h-3.5" />معدل التسليم</span>
            <span className="text-emerald-400">{os.total > 0 ? pct(os.delivered / os.total * 100) : "0.0%"}</span>
          </div>
          <div className="h-3 bg-muted/30 rounded-full overflow-hidden">
            <div className="h-full rounded-full bg-emerald-500 transition-all duration-700"
              style={{ width: `${os.total > 0 ? (os.delivered / os.total * 100) : 0}%` }} />
          </div>
        </div>

        <div className="space-y-1.5">
          <div className="flex justify-between text-xs font-semibold">
            <span className="flex items-center gap-1.5 text-rose-400"><XCircle className="w-3.5 h-3.5" />معدل الإرجاع</span>
            <span className="text-rose-400">{os.total > 0 ? pct(os.returned / os.total * 100) : "0.0%"}</span>
          </div>
          <div className="h-3 bg-muted/30 rounded-full overflow-hidden">
            <div className="h-full rounded-full bg-rose-500 transition-all duration-700"
              style={{ width: `${os.total > 0 ? (os.returned / os.total * 100) : 0}%` }} />
          </div>
        </div>

        {/* Pie chart */}
        {pieData.length > 0 && (
          <div className="flex items-center gap-4 pt-1">
            <ResponsiveContainer width={110} height={110}>
              <PieChart>
                <Pie data={pieData} dataKey="value" cx="50%" cy="50%" innerRadius={28} outerRadius={50} paddingAngle={3}>
                  {pieData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                </Pie>
                <Tooltip formatter={(v: any) => [fmtNum(v), ""]}
                  contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 11 }}
                  cursor={false}
                  wrapperStyle={{ display: "none" }} />
              </PieChart>
            </ResponsiveContainer>
            <div className="flex-1 space-y-2">
              {pieData.map(d => (
                <div key={d.name} className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: d.color }} />
                    <span className="text-xs text-muted-foreground">{d.name}</span>
                  </div>
                  <span className="text-xs font-bold">{fmtNum(d.value)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── KPIs ── */}
      {kpis.length > 0 && (
        <div>
          <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest mb-2.5 px-0.5">مؤشرات الأداء الوظيفي</p>
          <div className="space-y-2.5">
            {kpis.map(k => {
              const actual = k.actualValue ?? 0;
              const progress = k.targetValue > 0 ? Math.min(100, (actual / k.targetValue) * 100) : 0;
              const scoreColor = k.score == null ? "text-muted-foreground"
                : k.score >= 80 ? "text-emerald-400" : k.score >= 60 ? "text-blue-400"
                : k.score >= 40 ? "text-amber-400" : "text-rose-400";
              const barColor = k.achieved ? "bg-emerald-500" : progress >= 70 ? "bg-amber-500" : "bg-rose-500";
              return (
                <div key={k.id} className={`rounded-xl border p-4 transition-all ${k.achieved ? "border-emerald-500/30 bg-emerald-500/5" : "border-border bg-card"}`}>
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        {k.achieved === true
                          ? <BadgeCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                          : k.achieved === false
                            ? <XCircle className="w-4 h-4 text-rose-400 shrink-0" />
                            : <Info className="w-4 h-4 text-muted-foreground shrink-0" />}
                        <span className="font-bold text-sm">{k.name}</span>
                      </div>
                      {k.description && <p className="text-[11px] text-muted-foreground mt-0.5 mr-6">{k.description}</p>}
                    </div>
                    {k.score != null && (
                      <div className="text-right shrink-0">
                        <span className={`text-xl font-black ${scoreColor}`}>{k.score.toFixed(0)}</span>
                        <span className="text-[10px] text-muted-foreground">/100</span>
                      </div>
                    )}
                  </div>
                  <div className="space-y-2 mr-6">
                    <div className="flex justify-between text-[11px]">
                      <span className="text-muted-foreground">الفعلي: <strong className="text-foreground">{fmtNum(actual)} {k.unit}</strong></span>
                      <span className="text-muted-foreground">الهدف: <strong className="text-foreground">{fmtNum(k.targetValue)} {k.unit}</strong></span>
                    </div>
                    <div className="h-2.5 bg-muted/30 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full ${barColor} transition-all duration-700`} style={{ width: `${progress}%` }} />
                    </div>
                    <div className="flex justify-between text-[10px] text-muted-foreground">
                      <span>{progress.toFixed(1)}% من الهدف</span>
                      {k.weight > 0 && <span>الوزن: {k.weight}%</span>}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Salary Card ── */}
      {salary > 0 && (
        <div className="rounded-2xl border border-border overflow-hidden">
          <div className="px-5 py-3 border-b border-border/50 flex items-center gap-2"
            style={{ background: "linear-gradient(to left, hsl(var(--primary)/0.08), transparent)" }}>
            <Wallet className="w-4 h-4 text-primary shrink-0" />
            <p className="font-black text-sm">ملخص الراتب</p>
          </div>
          <div className="p-4 bg-card space-y-2.5">
            <div className="flex justify-between items-center py-2 border-b border-border/20">
              <span className="text-sm text-muted-foreground">الراتب الأساسي</span>
              <span className="font-bold text-sm">{fmt(salary)}</span>
            </div>
            {fin && fin.totalBonus > 0 && (
              <div className="flex justify-between items-center py-2 border-b border-border/20">
                <span className="text-sm text-emerald-400 flex items-center gap-1.5">
                  <ArrowUp className="w-3.5 h-3.5" />مكافآت الأداء
                </span>
                <span className="font-bold text-sm text-emerald-400">+ {fmt(fin.totalBonus)}</span>
              </div>
            )}
            {fin && fin.totalDeduction > 0 && (
              <div className="flex justify-between items-center py-2 border-b border-border/20">
                <span className="text-sm text-rose-400 flex items-center gap-1.5">
                  <ArrowDown className="w-3.5 h-3.5" />خصومات الأداء
                </span>
                <span className="font-bold text-sm text-rose-400">- {fmt(fin.totalDeduction)}</span>
              </div>
            )}

            {/* ── تسويات يدوية (بونص/خصم المكتب) ── */}
            {profileId && (
              <div className="py-2 border-b border-border/20 space-y-2">
                {/* عنوان القسم */}
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-amber-400" />تسويات المكتب
                  </span>
                  <button
                    type="button"
                    onClick={() => setAdjForm(f => ({ ...f, show: !f.show, editId: null, amount: "", reason: "", type: "bonus" }))}
                    className="flex items-center gap-1 text-xs font-bold text-primary hover:text-primary/80 transition-colors"
                  >
                    <RefreshCw className="w-3 h-3" />
                    {adjForm.show ? "إلغاء" : "+ إضافة"}
                  </button>
                </div>

                {/* فورم الإضافة */}
                {adjForm.show && (
                  <div className="rounded-xl border border-primary/20 bg-primary/5 p-3 space-y-3">
                    {/* نوع التسوية */}
                    <div className="grid grid-cols-2 gap-2">
                      {(["bonus", "deduction"] as const).map(t => (
                        <button
                          key={t}
                          type="button"
                          onClick={() => setAdjForm(f => ({ ...f, type: t }))}
                          className={`py-2 rounded-lg text-xs font-bold border transition-all ${
                            adjForm.type === t
                              ? t === "bonus"
                                ? "bg-emerald-500/20 border-emerald-500/50 text-emerald-400"
                                : "bg-rose-500/20 border-rose-500/50 text-rose-400"
                              : "border-border text-muted-foreground hover:text-foreground"
                          }`}
                        >
                          {t === "bonus" ? "✦ بونص" : "✕ خصم"}
                        </button>
                      ))}
                    </div>
                    {/* المبلغ */}
                    <div className="space-y-1">
                      <label className="text-[11px] text-muted-foreground font-medium">المبلغ (ج.م)</label>
                      <Input
                        type="number"
                        min="0"
                        placeholder="0"
                        value={adjForm.amount}
                        onChange={e => setAdjForm(f => ({ ...f, amount: e.target.value }))}
                        className="h-9 text-sm"
                      />
                    </div>
                    {/* السبب */}
                    <div className="space-y-1">
                      <label className="text-[11px] text-muted-foreground font-medium">السبب / الملاحظات</label>
                      <Input
                        placeholder="مثال: مكافأة أداء شهر يونيو"
                        value={adjForm.reason}
                        onChange={e => setAdjForm(f => ({ ...f, reason: e.target.value }))}
                        className="h-9 text-sm"
                      />
                    </div>
                    {/* زر الحفظ */}
                    <Button
                      size="sm"
                      className="w-full h-9 text-xs font-bold"
                      onClick={handleSaveAdj}
                      disabled={addAdjMutation.isPending}
                    >
                      {addAdjMutation.isPending
                        ? <><div className="w-3.5 h-3.5 rounded-full border-2 border-primary-foreground border-t-transparent animate-spin" />جاري الحفظ...</>
                        : <><Save className="w-3.5 h-3.5" />حفظ التسوية</>}
                    </Button>
                  </div>
                )}

                {/* قائمة التسويات الموجودة */}
                {adjLoading ? (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground py-1">
                    <div className="w-3 h-3 rounded-full border-2 border-muted-foreground border-t-transparent animate-spin" />
                    جاري التحميل...
                  </div>
                ) : adjustments.length > 0 ? (
                  <div className="space-y-2">
                    {adjustments.map(adj => (
                      <div key={adj.id} className={`rounded-lg border px-3 py-2 flex items-center justify-between gap-3 ${
                        adj.type === "bonus"
                          ? "border-emerald-500/25 bg-emerald-500/5"
                          : "border-rose-500/25 bg-rose-500/5"
                      }`}>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className={`text-xs font-black ${adj.type === "bonus" ? "text-emerald-400" : "text-rose-400"}`}>
                              {adj.type === "bonus" ? "+" : "-"}{fmt(adj.amount)}
                            </span>
                            <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
                              adj.type === "bonus"
                                ? "bg-emerald-500/15 text-emerald-400"
                                : "bg-rose-500/15 text-rose-400"
                            }`}>
                              {adj.type === "bonus" ? "بونص" : "خصم"}
                            </span>
                          </div>
                          <p className="text-[11px] text-muted-foreground truncate mt-0.5">{adj.reason}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => deleteAdjMutation.mutate(adj.id)}
                          disabled={deleteAdjMutation.isPending}
                          className="shrink-0 text-muted-foreground hover:text-rose-400 transition-colors p-1 rounded"
                        >
                          <XCircle className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                    {/* مجموع التسويات */}
                    <div className="flex justify-between text-xs font-bold pt-1 px-0.5">
                      <span className="text-muted-foreground">مجموع التسويات</span>
                      <span className={(() => {
                        const net = adjustments.reduce((s, a) => a.type === "bonus" ? s + a.amount : s - a.amount, 0);
                        return net >= 0 ? "text-emerald-400" : "text-rose-400";
                      })()}>
                        {(() => {
                          const net = adjustments.reduce((s, a) => a.type === "bonus" ? s + a.amount : s - a.amount, 0);
                          return (net >= 0 ? "+" : "") + fmt(net);
                        })()}
                      </span>
                    </div>
                  </div>
                ) : (
                  <p className="text-[11px] text-muted-foreground text-center py-1">لا توجد تسويات لهذا الشهر</p>
                )}
              </div>
            )}

            <div className="flex justify-between items-center pt-2 mt-1">
              <span className="font-black text-sm">صافي الراتب المستحق</span>
              <span className="font-black text-xl text-primary">{fmt(
                netSalary +
                adjustments.reduce((s, a) => a.type === "bonus" ? s + a.amount : s - a.amount, 0)
              )}</span>
            </div>
          </div>
        </div>
      )}

      {/* ── Overall Rating Banner ── */}
      {rating && overallScore != null && (
        <div className={`rounded-2xl border ${rm.border} ${rm.bg} p-4 flex items-center gap-4`}>
          <div className="shrink-0">
            <ScoreRing score={overallScore} size={64} />
            <div className="absolute" style={{ marginTop: -64, width: 64, height: 64, display: "flex", alignItems: "center", justifyContent: "center", position: "relative", top: -64 }}>
            </div>
          </div>
          <div className="flex-1">
            <p className="text-[10px] text-muted-foreground uppercase tracking-widest mb-0.5">التقييم العام لشهر {monthLabel}</p>
            <div className="flex items-center gap-2">
              <RatingIcon className={`w-5 h-5 ${rm.color} shrink-0`} />
              <span className={`text-2xl font-black ${rm.color}`}>{rating}</span>
            </div>
            {fin && (
              <p className="text-[11px] text-muted-foreground mt-1">
                {fin.achievedCount} من {kpis.length} مؤشرات محققة
              </p>
            )}
          </div>
        </div>
      )}

    </div>
  );
}

/* ── Tab: Settings ── */
function SettingsTab({ user, avatarB64, setAvatarB64, avatarMutation, handleSaveAvatar, pwMutation, handleChangePassword }: any) {
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const { toast } = useToast();

  const doChangePassword = () => {
    if (!currentPw) { toast({ title: "خطأ", description: "أدخل كلمة المرور الحالية", variant: "destructive" }); return; }
    if (newPw.length < 6) { toast({ title: "خطأ", description: "كلمة المرور الجديدة يجب أن تكون 6 أحرف على الأقل", variant: "destructive" }); return; }
    if (newPw !== confirmPw) { toast({ title: "خطأ", description: "كلمتا المرور غير متطابقتين", variant: "destructive" }); return; }
    handleChangePassword(currentPw, newPw, () => { setCurrentPw(""); setNewPw(""); setConfirmPw(""); });
  };

  return (
    <div className="space-y-4">
      <Card className="border">
        <CardContent className="p-6">
          <h3 className="font-bold text-sm mb-4 flex items-center gap-2"><Camera className="w-4 h-4 text-primary" />الصورة الشخصية</h3>
          <div className="flex flex-col sm:flex-row items-center gap-6">
            <AvatarUpload currentAvatar={(user as any).avatar} displayName={user.displayName} onUpload={(b64) => setAvatarB64(b64)} />
            <div className="flex-1 space-y-2 text-sm text-muted-foreground">
              <p className="font-semibold text-foreground">تعليمات رفع الصورة</p>
              <ul className="space-y-1 text-xs">
                <li className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-primary/60 shrink-0" />اضغط على الصورة أو اسحب ملف إليها</li>
                <li className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-primary/60 shrink-0" />الصيغ المقبولة: JPG, PNG, WebP</li>
                <li className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-primary/60 shrink-0" />ستظهر الصورة في قائمة المستخدمين</li>
              </ul>
              <Button size="sm" onClick={handleSaveAvatar} disabled={avatarB64 === undefined || avatarMutation.isPending} className="mt-2 gap-2">
                {avatarMutation.isPending ? <><div className="w-3.5 h-3.5 rounded-full border-2 border-primary-foreground border-t-transparent animate-spin" />جاري الحفظ...</> : <><Save className="w-3.5 h-3.5" />حفظ الصورة</>}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border">
        <CardContent className="p-6">
          <h3 className="font-bold text-sm mb-4 flex items-center gap-2"><KeyRound className="w-4 h-4 text-primary" />تغيير كلمة المرور</h3>
          <div className="space-y-3 max-w-sm">
            <div className="space-y-1.5">
              <Label className="text-xs">كلمة المرور الحالية</Label>
              <div className="relative">
                <Input type={showCurrent ? "text" : "password"} value={currentPw} onChange={e => setCurrentPw(e.target.value)} placeholder="••••••••" className="pr-4 pl-10" />
                <button type="button" className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" onClick={() => setShowCurrent(v => !v)}>
                  {showCurrent ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">كلمة المرور الجديدة</Label>
              <div className="relative">
                <Input type={showNew ? "text" : "password"} value={newPw} onChange={e => setNewPw(e.target.value)} placeholder="6 أحرف على الأقل" className="pr-4 pl-10" />
                <button type="button" className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" onClick={() => setShowNew(v => !v)}>
                  {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">تأكيد كلمة المرور</Label>
              <Input type="password" value={confirmPw} onChange={e => setConfirmPw(e.target.value)} placeholder="أعد كتابة كلمة المرور" className={confirmPw && confirmPw !== newPw ? "border-rose-500" : ""} />
              {confirmPw && confirmPw !== newPw && <p className="text-xs text-rose-400">كلمتا المرور غير متطابقتين</p>}
            </div>
            <Button onClick={doChangePassword} disabled={pwMutation.isPending || !currentPw || !newPw || !confirmPw} className="gap-2 w-full sm:w-auto">
              {pwMutation.isPending ? <><div className="w-3.5 h-3.5 rounded-full border-2 border-primary-foreground border-t-transparent animate-spin" />جاري التغيير...</> : <><KeyRound className="w-3.5 h-3.5" />تغيير كلمة المرور</>}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

/* ── Tab: Sales KPI Dashboard (أداء الفريق للموظف) ── */
function SalesKPIDashboardTab({ myStats, profile }: { myStats?: TeamMemberExtStats; profile?: EmployeeProfile }) {
  const currentMonth = format(new Date(), "yyyy-MM");
  const prevMonth = format(subMonths(new Date(), 1), "yyyy-MM");
  const prev2Month = format(subMonths(new Date(), 2), "yyyy-MM");

  const profileId = profile?.id;
  const userId    = profile?.userId ?? null;

  // ── جلب التقارير الشهرية الحقيقية للموظف ──
  // لو عندنا profileId نستخدم getReport (بيانات الموظف المحدد)
  // لو مفيش نرجع لـ getMyReport (بيانات الـ logged-in user)
  const { data: currReport } = useQuery({
    queryKey: ["sales-kpi-curr", profileId, currentMonth],
    queryFn: () => profileId
      ? employeeApi.getReport(profileId, currentMonth)
      : employeeApi.getMyReport(currentMonth),
    staleTime: 5 * 60_000,
  });
  const { data: prevReport } = useQuery({
    queryKey: ["sales-kpi-prev", profileId, prevMonth],
    queryFn: () => profileId
      ? employeeApi.getReport(profileId, prevMonth)
      : employeeApi.getMyReport(prevMonth),
    staleTime: 5 * 60_000,
  });
  const { data: prev2Report } = useQuery({
    queryKey: ["sales-kpi-prev2", profileId, prev2Month],
    queryFn: () => profileId
      ? employeeApi.getReport(profileId, prev2Month)
      : employeeApi.getMyReport(prev2Month),
    staleTime: 5 * 60_000,
  });

  // ── جلب الـ TeamMemberExtStats الحقيقية للموظف من أداء الفريق ──
  const currMonthStart = format(startOfMonth(new Date()), "yyyy-MM-dd");
  const currMonthEnd   = format(endOfMonth(new Date()), "yyyy-MM-dd");
  const { data: teamExtList } = useQuery({
    queryKey: ["team-ext-for-employee", userId, currentMonth],
    queryFn: () => teamAnalyticsApi.teamPerformanceExtended(currMonthStart, currMonthEnd),
    enabled: !!userId,
    staleTime: 5 * 60_000,
  });
  // استخرج stats الموظف المحدد
  const liveStats: TeamMemberExtStats | undefined = useMemo(() => {
    if (!teamExtList || !userId) return myStats;
    return teamExtList.find(m => m.userId === userId) ?? myStats;
  }, [teamExtList, userId, myStats]);

  const os = currReport?.orderStats;
  const kpis = currReport?.kpis ?? [];
  const fin = currReport?.kpiFinancials;
  const score = currReport?.overallScore ?? liveStats?.score ?? 0;

  // نحسب التقييم محلياً من النقاط عشان نتجنب مشكلة encoding القادم من الـ API
  const ratingLabel =
    score >= 80 ? "ممتاز" :
    score >= 65 ? "جيد جداً" :
    score >= 50 ? "جيد" :
    score >= 35 ? "مقبول" :
    score > 0   ? "ضعيف" : null;

  // ── 1. التقدم نحو الأهداف ──
  const goals = useMemo(() => {
    const deliveryRate = os?.deliveryRate ?? liveStats?.deliveryRate ?? 0;
    const returnRate   = os?.returnRate   ?? liveStats?.returnRate   ?? 0;
    const total        = os?.total        ?? liveStats?.total        ?? 0;
    const daily        = liveStats?.ordersPerDay ?? (total / 26);
    return [
      { label: "معدل التسليم",   value: deliveryRate,       target: 80,   unit: "%",       icon: CheckCircle2, color: "emerald" },
      { label: "تخفيض الإرجاع", value: Math.max(0,20-returnRate), target: 20, unit: "%",  icon: XCircle,      color: "rose",    invert: true, rawValue: returnRate, rawTarget: 20 },
      { label: "طلبات يومياً",   value: daily,              target: 10,   unit: "طلب",    icon: Package,      color: "blue" },
      { label: "نقاط الأداء",    value: score,              target: 80,   unit: "نقطة",   icon: Trophy,       color: "amber" },
    ];
  }, [os, liveStats, score]);

  const achievedGoals = goals.filter(g => {
    if (g.invert) return (g.rawValue ?? 0) < (g.rawTarget ?? 20);
    return g.value >= g.target;
  }).length;

  // ── 2. تقييم الأداء الربعي ──
  const quarterData = useMemo(() => [
    { label: format(new Date(prev2Month + "-01"), "MMM", { locale: ar }), score: prev2Report?.overallScore ?? 0, delivered: prev2Report?.orderStats?.delivered ?? 0 },
    { label: format(new Date(prevMonth + "-01"), "MMM",  { locale: ar }), score: prevReport?.overallScore  ?? 0, delivered: prevReport?.orderStats?.delivered  ?? 0 },
    { label: format(new Date(currentMonth + "-01"), "MMM", { locale: ar }), score: currReport?.overallScore ?? 0, delivered: os?.delivered ?? 0 },
  ], [prev2Report, prevReport, currReport, os, prev2Month, prevMonth, currentMonth]);

  const quarterTrend = quarterData[2].score - quarterData[0].score;

  // ── 2b. بيانات الـ Line Chart و Radar Chart للربع ──
  const quarterLineData = useMemo(() => {
    const ref = 70; // reference line
    return quarterData.map(q => ({ ...q, ref }));
  }, [quarterData]);

  const radarData = useMemo(() => {
    const deliveryRate = os?.deliveryRate ?? liveStats?.deliveryRate ?? 0;
    const returnRate   = os?.returnRate   ?? liveStats?.returnRate   ?? 0;
    const procHours    = liveStats?.avgProcessingHours ?? 0;
    const daily        = liveStats?.ordersPerDay ?? 0;
    const scoreVal     = score;
    // normalize كل قيمة على 100
    return [
      { label: "معدل ت...", value: Math.min(100, deliveryRate), full: 100 },
      { label: "سرعة ا...", value: Math.min(100, Math.max(0, (48 - procHours) / 48 * 100)), full: 100 },
      { label: "معدل الا...", value: Math.min(100, Math.max(0, (20 - returnRate) / 20 * 100)), full: 100 },
      { label: "معدل ا...", value: Math.min(100, (daily / 15) * 100), full: 100 },
      { label: "معدل تح...", value: Math.min(100, scoreVal), full: 100 },
    ];
  }, [os, liveStats, score]);

  // ── 3. مؤشرات الأداء التشغيلي ──
  const operationalKpis = useMemo(() => [
    {
      label: "معدل التسليم",
      value: os?.deliveryRate ?? liveStats?.deliveryRate ?? 0,
      target: 80, unit: "%", icon: CheckCircle2,
      color: (os?.deliveryRate ?? 0) >= 80 ? "emerald" : "amber",
      description: "نسبة الطلبات المكتملة",
    },
    {
      label: "معدل الإرجاع",
      value: os?.returnRate ?? liveStats?.returnRate ?? 0,
      target: 20, unit: "%", icon: XCircle,
      color: (os?.returnRate ?? 0) < 20 ? "emerald" : "rose",
      description: "نسبة الطلبات المرتجعة",
      lowerIsBetter: true,
    },
    {
      label: "سرعة المعالجة",
      value: liveStats?.avgProcessingHours ?? 0,
      target: 24, unit: "ساعة", icon: Clock,
      color: (liveStats?.avgProcessingHours ?? 99) <= 24 ? "emerald" : "amber",
      description: "متوسط وقت الإنجاز",
      lowerIsBetter: true,
    },
    {
      label: "طلبات/يوم",
      value: liveStats?.ordersPerDay ?? 0,
      target: 10, unit: "طلب", icon: Gauge,
      color: (liveStats?.ordersPerDay ?? 0) >= 10 ? "emerald" : "blue",
      description: "متوسط الإنتاجية اليومية",
    },
  ], [os, liveStats]);

  // ── 4. الملخص المالي ──
  const baseSalary = currReport?.salary ?? 0;
  const bonuses    = fin?.totalBonus ?? 0;
  const deductions = fin?.totalDeduction ?? 0;
  const netSalary  = baseSalary + bonuses - deductions;
  const revenue    = os?.totalRevenue ?? 0;

  // ── 5. مصفوفة مخاطر المؤشرات ──
  const riskMatrix = useMemo(() => {
    const items: { label: string; risk: "high" | "medium" | "low"; trend: "up" | "down" | "stable"; value: string; note: string }[] = [];
    const returnRate = os?.returnRate ?? liveStats?.returnRate ?? 0;
    const deliveryRate = os?.deliveryRate ?? liveStats?.deliveryRate ?? 0;
    const procHours = liveStats?.avgProcessingHours ?? null;
    const scoreVal = score;

    if (returnRate >= 25) items.push({ label: "معدل الإرجاع", risk: "high", trend: "down", value: `${returnRate.toFixed(1)}%`, note: "يتجاوز الحد المقبول 20%" });
    else if (returnRate >= 15) items.push({ label: "معدل الإرجاع", risk: "medium", trend: "stable", value: `${returnRate.toFixed(1)}%`, note: "قريب من الحد التحذيري" });
    else items.push({ label: "معدل الإرجاع", risk: "low", trend: "up", value: `${returnRate.toFixed(1)}%`, note: "ضمن النطاق الطبيعي" });

    if (deliveryRate < 60) items.push({ label: "معدل التسليم", risk: "high", trend: "down", value: `${deliveryRate.toFixed(1)}%`, note: "أقل من الحد الأدنى المطلوب" });
    else if (deliveryRate < 80) items.push({ label: "معدل التسليم", risk: "medium", trend: "stable", value: `${deliveryRate.toFixed(1)}%`, note: "يحتاج تحسين للوصول للهدف" });
    else items.push({ label: "معدل التسليم", risk: "low", trend: "up", value: `${deliveryRate.toFixed(1)}%`, note: "يحقق الهدف المطلوب" });

    if (procHours !== null) {
      if (procHours > 48) items.push({ label: "سرعة التسليم", risk: "high", trend: "down", value: `${procHours.toFixed(0)}س`, note: "بطيء جداً في المعالجة" });
      else if (procHours > 24) items.push({ label: "سرعة التسليم", risk: "medium", trend: "stable", value: `${procHours.toFixed(0)}س`, note: "أبطأ من المستهدف" });
      else items.push({ label: "سرعة التسليم", risk: "low", trend: "up", value: `${procHours.toFixed(0)}س`, note: "سريع ومنتج" });
    }

    if (scoreVal < 40) items.push({ label: "نقاط الأداء الكلية", risk: "high", trend: "down", value: `${scoreVal}`, note: "يحتاج تدخل عاجل" });
    else if (scoreVal < 60) items.push({ label: "نقاط الأداء الكلية", risk: "medium", trend: "stable", value: `${scoreVal}`, note: "مجال واسع للتحسين" });
    else items.push({ label: "نقاط الأداء الكلية", risk: "low", trend: "up", value: `${scoreVal}`, note: "أداء جيد" });

    return items.sort((a, b) => {
      const order = { high: 0, medium: 1, low: 2 };
      return order[a.risk] - order[b.risk];
    });
  }, [os, liveStats, score]);

  // ── 6. جدار الإنجازات الشهرية ──
  const achievements = useMemo(() => {
    const deliveryRate = os?.deliveryRate ?? liveStats?.deliveryRate ?? 0;
    const returnRate   = os?.returnRate   ?? liveStats?.returnRate   ?? 0;
    const total        = os?.total        ?? 0;
    const daily        = liveStats?.ordersPerDay ?? 0;
    const procHours    = liveStats?.avgProcessingHours ?? null;
    const scoreVal     = score;

    return [
      {
        id: "top_delivery",
        label: "معدل تسليم ممتاز",
        icon: Trophy,
        color: "amber",
        unlocked: deliveryRate >= 85,
        desc: "حقق ≥ 85% معدل تسليم",
        progress: Math.min(100, (deliveryRate / 85) * 100),
      },
      {
        id: "zero_return",
        label: "مرتجعات منخفضة",
        icon: ShieldAlert,
        color: "emerald",
        unlocked: returnRate < 10,
        desc: "معدل إرجاع أقل من 10%",
        progress: Math.min(100, Math.max(0, (20 - returnRate) / 20) * 100),
      },
      {
        id: "high_score",
        label: "نجم الأداء",
        icon: Star,
        color: "yellow",
        unlocked: scoreVal >= 80,
        desc: "نقاط أداء ≥ 80",
        progress: Math.min(100, (scoreVal / 80) * 100),
      },
      {
        id: "productive",
        label: "منتج يومياً",
        icon: Zap,
        color: "blue",
        unlocked: daily >= 10,
        desc: "متوسط 10 طلبات يومياً",
        progress: Math.min(100, (daily / 10) * 100),
      },
      {
        id: "fast_delivery",
        label: "سريع الإنجاز",
        icon: Clock,
        color: "violet",
        unlocked: procHours !== null && procHours <= 12,
        desc: "وقت تسليم ≤ 12 ساعة",
        progress: procHours !== null ? Math.min(100, Math.max(0, (24 - procHours) / 24) * 100) : 0,
      },
      {
        id: "volume_hero",
        label: "بطل الحجم",
        icon: Package,
        color: "rose",
        unlocked: total >= 100,
        desc: "100 طلب في الشهر",
        progress: Math.min(100, (total / 100) * 100),
      },
    ];
  }, [os, liveStats, score]);

  const unlockedCount = achievements.filter(a => a.unlocked).length;

  const colorMap: Record<string, { text: string; bg: string; border: string; bar: string }> = {
    emerald: { text: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/30", bar: "bg-emerald-500" },
    amber:   { text: "text-amber-400",   bg: "bg-amber-500/10",   border: "border-amber-500/30",   bar: "bg-amber-500"   },
    yellow:  { text: "text-yellow-400",  bg: "bg-yellow-500/10",  border: "border-yellow-500/30",  bar: "bg-yellow-500"  },
    blue:    { text: "text-blue-400",    bg: "bg-blue-500/10",    border: "border-blue-500/30",    bar: "bg-blue-500"    },
    violet:  { text: "text-violet-400",  bg: "bg-violet-500/10",  border: "border-violet-500/30",  bar: "bg-violet-500"  },
    rose:    { text: "text-rose-400",    bg: "bg-rose-500/10",    border: "border-rose-500/30",    bar: "bg-rose-500"    },
  };
  const riskColorMap: Record<string, { text: string; bg: string; border: string; dot: string; label: string }> = {
    high:   { text: "text-rose-400",    bg: "bg-rose-500/10",    border: "border-rose-500/30",   dot: "bg-rose-500",    label: "خطر عالٍ"   },
    medium: { text: "text-amber-400",   bg: "bg-amber-500/10",   border: "border-amber-500/30",  dot: "bg-amber-500",   label: "خطر متوسط" },
    low:    { text: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/30",dot: "bg-emerald-500", label: "منخفض"       },
  };

  return (
    <div className="space-y-5" dir="rtl">

      {/* ══ 1. التقدم نحو الأهداف ══ */}
      <div className="rounded-2xl border border-border bg-card overflow-hidden">
        <div className="px-4 py-3 border-b border-border/50 flex items-center justify-between"
          style={{ background: "linear-gradient(to left, hsl(var(--primary)/0.08), transparent)" }}>
          <div className="flex items-center gap-2">
            <Target className="w-4 h-4 text-primary" />
            <span className="font-black text-sm">التقدم نحو الأهداف</span>
          </div>
          <span className="text-xs font-bold text-muted-foreground">{achievedGoals}/{goals.length} محقق</span>
        </div>
        <div className="p-4 space-y-4">
          {/* Donut summary */}
          <div className="flex items-center gap-4">
            <div className="relative shrink-0" style={{ width: 80, height: 80 }}>
              <svg width={80} height={80} style={{ transform: "rotate(-90deg)" }}>
                <circle cx={40} cy={40} r={32} fill="none" stroke="hsl(var(--muted)/0.3)" strokeWidth={10} />
                <circle cx={40} cy={40} r={32} fill="none"
                  stroke={achievedGoals === goals.length ? "#10b981" : achievedGoals >= goals.length / 2 ? "#3b82f6" : "#f59e0b"}
                  strokeWidth={10}
                  strokeDasharray={`${(achievedGoals / goals.length) * 2 * Math.PI * 32} ${2 * Math.PI * 32}`}
                  strokeLinecap="round"
                  style={{ transition: "stroke-dasharray 1s ease" }}
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-lg font-black leading-none">{achievedGoals}</span>
                <span className="text-[9px] text-muted-foreground">/{goals.length}</span>
              </div>
            </div>
            <div className="flex-1 space-y-1">
              <p className="text-sm font-bold">{achievedGoals === goals.length ? "🎉 كل الأهداف محققة!" : `${goals.length - achievedGoals} أهداف متبقية`}</p>
              <p className="text-xs text-muted-foreground">شهر {format(new Date(currentMonth + "-01"), "MMMM yyyy", { locale: ar })}</p>
              {ratingLabel && <p className="text-xs font-bold" style={{ color: score >= 80 ? "#10b981" : score >= 60 ? "#3b82f6" : "#f59e0b" }}>التقييم: {ratingLabel}</p>}
            </div>
          </div>
          {/* Goals list */}
          <div className="space-y-3">
            {goals.map((g, i) => {
              const isAchieved = g.invert ? (g.rawValue ?? 0) < (g.rawTarget ?? 20) : g.value >= g.target;
              const progressPct = g.invert
                ? Math.min(100, Math.max(0, ((g.rawTarget ?? 20) - (g.rawValue ?? 0)) / (g.rawTarget ?? 20) * 100))
                : Math.min(100, (g.value / g.target) * 100);
              const c = colorMap[g.color] ?? colorMap.blue;
              return (
                <div key={i} className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <g.icon className={`w-3.5 h-3.5 ${c.text}`} />
                      <span className="text-xs font-bold">{g.label}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-black ${c.text}`}>
                        {g.invert ? `${(g.rawValue ?? 0).toFixed(1)}${g.unit}` : `${typeof g.value === 'number' && g.value % 1 !== 0 ? g.value.toFixed(1) : g.value} ${g.unit}`}
                      </span>
                      {isAchieved
                        ? <BadgeCheck className="w-3.5 h-3.5 text-emerald-400" />
                        : <span className="text-[10px] text-muted-foreground">الهدف: {g.target}{g.unit}</span>}
                    </div>
                  </div>
                  <div className="h-2 bg-muted/30 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full transition-all duration-700 ${isAchieved ? "bg-emerald-500" : c.bar}`}
                      style={{ width: `${progressPct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ══ 2. تقييم الأداء الربعي ══ */}
      <div className="rounded-2xl border border-border bg-card overflow-hidden">
        <div className="px-4 py-3 border-b border-border/50 flex items-center justify-between"
          style={{ background: "linear-gradient(to left, hsl(var(--primary)/0.08), transparent)" }}>
          <div>
            <div className="flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-blue-400" />
              <span className="font-black text-sm">تقييم الأداء الربعي</span>
            </div>
            <p className="text-[10px] text-muted-foreground mt-0.5">مقارنة الأداء الحالي مع المرجع العام</p>
          </div>
          <div className="flex flex-col items-end gap-1">
            {/* Star rating */}
            <div className="flex items-center gap-0.5">
              {[1,2,3,4,5].map(s => (
                <Star key={s} className="w-3.5 h-3.5" fill={s <= Math.round(score / 20) ? "#f59e0b" : "none"} stroke={s <= Math.round(score / 20) ? "#f59e0b" : "#6b7280"} />
              ))}
            </div>
            {ratingLabel && <span className="text-[10px] text-muted-foreground">{ratingLabel}</span>}
          </div>
        </div>
        <div className="p-4 space-y-4">
          {/* Legend */}
          <div className="flex items-center gap-4 justify-end text-[10px]">
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-0.5 rounded" style={{ background: "#f59e0b" }} />
              <span className="text-muted-foreground">الأداء الحالي</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-0.5 rounded border-t-2 border-dashed" style={{ borderColor: "#10b981" }} />
              <span className="text-muted-foreground">المرجع</span>
            </div>
          </div>
          {/* Line Chart */}
          <div style={{ background: "hsl(var(--card))", borderRadius: 12, padding: "8px 4px" }}>
            <ResponsiveContainer width="100%" height={140}>
              <LineChart data={quarterLineData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <XAxis dataKey="label" tick={{ fill: "#9ca3af", fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis domain={[0, 100]} tick={{ fill: "#9ca3af", fontSize: 10 }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{ background: "#1f2937", border: "1px solid #374151", borderRadius: 8, fontSize: 11 }}
                  labelStyle={{ color: "#f9fafb", fontWeight: "bold" }}
                  formatter={(val: number, name: string) => [
                    val,
                    name === "score" ? "الأداء الحالي" : "المرجع"
                  ]}
                />
                <ReferenceLine y={70} stroke="#10b981" strokeDasharray="5 3" strokeWidth={1.5} />
                <Line
                  type="monotone"
                  dataKey="score"
                  stroke="#f59e0b"
                  strokeWidth={2.5}
                  dot={{ fill: "#f59e0b", r: 4, strokeWidth: 0 }}
                  activeDot={{ r: 6, fill: "#f59e0b" }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Radar Chart */}
          <div>
            <p className="text-[10px] text-muted-foreground mb-2 text-center">تطور الكفاءات الأساسية</p>
            <div style={{ background: "hsl(var(--card))", borderRadius: 12, padding: "4px" }}>
              <ResponsiveContainer width="100%" height={180}>
                <RadarChart cx="50%" cy="50%" outerRadius={65} data={radarData}>
                  <PolarGrid stroke="#374151" strokeWidth={0.8} />
                  <PolarAngleAxis dataKey="label" tick={{ fill: "#9ca3af", fontSize: 9 }} />
                  <Radar
                    name="الأداء"
                    dataKey="value"
                    stroke="#f59e0b"
                    fill="#f59e0b"
                    fillOpacity={0.25}
                    strokeWidth={1.5}
                    dot={{ fill: "#f59e0b", r: 3, strokeWidth: 0 }}
                  />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Trend badge */}
          <div className="flex items-center justify-between rounded-xl px-3 py-2 border border-border bg-muted/20">
            <span className="text-xs text-muted-foreground">التغيير خلال الربع</span>
            <span className={`text-xs font-black flex items-center gap-1 ${quarterTrend > 0 ? "text-emerald-400" : quarterTrend < 0 ? "text-rose-400" : "text-muted-foreground"}`}>
              {quarterTrend > 0 ? <ArrowUp className="w-3 h-3" /> : quarterTrend < 0 ? <ArrowDown className="w-3 h-3" /> : null}
              {quarterTrend > 0 ? `+${quarterTrend}` : quarterTrend} نقطة
            </span>
          </div>
        </div>
      </div>

      {/* ══ 3. مؤشرات الأداء التشغيلي ══ */}
      <div className="rounded-2xl border border-border bg-card overflow-hidden">
        <div className="px-4 py-3 border-b border-border/50"
          style={{ background: "linear-gradient(to left, hsl(var(--primary)/0.08), transparent)" }}>
          <div className="flex items-center gap-2">
            <Gauge className="w-4 h-4 text-violet-400" />
            <span className="font-black text-sm">مؤشرات الأداء التشغيلي</span>
          </div>
        </div>
        <div className="p-4 space-y-3">
          {operationalKpis.map((kpi, i) => {
            const c = colorMap[kpi.color] ?? colorMap.blue;
            const progressPct = kpi.lowerIsBetter
              ? Math.min(100, Math.max(0, ((kpi.target * 2) - kpi.value) / (kpi.target * 2) * 100))
              : Math.min(100, (kpi.value / kpi.target) * 100);
            const isOk = kpi.lowerIsBetter ? kpi.value <= kpi.target : kpi.value >= kpi.target;
            return (
              <div key={i} className={`rounded-xl p-3.5 border ${c.bg} ${c.border}`}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <kpi.icon className={`w-4 h-4 ${c.text}`} />
                    <span className="text-sm font-bold">{kpi.label}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-base font-black ${c.text}`}>
                      {typeof kpi.value === 'number' && kpi.value % 1 !== 0 ? kpi.value.toFixed(1) : kpi.value}{kpi.unit}
                    </span>
                    {isOk ? <BadgeCheck className="w-4 h-4 text-emerald-400" /> : <AlertCircle className="w-4 h-4 text-amber-400" />}
                  </div>
                </div>
                <div className="h-2.5 bg-black/20 rounded-full overflow-hidden mb-1.5">
                  <div className={`h-full rounded-full transition-all duration-700 ${isOk ? "bg-emerald-500" : c.bar}`}
                    style={{ width: `${progressPct}%` }} />
                </div>
                <div className="flex justify-between text-[10px] text-muted-foreground/70">
                  <span>{kpi.description}</span>
                  <span>{kpi.lowerIsBetter ? "الحد: " : "الهدف: "}{kpi.target}{kpi.unit}</span>
                </div>
              </div>
            );
          })}
          {/* KPIs المخصصة من التقرير */}
          {kpis.length > 0 && (
            <div className="pt-2 border-t border-border/40 space-y-2">
              <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">KPIs مخصصة</p>
              {kpis.map(k => {
                const actual = k.actualValue ?? 0;
                const progress = k.targetValue > 0 ? Math.min(100, (actual / k.targetValue) * 100) : 0;
                const c = k.achieved ? colorMap.emerald : colorMap.amber;
                return (
                  <div key={k.id} className={`rounded-xl p-3 border ${c.bg} ${c.border}`}>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs font-bold">{k.name}</span>
                      <span className={`text-sm font-black ${c.text}`}>{fmtNum(actual)}/{fmtNum(k.targetValue)} {k.unit}</span>
                    </div>
                    <div className="h-2 bg-black/20 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full ${k.achieved ? "bg-emerald-500" : "bg-amber-500"} transition-all duration-700`} style={{ width: `${progress}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ══ 4. الملخص المالي للمؤشرات ══ */}
      <div className="rounded-2xl border border-border bg-card overflow-hidden">
        <div className="px-4 py-3 border-b border-border/50"
          style={{ background: "linear-gradient(to left, hsl(var(--primary)/0.08), transparent)" }}>
          <div className="flex items-center gap-2">
            <Wallet className="w-4 h-4 text-emerald-400" />
            <span className="font-black text-sm">الملخص المالي للمؤشرات</span>
          </div>
        </div>
        <div className="p-4 space-y-3">
          {/* Mini cards */}
          <div className="grid grid-cols-2 gap-2.5">
            <div className="rounded-xl p-3.5 border border-blue-500/20 bg-blue-500/5">
              <p className="text-[10px] text-muted-foreground mb-1">إجمالي الإيرادات</p>
              <p className="text-lg font-black text-blue-400">{fmt(revenue)}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">{fmtNum(os?.delivered ?? 0)} طلب مسلّم</p>
            </div>
            <div className="rounded-xl p-3.5 border border-emerald-500/20 bg-emerald-500/5">
              <p className="text-[10px] text-muted-foreground mb-1">الراتب الأساسي</p>
              <p className="text-lg font-black text-emerald-400">{fmt(baseSalary)}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">شهر {format(new Date(currentMonth + "-01"), "MMMM", { locale: ar })}</p>
            </div>
          </div>
          {/* KPI bonuses/deductions */}
          {(bonuses > 0 || deductions > 0) && (
            <div className="space-y-2">
              {bonuses > 0 && (
                <div className="flex items-center justify-between rounded-xl p-3 border border-emerald-500/20 bg-emerald-500/5">
                  <span className="text-sm text-emerald-400 flex items-center gap-1.5"><ArrowUp className="w-3.5 h-3.5" />مكافآت KPIs</span>
                  <span className="font-black text-emerald-400">+ {fmt(bonuses)}</span>
                </div>
              )}
              {deductions > 0 && (
                <div className="flex items-center justify-between rounded-xl p-3 border border-rose-500/20 bg-rose-500/5">
                  <span className="text-sm text-rose-400 flex items-center gap-1.5"><ArrowDown className="w-3.5 h-3.5" />خصومات KPIs</span>
                  <span className="font-black text-rose-400">- {fmt(deductions)}</span>
                </div>
              )}
            </div>
          )}
          {/* Net salary */}
          {baseSalary > 0 && (
            <div className="rounded-xl p-4 border border-primary/30 bg-primary/5 flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">صافي الراتب المستحق</p>
                {fin && <p className="text-[10px] text-muted-foreground">{fin.achievedCount}/{kpis.length} KPIs محققة</p>}
              </div>
              <p className="text-2xl font-black text-primary">{fmt(netSalary)}</p>
            </div>
          )}
          {/* KPI financial breakdown */}
          {kpis.length > 0 && (
            <div className="space-y-1.5 pt-1 border-t border-border/40">
              <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">تفاصيل KPIs</p>
              {kpis.map(k => (
                <div key={k.id} className="flex items-center justify-between py-1.5 border-b border-border/20 last:border-0">
                  <div className="flex items-center gap-2">
                    {k.achieved ? <BadgeCheck className="w-3.5 h-3.5 text-emerald-400" /> : <XCircle className="w-3.5 h-3.5 text-rose-400" />}
                    <span className="text-xs">{k.name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-muted-foreground">{fmtNum(k.actualValue ?? 0)}/{fmtNum(k.targetValue)} {k.unit}</span>
                    {k.score != null && (
                      <span className={`text-xs font-bold ${k.score >= 80 ? "text-emerald-400" : k.score >= 60 ? "text-blue-400" : "text-rose-400"}`}>
                        {k.score.toFixed(0)}%
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
          {baseSalary === 0 && (
            <div className="text-center py-6 text-muted-foreground">
              <Wallet className="w-8 h-8 mx-auto mb-2 opacity-20" />
              <p className="text-sm">لا توجد بيانات مالية لهذا الشهر</p>
            </div>
          )}
        </div>
      </div>

      {/* ══ 5. مصفوفة مخاطر المؤشرات ══ */}
      <div className="rounded-2xl border border-border bg-card overflow-hidden">
        <div className="px-4 py-3 border-b border-border/50"
          style={{ background: "linear-gradient(to left, hsl(var(--primary)/0.08), transparent)" }}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-rose-400" />
              <span className="font-black text-sm">مصفوفة مخاطر المؤشرات</span>
            </div>
            <div className="flex items-center gap-2 text-[10px]">
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-rose-500" />عالٍ</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-500" />متوسط</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500" />منخفض</span>
            </div>
          </div>
        </div>
        <div className="p-4 space-y-2.5">
          {riskMatrix.map((item, i) => {
            const rc = riskColorMap[item.risk];
            return (
              <div key={i} className={`rounded-xl p-3.5 border ${rc.bg} ${rc.border} flex items-center gap-3`}>
                <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${rc.dot}`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <span className="text-sm font-bold">{item.label}</span>
                    <span className={`text-sm font-black ${rc.text}`}>{item.value}</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-0.5">{item.note}</p>
                </div>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${rc.bg} ${rc.border} ${rc.text} shrink-0`}>{rc.label}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* ══ 6. جدار الإنجازات الشهرية ══ */}
      <div className="rounded-2xl border border-border bg-card overflow-hidden">
        <div className="px-4 py-3 border-b border-border/50 flex items-center justify-between"
          style={{ background: "linear-gradient(to left, hsl(var(--primary)/0.08), transparent)" }}>
          <div className="flex items-center gap-2">
            <Award className="w-4 h-4 text-yellow-400" />
            <span className="font-black text-sm">جدار الإنجازات الشهرية</span>
          </div>
          <span className="text-xs font-bold text-muted-foreground">{unlockedCount}/{achievements.length} مفتوحة</span>
        </div>
        <div className="p-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {achievements.map((a, i) => {
              const c = colorMap[a.color] ?? colorMap.blue;
              return (
                <div key={i}
                  className={`rounded-2xl p-4 border flex flex-col items-center gap-2 text-center transition-all duration-300 ${
                    a.unlocked
                      ? `${c.bg} ${c.border} shadow-sm`
                      : "border-border/30 bg-muted/10 opacity-50 grayscale"
                  }`}>
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center ${a.unlocked ? c.bg : "bg-muted/30"}`}
                    style={a.unlocked ? { boxShadow: `0 0 16px ${a.color === "emerald" ? "rgba(16,185,129,0.3)" : a.color === "amber" ? "rgba(245,158,11,0.3)" : "rgba(59,130,246,0.3)"}` } : {}}>
                    <a.icon className={`w-6 h-6 ${a.unlocked ? c.text : "text-muted-foreground"}`} />
                  </div>
                  <div>
                    <p className="text-xs font-bold leading-tight">{a.label}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">{a.desc}</p>
                  </div>
                  {/* progress mini bar */}
                  <div className="w-full h-1.5 bg-black/10 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full transition-all duration-700 ${a.unlocked ? c.bar : "bg-muted-foreground/30"}`}
                      style={{ width: `${a.progress}%` }} />
                  </div>
                  {a.unlocked && (
                    <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${c.bg} ${c.text} border ${c.border}`}>
                      ✓ مفتوحة
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── متتبع سرعة الإنجاز ── */}
      {(() => {
        const activeKpis = kpis.filter((k: any) => k.isActive !== false);
        const evaluatedById = new Map(kpis.map((k: any) => [k.id, k]));
        if (!activeKpis.some((k: any) => evaluatedById.get(k.id)?.score !== null && evaluatedById.get(k.id)?.score !== undefined)) return null;

        const now = new Date();
        const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
        const dayPassed = now.getDate();
        const monthPct = Math.round((dayPassed / daysInMonth) * 100);

        return (
          <Card className="border-border bg-card">
            <CardContent className="px-4 py-4">
              <div className="flex items-center justify-between gap-2 mb-1">
                <div className="flex items-center gap-2">
                  <BarChart2 className="w-4 h-4 text-primary shrink-0" />
                  <p className="text-xs font-bold">متتبع سرعة الإنجاز</p>
                </div>
                <span className="text-[9px] text-muted-foreground/60 bg-muted/30 rounded-full px-2 py-0.5">
                  مرّ {dayPassed} يوم من {daysInMonth} ({monthPct}% من الشهر)
                </span>
              </div>
              <p className="text-[10px] text-muted-foreground mb-3.5">هل ستصل للهدف قبل نهاية الشهر بناءً على معدلك الحالي؟</p>
              <div className="space-y-3">
                {activeKpis.map((kpi: any) => {
                  const ev = evaluatedById.get(kpi.id);
                  const sc = ev?.score ?? null;
                  if (sc === null || sc === undefined) return null;

                  const projectedScore = monthPct > 0 ? Math.round((sc / monthPct) * 100) : sc;
                  const velocity = sc - monthPct;
                  const willReach = projectedScore >= 100;
                  const isOT = sc > 100;

                  return (
                    <div key={kpi.id} className="rounded-xl border border-border/50 bg-muted/5 px-3 py-2.5">
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <span className="text-[10px] font-bold truncate max-w-[55%]">{kpi.name}</span>
                        <div className="flex items-center gap-1.5 shrink-0">
                          {isOT ? (
                            <span className="text-[9px] font-black text-blue-500 bg-blue-500/10 rounded-full px-2 py-0.5">🏆 Over Target</span>
                          ) : willReach ? (
                            <span className="text-[9px] font-black text-emerald-500 bg-emerald-500/10 rounded-full px-2 py-0.5">✅ سيصل للهدف</span>
                          ) : (
                            <span className="text-[9px] font-black text-red-500 bg-red-500/10 rounded-full px-2 py-0.5">⚡ يحتاج تسريع</span>
                          )}
                        </div>
                      </div>
                      <div className="relative w-full h-3 rounded-full bg-muted/40 overflow-visible mb-1.5">
                        <div className="absolute top-0 h-3 rounded-full bg-muted/60 transition-all"
                          style={{ width: `${Math.min(monthPct, 100)}%` }} />
                        <div className={`absolute top-0 h-3 rounded-full transition-all duration-700 ${isOT ? "bg-blue-500" : willReach ? "bg-emerald-500" : "bg-red-500"}`}
                          style={{ width: `${Math.min(sc, 100)}%` }} />
                        <div className="absolute top-[-3px] w-0.5 h-[18px] bg-foreground/40 rounded-full"
                          style={{ left: `${Math.min(monthPct, 100)}%` }} />
                      </div>
                      <div className="flex items-center justify-between text-[9px] text-muted-foreground">
                        <span>فعلي: <strong className="text-foreground">{sc}%</strong></span>
                        <span>توقع الشهر: <strong className={willReach || isOT ? "text-emerald-500" : "text-amber-500"}>{Math.min(projectedScore, 150)}%</strong></span>
                        <span className={`font-bold ${velocity >= 0 ? "text-emerald-500" : "text-red-500"}`}>
                          {velocity >= 0 ? "+" : ""}{velocity}% عن المتوقع
                        </span>
                      </div>
                    </div>
                  );
                }).filter(Boolean)}
              </div>
            </CardContent>
          </Card>
        );
      })()}

    </div>
  );
}

/* ── Main Profile Page ── */
/* ── Tab: Attendance ── */
const STATUS_META: Record<string, { label: string; color: string; bg: string; border: string; dot: string }> = {
  present:  { label: "حاضر",     color: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/30", dot: "bg-emerald-500" },
  late:     { label: "متأخر",    color: "text-amber-400",   bg: "bg-amber-500/10",   border: "border-amber-500/30",   dot: "bg-amber-500" },
  absent:   { label: "غائب",     color: "text-rose-400",    bg: "bg-rose-500/10",    border: "border-rose-500/30",    dot: "bg-rose-500" },
  half_day: { label: "نصف يوم",  color: "text-blue-400",    bg: "bg-blue-500/10",    border: "border-blue-500/30",    dot: "bg-blue-500" },
  holiday:  { label: "إجازة",    color: "text-violet-400",  bg: "bg-violet-500/10",  border: "border-violet-500/30",  dot: "bg-violet-500" },
  excused:  { label: "مبرر",     color: "text-sky-400",     bg: "bg-sky-500/10",     border: "border-sky-500/30",     dot: "bg-sky-500" },
};

function AttendanceTab() {
  const [selectedMonth, setSelectedMonth] = useState(format(new Date(), "yyyy-MM"));

  const monthOptions = useMemo(() => Array.from({ length: 12 }, (_, i) => {
    const d = subMonths(new Date(), i);
    return { value: format(d, "yyyy-MM"), label: format(d, "MMMM yyyy", { locale: ar }) };
  }), []);

  const { data: report, isLoading } = useQuery({
    queryKey: ["my-attendance-report", selectedMonth],
    queryFn: () => employeeApi.getMySalaryReport(selectedMonth),
  });

  if (isLoading) return <LoadingSpinner text="جاري تحميل سجل الحضور..." />;

  // noProfile or no data at all
  if (!report || report.noProfile) return (
    <EmptyState icon={CalendarCheck2} title="لا يوجد بروفايل موظف" sub="تواصل مع المدير لإنشاء بروفايل وتسجيل الحضور" />
  );

  const {
    attendance, workedDays, absentDays, lateDays, halfDays,
    holidayDays = 0, excusedDays = 0,
    totalWorkingDays, workDays, totalRecordedDays,
    baseSalary, attendanceDeduction, bonuses, extraDeductions, netSalary, adjustments,
  } = report;

  // حساب نسبة الحضور على أيام العمل المسجلة فعلاً (مش كل أيام الشهر)
  const effectiveWorkDays = (workDays ?? totalRecordedDays ?? 0) || (workedDays + absentDays + lateDays + halfDays);
  const attendanceRate = effectiveWorkDays > 0 ? Math.round((workedDays / effectiveWorkDays) * 100) : 0;
  const totalDeductionAll = attendanceDeduction + extraDeductions;

  // Chart data
  const barData = [
    { name: "حاضر",    value: workedDays,       fill: "#10b981" },
    { name: "غائب",    value: absentDays,       fill: "#ef4444" },
    { name: "متأخر",   value: lateDays,         fill: "#f59e0b" },
    { name: "نصف يوم", value: halfDays,         fill: "#3b82f6" },
    { name: "إجازة",   value: holidayDays,      fill: "#8b5cf6" },
    { name: "مبرر",    value: excusedDays,      fill: "#06b6d4" },
  ].filter(d => d.value > 0);

  // Build calendar
  const [year, mon] = selectedMonth.split("-").map(Number);
  const firstDay = new Date(year, mon - 1, 1).getDay();
  const daysInMonth = new Date(year, mon, 0).getDate();
  const attMap = Object.fromEntries(attendance.map(a => [a.date, a]));
  const weekDays = ["سبت", "أحد", "اثنين", "ثلاثاء", "أربعاء", "خميس", "جمعة"];
  const offset = (firstDay + 1) % 7;

  return (
    <div className="space-y-4" dir="rtl">

      {/* Month Selector */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
        {monthOptions.slice(0, 6).map(m => (
          <button key={m.value} type="button" onClick={() => setSelectedMonth(m.value)}
            className={`shrink-0 px-3.5 py-1.5 rounded-full text-xs font-bold transition-all border whitespace-nowrap ${
              selectedMonth === m.value
                ? "bg-primary text-primary-foreground border-primary shadow-sm"
                : "border-border text-muted-foreground hover:text-foreground hover:border-foreground/30"
            }`}>
            {m.label}
          </button>
        ))}
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
        {[
          { label: "حاضر",    value: workedDays,  meta: STATUS_META.present },
          { label: "غائب",    value: absentDays,  meta: STATUS_META.absent },
          { label: "متأخر",   value: lateDays,    meta: STATUS_META.late },
          { label: "نصف يوم", value: halfDays,    meta: STATUS_META.half_day },
          { label: "إجازة",   value: holidayDays, meta: STATUS_META.holiday },
          { label: "مبرر",    value: excusedDays, meta: STATUS_META.excused },
        ].map(({ label, value, meta }) => (
          <div key={label} className={`rounded-xl p-3 border ${meta.border} ${meta.bg} flex flex-col items-center gap-1`}>
            <span className={`text-2xl font-black ${meta.color}`}>{value}</span>
            <span className="text-[10px] text-muted-foreground">{label}</span>
          </div>
        ))}
      </div>

      {/* Attendance Rate + Bar Chart */}
      <div className="rounded-xl border border-border bg-card p-4 space-y-3">
        <div className="flex justify-between items-center">
          <span className="text-sm font-bold flex items-center gap-2">
            <CalendarCheck2 className="w-4 h-4 text-primary" />نسبة الحضور
          </span>
          <span className={`text-lg font-black ${attendanceRate >= 80 ? "text-emerald-400" : attendanceRate >= 60 ? "text-amber-400" : "text-rose-400"}`}>
            {attendanceRate}%
          </span>
        </div>
        <div className="h-3 bg-muted/30 rounded-full overflow-hidden">
          <div className={`h-full rounded-full transition-all duration-700 ${attendanceRate >= 80 ? "bg-emerald-500" : attendanceRate >= 60 ? "bg-amber-500" : "bg-rose-500"}`}
            style={{ width: `${attendanceRate}%` }} />
        </div>
        <p className="text-[11px] text-muted-foreground">
          {workedDays} يوم حضور من أصل {effectiveWorkDays} يوم عمل مسجّل
        </p>

        {/* Bar chart */}
        {barData.length > 0 && (
          <div className="pt-2">
            <ResponsiveContainer width="100%" height={100}>
              <BarChart data={barData} barSize={28}>
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                <YAxis hide />
                <Tooltip
                  formatter={(v: any) => [fmtNum(v), "أيام"]}
                  contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 11 }}
                  cursor={false}
                  wrapperStyle={{ display: "none" }} />
                <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                  {barData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Salary Summary (only if baseSalary > 0) */}
      {baseSalary > 0 && (
        <div className="rounded-2xl border border-border overflow-hidden">
          <div className="px-4 py-3 border-b border-border/50 flex items-center gap-2"
            style={{ background: "linear-gradient(to left, hsl(var(--primary)/0.08), transparent)" }}>
            <Wallet className="w-4 h-4 text-primary" />
            <span className="font-black text-sm">ملخص الراتب — {monthOptions.find(m => m.value === selectedMonth)?.label}</span>
          </div>
          <div className="p-4 space-y-2.5 bg-card">
            <div className="flex justify-between py-1.5 border-b border-border/20">
              <span className="text-sm text-muted-foreground">الراتب الأساسي</span>
              <span className="font-bold text-sm">{fmt(baseSalary)}</span>
            </div>
            {attendanceDeduction > 0 && (
              <div className="flex justify-between py-1.5 border-b border-border/20">
                <span className="text-sm text-rose-400 flex items-center gap-1.5"><ArrowDown className="w-3.5 h-3.5" />خصم غياب وتأخير</span>
                <span className="font-bold text-sm text-rose-400">- {fmt(attendanceDeduction)}</span>
              </div>
            )}
            {bonuses > 0 && (
              <div className="flex justify-between py-1.5 border-b border-border/20">
                <span className="text-sm text-emerald-400 flex items-center gap-1.5"><ArrowUp className="w-3.5 h-3.5" />مكافآت</span>
                <span className="font-bold text-sm text-emerald-400">+ {fmt(bonuses)}</span>
              </div>
            )}
            {extraDeductions > 0 && (
              <div className="flex justify-between py-1.5 border-b border-border/20">
                <span className="text-sm text-rose-400 flex items-center gap-1.5"><ArrowDown className="w-3.5 h-3.5" />خصومات إضافية</span>
                <span className="font-bold text-sm text-rose-400">- {fmt(extraDeductions)}</span>
              </div>
            )}
            <div className="flex justify-between pt-2">
              <span className="font-black text-sm">صافي الراتب المستحق</span>
              <span className="font-black text-xl text-primary">{fmt(netSalary)}</span>
            </div>
          </div>
        </div>
      )}

      {/* Calendar Grid */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="px-4 py-3 border-b border-border/50 flex items-center gap-2"
          style={{ background: "linear-gradient(to left, hsl(var(--primary)/0.08), transparent)" }}>
          <CalendarDays className="w-4 h-4 text-primary" />
          <span className="font-black text-sm">{monthOptions.find(m => m.value === selectedMonth)?.label}</span>
        </div>
        <div className="grid grid-cols-7 border-b border-border/30">
          {weekDays.map(d => (
            <div key={d} className="py-2 text-center text-[10px] font-bold text-muted-foreground">{d}</div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-px bg-border/10 p-2">
          {Array.from({ length: offset }).map((_, i) => <div key={`e-${i}`} />)}
          {Array.from({ length: daysInMonth }, (_, i) => {
            const day = i + 1;
            const dateStr = `${year}-${String(mon).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
            const rec = attMap[dateStr];
            const meta = rec ? STATUS_META[rec.status] : null;
            const isToday = dateStr === format(new Date(), "yyyy-MM-dd");
            return (
              <div key={day} title={rec ? `${STATUS_META[rec.status]?.label}${rec.checkIn ? ` · دخول: ${rec.checkIn}` : ""}` : undefined}
                className={`rounded-lg p-1 flex flex-col items-center gap-0.5 min-h-[46px] justify-center cursor-default transition-all
                  ${meta ? `${meta.bg} ${meta.border} border` : "border border-transparent hover:bg-muted/20"}
                  ${isToday ? "ring-2 ring-primary" : ""}`}>
                <span className={`text-xs font-bold leading-none ${meta ? meta.color : "text-muted-foreground"}`}>{day}</span>
                {rec && <span className={`w-1.5 h-1.5 rounded-full ${meta!.dot}`} />}
                {rec?.checkIn && <span className="text-[8px] text-muted-foreground leading-none">{rec.checkIn}</span>}
                {rec?.lateMinutes && rec.lateMinutes > 0 ? <span className="text-[8px] text-amber-400 leading-none">+{rec.lateMinutes}د</span> : null}
              </div>
            );
          })}
        </div>
        <div className="px-4 py-3 border-t border-border/30 flex flex-wrap gap-3">
          {Object.entries(STATUS_META).map(([, m]) => (
            <span key={m.label} className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
              <span className={`w-2 h-2 rounded-full shrink-0 ${m.dot}`} />{m.label}
            </span>
          ))}
        </div>
      </div>

      {/* Detailed List */}
      {attendance.length > 0 ? (
        <div>
          <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest mb-2.5">سجل مفصّل</p>
          <div className="space-y-2">
            {[...attendance].sort((a, b) => b.date.localeCompare(a.date)).map(rec => {
              const meta = STATUS_META[rec.status] ?? STATUS_META.present;
              return (
                <div key={rec.id} className={`rounded-xl border ${meta.border} ${meta.bg} px-4 py-3 flex items-center gap-3`}>
                  <span className={`w-2 h-2 rounded-full shrink-0 ${meta.dot}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-bold">{format(new Date(rec.date + "T00:00:00"), "EEEE d MMMM", { locale: ar })}</span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${meta.bg} ${meta.border} ${meta.color}`}>{meta.label}</span>
                    </div>
                    <div className="flex gap-3 mt-0.5 flex-wrap text-[11px] text-muted-foreground">
                      {rec.checkIn  && <span>دخول: <strong className="text-foreground">{rec.checkIn}</strong></span>}
                      {rec.checkOut && <span>خروج: <strong className="text-foreground">{rec.checkOut}</strong></span>}
                      {rec.lateMinutes > 0 && <span className="text-amber-400">تأخير: {rec.lateMinutes} دقيقة</span>}
                      {rec.deduction > 0    && <span className="text-rose-400">خصم: {fmt(rec.deduction)}</span>}
                      {rec.notes && <span>{rec.notes}</span>}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <EmptyState icon={CalendarCheck2} title="لا يوجد سجل حضور" sub="لم يتم تسجيل أي حضور لهذا الشهر بعد" />
      )}
    </div>
  );
}

export default function ProfilePage() {
  const { user, refreshUser } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [location] = useLocation();

  const [avatarB64, setAvatarB64] = useState<string | null | undefined>(undefined);
  const [activeTab, setActiveTab] = useState<"dashboard" | "orders" | "kpis" | "report" | "saleskpi" | "attendance" | "settings">("dashboard");

  // state مشترك للـ header وDashboardTab
  const [headerViewMode, setHeaderViewMode] = useState<"monthly" | "daily">("monthly");
  const [headerDate, setHeaderDate] = useState(format(new Date(), "yyyy-MM-dd"));

  // Fetch team extended stats (for current user overview)
  const { data: allStats } = useQuery({
    queryKey: ["team-perf-profile"],
    queryFn: () => teamAnalyticsApi.teamPerformanceExtended(),
    staleTime: 2 * 60_000,
  });
  const myStats = allStats?.find(s => s.userId === user?.id);

  // Fetch my-report لنقاط الأداء الصحيحة (0-100) في الـ header
  const currentMonth = format(new Date(), "yyyy-MM");
  const { data: myReport } = useQuery({
    queryKey: ["my-report-header", headerViewMode, headerViewMode === "daily" ? headerDate : currentMonth],
    queryFn: () => headerViewMode === "daily"
      ? employeeApi.getMyReport(undefined, "daily", headerDate)
      : employeeApi.getMyReport(currentMonth),
    staleTime: 5 * 60_000,
  });

  // حساب الـ score: لو daily وما رجعش score من API، احسبه لاحقاً من dayOrders
  const headerScore = myReport?.overallScore ?? null;

  // Fetch employee profiles list to find the current user's profile
  const { data: profiles } = useQuery({
    queryKey: ["emp-profiles-list"],
    queryFn: () => employeeApi.listProfiles(),
    staleTime: 5 * 60_000,
  });
  const myProfile = profiles?.find(p => p.userId === user?.id);

  // Mutations
  const avatarMutation = useMutation({
    mutationFn: (data: { avatar?: string | null }) => authApi.updateProfile(data),
    onSuccess: () => {
      toast({ title: "✅ تم تحديث الصورة الشخصية" });
      refreshUser();
      qc.invalidateQueries({ queryKey: ["users"] });
      setAvatarB64(undefined);
    },
    onError: (e: any) => toast({ title: "خطأ", description: e.message, variant: "destructive" }),
  });

  const pwMutation = useMutation({
    mutationFn: ({ currentPw, newPw }: { currentPw: string; newPw: string }) => authApi.changePassword(currentPw, newPw),
    onSuccess: () => toast({ title: "✅ تم تغيير كلمة المرور" }),
    onError: (e: any) => toast({ title: "خطأ", description: e.message, variant: "destructive" }),
  });

  const handleSaveAvatar = () => {
    if (avatarB64 === undefined) return;
    avatarMutation.mutate({ avatar: avatarB64 });
  };

  const handleChangePassword = (currentPw: string, newPw: string, onSuccess: () => void) => {
    pwMutation.mutate({ currentPw, newPw }, { onSuccess });
  };

  if (!user) return null;

  const roleColor = getRoleColor(user.role);

  const isAdminRole = user?.role === "super_admin" || user?.role === "admin";
  const isEmployee  = user?.role === "employee";

  const TABS = [
    { key: "dashboard",    label: "لوحتي",         icon: LayoutDashboard },
    { key: "orders",       label: "طلباتي",         icon: ListOrdered },
    { key: "kpis",         label: "مؤشرات الأداء",  icon: Activity },
    { key: "report",       label: "تقرير شهري",     icon: FileText },
    ...(isEmployee ? [{ key: "saleskpi", label: "أداء الفريق", icon: GanttChart }] : []),
    ...(!isAdminRole ? [{ key: "attendance", label: "الحضور", icon: CalendarCheck2 }] : []),
    { key: "settings",     label: "الإعدادات",       icon: User },
  ];

  // لو الـ route هو /my-dashboard → اعرض البروفايل كامل full width
  const isMyDashboard = location === "/my-dashboard";

  return (
    <div className={isMyDashboard ? "w-full space-y-5" : "max-w-3xl mx-auto space-y-5"} dir="rtl">
      {/* ── Header ── */}
      <Card className="overflow-hidden border-0" style={{ background: "hsl(var(--card))" }}>
        <div className="h-20 relative" style={{ background: "linear-gradient(135deg, hsl(var(--primary)/0.35) 0%, hsl(var(--primary)/0.1) 60%, transparent 100%)" }}>
          <div className="absolute inset-0" style={{ backgroundImage: "radial-gradient(circle at 20% 50%, hsl(var(--primary)/0.2) 0%, transparent 50%)" }} />
        </div>
        <CardContent className="px-5 pb-5 -mt-10">
          <div className="flex flex-col sm:flex-row sm:items-end gap-4">
            <div className="relative shrink-0">
              {(user as any).avatar
                ? <img src={(user as any).avatar} className="w-20 h-20 rounded-2xl object-cover border-4 border-card shadow-xl" alt={user.displayName} />
                : <div className="w-20 h-20 rounded-2xl flex items-center justify-center text-2xl font-black border-4 border-card shadow-xl"
                    style={{ background: "linear-gradient(135deg,hsl(var(--primary)/0.9),hsl(var(--primary)/0.5))", color: "hsl(var(--primary-foreground))" }}>
                    {user.displayName.charAt(0).toUpperCase()}
                  </div>}
              <span className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-emerald-400 border-2 border-card" style={{ boxShadow: "0 0 8px rgba(52,211,153,0.8)" }} />
            </div>
            <div className="flex-1 min-w-0 pt-1">
              <h1 className="text-xl font-black truncate">{user.displayName}</h1>
              <p className="text-sm text-muted-foreground">@{user.username}</p>
              <div className="flex items-center gap-2 flex-wrap mt-1.5">
                <div className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold border bg-gradient-to-r ${roleColor}`}>
                  <Shield className="w-3 h-3" />{ROLE_LABELS[user.role] ?? user.role}
                </div>
                {myProfile?.jobTitle && <Badge variant="outline" className="text-xs">{myProfile.jobTitle}</Badge>}
                {myProfile?.department && <Badge variant="outline" className="text-xs">{myProfile.department}</Badge>}
              </div>
            </div>
            {headerScore != null && (
              <div className="shrink-0 text-center sm:text-left">
                <div className="text-xs text-muted-foreground mb-0.5 flex items-center gap-1.5 justify-center sm:justify-start">
                  نقاط الأداء
                  {headerViewMode === "daily" && (
                    <span className="text-[9px] bg-primary/15 text-primary font-bold px-1.5 py-0.5 rounded-full">يومي</span>
                  )}
                </div>
                <div className="text-3xl font-black">{headerScore}<span className="text-sm text-muted-foreground">/100</span></div>
                <ScoreBadge score={headerScore} />
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* ── Tabs ── */}
      <div className="flex gap-1 bg-muted/30 rounded-xl p-1 border overflow-x-auto">
        {TABS.map(({ key, label, icon: Icon }) => (
          <button key={key} type="button" onClick={() => setActiveTab(key as any)}
            className={`flex-1 min-w-fit flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${activeTab === key ? "bg-card text-foreground shadow-sm border border-border/50" : "text-muted-foreground hover:text-foreground"}`}>
            <Icon className="w-3.5 h-3.5 shrink-0" />{label}
          </button>
        ))}
      </div>

      {/* ── Tab Content ── */}
      {activeTab === "dashboard" && (
        <DashboardTab
          myStats={myStats}
          profile={myProfile}
          externalViewMode={headerViewMode}
          externalDate={headerDate}
          onViewModeChange={setHeaderViewMode}
          onDateChange={setHeaderDate}
        />
      )}
      {activeTab === "orders" && <OrdersTab profile={myProfile} userId={user.id} />}
      {activeTab === "kpis" && <KpisTab
        myStats={myStats}
        profile={myProfile}
        externalViewMode={headerViewMode}
        externalDate={headerDate}
        onViewModeChange={setHeaderViewMode}
        onDateChange={setHeaderDate}
      />}
      {activeTab === "report" && <MonthlyReportTab
        profile={myProfile}
        externalViewMode={headerViewMode}
        externalDate={headerDate}
        onViewModeChange={setHeaderViewMode}
        onDateChange={setHeaderDate}
      />}
      {activeTab === "saleskpi" && <SalesKPIDashboardTab myStats={myStats} profile={myProfile} />}
      {activeTab === "attendance" && <AttendanceTab />}
      {activeTab === "settings" && (
        <SettingsTab
          user={user}
          avatarB64={avatarB64}
          setAvatarB64={setAvatarB64}
          avatarMutation={avatarMutation}
          handleSaveAvatar={handleSaveAvatar}
          pwMutation={pwMutation}
          handleChangePassword={handleChangePassword}
        />
      )}
    </div>
  );
}
