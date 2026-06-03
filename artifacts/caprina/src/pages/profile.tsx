import { useState, useRef, useCallback, useMemo } from "react";
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
  RefreshCw, CalendarCheck2,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/contexts/AuthContext";
import {
  authApi, teamAnalyticsApi, employeeApi, ordersApi, apiFetch,
  type TeamMemberExtStats, type EmployeeProfile,
  type EmployeeReport, type EvaluatedKpi,
  type Attendance, type AttendanceSalaryReport,
} from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, PieChart, Pie } from "recharts";

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
function DashboardTab({ myStats, profile }: { myStats?: TeamMemberExtStats; profile?: EmployeeProfile }) {
  const currentMonth = format(new Date(), "yyyy-MM");
  const prevMonth = format(subMonths(new Date(), 1), "yyyy-MM");

  const { data: currReport } = useQuery({
    queryKey: ["emp-report-curr-mine", currentMonth],
    queryFn: () => employeeApi.getMyReport(currentMonth),
  });
  const { data: prevReport } = useQuery({
    queryKey: ["emp-report-prev-mine", prevMonth],
    queryFn: () => employeeApi.getMyReport(prevMonth),
  });

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
  const rating = currReport?.rating;

  // دايماً نعرض اللوحة — البيانات هتييجي من getMyReport حتى لو مفيش profile
  return (
    <div className="space-y-4">
      {/* Quick KPI Cards */}
      <div className="grid grid-cols-3 gap-3">
        <MiniCard icon={Package} label="طلبات الشهر" value={fmtNum(stats?.total ?? myStats?.total ?? 0)} color="from-blue-500/15 to-blue-600/5 border-blue-500/20 text-blue-400" />
        <MiniCard icon={CheckCircle2} label="مسلّمة" value={fmtNum(stats?.delivered ?? myStats?.delivered ?? 0)} sub={pct(stats?.deliveryRate ?? myStats?.deliveryRate ?? 0)} color="from-emerald-500/15 to-green-600/5 border-emerald-500/20 text-emerald-400" />
        <MiniCard icon={XCircle} label="مرتجعات" value={fmtNum(stats?.returned ?? myStats?.returned ?? 0)} sub={pct(stats?.returnRate ?? myStats?.returnRate ?? 0)} color="from-rose-500/15 to-red-600/5 border-rose-500/20 text-rose-400" />

      </div>

      {/* Score + Comparison */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* Score Card */}
        <Card className="border">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Trophy className="w-4 h-4 text-amber-400" />
                <span className="font-bold text-sm">نقاط الأداء</span>
              </div>
              {score != null && <ScoreBadge score={score} />}
            </div>
            {score != null ? (
              <>
                <div className="text-center py-2">
                  <span className="text-5xl font-black">{score}</span>
                  <span className="text-sm text-muted-foreground">/100</span>
                </div>
                <div className="h-3 bg-muted/30 rounded-full overflow-hidden">
                  <div className="h-full rounded-full transition-all duration-700" style={{
                    width: `${score}%`,
                    background: score >= 80 ? "linear-gradient(90deg,#10b981,#34d399)" : score >= 60 ? "linear-gradient(90deg,#3b82f6,#60a5fa)" : score >= 40 ? "linear-gradient(90deg,#f59e0b,#fbbf24)" : "linear-gradient(90deg,#ef4444,#f87171)",
                  }} />
                </div>
                {rating && <p className="text-xs text-center text-muted-foreground">التقييم: <span className="font-bold text-foreground">{rating}</span></p>}
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
                <p className="text-[11px] text-muted-foreground/60 text-center">ستظهر النقاط بعد تسجيل أول طلب</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* This Month vs Last Month */}
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
                  <Tooltip
                    formatter={(v: any) => [fmtNum(v), ""]}
                    contentStyle={{
                      background: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: 8,
                      fontSize: 11,
                      boxShadow: "none",
                    }}
                    itemStyle={{ color: "hsl(var(--foreground))" }}
                    cursor={{ stroke: "hsl(var(--border))", strokeWidth: 1 }}
                  />
                  <Line type="monotone" dataKey="delivered" name="مسلّمة" stroke="#10b981" strokeWidth={2.5} dot={{ r: 4, fill: "#10b981", strokeWidth: 0 }} activeDot={{ r: 5, fill: "#10b981", strokeWidth: 0 }} />
                  <Line type="monotone" dataKey="returned" name="مرتجعة" stroke="#ef4444" strokeWidth={2.5} dot={{ r: 4, fill: "#ef4444", strokeWidth: 0 }} activeDot={{ r: 5, fill: "#ef4444", strokeWidth: 0 }} />
                </LineChart>
              </ResponsiveContainer>
            ) : <div className="h-[110px] flex items-center justify-center text-muted-foreground text-sm">لا بيانات كافية</div>}
          </CardContent>
        </Card>
      </div>

      {/* Financial + Speed */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Card className="border">
          <CardContent className="p-4 space-y-2.5">
            <div className="flex items-center gap-2"><TrendingUp className="w-4 h-4 text-emerald-400" /><span className="font-bold text-sm">الأداء المالي</span></div>
            <div><div className="flex justify-between text-xs mb-1"><span className="text-muted-foreground">إجمالي الإيرادات</span><span className="font-bold">{fmt(stats?.totalRevenue ?? 0)}</span></div><AnimatedBar pct={100} color="bg-blue-500" /></div>
            <div><div className="flex justify-between text-xs mb-1"><span className="text-muted-foreground">معدل التسليم</span><span className="font-bold text-blue-400">{pct(stats?.deliveryRate ?? 0)}</span></div><AnimatedBar pct={stats?.deliveryRate ?? 0} color="bg-blue-500" /></div>
            <div><div className="flex justify-between text-xs mb-1"><span className="text-muted-foreground">معدل الإرجاع</span><span className="font-bold text-rose-400">{pct(stats?.returnRate ?? 0)}</span></div><AnimatedBar pct={stats?.returnRate ?? 0} color="bg-rose-500" /></div>
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
function KpisTab({ myStats, profile }: { myStats?: TeamMemberExtStats; profile?: EmployeeProfile }) {
  const [selectedMonth, setSelectedMonth] = useState(format(new Date(), "yyyy-MM"));

  const monthOptions = useMemo(() => Array.from({ length: 6 }, (_, i) => {
    const d = subMonths(new Date(), i);
    return { value: format(d, "yyyy-MM"), label: format(d, "MMMM yyyy", { locale: ar }) };
  }), []);

  // استخدم getMyReport بدل getReport(profile.id) — يشتغل حتى بدون profile
  const { data: report, isLoading: reportLoading } = useQuery({
    queryKey: ["emp-report-kpis-mine", selectedMonth],
    queryFn: () => employeeApi.getMyReport(selectedMonth),
  });

  const kpis = report?.kpis ?? [];
  const fin = report?.kpiFinancials;

  // ── مؤشرات من التقرير الشهري (الأولوية) أو من myStats كـ fallback ──
  const teamKpiItems = useMemo(() => {
    const os = report?.orderStats;
    const deliveryRate = os?.deliveryRate ?? myStats?.deliveryRate ?? 0;
    const returnRate   = os?.returnRate   ?? myStats?.returnRate   ?? 0;
    const ordersPerDay = myStats?.ordersPerDay ?? (os ? os.total / 26 : 0);
    const score        = myStats?.score ?? 0;
    if (!os && !myStats) return [];
    return [
      {
        id: "delivery",
        name: "معدل التسليم",
        icon: CheckCircle2,
        color: "text-emerald-400",
        bg: "from-emerald-500/15 to-green-600/5 border-emerald-500/20",
        progress: deliveryRate,
        value: `${deliveryRate.toFixed(1)}%`,
        target: "80%",
        achieved: deliveryRate >= 80,
        description: "نسبة الطلبات المسلّمة من الإجمالي",
      },
      {
        id: "return",
        name: "معدل الإرجاع",
        icon: XCircle,
        color: "text-rose-400",
        bg: "from-rose-500/15 to-red-600/5 border-rose-500/20",
        progress: Math.max(0, 20 - returnRate) / 20 * 100,
        value: `${returnRate.toFixed(1)}%`,
        target: "< 20%",
        achieved: returnRate < 20,
        description: "نسبة الطلبات المرتجعة (كلما قلّت كان أفضل)",
      },
      {
        id: "score",
        name: "نقاط الأداء الكلية",
        icon: Trophy,
        color: "text-amber-400",
        bg: "from-amber-500/15 to-yellow-600/5 border-amber-500/20",
        progress: score,
        value: `${score} / 100`,
        target: "80 نقطة",
        achieved: score >= 80,
        description: "النقاط الإجمالية بناءً على كل المؤشرات",
      },
      {
        id: "volume",
        name: "حجم المبيعات",
        icon: Package,
        color: "text-blue-400",
        bg: "from-blue-500/15 to-blue-600/5 border-blue-500/20",
        progress: Math.min(100, ordersPerDay * 10),
        value: `${ordersPerDay.toFixed(1)} / يوم`,
        target: "10 يومياً",
        achieved: ordersPerDay >= 10,
        description: "متوسط الطلبات اليومية",
      },
      {
        id: "speed",
        name: "سرعة المعالجة",
        icon: Zap,
        color: "text-violet-400",
        bg: "from-violet-500/15 to-purple-600/5 border-violet-500/20",
        progress: myStats?.avgProcessingHours != null
          ? Math.max(0, (48 - myStats.avgProcessingHours) / 48 * 100)
          : 0,
        value: myStats?.avgProcessingHours != null ? `${myStats.avgProcessingHours.toFixed(1)} ساعة` : "—",
        target: "< 24 ساعة",
        achieved: myStats?.avgProcessingHours != null && myStats.avgProcessingHours < 24,
        description: "متوسط الوقت من إنشاء الطلب للتسليم",
      },
    ];
  }, [myStats, report]);

  const achieved = teamKpiItems.filter(k => k.achieved).length;

  return (
    <div className="space-y-4">
      {/* ── Quick Stats من أداء الفريق ── */}
      {myStats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <MiniCard icon={Trophy} label="النقاط الكلية" value={`${myStats.score}/100`}
            color="from-amber-500/15 to-yellow-600/5 border-amber-500/20 text-amber-400" />
          <MiniCard icon={CheckCircle2} label="معدل التسليم" value={`${myStats.deliveryRate.toFixed(1)}%`}
            color="from-emerald-500/15 to-green-600/5 border-emerald-500/20 text-emerald-400" />
          <MiniCard icon={XCircle} label="معدل الإرجاع" value={`${myStats.returnRate.toFixed(1)}%`}
            color="from-rose-500/15 to-red-600/5 border-rose-500/20 text-rose-400" />
          <MiniCard icon={BadgeCheck} label="محقق" value={`${achieved} / ${teamKpiItems.length}`}
            color="from-blue-500/15 to-blue-600/5 border-blue-500/20 text-blue-400" />
        </div>
      )}

      {/* ── Month selector (للـ KPIs المخصصة فقط) ── */}
      {profile?.id && (
        <div className="flex items-center gap-3 flex-wrap">
          <Activity className="w-4 h-4 text-muted-foreground shrink-0" />
          <div className="flex gap-2 flex-wrap">
            {monthOptions.map(m => (
              <button key={m.value} type="button" onClick={() => setSelectedMonth(m.value)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${
                  selectedMonth === m.value
                    ? "bg-primary text-primary-foreground border-primary"
                    : "border-border text-muted-foreground hover:text-foreground"
                }`}>
                {m.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── مؤشرات أداء الفريق ── */}
      {teamKpiItems.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">مؤشرات أداء الفريق</p>
          <div className="space-y-2.5">
            {teamKpiItems.map(kpi => (
              <Card key={kpi.id} className={`border transition-all ${
                kpi.achieved ? "border-emerald-500/30" : "border-border"
              }`}>
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
                    <div className="text-left shrink-0">
                      <span className={`text-lg font-black ${kpi.color}`}>{kpi.value}</span>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-[10px] text-muted-foreground">
                      <span>التقدم</span>
                      <span>الهدف: {kpi.target}</span>
                    </div>
                    <div className="h-2.5 bg-muted/30 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-700 ${
                          kpi.achieved ? "bg-emerald-500" : kpi.progress >= 60 ? "bg-amber-500" : "bg-rose-500"
                        }`}
                        style={{ width: `${Math.min(100, kpi.progress)}%` }}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* ── مصادر الإعلانات ── */}
      {myStats?.sourceCounts && Object.keys(myStats.sourceCounts).length > 0 && (
        <Card className="border">
          <CardContent className="p-4">
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3">توزيع مصادر الطلبات</p>
            <div className="space-y-2">
              {Object.entries(myStats.sourceCounts)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 5)
                .map(([source, count]) => {
                  const total = Object.values(myStats.sourceCounts).reduce((s, v) => s + v, 0);
                  const pctVal = total > 0 ? (count / total) * 100 : 0;
                  return (
                    <div key={source} className="flex items-center gap-3">
                      <span className="text-xs text-muted-foreground w-20 shrink-0 truncate">{source}</span>
                      <div className="flex-1 h-2 bg-muted/30 rounded-full overflow-hidden">
                        <div className="h-full bg-primary/60 rounded-full transition-all duration-700"
                          style={{ width: `${pctVal}%` }} />
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
            {/* Financial summary */}
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
                const achieved = kpi.achieved;
                const progressColor = achieved ? "bg-emerald-500" : progress >= 70 ? "bg-amber-500" : "bg-rose-500";
                return (
                  <Card key={kpi.id} className={`border transition-all ${achieved ? "border-emerald-500/30" : "border-border"}`}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className="font-bold text-sm">{kpi.name}</span>
                            {achieved === true && <BadgeCheck className="w-4 h-4 text-emerald-400 shrink-0" />}
                            {achieved === false && <XCircle className="w-4 h-4 text-rose-400 shrink-0" />}
                          </div>
                          {kpi.description && <p className="text-xs text-muted-foreground">{kpi.description}</p>}
                        </div>
                        <div className="text-left shrink-0">
                          {kpi.score != null && (
                            <span className={`text-lg font-black ${
                              kpi.score >= 80 ? "text-emerald-400" : kpi.score >= 60 ? "text-blue-400"
                              : kpi.score >= 40 ? "text-amber-400" : "text-rose-400"
                            }`}>
                              {kpi.score.toFixed(0)}<span className="text-xs text-muted-foreground">/100</span>
                            </span>
                          )}
                        </div>
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

      {/* ── فارغ لو مفيش بيانات خالص ── */}
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

function MonthlyReportTab({ profile }: { profile?: EmployeeProfile }) {
  const [selectedMonth, setSelectedMonth] = useState(format(new Date(), "yyyy-MM"));

  const monthOptions = useMemo(() => Array.from({ length: 12 }, (_, i) => {
    const d = subMonths(new Date(), i);
    return { value: format(d, "yyyy-MM"), label: format(d, "MMMM yyyy", { locale: ar }) };
  }), []);

  const { data: report, isLoading } = useQuery({
    queryKey: ["emp-report-monthly-mine", selectedMonth],
    queryFn: () => employeeApi.getMyReport(selectedMonth),
  });

  if (isLoading) return <LoadingSpinner text="جاري تحميل التقرير الشهري..." />;
  if (!report) return <EmptyState icon={FileText} title="لا يوجد تقرير" sub="لا توجد بيانات لهذا الشهر" />;

  const { orderStats: os, kpis, kpiFinancials: fin, overallScore, rating, salary } = report;
  const netSalary = salary + (fin?.totalBonus ?? 0) - (fin?.totalDeduction ?? 0);
  const monthLabel = monthOptions.find(m => m.value === selectedMonth)?.label ?? selectedMonth;

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

      {/* ── Month Selector ── */}
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
                <span className="text-base font-black text-emerald-400">{pct(os.deliveryRate)}</span>
              </div>
              <div className="w-px bg-border/50 self-stretch" />
              <div className="flex flex-col">
                <span className="text-[10px] text-muted-foreground">صافي الأرباح</span>
                <span className="text-base font-black text-violet-400">{fmt(os.totalProfit)}</span>
              </div>
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
            <span className="text-emerald-400">{pct(os.deliveryRate)}</span>
          </div>
          <div className="h-3 bg-muted/30 rounded-full overflow-hidden">
            <div className="h-full rounded-full bg-emerald-500 transition-all duration-700"
              style={{ width: `${os.deliveryRate}%` }} />
          </div>
        </div>

        <div className="space-y-1.5">
          <div className="flex justify-between text-xs font-semibold">
            <span className="flex items-center gap-1.5 text-rose-400"><XCircle className="w-3.5 h-3.5" />معدل الإرجاع</span>
            <span className="text-rose-400">{pct(os.returnRate)}</span>
          </div>
          <div className="h-3 bg-muted/30 rounded-full overflow-hidden">
            <div className="h-full rounded-full bg-rose-500 transition-all duration-700"
              style={{ width: `${os.returnRate}%` }} />
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
                  contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 11 }} />
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
            <div className="flex justify-between items-center pt-2 mt-1">
              <span className="font-black text-sm">صافي الراتب المستحق</span>
              <span className="font-black text-xl text-primary">{fmt(netSalary)}</span>
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
                  contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 11 }} />
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

  const [avatarB64, setAvatarB64] = useState<string | null | undefined>(undefined);
  const [activeTab, setActiveTab] = useState<"dashboard" | "orders" | "kpis" | "report" | "attendance" | "settings">("dashboard");

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
    queryKey: ["my-report-header", currentMonth],
    queryFn: () => employeeApi.getMyReport(currentMonth),
    staleTime: 5 * 60_000,
  });
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

  const TABS = [
    { key: "dashboard",  label: "لوحتي",         icon: LayoutDashboard },
    { key: "orders",     label: "طلباتي",         icon: ListOrdered },
    { key: "kpis",       label: "مؤشرات الأداء",  icon: Activity },
    { key: "report",     label: "تقرير شهري",     icon: FileText },
    { key: "attendance", label: "الحضور",          icon: CalendarCheck2 },
    { key: "settings",   label: "الإعدادات",       icon: User },
  ];

  return (
    <div className="max-w-3xl mx-auto space-y-5" dir="rtl">
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
                <div className="text-xs text-muted-foreground mb-0.5">نقاط الأداء</div>
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
      {activeTab === "dashboard" && <DashboardTab myStats={myStats} profile={myProfile} />}
      {activeTab === "orders" && <OrdersTab profile={myProfile} userId={user.id} />}
      {activeTab === "kpis" && <KpisTab myStats={myStats} profile={myProfile} />}
      {activeTab === "report" && <MonthlyReportTab profile={myProfile} />}
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
