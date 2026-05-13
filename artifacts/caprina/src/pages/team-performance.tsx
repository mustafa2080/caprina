import { useState, useMemo, useRef, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  UserCheck, TrendingUp, TrendingDown, Package,
  Clock, Trophy, Zap, Star, Activity, ChevronDown, ChevronUp,
  Search, X, SlidersHorizontal, ArrowUpDown, CheckCircle2,
  XCircle, Hourglass, Flame, Filter,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { teamAnalyticsApi, type TeamMemberExtStats } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";

/* ─── helpers ──────────────────────────────────────────────────────────────── */
const fmt = (n: number) =>
  new Intl.NumberFormat("ar-EG", { style: "currency", currency: "EGP", maximumFractionDigits: 0 }).format(n);
const fmtNum = (n: number) => new Intl.NumberFormat("ar-EG").format(n);

const SOURCE_LABELS: Record<string, string> = {
  facebook: "فيسبوك", tiktok: "تيك توك", instagram: "إنستجرام",
  organic: "عضوي", whatsapp: "واتساب", other: "أخرى",
};
const SOURCE_COLORS: Record<string, string> = {
  facebook: "bg-blue-500", tiktok: "bg-pink-500", instagram: "bg-purple-500",
  organic: "bg-green-500", whatsapp: "bg-emerald-500", other: "bg-gray-400",
};
const SOURCE_TEXT: Record<string, string> = {
  facebook: "text-blue-600 dark:text-blue-400",
  tiktok: "text-pink-600 dark:text-pink-400",
  instagram: "text-purple-600 dark:text-purple-400",
  organic: "text-green-600 dark:text-green-400",
  whatsapp: "text-emerald-600 dark:text-emerald-400",
  other: "text-gray-500",
};

type SortKey = "score" | "profit" | "delivered" | "deliveryRate" | "returnRate" | "total" | "avgProcessingHours";
type SpeedFilter = "all" | "fast" | "medium" | "slow";
type PerformanceFilter = "all" | "top" | "mid" | "low";

/* ─── animated stat bar ────────────────────────────────────────────────────── */
function StatBar({ value, max, color, delay = 0 }: { value: number; max: number; color: string; delay?: number }) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.width = "0%";
    const t = setTimeout(() => {
      el.style.transition = `width 0.7s cubic-bezier(0.34,1.56,0.64,1) ${delay}ms`;
      el.style.width = `${pct}%`;
    }, 80);
    return () => clearTimeout(t);
  }, [pct, delay]);
  return (
    <div className="w-full bg-muted/30 rounded-full h-1.5 overflow-hidden">
      <div ref={ref} className={`h-full rounded-full ${color}`} style={{ width: "0%" }} />
    </div>
  );
}

/* ─── animated number ─────────────────────────────────────────────────────── */
function AnimNum({ value, format = fmtNum }: { value: number; format?: (n: number) => string }) {
  const [displayed, setDisplayed] = useState(0);
  useEffect(() => {
    let start: number | null = null;
    const from = 0;
    const to = value;
    const dur = 600;
    const step = (ts: number) => {
      if (!start) start = ts;
      const prog = Math.min((ts - start) / dur, 1);
      const ease = 1 - Math.pow(1 - prog, 3);
      setDisplayed(Math.round(from + (to - from) * ease));
      if (prog < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, [value]);
  return <>{format(displayed)}</>;
}

/* ─── speed badge ─────────────────────────────────────────────────────────── */
function SpeedBadge({ hours }: { hours: number | null }) {
  if (hours === null) return <span className="text-[9px] text-muted-foreground">—</span>;
  const label = hours <= 12 ? "سريع جداً" : hours <= 24 ? "سريع" : hours <= 48 ? "متوسط" : "بطيء";
  const cls = hours <= 12
    ? "border-emerald-500 text-emerald-700 dark:text-emerald-400"
    : hours <= 24 ? "border-blue-500 text-blue-700 dark:text-blue-400"
    : hours <= 48 ? "border-amber-500 text-amber-700 dark:text-amber-400"
    : "border-red-500 text-red-600 dark:text-red-400";
  return (
    <Badge variant="outline" className={`text-[9px] gap-0.5 ${cls}`}>
      <Zap className="w-2.5 h-2.5" />{label} ({hours}س)
    </Badge>
  );
}

/* ─── filter chip ─────────────────────────────────────────────────────────── */
function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`px-2.5 py-1 rounded-full text-[11px] font-medium border transition-all duration-200 whitespace-nowrap
        ${active
          ? "bg-primary text-primary-foreground border-primary shadow-sm scale-[1.03]"
          : "bg-muted/30 text-muted-foreground border-border/50 hover:border-primary/40 hover:text-foreground"
        }`}
    >
      {children}
    </button>
  );
}

/* ─── member card ─────────────────────────────────────────────────────────── */
function MemberCard({
  member, rank, maxScore, showProfit, expanded, onToggle, animDelay,
}: {
  member: TeamMemberExtStats; rank: number; maxScore: number;
  showProfit: boolean; expanded: boolean; onToggle: () => void; animDelay: number;
}) {
  const isTop = rank === 1;
  const rankColors = [
    "bg-yellow-500/20 text-yellow-600 dark:text-yellow-400 ring-1 ring-yellow-500/40",
    "bg-slate-300/20 text-slate-500 dark:text-slate-300 ring-1 ring-slate-400/30",
    "bg-orange-500/20 text-orange-700 dark:text-orange-400 ring-1 ring-orange-500/30",
  ];
  const rankCls = rank <= 3 ? rankColors[rank - 1] : "bg-muted/20 text-muted-foreground";

  return (
    <div
      className="animate-in fade-in slide-in-from-bottom-3 fill-mode-both"
      style={{ animationDelay: `${animDelay}ms`, animationDuration: "350ms" }}
    >
      <Card className={`border-border bg-card hover:shadow-md hover:-translate-y-0.5 transition-all duration-300
        ${isTop ? "border-yellow-600/40 shadow-yellow-500/5 shadow-sm" : ""}`}>
        <CardContent className="px-4 pt-4 pb-3 space-y-3">

          {/* ── header ── */}
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${rankCls}`}>
                {rank === 1 ? <Trophy className="w-4 h-4" /> : rank === 2 ? "②" : rank === 3 ? "③" : `${rank}`}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-bold truncate">{member.displayName}</p>
                {member.userName !== member.displayName && (
                  <p className="text-[10px] text-muted-foreground truncate">@{member.userName}</p>
                )}
              </div>
            </div>
            <div className="flex flex-col items-end gap-1 shrink-0">
              <Badge variant="secondary" className="text-[10px] gap-0.5 font-bold">
                <Star className="w-2.5 h-2.5 text-yellow-500" />
                {fmtNum(member.score)}
              </Badge>
              {showProfit && (
                <span className={`text-[10px] font-bold ${member.profit >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-500"}`}>
                  {fmt(member.profit)}
                </span>
              )}
            </div>
          </div>

          {/* ── score bar ── */}
          <StatBar value={member.score} max={Math.max(maxScore, 1)} color={isTop ? "bg-yellow-500" : "bg-primary/70"} delay={animDelay + 100} />

          {/* ── stats 4-col ── */}
          <div className="grid grid-cols-4 gap-1 text-center">
            {[
              { val: member.total, label: "إجمالي", cls: "bg-muted/20" },
              { val: member.delivered, label: "مُسلَّم", cls: "bg-emerald-100 dark:bg-emerald-900/20", textCls: "text-emerald-600 dark:text-emerald-400" },
              { val: member.returned, label: "مُرتجَع", cls: "bg-red-100 dark:bg-red-900/20", textCls: "text-red-600 dark:text-red-400" },
              { val: member.pending, label: "مؤجَّل", cls: "bg-amber-50 dark:bg-amber-900/20", textCls: "text-amber-700 dark:text-amber-400" },
            ].map(({ val, label, cls, textCls }) => (
              <div key={label} className={`${cls} rounded-lg p-1.5`}>
                <p className={`text-sm font-bold ${textCls ?? ""}`}>{fmtNum(val)}</p>
                <p className="text-[9px] text-muted-foreground">{label}</p>
              </div>
            ))}
          </div>

          {/* ── rates row ── */}
          <div className="flex items-center justify-between text-[10px] flex-wrap gap-1">
            <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-0.5">
              <CheckCircle2 className="w-3 h-3" /> تسليم <strong>{member.deliveryRate}%</strong>
            </span>
            <span className="text-red-500 flex items-center gap-0.5">
              <XCircle className="w-3 h-3" /> رجوع <strong>{member.returnRate}%</strong>
            </span>
            <SpeedBadge hours={member.avgProcessingHours} />
          </div>

          {/* ── expand toggle ── */}
          <button
            onClick={onToggle}
            className="w-full flex items-center justify-center gap-1 text-[10px] text-muted-foreground
              hover:text-foreground transition-colors py-0.5 rounded hover:bg-muted/20"
          >
            {expanded
              ? <><ChevronUp className="w-3 h-3" /> إخفاء التفاصيل</>
              : <><ChevronDown className="w-3 h-3" /> عرض التفاصيل</>
            }
          </button>

          {/* ── expanded details ── */}
          {expanded && (
            <div className="space-y-2.5 pt-2 border-t border-border/40 animate-in fade-in slide-in-from-top-1 duration-200">
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="flex items-center justify-between bg-muted/20 rounded px-2 py-1.5">
                  <span className="text-muted-foreground flex items-center gap-1"><Activity className="w-3 h-3" />طلبات/يوم</span>
                  <strong>{member.ordersPerDay}</strong>
                </div>
                <div className="flex items-center justify-between bg-muted/20 rounded px-2 py-1.5">
                  <span className="text-muted-foreground flex items-center gap-1"><Clock className="w-3 h-3" />وقت تسليم</span>
                  <strong>{member.avgProcessingHours !== null ? `${member.avgProcessingHours}س` : "—"}</strong>
                </div>
              </div>
              {Object.keys(member.sourceCounts).length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-[10px] text-muted-foreground font-medium">توزيع المصادر</p>
                  {Object.entries(member.sourceCounts).sort((a, b) => b[1] - a[1]).map(([src, cnt]) => (
                    <div key={src} className="flex items-center gap-2">
                      <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${SOURCE_COLORS[src] ?? "bg-gray-400"}`} />
                      <span className={`text-[10px] flex-1 ${SOURCE_TEXT[src] ?? "text-muted-foreground"}`}>
                        {SOURCE_LABELS[src] ?? src}
                      </span>
                      <span className="text-[10px] font-bold tabular-nums">{cnt}</span>
                      <div className="w-14 bg-muted/30 rounded-full h-1 overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${SOURCE_COLORS[src] ?? "bg-gray-400"}`}
                          style={{ width: `${Math.round((cnt / member.total) * 100)}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

/* ─── main page ───────────────────────────────────────────────────────────── */
export default function TeamPerformancePage() {
  const { canViewFinancials } = useAuth();

  /* date filters */
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  /* search */
  const [search, setSearch] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);

  /* advanced filters */
  const [showFilters, setShowFilters] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>("score");
  const [sortDir, setSortDir] = useState<"desc" | "asc">("desc");
  const [speedFilter, setSpeedFilter] = useState<SpeedFilter>("all");
  const [perfFilter, setPerfFilter] = useState<PerformanceFilter>("all");
  const [sourceFilter, setSourceFilter] = useState<string>("all");
  const [expandedId, setExpandedId] = useState<number | null>(null);

  /* data */
  const { data: members = [], isLoading } = useQuery({
    queryKey: ["team-performance-ext", dateFrom, dateTo],
    queryFn: () => teamAnalyticsApi.teamPerformanceExtended(dateFrom || undefined, dateTo || undefined),
  });

  const assignedMembers = members.filter(m => m.userId !== 0);
  const unassigned = members.find(m => m.userId === 0);
  const maxScore = Math.max(...assignedMembers.map(m => m.score), 0);

  /* available sources across all members */
  const allSources = useMemo(() => {
    const set = new Set<string>();
    assignedMembers.forEach(m => Object.keys(m.sourceCounts).forEach(s => set.add(s)));
    return Array.from(set);
  }, [assignedMembers]);

  /* active filter count badge */
  const activeFilterCount = [
    speedFilter !== "all", perfFilter !== "all", sourceFilter !== "all",
    sortKey !== "score",
  ].filter(Boolean).length;

  /* filtered + sorted list */
  const filtered = useMemo(() => {
    let list = [...assignedMembers];

    /* search */
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(m =>
        m.displayName.toLowerCase().includes(q) || m.userName.toLowerCase().includes(q)
      );
    }

    /* speed filter */
    if (speedFilter !== "all") {
      list = list.filter(m => {
        const h = m.avgProcessingHours;
        if (h === null) return speedFilter === "slow";
        if (speedFilter === "fast") return h <= 24;
        if (speedFilter === "medium") return h > 24 && h <= 48;
        if (speedFilter === "slow") return h > 48;
        return true;
      });
    }

    /* performance filter */
    if (perfFilter !== "all" && list.length > 0) {
      const rates = list.map(m => m.deliveryRate).sort((a, b) => a - b);
      const lo = rates[Math.floor(rates.length * 0.33)];
      const hi = rates[Math.floor(rates.length * 0.66)];
      list = list.filter(m => {
        if (perfFilter === "top") return m.deliveryRate >= hi;
        if (perfFilter === "mid") return m.deliveryRate >= lo && m.deliveryRate < hi;
        if (perfFilter === "low") return m.deliveryRate < lo;
        return true;
      });
    }

    /* source filter */
    if (sourceFilter !== "all") {
      list = list.filter(m => (m.sourceCounts[sourceFilter] ?? 0) > 0);
    }

    /* sort */
    list.sort((a, b) => {
      let av = a[sortKey as keyof TeamMemberExtStats] as number ?? 0;
      let bv = b[sortKey as keyof TeamMemberExtStats] as number ?? 0;
      return sortDir === "desc" ? bv - av : av - bv;
    });

    return list;
  }, [assignedMembers, search, speedFilter, perfFilter, sourceFilter, sortKey, sortDir]);

  /* summary totals from ALL assigned (not filtered) */
  const totalOrders = assignedMembers.reduce((s, m) => s + m.total, 0);
  const totalDelivered = assignedMembers.reduce((s, m) => s + m.delivered, 0);
  const totalReturned = assignedMembers.reduce((s, m) => s + m.returned, 0);
  const totalProfit = assignedMembers.reduce((s, m) => s + m.profit, 0);
  const avgDelivery = assignedMembers.length > 0
    ? Math.round(assignedMembers.reduce((s, m) => s + m.deliveryRate, 0) / assignedMembers.length) : 0;

  const resetFilters = () => {
    setSearch(""); setSortKey("score"); setSortDir("desc");
    setSpeedFilter("all"); setPerfFilter("all"); setSourceFilter("all");
  };

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(d => d === "desc" ? "asc" : "desc");
    else { setSortKey(key); setSortDir("desc"); }
  };

  return (
    <div className="space-y-4 animate-in fade-in duration-300">

      {/* ── header ── */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <UserCheck className="w-5 h-5 text-primary" />
            أداء الفريق
          </h1>
          <p className="text-muted-foreground text-xs mt-0.5">تتبع أداء كل موظف وأثره على الإيرادات</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="space-y-0.5">
            <Label className="text-[10px] text-muted-foreground">من</Label>
            <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="h-7 text-xs w-32" />
          </div>
          <div className="space-y-0.5">
            <Label className="text-[10px] text-muted-foreground">إلى</Label>
            <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="h-7 text-xs w-32" />
          </div>
          {(dateFrom || dateTo) && (
            <Button variant="ghost" size="sm" className="h-7 text-xs mt-4"
              onClick={() => { setDateFrom(""); setDateTo(""); }}>
              <X className="w-3 h-3" />
            </Button>
          )}
        </div>
      </div>

      {/* ── KPI summary row ── */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-2.5">
        {[
          { label: "إجمالي الطلبات", value: totalOrders, fmt: fmtNum, icon: Package, color: "text-primary", bg: "bg-primary/5", show: true },
          { label: "مُسلَّم", value: totalDelivered, fmt: fmtNum, icon: TrendingUp, color: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-500/5", show: true },
          { label: "مُرتجَع", value: totalReturned, fmt: fmtNum, icon: TrendingDown, color: "text-red-500", bg: "bg-red-500/5", show: true },
          { label: "متوسط تسليم", value: avgDelivery, fmt: (n: number) => `${n}%`, icon: Activity, color: "text-blue-600 dark:text-blue-400", bg: "bg-blue-500/5", show: true },
          { label: "إجمالي الربح", value: totalProfit, fmt, icon: Trophy, color: "text-yellow-600 dark:text-yellow-400", bg: "bg-yellow-500/5", show: canViewFinancials },
        ].filter(c => c.show).map((card, i) => (
          <Card key={card.label}
            className="border-border bg-card overflow-hidden animate-in fade-in slide-in-from-bottom-2 fill-mode-both"
            style={{ animationDelay: `${i * 60}ms`, animationDuration: "300ms" }}>
            <CardContent className={`px-4 py-3 flex items-center gap-3 ${card.bg}`}>
              <card.icon className={`w-4 h-4 shrink-0 ${card.color}`} />
              <div>
                <p className="text-base font-bold tabular-nums">
                  <AnimNum value={card.value} format={card.fmt} />
                </p>
                <p className="text-[10px] text-muted-foreground">{card.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* ── search + filter bar ── */}
      <div className="space-y-2.5">
        <div className="flex items-center gap-2">
          {/* search box */}
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
            <Input
              ref={searchRef}
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="ابحث عن موظف..."
              className="h-8 text-xs pr-8 pl-8"
            />
            {search && (
              <button onClick={() => setSearch("")}
                className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          {/* filters toggle */}
          <Button
            variant={showFilters ? "default" : "outline"}
            size="sm"
            className="h-8 text-xs gap-1.5 relative"
            onClick={() => setShowFilters(v => !v)}
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            فلاتر
            {activeFilterCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-primary text-primary-foreground
                text-[9px] flex items-center justify-center font-bold">
                {activeFilterCount}
              </span>
            )}
          </Button>

          {/* results count */}
          <span className="text-[11px] text-muted-foreground hidden sm:block">
            {filtered.length} / {assignedMembers.length} موظف
          </span>
        </div>

        {/* expanded filter panel */}
        {showFilters && (
          <div className="bg-muted/10 border border-border/50 rounded-xl p-3 space-y-3
            animate-in fade-in slide-in-from-top-2 duration-200">

            {/* Sort row */}
            <div className="space-y-1.5">
              <p className="text-[10px] text-muted-foreground font-medium flex items-center gap-1">
                <ArrowUpDown className="w-3 h-3" /> ترتيب حسب
              </p>
              <div className="flex flex-wrap gap-1.5">
                {([
                  ["score", "النقاط"], ["delivered", "مُسلَّم"], ["deliveryRate", "نسبة تسليم"],
                  ["returnRate", "نسبة رجوع"], ["total", "إجمالي"],
                  ...(canViewFinancials ? [["profit", "الربح"]] as [string, string][] : []),
                  ["avgProcessingHours", "سرعة التسليم"],
                ] as [SortKey, string][]).map(([key, label]) => (
                  <Chip key={key} active={sortKey === key} onClick={() => toggleSort(key)}>
                    {label}
                    {sortKey === key && (
                      <span className="mr-1">{sortDir === "desc" ? "↓" : "↑"}</span>
                    )}
                  </Chip>
                ))}
              </div>
            </div>

            {/* Speed filter */}
            <div className="space-y-1.5">
              <p className="text-[10px] text-muted-foreground font-medium flex items-center gap-1">
                <Zap className="w-3 h-3" /> سرعة التسليم
              </p>
              <div className="flex flex-wrap gap-1.5">
                {([["all", "الكل"], ["fast", "سريع (≤24س)"], ["medium", "متوسط (24-48س)"], ["slow", "بطيء (>48س)"]] as [SpeedFilter, string][])
                  .map(([key, label]) => (
                    <Chip key={key} active={speedFilter === key} onClick={() => setSpeedFilter(key)}>{label}</Chip>
                  ))}
              </div>
            </div>

            {/* Performance filter */}
            <div className="space-y-1.5">
              <p className="text-[10px] text-muted-foreground font-medium flex items-center gap-1">
                <Flame className="w-3 h-3" /> مستوى الأداء
              </p>
              <div className="flex flex-wrap gap-1.5">
                {([["all", "الكل"], ["top", "🔥 متميز"], ["mid", "👍 متوسط"], ["low", "⚠️ يحتاج تحسين"]] as [PerformanceFilter, string][])
                  .map(([key, label]) => (
                    <Chip key={key} active={perfFilter === key} onClick={() => setPerfFilter(key)}>{label}</Chip>
                  ))}
              </div>
            </div>

            {/* Source filter */}
            {allSources.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-[10px] text-muted-foreground font-medium flex items-center gap-1">
                  <Filter className="w-3 h-3" /> المصدر
                </p>
                <div className="flex flex-wrap gap-1.5">
                  <Chip active={sourceFilter === "all"} onClick={() => setSourceFilter("all")}>الكل</Chip>
                  {allSources.map(src => (
                    <Chip key={src} active={sourceFilter === src} onClick={() => setSourceFilter(src)}>
                      {SOURCE_LABELS[src] ?? src}
                    </Chip>
                  ))}
                </div>
              </div>
            )}

            {/* Reset */}
            {activeFilterCount > 0 && (
              <div className="pt-1">
                <Button variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground gap-1" onClick={resetFilters}>
                  <X className="w-3 h-3" /> مسح الفلاتر
                </Button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── score legend ── */}
      <div className="flex items-center gap-1.5 flex-wrap text-[10px] text-muted-foreground px-1">
        <Star className="w-3 h-3 text-yellow-500 shrink-0" />
        <span><strong>النقاط:</strong> تسليم +3 · سرعة 24س +2 · ربح/100جـ +1</span>
        <span className="text-red-500">· مرتجع −1</span>
      </div>

      {/* ── loading ── */}
      {isLoading && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => (
            <Card key={i} className="border-border bg-card">
              <CardContent className="px-4 py-4 space-y-3 animate-pulse">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-muted" />
                  <div className="space-y-1.5 flex-1">
                    <div className="h-3 bg-muted rounded w-32" />
                    <div className="h-2 bg-muted rounded w-20" />
                  </div>
                </div>
                <div className="h-1.5 bg-muted rounded-full" />
                <div className="grid grid-cols-4 gap-1">
                  {[1, 2, 3, 4].map(j => <div key={j} className="h-10 bg-muted rounded-lg" />)}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* ── empty state ── */}
      {!isLoading && filtered.length === 0 && (
        <div className="text-center py-16 text-muted-foreground animate-in fade-in duration-300">
          {search || activeFilterCount > 0 ? (
            <>
              <Search className="w-10 h-10 mx-auto mb-3 opacity-20" />
              <p className="text-sm">لا توجد نتائج مطابقة للفلاتر المحددة</p>
              <Button variant="ghost" size="sm" className="mt-3 text-xs" onClick={resetFilters}>
                مسح الفلاتر
              </Button>
            </>
          ) : (
            <>
              <UserCheck className="w-10 h-10 mx-auto mb-3 opacity-20" />
              <p className="text-sm">لم يتم إسناد طلبات لأعضاء الفريق بعد</p>
            </>
          )}
        </div>
      )}

      {/* ── cards grid ── */}
      {!isLoading && filtered.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((m, i) => (
            <MemberCard
              key={m.userId}
              member={m}
              rank={assignedMembers.indexOf(m) + 1}
              maxScore={maxScore}
              showProfit={canViewFinancials}
              expanded={expandedId === m.userId}
              onToggle={() => setExpandedId(expandedId === m.userId ? null : m.userId)}
              animDelay={i * 50}
            />
          ))}
        </div>
      )}

      {/* ── unassigned orders ── */}
      {unassigned && unassigned.total > 0 && (
        <Card className="border-dashed border-border/50 bg-muted/10 animate-in fade-in duration-500">
          <CardContent className="px-4 py-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <Hourglass className="w-4 h-4 text-muted-foreground" />
                <div>
                  <p className="text-xs font-bold text-muted-foreground">طلبات غير مُسنَدة</p>
                  <p className="text-[10px] text-muted-foreground">{fmtNum(unassigned.total)} طلب لم يُسند لأي موظف</p>
                </div>
              </div>
              <div className="flex items-center gap-3 text-xs flex-wrap">
                <span className="text-emerald-600 dark:text-emerald-400">{fmtNum(unassigned.delivered)} مسلَّم</span>
                <span className="text-red-500">{fmtNum(unassigned.returned)} مرتجع</span>
                <span className="text-amber-600 dark:text-amber-400">{fmtNum(unassigned.pending)} مؤجَّل</span>
                {canViewFinancials && (
                  <Badge variant="outline"
                    className={`text-[10px] ${unassigned.profit >= 0
                      ? "text-emerald-700 dark:text-emerald-400 border-emerald-500"
                      : "text-red-600 border-red-500"}`}>
                    {fmt(unassigned.profit)}
                  </Badge>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}