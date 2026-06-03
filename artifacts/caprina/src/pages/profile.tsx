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
  RefreshCw,
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
    queryKey: ["emp-report-curr", profile?.id],
    queryFn: () => employeeApi.getReport(profile!.id, currentMonth),
    enabled: !!profile?.id,
  });
  const { data: prevReport } = useQuery({
    queryKey: ["emp-report-prev", profile?.id],
    queryFn: () => employeeApi.getReport(profile!.id, prevMonth),
    enabled: !!profile?.id,
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

  if (!myStats && !profile) return <EmptyState icon={LayoutDashboard} title="لا توجد بيانات" sub="لم يتم إنشاء بروفايل موظف لحسابك بعد" />;

  return (
    <div className="space-y-4">
      {/* Quick KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <MiniCard icon={Package} label="طلبات الشهر" value={fmtNum(stats?.total ?? myStats?.total ?? 0)} color="from-blue-500/15 to-blue-600/5 border-blue-500/20 text-blue-400" />
        <MiniCard icon={CheckCircle2} label="مسلّمة" value={fmtNum(stats?.delivered ?? myStats?.delivered ?? 0)} sub={pct(stats?.deliveryRate ?? myStats?.deliveryRate ?? 0)} color="from-emerald-500/15 to-green-600/5 border-emerald-500/20 text-emerald-400" />
        <MiniCard icon={XCircle} label="مرتجعات" value={fmtNum(stats?.returned ?? myStats?.returned ?? 0)} sub={pct(stats?.returnRate ?? myStats?.returnRate ?? 0)} color="from-rose-500/15 to-red-600/5 border-rose-500/20 text-rose-400" />
        <MiniCard icon={Coins} label="الأرباح" value={fmt(stats?.totalProfit ?? myStats?.profit ?? 0)} color="from-violet-500/15 to-purple-600/5 border-violet-500/20 text-violet-400" />
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
              </>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">لا توجد نقاط أداء بعد</p>
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
                <BarChart data={compData} barGap={2}>
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                  <Tooltip formatter={(v: any) => [fmtNum(v), ""]} contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 11 }} />
                  <Bar dataKey="delivered" name="مسلّمة" fill="#10b981" radius={[3,3,0,0]} />
                  <Bar dataKey="returned" name="مرتجعة" fill="#ef4444" radius={[3,3,0,0]} />
                </BarChart>
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
            <div><div className="flex justify-between text-xs mb-1"><span className="text-muted-foreground">الأرباح الصافية</span><span className="font-bold text-emerald-400">{fmt(stats?.totalProfit ?? 0)}</span></div><AnimatedBar pct={stats?.totalRevenue ? (stats.totalProfit / stats.totalRevenue) * 100 : 0} color="bg-emerald-500" /></div>
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

  // تقرير KPI المخصص (لو في profile)
  const { data: report, isLoading: reportLoading } = useQuery({
    queryKey: ["emp-report-kpis", profile?.id, selectedMonth],
    queryFn: () => employeeApi.getReport(profile!.id, selectedMonth),
    enabled: !!profile?.id,
  });

  const kpis = report?.kpis ?? [];
  const fin = report?.kpiFinancials;

  // ── مؤشرات من أداء الفريق (دائماً متاحة) ──
  const teamKpiItems = useMemo(() => {
    if (!myStats) return [];
    return [
      {
        id: "delivery",
        name: "معدل التسليم",
        icon: CheckCircle2,
        color: "text-emerald-400",
        bg: "from-emerald-500/15 to-green-600/5 border-emerald-500/20",
        progress: myStats.deliveryRate,
        value: `${myStats.deliveryRate.toFixed(1)}%`,
        target: "80%",
        achieved: myStats.deliveryRate >= 80,
        description: "نسبة الطلبات المسلّمة من الإجمالي",
      },
      {
        id: "return",
        name: "معدل الإرجاع",
        icon: XCircle,
        color: "text-rose-400",
        bg: "from-rose-500/15 to-red-600/5 border-rose-500/20",
        progress: Math.max(0, 20 - myStats.returnRate) / 20 * 100,
        value: `${myStats.returnRate.toFixed(1)}%`,
        target: "< 20%",
        achieved: myStats.returnRate < 20,
        description: "نسبة الطلبات المرتجعة (كلما قلّت كان أفضل)",
      },
      {
        id: "score",
        name: "نقاط الأداء الكلية",
        icon: Trophy,
        color: "text-amber-400",
        bg: "from-amber-500/15 to-yellow-600/5 border-amber-500/20",
        progress: myStats.score,
        value: `${myStats.score} / 100`,
        target: "80 نقطة",
        achieved: myStats.score >= 80,
        description: "النقاط الإجمالية بناءً على كل المؤشرات",
      },
      {
        id: "volume",
        name: "حجم المبيعات",
        icon: Package,
        color: "text-blue-400",
        bg: "from-blue-500/15 to-blue-600/5 border-blue-500/20",
        progress: Math.min(100, myStats.ordersPerDay * 10),
        value: `${myStats.ordersPerDay.toFixed(1)} / يوم`,
        target: "10 يومياً",
        achieved: myStats.ordersPerDay >= 10,
        description: "متوسط الطلبات اليومية",
      },
      {
        id: "speed",
        name: "سرعة المعالجة",
        icon: Zap,
        color: "text-violet-400",
        bg: "from-violet-500/15 to-purple-600/5 border-violet-500/20",
        progress: myStats.avgProcessingHours != null
          ? Math.max(0, (48 - myStats.avgProcessingHours) / 48 * 100)
          : 0,
        value: myStats.avgProcessingHours != null ? `${myStats.avgProcessingHours.toFixed(1)} ساعة` : "—",
        target: "< 24 ساعة",
        achieved: myStats.avgProcessingHours != null && myStats.avgProcessingHours < 24,
        description: "متوسط الوقت من إنشاء الطلب للتسليم",
      },
    ];
  }, [myStats]);

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
            const actual = kpi.actualValue ?? 0;
            const target = kpi.targetValue;
            const progress = target > 0 ? Math.min(100, (actual / target) * 100) : 0;
            const achieved = kpi.achieved;
            const isHigher = kpi.direction === "higher_is_better";
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
                        <span className={`text-lg font-black ${kpi.score >= 80 ? "text-emerald-400" : kpi.score >= 60 ? "text-blue-400" : kpi.score >= 40 ? "text-amber-400" : "text-rose-400"}`}>
                          {kpi.score.toFixed(0)}<span className="text-xs text-muted-foreground">/100</span>
                        </span>
                      )}
                    </div>
                  </div>
                  {/* Progress Bar */}
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
      )}
    </div>
  );
}

/* ── Tab: Monthly Report (تقرير شهري) ── */
function MonthlyReportTab({ profile }: { profile?: EmployeeProfile }) {
  const [selectedMonth, setSelectedMonth] = useState(format(new Date(), "yyyy-MM"));

  const monthOptions = useMemo(() => Array.from({ length: 12 }, (_, i) => {
    const d = subMonths(new Date(), i);
    return { value: format(d, "yyyy-MM"), label: format(d, "MMMM yyyy", { locale: ar }) };
  }), []);

  const { data: report, isLoading } = useQuery({
    queryKey: ["emp-report-monthly", profile?.id, selectedMonth],
    queryFn: () => employeeApi.getReport(profile!.id, selectedMonth),
    enabled: !!profile?.id,
  });

  if (!profile?.id) return <EmptyState icon={FileText} title="لا يوجد بروفايل موظف" sub="تواصل مع المدير لإنشاء بروفايل موظف" />;
  if (isLoading) return <LoadingSpinner text="جاري تحميل التقرير الشهري..." />;
  if (!report) return <EmptyState icon={FileText} title="لا يوجد تقرير" sub="لا توجد بيانات لهذا الشهر" />;

  const { orderStats: os, kpis, kpiFinancials: fin, overallScore, rating, salary } = report;
  const netSalary = salary + (fin?.totalBonus ?? 0) - (fin?.totalDeduction ?? 0);

  // Pie data for order distribution
  const pieData = [
    { name: "مسلّمة", value: os.delivered, color: "#10b981" },
    { name: "مرتجعة", value: os.returned, color: "#ef4444" },
    { name: "قيد التنفيذ", value: os.pending, color: "#f59e0b" },
  ].filter(d => d.value > 0);

  return (
    <div className="space-y-4" dir="rtl">
      {/* Month selector */}
      <div className="flex items-center gap-2 flex-wrap">
        <FileText className="w-4 h-4 text-muted-foreground shrink-0" />
        <select value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)}
          className="text-sm border border-border rounded-lg px-3 py-1.5 bg-background text-foreground cursor-pointer">
          {monthOptions.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
        </select>
      </div>

      {/* Report Header */}
      <Card className="border overflow-hidden">
        <div className="px-5 py-4 bg-gradient-to-l from-primary/10 via-primary/5 to-transparent border-b border-border/50">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <h3 className="font-black text-base">التقرير الشهري</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                {monthOptions.find(m => m.value === selectedMonth)?.label} · {report.displayName}
              </p>
            </div>
            {overallScore != null && (
              <div className="flex items-center gap-3">
                <div className="text-left">
                  <div className="text-3xl font-black leading-none">{overallScore}<span className="text-sm text-muted-foreground">/100</span></div>
                  <ScoreBadge score={overallScore} />
                </div>
              </div>
            )}
          </div>
        </div>
        <CardContent className="p-5 space-y-5">

          {/* Order Stats + Pie */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <p className="font-bold text-xs text-muted-foreground uppercase tracking-wider">إحصائيات الطلبات</p>
              <div className="space-y-2">
                {[
                  { label: "إجمالي الطلبات", value: fmtNum(os.total), color: "text-foreground" },
                  { label: "الطلبات المسلّمة", value: `${fmtNum(os.delivered)} (${pct(os.deliveryRate)})`, color: "text-emerald-400" },
                  { label: "الطلبات المرتجعة", value: `${fmtNum(os.returned)} (${pct(os.returnRate)})`, color: "text-rose-400" },
                  { label: "قيد التنفيذ", value: fmtNum(os.pending), color: "text-amber-400" },
                  { label: "إجمالي الإيرادات", value: fmt(os.totalRevenue), color: "text-blue-400" },
                  { label: "صافي الأرباح", value: fmt(os.totalProfit), color: "text-violet-400" },
                ].map(({ label, value, color }) => (
                  <div key={label} className="flex justify-between items-center py-1.5 border-b border-border/20 last:border-0">
                    <span className="text-xs text-muted-foreground">{label}</span>
                    <span className={`text-xs font-bold ${color}`}>{value}</span>
                  </div>
                ))}
              </div>
            </div>
            {pieData.length > 0 && (
              <div className="flex flex-col items-center justify-center">
                <ResponsiveContainer width="100%" height={140}>
                  <PieChart>
                    <Pie data={pieData} dataKey="value" cx="50%" cy="50%" innerRadius={35} outerRadius={60} paddingAngle={3}>
                      {pieData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                    </Pie>
                    <Tooltip formatter={(v: any) => [fmtNum(v), ""]} contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 11 }} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex gap-3 flex-wrap justify-center text-[11px]">
                  {pieData.map(d => <span key={d.name} className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: d.color }} />{d.name}</span>)}
                </div>
              </div>
            )}
          </div>

          {/* KPI Summary */}
          {kpis.length > 0 && (
            <div className="space-y-2">
              <p className="font-bold text-xs text-muted-foreground uppercase tracking-wider">ملخص مؤشرات الأداء</p>
              <div className="grid grid-cols-1 gap-2">
                {kpis.map(k => (
                  <div key={k.id} className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border ${k.achieved ? "border-emerald-500/30 bg-emerald-500/5" : "border-border bg-muted/10"}`}>
                    {k.achieved ? <BadgeCheck className="w-4 h-4 text-emerald-400 shrink-0" /> : <XCircle className="w-4 h-4 text-rose-400 shrink-0" />}
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between gap-2">
                        <span className="text-xs font-semibold truncate">{k.name}</span>
                        <span className={`text-xs font-bold shrink-0 ${k.score != null && k.score >= 80 ? "text-emerald-400" : k.score != null && k.score >= 60 ? "text-blue-400" : "text-rose-400"}`}>
                          {k.score?.toFixed(0) ?? "—"}/100
                        </span>
                      </div>
                      <div className="text-[10px] text-muted-foreground mt-0.5">
                        الفعلي: {fmtNum(k.actualValue ?? 0)} / الهدف: {fmtNum(k.targetValue)} {k.unit}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Salary Summary */}
          {salary > 0 && (
            <div className="rounded-xl border border-border p-4 bg-muted/10 space-y-2">
              <p className="font-bold text-xs text-muted-foreground uppercase tracking-wider">ملخص الراتب</p>
              <div className="space-y-1.5">
                <div className="flex justify-between text-sm"><span className="text-muted-foreground">الراتب الأساسي</span><span className="font-bold">{fmt(salary)}</span></div>
                {fin && fin.totalBonus > 0 && <div className="flex justify-between text-sm"><span className="text-emerald-400 flex items-center gap-1"><ArrowUp className="w-3 h-3" />مكافآت الأداء</span><span className="font-bold text-emerald-400">+ {fmt(fin.totalBonus)}</span></div>}
                {fin && fin.totalDeduction > 0 && <div className="flex justify-between text-sm"><span className="text-rose-400 flex items-center gap-1"><ArrowDown className="w-3 h-3" />خصومات الأداء</span><span className="font-bold text-rose-400">- {fmt(fin.totalDeduction)}</span></div>}
                <div className="flex justify-between text-sm font-black border-t border-border/50 pt-2 mt-1">
                  <span>صافي الراتب المستحق</span>
                  <span className="text-primary text-base">{fmt(netSalary)}</span>
                </div>
              </div>
            </div>
          )}

          {/* Rating */}
          {rating && (
            <div className="flex items-center gap-3 rounded-xl border border-primary/20 bg-primary/5 px-4 py-3">
              <Star className="w-5 h-5 text-amber-400 shrink-0" />
              <div>
                <p className="text-xs text-muted-foreground">التقييم العام</p>
                <p className="font-black text-sm">{rating}</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
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
export default function ProfilePage() {
  const { user, refreshUser } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();

  const [avatarB64, setAvatarB64] = useState<string | null | undefined>(undefined);
  const [activeTab, setActiveTab] = useState<"dashboard" | "orders" | "kpis" | "report" | "settings">("dashboard");

  // Fetch team extended stats (for current user overview)
  const { data: allStats } = useQuery({
    queryKey: ["team-perf-profile"],
    queryFn: () => teamAnalyticsApi.teamPerformanceExtended(),
    staleTime: 2 * 60_000,
  });
  const myStats = allStats?.find(s => s.userId === user?.id);

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
    { key: "dashboard", label: "لوحتي", icon: LayoutDashboard },
    { key: "orders", label: "طلباتي", icon: ListOrdered },
    { key: "kpis", label: "مؤشرات الأداء", icon: Activity },
    { key: "report", label: "تقرير شهري", icon: FileText },
    { key: "settings", label: "الإعدادات", icon: User },
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
            {myStats && (
              <div className="shrink-0 text-center sm:text-left">
                <div className="text-xs text-muted-foreground mb-0.5">نقاط الأداء</div>
                <div className="text-3xl font-black">{myStats.score}<span className="text-sm text-muted-foreground">/100</span></div>
                <ScoreBadge score={myStats.score} />
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
