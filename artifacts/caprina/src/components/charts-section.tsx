import { useQuery } from "@tanstack/react-query";
import { analyticsApi, type ChartsData } from "@/lib/api";
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from "recharts";
import React from "react";

// ─── Status config ─────────────────────────────────────────────────────────
const STATUS_CONFIG: Record<string, { label: string; from: string; to: string }> = {
  received:         { label: "مُسلَّم",       from: "#22c55e", to: "#15803d" },
  returned:         { label: "مرتجع",         from: "#f87171", to: "#b91c1c" },
  pending:          { label: "قيد الانتظار",  from: "#fbbf24", to: "#b45309" },
  in_shipping:      { label: "قيد الشحن",     from: "#38bdf8", to: "#0369a1" },
  delayed:          { label: "مؤجل",          from: "#818cf8", to: "#4338ca" },
  partial_received: { label: "استلم جزئي",    from: "#c084fc", to: "#7e22ce" },
  cancelled:        { label: "ملغي",          from: "#9ca3af", to: "#374151" },
};

const SOURCE_CONFIG: Record<string, { label: string; emoji: string; from: string; to: string }> = {
  facebook:  { label: "فيسبوك",   emoji: "📘", from: "#60a5fa", to: "#1d4ed8" },
  tiktok:    { label: "تيك توك",  emoji: "🎵", from: "#f472b6", to: "#be185d" },
  instagram: { label: "إنستجرام", emoji: "📷", from: "#fb923c", to: "#c2410c" },
  whatsapp:  { label: "واتساب",   emoji: "💬", from: "#4ade80", to: "#15803d" },
  organic:   { label: "عضوي",     emoji: "🌱", from: "#34d399", to: "#065f46" },
  other:     { label: "أخرى",     emoji: "📌", from: "#a78bfa", to: "#5b21b6" },
};

const DAY_COLORS = [
  { from: "#fbbf24", to: "#d97706" },
  { from: "#f97316", to: "#c2410c" },
  { from: "#a78bfa", to: "#7c3aed" },
  { from: "#38bdf8", to: "#0369a1" },
  { from: "#4ade80", to: "#15803d" },
  { from: "#f472b6", to: "#be185d" },
  { from: "#fb923c", to: "#c2410c" },
];

const fc = (n: number) =>
  new Intl.NumberFormat("ar-EG", { style: "currency", currency: "EGP", maximumFractionDigits: 0 }).format(n);

// ─── Gradient ID helpers ───────────────────────────────────────────────────
function gradId(prefix: string, key: string) {
  return `${prefix}_${key.replace(/[^a-z0-9]/gi, "_")}`;
}

// ─── Custom 3D Bar Shape ───────────────────────────────────────────────────
function Bar3DShape(props: any) {
  const { x, y, width, height, index } = props;
  if (!height || height <= 0) return null;
  const cfg = DAY_COLORS[index % DAY_COLORS.length];
  const gid = `dayBar_${index}`;
  const topH = Math.max(4, width * 0.22);
  const sideW = Math.max(3, width * 0.15);

  return (
    <g>
      <defs>
        <linearGradient id={gid + "_front"} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={cfg.from} />
          <stop offset="100%" stopColor={cfg.to} />
        </linearGradient>
        <linearGradient id={gid + "_side"} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor={cfg.to} stopOpacity={0.9} />
          <stop offset="100%" stopColor={cfg.to} stopOpacity={0.6} />
        </linearGradient>
        <linearGradient id={gid + "_top"} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={cfg.from} stopOpacity={0.95} />
          <stop offset="100%" stopColor={cfg.from} stopOpacity={0.75} />
        </linearGradient>
      </defs>

      {/* Front face */}
      <rect x={x} y={y} width={width} height={height} fill={`url(#${gid}_front)`} rx={2} />

      {/* Right side face */}
      <polygon
        points={`
          ${x + width},${y}
          ${x + width + sideW},${y - topH}
          ${x + width + sideW},${y - topH + height}
          ${x + width},${y + height}
        `}
        fill={`url(#${gid}_side)`}
      />

      {/* Top face */}
      <polygon
        points={`
          ${x},${y}
          ${x + sideW},${y - topH}
          ${x + width + sideW},${y - topH}
          ${x + width},${y}
        `}
        fill={`url(#${gid}_top)`}
      />

      {/* Shine overlay */}
      <rect
        x={x + 2} y={y + 2}
        width={width * 0.35} height={height * 0.25}
        fill="white" opacity={0.12} rx={1}
      />
    </g>
  );
}

// ─── Custom Tooltip ─────────────────────────────────────────────────────────
function StatusTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  const cfg = STATUS_CONFIG[d.status];
  return (
    <div className="bg-zinc-900 border border-white/10 rounded-xl shadow-2xl px-3 py-2 text-xs">
      <p className="font-bold text-white">{cfg?.label ?? d.status}</p>
      <p className="text-zinc-400">{d.count} طلب — {d.pct}%</p>
    </div>
  );
}
function BarTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-zinc-900 border border-white/10 rounded-xl shadow-2xl px-3 py-2 text-xs space-y-1">
      <p className="font-bold text-white">{label}</p>
      <p className="text-amber-300">{payload[0]?.value} طلب</p>
    </div>
  );
}
function SourceTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  const cfg = SOURCE_CONFIG[d.source];
  return (
    <div className="bg-zinc-900 border border-white/10 rounded-xl shadow-2xl px-3 py-2 text-xs">
      <p className="font-bold text-white">{cfg?.emoji} {cfg?.label ?? d.source}</p>
      <p className="text-zinc-400">{d.count} طلب — {d.pct}%</p>
    </div>
  );
}

// ─── 3D Donut Chart ─────────────────────────────────────────────────────────
function Donut3D({ data, total }: { data: ChartsData["statusBreakdown"]; total: number }) {
  const chartData = data.map(d => ({ ...d }));
  if (!chartData.length) return (
    <div className="flex items-center justify-center h-48 text-zinc-500 text-xs">لا توجد بيانات</div>
  );

  return (
    <div className="space-y-4">
      {/* 3D Perspective Wrapper */}
      <div className="relative flex justify-center" style={{ height: 180 }}>
        {/* Drop shadow for 3D depth */}
        <div
          className="absolute bottom-0 left-1/2 -translate-x-1/2"
          style={{
            width: 160, height: 28,
            background: "radial-gradient(ellipse, rgba(0,0,0,0.55) 0%, transparent 75%)",
            filter: "blur(6px)",
            transform: "translateY(4px)",
          }}
        />
        {/* Chart with perspective tilt */}
        <div
          style={{
            transform: "perspective(420px) rotateX(42deg)",
            transformOrigin: "center bottom",
            width: "100%", height: 220,
            marginTop: -20,
          }}
        >
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <defs>
                {chartData.map((d, i) => {
                  const cfg = STATUS_CONFIG[d.status];
                  const gid = gradId("ds", d.status);
                  return (
                    <radialGradient key={gid} id={gid} cx="35%" cy="35%" r="65%">
                      <stop offset="0%" stopColor={cfg?.from ?? "#888"} />
                      <stop offset="100%" stopColor={cfg?.to ?? "#444"} />
                    </radialGradient>
                  );
                })}
                <filter id="donut_shadow" x="-20%" y="-20%" width="140%" height="140%">
                  <feDropShadow dx="0" dy="3" stdDeviation="4" floodColor="#000" floodOpacity="0.5" />
                </filter>
              </defs>
              <Pie
                data={chartData}
                cx="50%"
                cy="54%"
                innerRadius="44%"
                outerRadius="72%"
                paddingAngle={3}
                dataKey="count"
                stroke="none"
                filter="url(#donut_shadow)"
                startAngle={90}
                endAngle={-270}
              >
                {chartData.map((d, i) => (
                  <Cell key={i} fill={`url(#${gradId("ds", d.status)})`} />
                ))}
              </Pie>
              <Tooltip content={<StatusTooltip />} />
            </PieChart>
          </ResponsiveContainer>
        </div>
        {/* Center label (not rotated) */}
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none" style={{ bottom: 12 }}>
          <p className="text-3xl font-black text-foreground leading-none">{total}</p>
          <p className="text-[10px] text-muted-foreground mt-0.5">إجمالي</p>
        </div>
      </div>

      {/* Legend */}
      <div className="grid grid-cols-2 gap-x-3 gap-y-2">
        {chartData.map(item => {
          const cfg = STATUS_CONFIG[item.status];
          return (
            <div key={item.status} className="flex items-center gap-2 min-w-0">
              <span
                className="w-3 h-3 rounded-sm shrink-0"
                style={{ background: `linear-gradient(135deg, ${cfg?.from ?? "#888"}, ${cfg?.to ?? "#444"})` }}
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-1">
                  <p className="text-[11px] font-semibold text-foreground truncate">{cfg?.label ?? item.status}</p>
                  <p className="text-[11px] font-black shrink-0" style={{ color: cfg?.from ?? "#888" }}>{item.pct}%</p>
                </div>
                <p className="text-[10px] text-muted-foreground">{item.count} طلب</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── 3D Bar Chart ────────────────────────────────────────────────────────────
function WeeklyBar3D({ data }: { data: ChartsData["weeklySales"] }) {
  const hasData = data.some(d => d.orders > 0);
  if (!hasData) return (
    <div className="flex items-center justify-center h-48 text-zinc-500 text-xs">لا توجد بيانات هذا الأسبوع</div>
  );

  const maxOrders = Math.max(...data.map(d => d.orders), 1);

  return (
    <div className="space-y-3">
      {/* 3D perspective wrapper */}
      <div className="relative" style={{ height: 200 }}>
        {/* Ground shadow */}
        <div
          className="absolute bottom-0 left-0 right-0"
          style={{
            height: 12,
            background: "linear-gradient(to top, rgba(0,0,0,0.15), transparent)",
            borderRadius: "0 0 8px 8px",
          }}
        />
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            margin={{ top: 16, right: 20, left: -16, bottom: 0 }}
            barCategoryGap="28%"
          >
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(128,128,128,0.15)" vertical={false} />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))", fontWeight: 600 }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }}
              axisLine={false}
              tickLine={false}
              allowDecimals={false}
            />
            <Tooltip content={<BarTooltip />} cursor={{ fill: "rgba(255,255,255,0.04)" }} />
            <Bar
              dataKey="orders"
              shape={<Bar3DShape />}
              maxBarSize={36}
              radius={[3, 3, 0, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Weekly summary row */}
      <div className="grid grid-cols-4 gap-2 pt-2 border-t border-border/50">
        {(() => {
          const total = data.reduce((s, d) => s + d.orders, 0);
          const peak = data.reduce((a, b) => (b.orders > a.orders ? b : a), data[0]);
          const revenue = data.reduce((s, d) => s + d.revenue, 0);
          const avg = total / 7;
          return (
            <>
              <Stat label="إجمالي" value={String(total)} color="text-amber-500" />
              <Stat label="ذروة" value={peak.label} color="text-emerald-500" />
              <Stat label="متوسط/يوم" value={avg.toFixed(1)} color="text-sky-500" />
              <Stat label="إيرادات" value={fc(revenue)} color="text-purple-500" small />
            </>
          );
        })()}
      </div>
    </div>
  );
}

function Stat({ label, value, color, small }: { label: string; value: string; color: string; small?: boolean }) {
  return (
    <div className="text-center">
      <p className={`font-black ${small ? "text-[10px]" : "text-sm"} ${color}`}>{value}</p>
      <p className="text-[9px] text-muted-foreground">{label}</p>
    </div>
  );
}

// ─── 3D Pie (Ad Sources) ────────────────────────────────────────────────────
function AdSourcePie3D({ data }: { data: ChartsData["adSourceBreakdown"] }) {
  const filtered = data.filter(d => d.count > 0);
  if (!filtered.length) return (
    <div className="flex items-center justify-center h-48 text-zinc-500 text-xs">
      لا توجد بيانات مصادر الإعلانات
      <br />
      <span className="block text-[10px] mt-1 text-zinc-600">أضف adSource عند إنشاء الطلبات</span>
    </div>
  );

  return (
    <div className="space-y-4">
      {/* 3D Perspective Pie */}
      <div className="relative flex justify-center" style={{ height: 165 }}>
        <div
          className="absolute bottom-0 left-1/2 -translate-x-1/2"
          style={{
            width: 140, height: 22,
            background: "radial-gradient(ellipse, rgba(0,0,0,0.5) 0%, transparent 75%)",
            filter: "blur(5px)",
            transform: "translateY(4px)",
          }}
        />
        <div
          style={{
            transform: "perspective(400px) rotateX(40deg)",
            transformOrigin: "center bottom",
            width: "100%", height: 200,
            marginTop: -18,
          }}
        >
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <defs>
                {filtered.map((d) => {
                  const cfg = SOURCE_CONFIG[d.source];
                  const gid = gradId("src", d.source);
                  return (
                    <radialGradient key={gid} id={gid} cx="35%" cy="35%" r="65%">
                      <stop offset="0%" stopColor={cfg?.from ?? "#888"} />
                      <stop offset="100%" stopColor={cfg?.to ?? "#444"} />
                    </radialGradient>
                  );
                })}
                <filter id="pie_shadow" x="-20%" y="-20%" width="140%" height="140%">
                  <feDropShadow dx="0" dy="3" stdDeviation="3" floodColor="#000" floodOpacity="0.5" />
                </filter>
              </defs>
              <Pie
                data={filtered}
                cx="50%"
                cy="54%"
                outerRadius="68%"
                paddingAngle={2}
                dataKey="count"
                stroke="none"
                filter="url(#pie_shadow)"
                startAngle={90}
                endAngle={-270}
              >
                {filtered.map((d, i) => (
                  <Cell key={i} fill={`url(#${gradId("src", d.source)})`} />
                ))}
              </Pie>
              <Tooltip content={<SourceTooltip />} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Legend */}
      <div className="space-y-1.5">
        {filtered.map(item => {
          const cfg = SOURCE_CONFIG[item.source] ?? { label: item.source, emoji: "📌", from: "#888", to: "#444" };
          return (
            <div key={item.source} className="flex items-center gap-2">
              <span
                className="w-3 h-3 rounded-sm shrink-0"
                style={{ background: `linear-gradient(135deg, ${cfg.from}, ${cfg.to})` }}
              />
              <p className="text-[11px] font-semibold flex-1 text-foreground">
                {cfg.emoji} {cfg.label}
              </p>
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-muted-foreground">{item.count} طلب</span>
                <span
                  className="text-[11px] font-black min-w-[32px] text-right"
                  style={{ color: cfg.from }}
                >{item.pct}%</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Glow Card ──────────────────────────────────────────────────────────────
function GlowCard({
  children,
  title,
  icon,
  accentFrom,
  accentTo,
  className = "",
}: {
  children: React.ReactNode;
  title: string;
  icon: React.ReactNode;
  accentFrom: string;
  accentTo: string;
  className?: string;
}) {
  return (
    <div className={`relative rounded-2xl overflow-hidden border border-white/8 dark:border-white/5 ${className}`}
      style={{
        background: "hsl(var(--card))",
        boxShadow: `0 4px 24px -4px rgba(0,0,0,0.18), 0 1px 0 0 rgba(255,255,255,0.06) inset`,
      }}
    >
      {/* Top accent bar */}
      <div
        className="absolute top-0 left-0 right-0 h-[3px] rounded-t-2xl"
        style={{ background: `linear-gradient(90deg, ${accentFrom}, ${accentTo})` }}
      />
      {/* Header */}
      <div className="flex items-center gap-2.5 px-4 pt-5 pb-3 border-b border-border/40">
        <div
          className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
          style={{ background: `linear-gradient(135deg, ${accentFrom}33, ${accentTo}22)`, border: `1px solid ${accentFrom}44` }}
        >
          {icon}
        </div>
        <p className="text-sm font-bold text-foreground">{title}</p>
      </div>
      {/* Body */}
      <div className="p-4">{children}</div>
    </div>
  );
}

// ─── Main Export ─────────────────────────────────────────────────────────────
export function ChartsSection() {
  const { data, isLoading } = useQuery({
    queryKey: ["analytics-charts"],
    queryFn: analyticsApi.charts,
    staleTime: 30000,
    refetchInterval: 60000,
  });

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[1, 2, 3].map(i => (
          <div
            key={i}
            className="rounded-2xl border border-border animate-pulse"
            style={{ height: 340, background: "hsl(var(--card))" }}
          />
        ))}
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {/* 1. Donut — Status */}
      <GlowCard
        title="توزيع حالات الطلبات"
        icon={
          <svg viewBox="0 0 16 16" fill="none" className="w-3.5 h-3.5">
            <circle cx="8" cy="8" r="7" stroke="#22c55e" strokeWidth="1.5" />
            <circle cx="8" cy="8" r="4" stroke="#22c55e" strokeWidth="1.5" strokeDasharray="6 3" />
          </svg>
        }
        accentFrom="#22c55e"
        accentTo="#0ea5e9"
      >
        <Donut3D data={data.statusBreakdown} total={data.total} />
      </GlowCard>

      {/* 2. Bar — Weekly */}
      <GlowCard
        title="أداء المبيعات — آخر 7 أيام"
        icon={
          <svg viewBox="0 0 16 16" fill="none" className="w-3.5 h-3.5">
            <rect x="1" y="8" width="3" height="7" fill="#fbbf24" rx="1" />
            <rect x="6" y="4" width="3" height="11" fill="#f97316" rx="1" />
            <rect x="11" y="1" width="3" height="14" fill="#a78bfa" rx="1" />
          </svg>
        }
        accentFrom="#fbbf24"
        accentTo="#f97316"
      >
        <WeeklyBar3D data={data.weeklySales} />
      </GlowCard>

      {/* 3. Pie — Ad Sources */}
      <GlowCard
        title="مصادر الطلبات"
        icon={
          <svg viewBox="0 0 16 16" fill="none" className="w-3.5 h-3.5">
            <circle cx="8" cy="8" r="7" stroke="#60a5fa" strokeWidth="1.5" />
            <path d="M8 1 L8 8 L14 5" stroke="#60a5fa" strokeWidth="1.2" />
            <path d="M8 8 L3 13" stroke="#f472b6" strokeWidth="1.2" />
          </svg>
        }
        accentFrom="#60a5fa"
        accentTo="#f472b6"
      >
        <AdSourcePie3D data={data.adSourceBreakdown} />
      </GlowCard>
    </div>
  );
}
