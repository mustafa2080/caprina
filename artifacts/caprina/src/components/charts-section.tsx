import React from "react";
import { useQuery } from "@tanstack/react-query";
import { analyticsApi, type ChartsData } from "@/lib/api";
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from "recharts";

// ─── Configs ────────────────────────────────────────────────────────────────
const STATUS_CFG: Record<string, { label: string; from: string; to: string; bg: string }> = {
  received:         { label: "مُسلَّم",       from: "#22c55e", to: "#15803d", bg: "rgba(34,197,94,0.12)"  },
  returned:         { label: "مرتجع",         from: "#f87171", to: "#b91c1c", bg: "rgba(248,113,113,0.12)" },
  pending:          { label: "قيد الانتظار",  from: "#fbbf24", to: "#b45309", bg: "rgba(251,191,36,0.12)"  },
  in_shipping:      { label: "قيد الشحن",     from: "#38bdf8", to: "#0369a1", bg: "rgba(56,189,248,0.12)"  },
  delayed:          { label: "مؤجل",          from: "#818cf8", to: "#4338ca", bg: "rgba(129,140,248,0.12)" },
  partial_received: { label: "استلم جزئي",    from: "#c084fc", to: "#7e22ce", bg: "rgba(192,132,252,0.12)" },
  cancelled:        { label: "ملغي",          from: "#9ca3af", to: "#374151", bg: "rgba(156,163,175,0.12)" },
};

const SOURCE_CFG: Record<string, { label: string; emoji: string; from: string; to: string }> = {
  facebook:  { label: "فيسبوك",   emoji: "📘", from: "#60a5fa", to: "#1d4ed8" },
  tiktok:    { label: "تيك توك",  emoji: "🎵", from: "#f472b6", to: "#be185d" },
  instagram: { label: "إنستجرام", emoji: "📷", from: "#fb923c", to: "#c2410c" },
  whatsapp:  { label: "واتساب",   emoji: "💬", from: "#4ade80", to: "#15803d" },
  organic:   { label: "عضوي",     emoji: "🌱", from: "#34d399", to: "#065f46" },
  other:     { label: "أخرى",     emoji: "📌", from: "#a78bfa", to: "#5b21b6" },
};

const BAR_COLORS = [
  { from: "#fbbf24", to: "#d97706" },
  { from: "#fb923c", to: "#c2410c" },
  { from: "#a78bfa", to: "#7c3aed" },
  { from: "#38bdf8", to: "#0369a1" },
  { from: "#4ade80", to: "#15803d" },
  { from: "#f472b6", to: "#be185d" },
  { from: "#fb923c", to: "#92400e" },
];

const fc = (n: number) =>
  new Intl.NumberFormat("ar-EG", { style: "currency", currency: "EGP", maximumFractionDigits: 0 }).format(n);
const gid = (p: string, k: string) => `${p}_${k.replace(/[^a-z0-9]/gi, "_")}`;

// ─── KPI Cards Strip ────────────────────────────────────────────────────────
function KpiStrip({ data, total }: { data: ChartsData["statusBreakdown"]; total: number }) {
  const sorted = [...data].sort((a, b) => b.count - a.count);
  return (
    <div className="flex gap-2.5 overflow-x-auto pb-1 no-scrollbar">
      {/* Total */}
      <div
        className="flex-none rounded-xl px-4 py-3 min-w-[90px] text-center"
        style={{ background: "linear-gradient(135deg,#f59e0b22,#d9770622)", border: "1px solid #f59e0b44" }}
      >
        <p className="text-2xl font-black text-amber-400 leading-none">{total}</p>
        <p className="text-[10px] text-amber-400/70 mt-0.5 font-semibold">إجمالي</p>
      </div>

      {sorted.map(item => {
        const cfg = STATUS_CFG[item.status];
        return (
          <div
            key={item.status}
            className="flex-none rounded-xl px-3.5 py-3 min-w-[82px] text-center"
            style={{ background: cfg?.bg ?? "rgba(128,128,128,0.1)", border: `1px solid ${cfg?.from ?? "#888"}44` }}
          >
            <p className="text-xl font-black leading-none" style={{ color: cfg?.from ?? "#888" }}>{item.count}</p>
            <p className="text-[10px] mt-0.5 font-bold" style={{ color: cfg?.from ?? "#888" }}>{item.pct}%</p>
            <p className="text-[9px] text-muted-foreground mt-0.5 leading-tight">{cfg?.label ?? item.status}</p>
          </div>
        );
      })}
    </div>
  );
}

// ─── Tooltips ───────────────────────────────────────────────────────────────
function StatusTip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  const cfg = STATUS_CFG[d.status];
  return (
    <div className="bg-zinc-900/95 backdrop-blur border border-white/10 rounded-xl shadow-2xl px-3 py-2 text-xs">
      <div className="flex items-center gap-1.5 mb-0.5">
        <span className="w-2 h-2 rounded-full" style={{ background: cfg?.from }} />
        <p className="font-bold text-white">{cfg?.label ?? d.status}</p>
      </div>
      <p className="text-zinc-400">{d.count} طلب • {d.pct}%</p>
    </div>
  );
}

function BarTip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-zinc-900/95 backdrop-blur border border-white/10 rounded-xl shadow-2xl px-3 py-2 text-xs">
      <p className="font-bold text-white mb-0.5">{label}</p>
      <p className="text-amber-300">{payload[0]?.value} طلب</p>
      {payload[1]?.value > 0 && <p className="text-emerald-400">{fc(payload[1].value)}</p>}
    </div>
  );
}

function SourceTip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  const cfg = SOURCE_CFG[d.source];
  return (
    <div className="bg-zinc-900/95 backdrop-blur border border-white/10 rounded-xl shadow-2xl px-3 py-2 text-xs">
      <div className="flex items-center gap-1.5 mb-0.5">
        <span className="w-2 h-2 rounded-full" style={{ background: cfg?.from }} />
        <p className="font-bold text-white">{cfg?.emoji} {cfg?.label ?? d.source}</p>
      </div>
      <p className="text-zinc-400">{d.count} طلب • {d.pct}%</p>
    </div>
  );
}

// ─── 3D Donut Chart ─────────────────────────────────────────────────────────
function Donut3D({ data, total }: { data: ChartsData["statusBreakdown"]; total: number }) {
  if (!data.length) return (
    <div className="flex items-center justify-center h-36 text-muted-foreground text-xs">لا توجد بيانات</div>
  );

  return (
    <div>
      {/* 3D disc */}
      <div className="relative" style={{ height: 190 }}>
        {/* Ellipse shadow */}
        <div className="absolute left-1/2 -translate-x-1/2" style={{
          bottom: 2, width: 160, height: 20,
          background: "radial-gradient(ellipse, rgba(0,0,0,0.45) 0%, transparent 72%)",
          filter: "blur(5px)",
        }} />

        {/* Tilted chart */}
        <div style={{
          transform: "perspective(380px) rotateX(44deg)",
          transformOrigin: "center bottom",
          width: "100%", height: 230, marginTop: -24,
        }}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
              <defs>
                {data.map(d => {
                  const cfg = STATUS_CFG[d.status];
                  return (
                    <radialGradient key={gid("d", d.status)} id={gid("d", d.status)} cx="30%" cy="30%" r="70%">
                      <stop offset="0%" stopColor={cfg?.from ?? "#888"} stopOpacity={1} />
                      <stop offset="100%" stopColor={cfg?.to ?? "#444"} stopOpacity={0.85} />
                    </radialGradient>
                  );
                })}
                <filter id="dshadow">
                  <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="#000" floodOpacity="0.5" />
                </filter>
              </defs>
              <Pie
                data={data}
                cx="50%" cy="52%"
                innerRadius="42%" outerRadius="70%"
                paddingAngle={2}
                dataKey="count"
                stroke="none"
                filter="url(#dshadow)"
                startAngle={90} endAngle={-270}
                isAnimationActive
              >
                {data.map((d, i) => (
                  <Cell key={i} fill={`url(#${gid("d", d.status)})`} />
                ))}
              </Pie>
              <Tooltip content={<StatusTip />} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Center text */}
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none" style={{ paddingBottom: 18 }}>
          <p className="text-3xl font-black text-foreground leading-none">{total}</p>
          <p className="text-[10px] text-muted-foreground">طلب</p>
        </div>
      </div>

      {/* Legend with progress bars */}
      <div className="mt-3 space-y-2.5">
        {[...data].sort((a, b) => b.count - a.count).map(item => {
          const cfg = STATUS_CFG[item.status];
          return (
            <div key={item.status}>
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: cfg?.from }} />
                  <span className="text-[11px] font-semibold text-foreground">{cfg?.label ?? item.status}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-muted-foreground">{item.count}</span>
                  <span className="text-[11px] font-black min-w-[28px] text-right" style={{ color: cfg?.from }}>{item.pct}%</span>
                </div>
              </div>
              {/* Progress bar */}
              <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{
                    width: `${item.pct}%`,
                    background: `linear-gradient(90deg, ${cfg?.from ?? "#888"}, ${cfg?.to ?? "#444"})`,
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── 3D Bar Shape ───────────────────────────────────────────────────────────
function Bar3DShape(props: any) {
  const { x, y, width, height, index } = props;
  if (!height || height <= 0) return null;
  const cfg = BAR_COLORS[index % BAR_COLORS.length];
  const g = `bar3d_${index}`;
  const topH = Math.max(3, width * 0.2);
  const sideW = Math.max(2, width * 0.14);

  return (
    <g>
      <defs>
        <linearGradient id={`${g}f`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={cfg.from} />
          <stop offset="100%" stopColor={cfg.to} />
        </linearGradient>
        <linearGradient id={`${g}s`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor={cfg.to} stopOpacity={0.8} />
          <stop offset="100%" stopColor={cfg.to} stopOpacity={0.5} />
        </linearGradient>
        <linearGradient id={`${g}t`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={cfg.from} stopOpacity={0.9} />
          <stop offset="100%" stopColor={cfg.from} stopOpacity={0.6} />
        </linearGradient>
      </defs>
      {/* Front */}
      <rect x={x} y={y} width={width} height={height} fill={`url(#${g}f)`} rx={2} />
      {/* Side */}
      <polygon
        points={`${x+width},${y} ${x+width+sideW},${y-topH} ${x+width+sideW},${y-topH+height} ${x+width},${y+height}`}
        fill={`url(#${g}s)`}
      />
      {/* Top */}
      <polygon
        points={`${x},${y} ${x+sideW},${y-topH} ${x+width+sideW},${y-topH} ${x+width},${y}`}
        fill={`url(#${g}t)`}
      />
      {/* Shine */}
      <rect x={x+2} y={y+2} width={width*0.3} height={height*0.2} fill="white" opacity={0.1} rx={1} />
    </g>
  );
}

// ─── 3D Bar Chart ────────────────────────────────────────────────────────────
function WeeklyBar3D({ data }: { data: ChartsData["weeklySales"] }) {
  const hasData = data.some(d => d.orders > 0);
  const total = data.reduce((s, d) => s + d.orders, 0);
  const peak = data.reduce((a, b) => b.orders > a.orders ? b : a, data[0]);
  const revenue = data.reduce((s, d) => s + d.revenue, 0);
  const avg = (total / 7).toFixed(1);

  return (
    <div className="space-y-3">
      {/* Summary KPIs */}
      <div className="grid grid-cols-4 gap-2">
        <MiniStat label="7 أيام" value={String(total)} color="#fbbf24" />
        <MiniStat label="ذروة" value={peak.label} color="#22c55e" />
        <MiniStat label="متوسط" value={avg} color="#38bdf8" />
        <MiniStat label="إيرادات" value={fc(revenue)} color="#c084fc" tiny />
      </div>

      {/* Bar chart */}
      {hasData ? (
        <div style={{ height: 200 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 14, right: 18, left: -18, bottom: 0 }} barCategoryGap="25%">
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(128,128,128,0.1)" vertical={false} />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))", fontWeight: 600 }}
                axisLine={false} tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }}
                axisLine={false} tickLine={false} allowDecimals={false}
              />
              <Tooltip content={<BarTip />} cursor={{ fill: "rgba(255,255,255,0.03)" }} />
              <Bar dataKey="orders" shape={<Bar3DShape />} maxBarSize={38} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center h-40 text-muted-foreground">
          <div className="text-4xl mb-2 opacity-20">📊</div>
          <p className="text-xs">لا طلبات في آخر 7 أيام</p>
        </div>
      )}

      {/* Day breakdown mini table */}
      <div className="grid grid-cols-7 gap-0.5 pt-2 border-t border-border/40">
        {data.map((d, i) => (
          <div key={i} className="text-center">
            <div
              className="mx-auto mb-1 rounded-sm"
              style={{
                width: "100%", height: 3,
                background: d.orders > 0
                  ? `linear-gradient(90deg, ${BAR_COLORS[i].from}, ${BAR_COLORS[i].to})`
                  : "hsl(var(--border))",
              }}
            />
            <p className="text-[9px] font-bold text-foreground">{d.orders}</p>
            <p className="text-[8px] text-muted-foreground leading-tight">{d.label.slice(0, 3)}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function MiniStat({ label, value, color, tiny }: { label: string; value: string; color: string; tiny?: boolean }) {
  return (
    <div
      className="rounded-lg px-2 py-2 text-center"
      style={{ background: `${color}12`, border: `1px solid ${color}30` }}
    >
      <p className={`font-black leading-none ${tiny ? "text-[9px]" : "text-sm"}`} style={{ color }}>{value}</p>
      <p className="text-[8px] text-muted-foreground mt-0.5">{label}</p>
    </div>
  );
}

// ─── 3D Pie (Ad Sources) ────────────────────────────────────────────────────
function AdSourcePie3D({ data }: { data: ChartsData["adSourceBreakdown"] }) {
  const filtered = data.filter(d => d.count > 0);

  if (!filtered.length) {
    return (
      <div className="flex flex-col items-center justify-center py-6 text-center">
        <div
          className="w-16 h-16 rounded-2xl mb-3 flex items-center justify-center text-2xl"
          style={{ background: "rgba(96,165,250,0.1)", border: "1px solid rgba(96,165,250,0.2)" }}
        >📡</div>
        <p className="text-sm font-bold text-foreground mb-1">لا توجد بيانات</p>
        <p className="text-xs text-muted-foreground">أضف مصدر الإعلان (adSource) عند إنشاء الطلبات</p>
        <div className="mt-3 flex flex-wrap gap-1.5 justify-center">
          {Object.entries(SOURCE_CFG).map(([k, v]) => (
            <span
              key={k}
              className="text-[10px] px-2 py-1 rounded-full font-medium"
              style={{ background: `${v.from}18`, color: v.from, border: `1px solid ${v.from}33` }}
            >{v.emoji} {v.label}</span>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* 3D Pie */}
      <div className="relative" style={{ height: 175 }}>
        <div className="absolute left-1/2 -translate-x-1/2" style={{
          bottom: 2, width: 140, height: 18,
          background: "radial-gradient(ellipse, rgba(0,0,0,0.4) 0%, transparent 72%)",
          filter: "blur(5px)",
        }} />
        <div style={{
          transform: "perspective(350px) rotateX(42deg)",
          transformOrigin: "center bottom",
          width: "100%", height: 210, marginTop: -22,
        }}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
              <defs>
                {filtered.map(d => {
                  const cfg = SOURCE_CFG[d.source];
                  return (
                    <radialGradient key={gid("s", d.source)} id={gid("s", d.source)} cx="30%" cy="30%" r="70%">
                      <stop offset="0%" stopColor={cfg?.from ?? "#888"} />
                      <stop offset="100%" stopColor={cfg?.to ?? "#444"} />
                    </radialGradient>
                  );
                })}
                <filter id="pshadow">
                  <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="#000" floodOpacity="0.45" />
                </filter>
              </defs>
              <Pie
                data={filtered}
                cx="50%" cy="52%"
                outerRadius="68%"
                paddingAngle={2}
                dataKey="count"
                stroke="none"
                filter="url(#pshadow)"
                startAngle={90} endAngle={-270}
                isAnimationActive
              >
                {filtered.map((d, i) => (
                  <Cell key={i} fill={`url(#${gid("s", d.source)})`} />
                ))}
              </Pie>
              <Tooltip content={<SourceTip />} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Legend */}
      <div className="mt-3 space-y-2">
        {filtered.map(item => {
          const cfg = SOURCE_CFG[item.source] ?? { label: item.source, emoji: "📌", from: "#888", to: "#444" };
          return (
            <div key={item.source}>
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: cfg.from }} />
                  <span className="text-[11px] font-semibold text-foreground">{cfg.emoji} {cfg.label}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-muted-foreground">{item.count}</span>
                  <span className="text-[11px] font-black min-w-[28px] text-right" style={{ color: cfg.from }}>{item.pct}%</span>
                </div>
              </div>
              <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{ width: `${item.pct}%`, background: `linear-gradient(90deg, ${cfg.from}, ${cfg.to})` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Section Card ────────────────────────────────────────────────────────────
function SectionCard({
  title, subtitle, children, accent,
}: {
  title: string; subtitle: string; children: React.ReactNode; accent: string;
}) {
  return (
    <div
      className="rounded-2xl overflow-hidden border border-border/60"
      style={{
        background: "hsl(var(--card))",
        boxShadow: "0 2px 16px -4px rgba(0,0,0,0.12), 0 0 0 1px rgba(255,255,255,0.04) inset",
      }}
    >
      {/* Accent top bar */}
      <div className="h-[2px]" style={{ background: accent }} />
      {/* Header */}
      <div className="px-4 py-3 border-b border-border/40">
        <p className="text-sm font-bold text-foreground">{title}</p>
        <p className="text-[10px] text-muted-foreground mt-0.5">{subtitle}</p>
      </div>
      {/* Body */}
      <div className="p-4">{children}</div>
    </div>
  );
}

// ─── Main Analytics Section ───────────────────────────────────────────────────
export function ChartsSection() {
  const { data, isLoading, dataUpdatedAt } = useQuery({
    queryKey: ["analytics-charts"],
    queryFn: analyticsApi.charts,
    staleTime: 30000,
    refetchInterval: 60000,
  });

  const lastUpdate = dataUpdatedAt
    ? new Date(dataUpdatedAt).toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" })
    : null;

  // ── Loading skeleton ───────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="space-y-3">
        <div className="flex gap-2">
          {[1,2,3,4,5].map(i => (
            <div key={i} className="flex-none h-16 w-20 rounded-xl bg-muted animate-pulse" />
          ))}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1,2,3].map(i => (
            <div key={i} className="h-80 rounded-2xl bg-muted animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="space-y-4">
      {/* ── Section Header ──────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div
            className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: "linear-gradient(135deg,#f59e0b33,#d9770622)", border: "1px solid #f59e0b44" }}
          >
            <svg viewBox="0 0 16 16" fill="none" className="w-4 h-4">
              <rect x="1" y="8" width="3" height="7" fill="#f59e0b" rx="0.5" />
              <rect x="6" y="4" width="3" height="11" fill="#f97316" rx="0.5" />
              <rect x="11" y="1" width="3" height="14" fill="#a78bfa" rx="0.5" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-bold text-foreground">مركز التحليلات البصرية</p>
            <p className="text-[10px] text-muted-foreground">ANALYTICS CENTER</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {lastUpdate && (
            <span className="text-[10px] text-muted-foreground hidden sm:block">
              آخر تحديث {lastUpdate}
            </span>
          )}
          <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            مباشر
          </span>
        </div>
      </div>

      {/* ── KPI Strip ───────────────────────────────────────────────────── */}
      <KpiStrip data={data.statusBreakdown} total={data.total} />

      {/* ── Charts Grid ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* 1 — Donut */}
        <SectionCard
          title="توزيع حالات الطلبات"
          subtitle="Order Status Breakdown"
          accent="linear-gradient(90deg,#22c55e,#0ea5e9)"
        >
          <Donut3D data={data.statusBreakdown} total={data.total} />
        </SectionCard>

        {/* 2 — Bar */}
        <SectionCard
          title="أداء المبيعات الأسبوعي"
          subtitle="Weekly Sales Performance"
          accent="linear-gradient(90deg,#fbbf24,#f97316)"
        >
          <WeeklyBar3D data={data.weeklySales} />
        </SectionCard>

        {/* 3 — Pie */}
        <SectionCard
          title="مصادر الطلبات"
          subtitle="Ad Attribution Sources"
          accent="linear-gradient(90deg,#60a5fa,#f472b6)"
        >
          <AdSourcePie3D data={data.adSourceBreakdown} />
        </SectionCard>
      </div>
    </div>
  );
}
