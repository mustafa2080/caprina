import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { sessionsApi } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Clock, Users, LogIn, LogOut, Timer, Lock, Wifi } from "lucide-react";

const ROLE_LABELS: Record<string, string> = {
  admin: "مدير", employee: "موظف مبيعات", warehouse: "مسؤول مخزون",
};

const ROLE_COLORS: Record<string, string> = {
  admin:     "border-amber-700   dark:border-amber-700   bg-amber-50   dark:bg-amber-900/20   text-amber-700   dark:text-amber-400",
  employee:  "border-sky-700     dark:border-sky-700     bg-sky-50     dark:bg-sky-900/20     text-sky-700     dark:text-sky-400",
  warehouse: "border-emerald-700 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400",
};

type Period = "week" | "month" | "year" | "custom";

const PERIOD_TABS: { id: Period; label: string }[] = [
  { id: "week",   label: "أسبوعي"  },
  { id: "month",  label: "شهري"    },
  { id: "year",   label: "سنوي"    },
  { id: "custom", label: "مخصص"    },
];

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

function Avatar({ name }: { name: string }) {
  return (
    <div className="w-9 h-9 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-sm font-black text-primary shrink-0">
      {name.charAt(0)}
    </div>
  );
}

export default function SessionsReportPage() {
  const { isAdmin, can } = useAuth();
  const canSessions = isAdmin || can("settings.sessions");
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
    enabled: canSessions && (period !== "custom" || (!!from && !!to)),
  });

  if (!canSessions) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]" dir="rtl">
        <div className="text-center space-y-3">
          <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto">
            <Lock className="w-7 h-7 text-muted-foreground" />
          </div>
          <p className="font-bold text-foreground">للمدير فقط</p>
          <p className="text-xs text-muted-foreground">ليس لديك صلاحية لعرض هذا التقرير</p>
        </div>
      </div>
    );
  }

  const totalSessions = data?.summary.reduce((s, u) => s + u.totalSessions, 0) ?? 0;
  const totalDuration = data?.summary.reduce((s, u) => s + u.totalDuration, 0) ?? 0;
  const activeUsers   = data?.summary.filter(u => u.totalSessions > 0).length ?? 0;

  return (
    <div className="space-y-5 p-4 md:p-6 max-w-5xl mx-auto" dir="rtl">

      {/* ── Header ── */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
          <Clock className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h1 className="text-xl font-black text-foreground">تقارير الدخول والخروج</h1>
          <p className="text-xs text-muted-foreground mt-0.5">تتبع جلسات المستخدمين وأوقات العمل</p>
        </div>
      </div>

      {/* ── Period Filter ── */}
      <div className="flex flex-wrap items-center gap-2">
        {PERIOD_TABS.map(p => (
          <button
            key={p.id}
            onClick={() => setPeriod(p.id)}
            className={`px-4 py-1.5 rounded-lg text-xs font-bold border transition-all ${
              period === p.id
                ? "bg-primary text-primary-foreground border-primary shadow-sm"
                : "border-border text-muted-foreground bg-card hover:border-primary/40 hover:text-foreground"
            }`}
          >
            {p.label}
          </button>
        ))}
        {period === "custom" && (
          <div className="flex items-center gap-2 mr-1">
            <input type="date" value={from} onChange={e => setFrom(e.target.value)}
              className="h-8 px-2 text-xs rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary" />
            <span className="text-xs text-muted-foreground">—</span>
            <input type="date" value={to} onChange={e => setTo(e.target.value)}
              className="h-8 px-2 text-xs rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary" />
          </div>
        )}
      </div>

      {/* ── KPI Cards ── */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { icon: Users,  value: activeUsers,              label: "مستخدم نشط",       color: "text-primary",      bg: "bg-primary/10",   border: "border-primary/20"   },
          { icon: LogIn,  value: totalSessions,            label: "إجمالي الجلسات",   color: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-50 dark:bg-emerald-900/20", border: "border-emerald-200 dark:border-emerald-800" },
          { icon: Timer,  value: formatDuration(totalDuration), label: "إجمالي وقت العمل", color: "text-amber-600 dark:text-amber-400",  bg: "bg-amber-50 dark:bg-amber-900/20",   border: "border-amber-200 dark:border-amber-800"   },
        ].map(({ icon: Icon, value, label, color, bg, border }) => (
          <Card key={label} className={`border ${border} ${bg}`}>
            <CardContent className="p-4 text-center space-y-1">
              <div className={`w-8 h-8 rounded-lg ${bg} border ${border} flex items-center justify-center mx-auto`}>
                <Icon className={`w-4 h-4 ${color}`} />
              </div>
              <p className={`text-2xl font-black ${color}`}>{value}</p>
              <p className="text-[10px] text-muted-foreground">{label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* ── Tabs ── */}
      <div className="flex gap-0 border-b border-border">
        {([
          { id: "summary" as const, label: "ملخص المستخدمين" },
          { id: "details" as const, label: "تفاصيل الجلسات"  },
        ]).map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className={`px-5 py-2.5 text-xs font-bold border-b-2 transition-colors ${
              activeTab === tab.id
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── Content ── */}
      {isLoading ? (
        <div className="space-y-2">
          {[1,2,3].map(i => (
            <div key={i} className="h-20 rounded-xl bg-muted/40 animate-pulse border border-border" />
          ))}
        </div>
      ) : !data ? (
        <div className="text-center text-muted-foreground py-16">
          <Clock className="w-10 h-10 mx-auto mb-3 opacity-20" />
          <p className="text-sm">لا توجد بيانات</p>
        </div>
      ) : activeTab === "summary" ? (

        /* ══ Summary Tab ══ */
        <div className="space-y-2">
          {data.summary.length === 0 ? (
            <div className="text-center text-muted-foreground py-16">
              <Users className="w-10 h-10 mx-auto mb-3 opacity-20" />
              <p className="text-sm">لا توجد جلسات في هذه الفترة</p>
            </div>
          ) : data.summary.map((u, i) => (
            <Card key={u.userId} className="border-border bg-card hover:bg-muted/10 transition-colors"
              style={{ animation: "rowFadeIn 0.3s ease both", animationDelay: `${i * 40}ms` }}>
              <CardContent className="p-4">
                <div className="flex items-center gap-3 flex-wrap">
                  <Avatar name={u.displayName} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-sm text-foreground">{u.displayName}</span>
                      <Badge variant="outline" className={`text-[10px] font-bold border ${ROLE_COLORS[u.role] ?? ""}`}>
                        {ROLE_LABELS[u.role] ?? u.role}
                      </Badge>
                    </div>
                    <p className="text-[11px] text-muted-foreground font-mono mt-0.5">{u.username}</p>
                  </div>
                  <div className="flex items-center gap-5 shrink-0 flex-wrap">
                    <div className="text-center">
                      <p className="text-lg font-black text-primary">{u.totalSessions}</p>
                      <p className="text-[10px] text-muted-foreground">جلسة</p>
                    </div>
                    <div className="text-center">
                      <p className="text-sm font-bold text-amber-600 dark:text-amber-400">{formatDuration(u.totalDuration)}</p>
                      <p className="text-[10px] text-muted-foreground">وقت العمل</p>
                    </div>
                    <div className="text-center hidden sm:block">
                      <p className="text-xs font-bold text-foreground">{formatDateTime(u.lastLogin)}</p>
                      <p className="text-[10px] text-muted-foreground">آخر دخول</p>
                    </div>
                    {u.lastIp && (
                      <div className="text-center hidden md:block">
                        <p className="text-[10px] font-mono text-muted-foreground">{u.lastIp}</p>
                        <p className="text-[10px] text-muted-foreground">آخر IP</p>
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

      ) : (

        /* ══ Details Tab ══ */
        <div className="space-y-2">
          {data.sessions.length === 0 ? (
            <div className="text-center text-muted-foreground py-16">
              <LogIn className="w-10 h-10 mx-auto mb-3 opacity-20" />
              <p className="text-sm">لا توجد جلسات في هذه الفترة</p>
            </div>
          ) : data.sessions.map((s, i) => (
            <div key={s.id}
              className="flex items-center gap-3 p-3.5 rounded-xl border border-border bg-card hover:bg-muted/10 transition-colors flex-wrap"
              style={{ animation: "rowFadeIn 0.3s ease both", animationDelay: `${i * 30}ms` }}
            >
              <Avatar name={s.displayName ?? "?"} />
              <div className="flex-1 min-w-0">
                <p className="font-bold text-sm text-foreground">{s.displayName ?? "—"}</p>
                <p className="text-[11px] text-muted-foreground font-mono">{s.username}</p>
              </div>
              <div className="flex items-center gap-4 shrink-0 flex-wrap">
                <div className="flex items-center gap-1.5">
                  <div className="w-6 h-6 rounded-md bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 flex items-center justify-center">
                    <LogIn className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-foreground">{formatDateTime(s.loginAt)}</p>
                    <p className="text-[10px] text-muted-foreground">دخول</p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-6 h-6 rounded-md bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 flex items-center justify-center">
                    <LogOut className="w-3 h-3 text-red-500 dark:text-red-400" />
                  </div>
                  <div>
                    <p className={`text-xs font-bold ${s.logoutAt ? "text-foreground" : "text-emerald-600 dark:text-emerald-400"}`}>
                      {s.logoutAt ? formatDateTime(s.logoutAt) : "داخل الآن"}
                    </p>
                    <p className="text-[10px] text-muted-foreground">خروج</p>
                  </div>
                </div>
                <div className="text-center">
                  <p className="text-xs font-bold text-amber-600 dark:text-amber-400">{formatDuration(s.duration)}</p>
                  <p className="text-[10px] text-muted-foreground">المدة</p>
                </div>
                {s.ipAddress && (
                  <div className="flex items-center gap-1 hidden sm:flex">
                    <Wifi className="w-3 h-3 text-muted-foreground" />
                    <p className="text-[10px] text-muted-foreground font-mono">{s.ipAddress}</p>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
