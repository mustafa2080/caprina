import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { sessionsApi } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Clock, Users, LogIn, LogOut, Calendar, Timer } from "lucide-react";

const ROLE_LABELS: Record<string, string> = {
  admin: "مدير", employee: "موظف مبيعات", warehouse: "مسؤول مخزون",
};

const ROLE_COLORS: Record<string, string> = {
  admin: "border-yellow-700 bg-yellow-900/20 text-yellow-400",
  employee: "border-blue-700 bg-blue-900/20 text-blue-400",
  warehouse: "border-emerald-700 bg-emerald-900/20 text-emerald-400",
};

type Period = "week" | "month" | "year" | "custom";

function formatDuration(seconds: number | null): string {
  if (!seconds || seconds <= 0) return "—";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}س ${m}د`;
  return `${m} دقيقة`;
}

function formatDateTime(dt: string | null): string {
  if (!dt) return "—";
  return new Intl.DateTimeFormat("ar-EG", {
    year: "numeric", month: "short", day: "numeric",
    hour: "2-digit", minute: "2-digit",
  }).format(new Date(dt));
}

export default function SessionsReportPage() {
  const { isAdmin } = useAuth();
  const [period, setPeriod] = useState<Period>("week");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [activeTab, setActiveTab] = useState<"summary" | "details">("summary");

  const params = period === "custom"
    ? { period: "custom", from, to }
    : { period };

  const { data, isLoading } = useQuery({
    queryKey: ["sessions-report", period, from, to],
    queryFn: () => sessionsApi.report(params),
    enabled: isAdmin && (period !== "custom" || (!!from && !!to)),
  });

  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]" dir="rtl">
        <div className="text-center space-y-2">
          <div className="text-4xl">🔒</div>
          <p className="font-bold text-foreground">للمدير فقط</p>
        </div>
      </div>
    );
  }

  const totalSessions = data?.summary.reduce((s, u) => s + u.totalSessions, 0) ?? 0;
  const totalDuration = data?.summary.reduce((s, u) => s + u.totalDuration, 0) ?? 0;
  const activeUsers   = data?.summary.filter(u => u.totalSessions > 0).length ?? 0;

  return (
    <div className="space-y-5 p-4 md:p-6 max-w-6xl mx-auto" dir="rtl">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-black flex items-center gap-2">
          <Clock className="w-6 h-6 text-primary" /> تقارير أوقات الدخول والخروج
        </h1>
        <p className="text-xs text-muted-foreground mt-0.5">تتبع جلسات المستخدمين وأوقات العمل</p>
      </div>

      {/* Period Filter */}
      <div className="flex flex-wrap items-center gap-2">
        {(["week","month","year","custom"] as Period[]).map(p => (
          <button
            key={p}
            onClick={() => setPeriod(p)}
            className={`px-4 py-2 rounded-lg text-xs font-bold border transition-all ${
              period === p
                ? "bg-primary text-primary-foreground border-primary"
                : "border-border text-muted-foreground hover:border-primary/50"
            }`}
          >
            {p === "week" ? "أسبوعي" : p === "month" ? "شهري" : p === "year" ? "سنوي" : "مخصص"}
          </button>
        ))}
        {period === "custom" && (
          <div className="flex items-center gap-2 mr-2">
            <input
              type="date"
              value={from}
              onChange={e => setFrom(e.target.value)}
              className="h-8 px-2 text-xs rounded-lg border border-border bg-background text-foreground"
            />
            <span className="text-xs text-muted-foreground">إلى</span>
            <input
              type="date"
              value={to}
              onChange={e => setTo(e.target.value)}
              className="h-8 px-2 text-xs rounded-lg border border-border bg-background text-foreground"
            />
          </div>
        )}
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="border-border">
          <CardContent className="p-4 text-center">
            <Users className="w-5 h-5 text-primary mx-auto mb-1" />
            <p className="text-2xl font-black text-primary">{activeUsers}</p>
            <p className="text-[10px] text-muted-foreground">مستخدم نشط</p>
          </CardContent>
        </Card>
        <Card className="border-border">
          <CardContent className="p-4 text-center">
            <LogIn className="w-5 h-5 text-emerald-500 mx-auto mb-1" />
            <p className="text-2xl font-black text-emerald-500">{totalSessions}</p>
            <p className="text-[10px] text-muted-foreground">إجمالي الجلسات</p>
          </CardContent>
        </Card>
        <Card className="border-border">
          <CardContent className="p-4 text-center">
            <Timer className="w-5 h-5 text-amber-500 mx-auto mb-1" />
            <p className="text-2xl font-black text-amber-500">{formatDuration(totalDuration)}</p>
            <p className="text-[10px] text-muted-foreground">إجمالي وقت العمل</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border">
        {(["summary","details"] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-xs font-bold border-b-2 transition-colors ${
              activeTab === tab
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {tab === "summary" ? "ملخص المستخدمين" : "تفاصيل الجلسات"}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="text-center text-muted-foreground py-12 text-sm">جاري التحميل...</div>
      ) : !data ? (
        <div className="text-center text-muted-foreground py-12 text-sm">لا توجد بيانات</div>
      ) : activeTab === "summary" ? (
        /* ── Summary Tab ── */
        <div className="space-y-2">
          {data.summary.length === 0 ? (
            <div className="text-center text-muted-foreground py-12 text-sm">لا توجد جلسات في هذه الفترة</div>
          ) : data.summary.map(u => (
            <Card key={u.userId} className="border-border">
              <CardContent className="p-4">
                <div className="flex items-center gap-3 flex-wrap">
                  <div className="w-10 h-10 rounded-full bg-muted/30 border border-border flex items-center justify-center text-sm font-black shrink-0">
                    {u.displayName.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-sm">{u.displayName}</span>
                      <Badge variant="outline" className={`text-[10px] font-bold ${ROLE_COLORS[u.role] ?? ""}`}>
                        {ROLE_LABELS[u.role] ?? u.role}
                      </Badge>
                    </div>
                    <p className="text-[11px] text-muted-foreground font-mono">{u.username}</p>
                  </div>
                 <div className="flex items-center gap-4 text-center shrink-0 flex-wrap">
                     <div>
                       <p className="text-lg font-black text-primary">{u.totalSessions}</p>
                       <p className="text-[10px] text-muted-foreground">جلسة</p>
                     </div>
                     <div>
                       <p className="text-sm font-bold text-amber-500">{formatDuration(u.totalDuration)}</p>
                       <p className="text-[10px] text-muted-foreground">وقت العمل</p>
                     </div>
                     <div>
                       <p className="text-xs font-bold">{formatDateTime(u.lastLogin)}</p>
                       <p className="text-[10px] text-muted-foreground">آخر دخول</p>
                     </div>
                     <div>
                       <p className="text-xs font-bold text-muted-foreground">{u.lastIp ?? "—"}</p>
                       <p className="text-[10px] text-muted-foreground">آخر IP</p>
                     </div>
                   </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        /* ── Details Tab ── */
        <div className="space-y-2">
          {data.sessions.length === 0 ? (
            <div className="text-center text-muted-foreground py-12 text-sm">لا توجد جلسات في هذه الفترة</div>
          ) : data.sessions.map(s => (
            <div key={s.id} className="flex items-center gap-3 p-3 rounded-xl border border-border bg-card flex-wrap">
              <div className="w-8 h-8 rounded-full bg-muted/30 border border-border flex items-center justify-center text-xs font-black shrink-0">
                {(s.displayName ?? "?").charAt(0)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-sm">{s.displayName ?? "—"}</p>
                <p className="text-[10px] text-muted-foreground font-mono">{s.username}</p>
              </div>
              <div className="flex items-center gap-4 shrink-0 flex-wrap text-center">
                <div className="flex items-center gap-1.5 text-emerald-500">
                  <LogIn className="w-3.5 h-3.5" />
                  <div>
                    <p className="text-xs font-bold">{formatDateTime(s.loginAt)}</p>
                    <p className="text-[10px] text-muted-foreground">دخول</p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 text-red-400">
                  <LogOut className="w-3.5 h-3.5" />
                  <div>
                    <p className="text-xs font-bold">{s.logoutAt ? formatDateTime(s.logoutAt) : "لا يزال داخل"}</p>
                    <p className="text-[10px] text-muted-foreground">خروج</p>
                  </div>
                </div>
                <div>
                  <p className="text-xs font-bold text-amber-500">{formatDuration(s.duration)}</p>
                  <p className="text-[10px] text-muted-foreground">المدة</p>
                </div>
                {s.ipAddress && (
                  <p className="text-[10px] text-muted-foreground font-mono">{s.ipAddress}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
