import React, { useState, useMemo, memo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useListOrders } from "@workspace/api-client-react";
import { analyticsApi, apiFetch, type ChartsData } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Link } from "wouter";
import { format } from "date-fns";
import {
  PieChart, Pie, Cell, Sector, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
} from "recharts";

// ─── Color palette — modern flat ───────────────────────────────────────────
const STATUS_CFG: Record<string, { label: string; color: string; bg: string }> = {
  received:         { label: "مُسلَّم",       color: "#22c55e", bg: "#22c55e18" },
  returned:         { label: "مرتجع",         color: "#ef4444", bg: "#ef444418" },
  pending:          { label: "قيد الانتظار",  color: "#f59e0b", bg: "#f59e0b18" },
  in_shipping:      { label: "قيد الشحن",     color: "#3b82f6", bg: "#3b82f618" },
  delayed:          { label: "مؤجل",          color: "#8b5cf6", bg: "#8b5cf618" },
  partial_received: { label: "استلم جزئي",    color: "#06b6d4", bg: "#06b6d418" },
  cancelled:        { label: "ملغي",          color: "#6b7280", bg: "#6b728018" },
};

const SOURCE_CFG: Record<string, { label: string; emoji: string; color: string }> = {
  facebook:  { label: "فيسبوك",   emoji: "📘", color: "#1877F2" },
  tiktok:    { label: "تيك توك",  emoji: "🎵", color: "#ff0050" },
  instagram: { label: "إنستجرام", emoji: "📷", color: "#E1306C" },
  whatsapp:  { label: "واتساب",   emoji: "💬", color: "#25D366" },
  organic:   { label: "عضوي",     emoji: "🌱", color: "#22c55e" },
  other:     { label: "أخرى",     emoji: "📌", color: "#8b5cf6" },
};

const BAR_COLOR = "#f59e0b";

const fc = (n: number) =>
  new Intl.NumberFormat("ar-EG", { style: "currency", currency: "EGP", maximumFractionDigits: 0 }).format(n);

// ─── Hover (active) shape — smooth expand with glow ────────────────────────
function ActiveDonutShape(props: any) {
  const {
    cx, cy, innerRadius, outerRadius,
    startAngle, endAngle, fill,
    payload, percent, value,
  } = props;
  const cfg = STATUS_CFG[payload.status] ?? { label: payload.status, color: fill };

  return (
    <g tabIndex={-1} style={{ outline: "none" }}>
      {/* Glow ring */}
      <Sector
        cx={cx} cy={cy}
        innerRadius={outerRadius + 5}
        outerRadius={outerRadius + 9}
        startAngle={startAngle}
        endAngle={endAngle}
        fill={fill}
        opacity={0.2}
        cornerRadius={6}
      />
      {/* Main segment — slightly expanded */}
      <Sector
        cx={cx} cy={cy}
        innerRadius={innerRadius - 4}
        outerRadius={outerRadius + 7}
        startAngle={startAngle}
        endAngle={endAngle}
        fill={fill}
        cornerRadius={6}
        tabIndex={-1}
        style={{ outline: "none" }}
      />
      {/* Center text: count */}
      <text x={cx} y={cy - 14} textAnchor="middle"
        fill="hsl(var(--foreground))" fontSize={26} fontWeight={900}
        fontFamily="inherit" style={{ pointerEvents: "none", userSelect: "none" }}>
        {value}
      </text>
      {/* Center text: label */}
      <text x={cx} y={cy + 8} textAnchor="middle"
        fill="hsl(var(--muted-foreground))" fontSize={11}
        fontFamily="inherit" style={{ pointerEvents: "none", userSelect: "none" }}>
        {cfg.label}
      </text>
      {/* Center text: percent */}
      <text x={cx} y={cy + 26} textAnchor="middle"
        fill={fill} fontSize={14} fontWeight={800}
        fontFamily="inherit" style={{ pointerEvents: "none", userSelect: "none" }}>
        {`${(percent * 100).toFixed(0)}%`}
      </text>
    </g>
  );
}

// ─── Percentage label inside each segment ───────────────────────────────────
function PctLabel({ cx, cy, midAngle, innerRadius, outerRadius, percent }: any) {
  if (percent < 0.07) return null;
  const RADIAN = Math.PI / 180;
  const r = innerRadius + (outerRadius - innerRadius) * 0.55;
  const x = cx + r * Math.cos(-midAngle * RADIAN);
  const y = cy + r * Math.sin(-midAngle * RADIAN);
  return (
    <text
      x={x} y={y}
      fill="white"
      textAnchor="middle"
      dominantBaseline="central"
      fontSize={11}
      fontWeight={700}
      style={{ filter: "drop-shadow(0 1px 1px rgba(0,0,0,0.4))" }}
    >
      {`${(percent * 100).toFixed(0)}%`}
    </text>
  );
}

// ─── Donut tooltip ──────────────────────────────────────────────────────────
function DonutTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  const cfg = STATUS_CFG[d.status] ?? { label: d.status, color: "#888", bg: "#88881a" };
  return (
    <div
      className="rounded-xl border px-3 py-2.5 text-xs shadow-xl"
      style={{ background: "hsl(var(--card))", borderColor: cfg.color + "44" }}
    >
      <div className="flex items-center gap-1.5 mb-1">
        <span className="w-2 h-2 rounded-full shrink-0" style={{ background: cfg.color }} />
        <span className="font-bold text-foreground">{cfg.label}</span>
      </div>
      <p className="text-muted-foreground">{d.count} طلب  •  {d.pct}%</p>
    </div>
  );
}

// ─── Main Donut Card ────────────────────────────────────────────────────────
const StatusDonut = memo(function StatusDonut({
  data, total, onStatusClick, selectedStatus,
}: {
  data: ChartsData["statusBreakdown"];
  total: number;
  onStatusClick?: (status: string | null) => void;
  selectedStatus?: string | null;
}) {
  const sorted = useMemo(() => [...data].sort((a, b) => b.count - a.count), [data]);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  return (
    <div className="space-y-5">
      <div className="relative" style={{ height: 240 }}>
        {/* Show center total only when nothing is hovered */}
        {activeIndex === null && (
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none z-10">
            <p className="text-4xl font-black text-foreground leading-none">{total}</p>
            <p className="text-xs text-muted-foreground mt-1">إجمالي الطلبات</p>
          </div>
        )}

        <ResponsiveContainer width="100%" height="100%">
          <PieChart tabIndex={-1} style={{ outline: "none" }}>
            <Pie
              data={sorted}
              cx="50%"
              cy="50%"
              innerRadius="52%"
              outerRadius="78%"
              paddingAngle={3}
              dataKey="count"
              stroke="none"
              cornerRadius={5}
              startAngle={90}
              endAngle={-270}
              labelLine={false}
              label={activeIndex === null ? <PctLabel /> : undefined}
              activeIndex={activeIndex ?? undefined}
              activeShape={ActiveDonutShape}
              animationBegin={0}
              animationDuration={600}
              animationEasing="ease-out"
              onMouseEnter={(_, index) => setActiveIndex(index)}
              onMouseLeave={() => setActiveIndex(null)}
              onClick={(entry) => onStatusClick?.(
                selectedStatus === entry.status ? null : entry.status
              )}
              style={{ cursor: onStatusClick ? "pointer" : "default", outline: "none" }}
            >
              {sorted.map((d, i) => {
                const cfg = STATUS_CFG[d.status];
                const isSelected = selectedStatus === d.status;
                return (
                  <Cell
                    key={i}
                    fill={cfg?.color ?? "#888"}
                    opacity={selectedStatus && !isSelected ? 0.35 : 1}
                  />
                );
              })}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
      </div>

      {/* Legend — قابلة للضغط */}
      <div className="space-y-2">
        {sorted.map(item => {
          const cfg = STATUS_CFG[item.status] ?? { label: item.status, color: "#888", bg: "#88881a" };
          const isSelected = selectedStatus === item.status;
          return (
            <button
              key={item.status}
              type="button"
              onClick={() => onStatusClick?.(isSelected ? null : item.status)}
              className="w-full flex items-center gap-3 rounded-lg px-2 py-1 transition-all text-right"
              style={{
                background: isSelected ? cfg.bg : "transparent",
                border: isSelected ? `1px solid ${cfg.color}55` : "1px solid transparent",
                cursor: onStatusClick ? "pointer" : "default",
              }}
            >
              <span className="w-3 h-3 rounded-full shrink-0" style={{ background: cfg.color }} />
              <span className="text-xs font-semibold text-foreground flex-1 truncate">{cfg.label}</span>
              <span className="text-xs font-bold px-2 py-0.5 rounded-md shrink-0"
                style={{ background: cfg.bg, color: cfg.color }}>
                {item.count}
              </span>
              <span className="text-xs font-black w-9 text-right shrink-0" style={{ color: cfg.color }}>
                {item.pct}%
              </span>
              {isSelected && (
                <span className="text-[9px] font-bold shrink-0" style={{ color: cfg.color }}>▼</span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
});

// ─── Bar tooltip ─────────────────────────────────────────────────────────────
function BarTip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  const isToday = d.isToday;
  // format date from d.date (YYYY-MM-DD)
  const dateFormatted = d.date
    ? new Date(d.date).toLocaleDateString("ar-EG", { day: "numeric", month: "long" })
    : "";
  return (
    <div
      className="rounded-xl border px-3 py-2.5 text-xs shadow-xl min-w-[130px]"
      style={{
        background: "hsl(var(--card))",
        borderColor: isToday ? "#f59e0b88" : "hsl(var(--border))",
      }}
    >
      {/* Day name + date */}
      <div className="flex items-center gap-1.5 mb-2 pb-1.5 border-b border-border/50">
        {isToday && <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse shrink-0" />}
        <p className="font-black text-foreground">{d.label}</p>
        <p className="text-muted-foreground text-[10px] mr-auto">{dateFormatted}</p>
      </div>
      {/* Orders */}
      <div className="flex items-center justify-between gap-3">
        <span className="text-muted-foreground">الطلبات</span>
        <span className="font-black" style={{ color: BAR_COLOR }}>{d.orders} طلب</span>
      </div>
      {/* Revenue */}
      {d.revenue > 0 && (
        <div className="flex items-center justify-between gap-3 mt-1">
          <span className="text-muted-foreground">الإيرادات</span>
          <span className="font-bold text-emerald-500 text-[11px]">{fc(d.revenue)}</span>
        </div>
      )}
      {d.orders === 0 && (
        <p className="text-muted-foreground/60 text-[10px] mt-1 text-center">لا طلبات هذا اليوم</p>
      )}
    </div>
  );
}

// ─── Custom X-Axis Tick ────────────────────────────────────────────────────────
function CustomXTick({ x, y, payload }: any) {
  const d = payload?.value ?? {};
  const isToday = d.isToday;
  const shortDate = d.date
    ? new Date(d.date).toLocaleDateString("ar-EG", { day: "numeric", month: "numeric" })
    : "";
  return (
    <g transform={`translate(${x},${y})`}>
      {/* Day name */}
      <text
        x={0} y={0} dy={12}
        textAnchor="middle"
        fill={isToday ? "#f59e0b" : "hsl(var(--muted-foreground))"}
        fontSize={isToday ? 10 : 9}
        fontWeight={isToday ? 900 : 600}
      >
        {d.label ?? ""}
      </text>
      {/* Date */}
      <text
        x={0} y={0} dy={24}
        textAnchor="middle"
        fill={isToday ? "#f59e0baa" : "hsl(var(--muted-foreground)/0.6)"}
        fontSize={8}
      >
        {shortDate}
      </text>
    </g>
  );
}

// ─── Weekly Sales Card (Glass Dark Redesign) ─────────────────────────────────
const GLASS_BAR_COLOR = "#FFD54F";
const GLASS_PURPLE = "#7E57C2";
const GLASS_GREEN = "#26A69A";
const GLASS_ORANGE = "#FFB74D";

function WeeklyDaysGrid({
  days,
  maxOrders,
  highlightToday = false,
}: {
  days: Array<{ date: string; label: string; orders: number; revenue: number; isToday?: boolean }>;
  maxOrders: number;
  highlightToday?: boolean;
}) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
      {days.map((d, i) => {
        const barH = Math.max(6, Math.round((d.orders / Math.max(maxOrders, 1)) * 34));
        const formattedDate = d.date
          ? new Date(d.date).toLocaleDateString("ar-EG", { day: "numeric", month: "short" })
          : "";
        const isToday = highlightToday && d.isToday;
        return (
          <div
            key={`${d.date}-${i}`}
            className="flex min-w-0 flex-col items-center gap-2 rounded-2xl px-2 py-2 text-center"
            style={{
              background: isToday ? "rgba(255,213,79,0.10)" : "rgba(255,255,255,0.02)",
              border: isToday ? "1px solid rgba(255,213,79,0.28)" : "1px solid rgba(255,255,255,0.04)",
            }}
          >
            <div className="flex h-11 items-end">
              <div
                className="min-w-[22px] rounded-md transition-all duration-300"
                style={{
                  width: d.orders > 0 ? 28 : 18,
                  height: d.orders > 0 ? barH : 4,
                  background: d.orders > 0
                    ? "linear-gradient(180deg, #FFF3A6 0%, #FFD54F 72%, #E0A800 100%)"
                    : "rgba(255,255,255,0.10)",
                  boxShadow: d.orders > 0 ? `0 0 12px ${GLASS_BAR_COLOR}66` : "none",
                  opacity: d.orders > 0 ? 1 : 0.45,
                }}
              />
            </div>
            <div className="text-center">
              <p className="text-[10px] font-black" style={{ color: d.orders > 0 ? GLASS_BAR_COLOR : "rgba(255,255,255,0.32)" }}>
                {d.orders > 0 ? d.orders : "·"}
              </p>
              <p className="mt-1 text-[11px] font-bold leading-tight" style={{ color: isToday ? "#fff4c2" : "rgba(255,255,255,0.82)" }}>
                {d.label}
              </p>
              <p className="mt-0.5 text-[9px] font-semibold" style={{ color: isToday ? "rgba(255,213,79,0.88)" : "rgba(255,255,255,0.52)" }}>
                {formattedDate}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function GlassBarTip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div
      style={{
        background: "rgba(20,20,20,0.92)",
        border: "1px solid rgba(255,213,79,0.4)",
        borderRadius: 10,
        padding: "8px 14px",
        boxShadow: "0 4px 20px rgba(0,0,0,0.5)",
        textAlign: "center",
        minWidth: 90,
        direction: "rtl",
      }}
    >
      <p style={{ color: "#FFD54F", fontWeight: 900, fontSize: 12, marginBottom: 2 }}>{d.label}</p>
      <p style={{ color: "#fff", fontWeight: 700, fontSize: 13 }}>{d.orders} طلب</p>
      {d.revenue > 0 && (
        <p style={{ color: "rgba(255,255,255,0.5)", fontSize: 10, marginTop: 2 }}>{fc(d.revenue)}</p>
      )}
    </div>
  );
}

function GlassXTick({ x, y, payload, enriched }: any) {
  const label: string = payload?.value ?? "";
  const dayData = enriched?.find((d: any) => d.label === label);
  const isToday = dayData?.isToday ?? false;
  const shortDate = dayData?.date
    ? new Date(dayData.date).toLocaleDateString("ar-EG", { day: "numeric", month: "numeric" })
    : "";
  return (
    <g transform={`translate(${x},${y})`}>
      <text
        x={0} y={0} dy={13}
        textAnchor="middle"
        fill={isToday ? GLASS_BAR_COLOR : "rgba(255,255,255,0.55)"}
        fontSize={isToday ? 10 : 9}
        fontWeight={isToday ? 900 : 600}
      >
        {label}
      </text>
      <text
        x={0} y={0} dy={26}
        textAnchor="middle"
        fill={isToday ? "#f59e0b88" : "rgba(255,255,255,0.28)"}
        fontSize={8}
        fontWeight={400}
      >
        {shortDate}
      </text>
    </g>
  );
}

const WeeklyBars = memo(function WeeklyBars({ data, weekComparison }: { data: ChartsData["weeklySales"]; weekComparison?: ChartsData["weekComparison"] }) {
  const todayStr = new Date().toISOString().split("T")[0];
  const enriched = useMemo(() =>
    data.map(d => ({ ...d, isToday: d.date === todayStr }))
  , [data, todayStr]);
  const prevWeekEnriched = useMemo(
    () => weekComparison?.prevWeekDays?.map(d => ({ ...d, isToday: false })) ?? [],
    [weekComparison]
  );

  const { total, peak, revenue, hasData } = useMemo(() => {
    const total = enriched.reduce((s, d) => s + d.orders, 0);
    const peak = enriched.reduce((a, b) => b.orders > a.orders ? b : a, enriched[0] ?? { label: "—", orders: 0, revenue: 0, date: "", isToday: false });
    const revenue = enriched.reduce((s, d) => s + d.revenue, 0);
    return { total, peak, revenue, hasData: total > 0 };
  }, [enriched]);

  const maxOrders = Math.max(...enriched.map(d => d.orders), 1);
  const prevWeekMaxOrders = Math.max(...prevWeekEnriched.map(d => d.orders), 1);
  const yMax = Math.ceil(maxOrders / 5) * 5 + 4;

  const statCards = [
    {
      label: "الإيرادات",
      value: revenue > 0 ? fc(revenue) : "0 ج.م",
      color: GLASS_PURPLE,
      glow: "rgba(126,87,194,0.32)",
      background: "linear-gradient(135deg, rgba(126,87,194,0.42) 0%, rgba(126,87,194,0.16) 52%, rgba(255,255,255,0.08) 100%)",
    },
    {
      label: "الأكثر بيعًا",
      value: peak.orders > 0 ? peak.label : "لا يوجد",
      subValue: peak.orders > 0 ? `${peak.orders} طلب` : undefined,
      color: GLASS_GREEN,
      glow: "rgba(38,166,154,0.28)",
      background: "linear-gradient(135deg, rgba(38,166,154,0.44) 0%, rgba(38,166,154,0.18) 52%, rgba(255,255,255,0.08) 100%)",
    },
    {
      label: "طلبات الأسبوع",
      value: String(total),
      color: GLASS_ORANGE,
      glow: "rgba(255,183,77,0.28)",
      background: "linear-gradient(135deg, rgba(255,183,77,0.40) 0%, rgba(255,183,77,0.16) 52%, rgba(255,255,255,0.08) 100%)",
    },
  ];

  return (
    <div
      className="space-y-5 rounded-[26px] p-4 sm:p-5"
      dir="rtl"
      style={{
        background: "linear-gradient(180deg, rgba(50,50,50,0.55) 0%, rgba(30,30,30,0.88) 100%)",
        border: "1px solid rgba(255,255,255,0.08)",
        boxShadow: "inset 0 1px 0 rgba(255,255,255,0.06), 0 24px 50px rgba(0,0,0,0.35)",
        backdropFilter: "blur(16px)",
      }}
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {statCards.map((card) => (
          <div
            key={card.label}
            className="group relative overflow-hidden rounded-[18px] px-4 py-3.5 text-center transition-transform duration-300 hover:-translate-y-0.5"
            style={{
              background: card.background,
              border: `1px solid ${card.glow}`,
              boxShadow: `inset 0 1px 0 rgba(255,255,255,0.18), 0 10px 24px ${card.glow}`,
              backdropFilter: "blur(12px)",
            }}
          >
            <div
              className="absolute inset-x-6 top-0 h-px opacity-80"
              style={{ background: `linear-gradient(90deg, transparent, ${card.color}, transparent)` }}
            />
            <p className="text-[11px] font-bold tracking-tight" style={{ color: "rgba(255,255,255,0.72)" }}>{card.label}</p>
            <p
              className="mt-1 truncate text-xl font-black sm:text-2xl"
              style={{ color: card.color, textShadow: `0 0 14px ${card.color}88` }}
            >
              {card.value}
            </p>
            {card.subValue && (
              <p className="mt-0.5 text-[10px] font-semibold" style={{ color: "rgba(255,255,255,0.60)" }}>{card.subValue}</p>
            )}
          </div>
        ))}
      </div>

      {hasData ? (
        <div
          className="rounded-[22px] px-2 py-3 sm:px-3"
          style={{
            background: "linear-gradient(180deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0.015) 100%)",
            border: "1px solid rgba(255,255,255,0.06)",
          }}
        >
          <div style={{ height: 270 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={enriched} margin={{ top: 10, right: 8, left: -22, bottom: 48 }}>
                <defs>
                  <linearGradient id="weeklyBarsGlow" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0%" stopColor="#FFF59D" />
                    <stop offset="55%" stopColor={GLASS_BAR_COLOR} />
                    <stop offset="100%" stopColor="#E0A800" />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  strokeDasharray="2 5"
                  stroke="rgba(255,255,255,0.12)"
                  vertical={false}
                />
                <XAxis
                  dataKey="label"
                  tick={(props) => <GlassXTick {...props} enriched={enriched} />}
                  axisLine={false}
                  tickLine={false}
                  interval={0}
                />
                <YAxis
                  tick={{ fontSize: 10, fill: "rgba(255,255,255,0.50)" }}
                  axisLine={false}
                  tickLine={false}
                  allowDecimals={false}
                  domain={[0, yMax]}
                />
                <Tooltip
                  content={<GlassBarTip />}
                  cursor={{ fill: "rgba(255,213,79,0.08)", radius: 10 }}
                />
                <Bar dataKey="orders" radius={[10, 10, 3, 3]} maxBarSize={38}>
                  {enriched.map((d, i) => (
                    <Cell
                      key={i}
                      fill={d.orders > 0 ? "url(#weeklyBarsGlow)" : "rgba(255,255,255,0.08)"}
                      style={d.orders > 0 ? { filter: `drop-shadow(0 0 10px ${GLASS_BAR_COLOR}99)` } : {}}
                      opacity={d.orders > 0 ? 1 : 0.32}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      ) : (
        <div
          className="flex h-56 flex-col items-center justify-center gap-2 rounded-[22px]"
          style={{
            background: "linear-gradient(180deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0.015) 100%)",
            border: "1px solid rgba(255,255,255,0.06)",
          }}
        >
          <span className="text-4xl" style={{ opacity: 0.2 }}>📊</span>
          <p className="text-xs" style={{ color: "rgba(255,255,255,0.40)" }}>لا طلبات في آخر 7 أيام</p>
        </div>
      )}

      <div
        className="rounded-[20px] px-3 py-3"
        style={{
          background: "linear-gradient(180deg, rgba(255,255,255,0.025) 0%, rgba(255,255,255,0.012) 100%)",
          border: "1px solid rgba(255,255,255,0.05)",
        }}
      >
        <WeeklyDaysGrid days={enriched} maxOrders={maxOrders} highlightToday />
      </div>

      {/* ── مقارنة الأسبوع السابق ── */}
      {weekComparison && (
        <div
          className="rounded-[20px] px-4 py-3 mt-1"
          style={{
            background: "linear-gradient(135deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.015) 100%)",
            border: "1px solid rgba(255,255,255,0.07)",
          }}
        >
          <p className="text-[11px] font-bold mb-2.5" style={{ color: "rgba(255,255,255,0.55)" }}>
            مقارنة بالأسبوع الماضي
          </p>
          <div className="grid grid-cols-3 gap-2">
            {/* الطلبات */}
            <div className="flex flex-col items-center gap-1">
              <p className="text-[10px]" style={{ color: "rgba(255,255,255,0.40)" }}>الطلبات</p>
              <p className="text-base font-black" style={{ color: GLASS_ORANGE }}>{weekComparison.thisWeek.orders}</p>
              <p className="text-[10px]" style={{ color: "rgba(255,255,255,0.35)" }}>vs {weekComparison.prevWeek.orders}</p>
              {weekComparison.ordersChange !== null && (
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: weekComparison.ordersChange >= 0 ? "rgba(38,166,154,0.18)" : "rgba(239,83,80,0.18)", color: weekComparison.ordersChange >= 0 ? GLASS_GREEN : "#ef5350" }}>
                  {weekComparison.ordersChange >= 0 ? "▲" : "▼"} {Math.abs(weekComparison.ordersChange)}%
                </span>
              )}
            </div>
            {/* الإيرادات */}
            <div className="flex flex-col items-center gap-1">
              <p className="text-[10px]" style={{ color: "rgba(255,255,255,0.40)" }}>الإيرادات</p>
              <p className="text-base font-black" style={{ color: GLASS_PURPLE }}>{fc(weekComparison.thisWeek.revenue)}</p>
              <p className="text-[10px]" style={{ color: "rgba(255,255,255,0.35)" }}>vs {fc(weekComparison.prevWeek.revenue)}</p>
              {weekComparison.revenueChange !== null && (
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: weekComparison.revenueChange >= 0 ? "rgba(38,166,154,0.18)" : "rgba(239,83,80,0.18)", color: weekComparison.revenueChange >= 0 ? GLASS_GREEN : "#ef5350" }}>
                  {weekComparison.revenueChange >= 0 ? "▲" : "▼"} {Math.abs(weekComparison.revenueChange)}%
                </span>
              )}
            </div>
            {/* متوسط يومي */}
            <div className="flex flex-col items-center gap-1">
              <p className="text-[10px]" style={{ color: "rgba(255,255,255,0.40)" }}>متوسط/يوم</p>
              <p className="text-base font-black" style={{ color: GLASS_BAR_COLOR }}>{(weekComparison.thisWeek.orders / 7).toFixed(1)}</p>
              <p className="text-[10px]" style={{ color: "rgba(255,255,255,0.35)" }}>vs {(weekComparison.prevWeek.orders / 7).toFixed(1)}</p>
            </div>
          </div>
          <div className="mt-4">
            <p className="mb-2 text-[11px] font-bold" style={{ color: "rgba(255,255,255,0.55)" }}>
              تفاصيل الأسبوع الماضي بالتاريخ
            </p>
            <WeeklyDaysGrid days={prevWeekEnriched} maxOrders={prevWeekMaxOrders} />
          </div>
        </div>
      )}
    </div>
  );
});

// ─── Ad Sources Card ─────────────────────────────────────────────────────────
const AdSources = memo(function AdSources({ data }: { data: ChartsData["adSourceBreakdown"] }) {
  const filtered = useMemo(() => data.filter(d => d.count > 0), [data]);

  if (!filtered.length) {
    return (
      <div className="flex flex-col items-center justify-center py-4 text-center space-y-3">
        <span className="text-5xl">📡</span>
        <div>
          <p className="text-sm font-bold text-foreground">لا توجد بيانات بعد</p>
          <p className="text-xs text-muted-foreground mt-1 max-w-[200px] mx-auto leading-relaxed">
            أضف مصدر الإعلان عند إنشاء أي طلب لتفعيل هذا القسم
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5 justify-center pt-1">
          {Object.entries(SOURCE_CFG).map(([k, v]) => (
            <span
              key={k}
              className="text-[10px] px-2.5 py-1 rounded-full font-semibold"
              style={{ background: v.color + "18", color: v.color, border: `1px solid ${v.color}33` }}
            >
              {v.emoji} {v.label}
            </span>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {filtered.map(item => {
        const cfg = SOURCE_CFG[item.source] ?? { label: item.source, emoji: "📌", color: "#8b5cf6" };
        return (
          <div key={item.source} className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <span className="text-base leading-none">{cfg.emoji}</span>
                <span className="font-semibold text-foreground">{cfg.label}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">{item.count} طلب</span>
                <span className="font-black w-8 text-right" style={{ color: cfg.color }}>
                  {item.pct}%
                </span>
              </div>
            </div>
            {/* Progress bar */}
            <div className="h-2 rounded-full overflow-hidden" style={{ background: cfg.color + "18" }}>
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{ width: `${item.pct}%`, background: cfg.color }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
});

// ─── Chart Card Wrapper ───────────────────────────────────────────────────────
function ChartCard({
  title,
  subtitle,
  dot,
  children,
  liveTag,
  glassStyle,
}: {
  title: string;
  subtitle: string;
  dot: string;
  children: React.ReactNode;
  liveTag?: boolean;
  glassStyle?: boolean;
}) {
  if (glassStyle) {
    return (
      <div
        className="rounded-2xl overflow-hidden"
        style={{
          background: "linear-gradient(135deg, #1e1e1e 0%, #2a2a2a 100%)",
          boxShadow: "0 8px 32px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.06) inset",
          border: "1px solid rgba(255,255,255,0.08)",
        }}
      >
        <div
          className="flex items-start justify-between px-4 pt-4 pb-3"
          style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}
        >
          <div className="flex items-center gap-2.5">
            <span
              className="w-2.5 h-2.5 rounded-full mt-0.5 shrink-0"
              style={{ background: dot, boxShadow: `0 0 8px ${dot}cc, 0 0 20px ${dot}55` }}
            />
            <div>
              <p className="text-sm font-bold" style={{ color: "#f0f0f0" }}>{title}</p>
              <p className="text-[10px] mt-0.5" style={{ color: "rgba(255,255,255,0.38)" }}>{subtitle}</p>
            </div>
          </div>
          {liveTag && (
            <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-400 shrink-0 mt-0.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              مباشر
            </span>
          )}
        </div>
        <div className="p-4">{children}</div>
      </div>
    );
  }

  return (
    <div
      className="rounded-2xl border border-border/50 overflow-hidden"
      style={{
        background: "hsl(var(--card))",
        boxShadow:
          "0 1px 3px rgba(0,0,0,0.07), 0 4px 16px rgba(0,0,0,0.06), 0 0 0 1px rgba(255,255,255,0.04) inset",
      }}
    >
      <div className="flex items-start justify-between px-4 pt-4 pb-3 border-b border-border/40">
        <div className="flex items-center gap-2.5">
          <span
            className="w-2.5 h-2.5 rounded-full mt-0.5 shrink-0"
            style={{ background: dot, boxShadow: `0 0 6px ${dot}88` }}
          />
          <div>
            <p className="text-sm font-bold text-foreground">{title}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">{subtitle}</p>
          </div>
        </div>
        {liveTag && (
          <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-500 shrink-0 mt-0.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            مباشر
          </span>
        )}
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

// ─── Loading Skeleton ─────────────────────────────────────────────────────────
function Skeleton() {
  return (
    <div className="space-y-4">
      <div className="flex gap-2 overflow-hidden">
        {[80, 72, 72, 72, 72].map((w, i) => (
          <div key={i} className="h-16 rounded-xl bg-muted animate-pulse shrink-0" style={{ width: w }} />
        ))}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[1, 2, 3].map(i => (
          <div key={i} className="rounded-2xl bg-muted animate-pulse" style={{ height: 400 }} />
        ))}
      </div>
    </div>
  );
}

// ─── KPI Strip ────────────────────────────────────────────────────────────────
const KpiStrip = memo(function KpiStrip({ data, total }: { data: ChartsData["statusBreakdown"]; total: number }) {
  const sorted = useMemo(() => [...data].sort((a, b) => b.count - a.count), [data]);
  return (
    <div className="flex gap-2.5 overflow-x-auto pb-0.5 no-scrollbar">
      {/* Total pill */}
      <div
        className="flex-none rounded-xl px-4 py-3 text-center min-w-[78px]"
        style={{ background: "#f59e0b14", border: "1px solid #f59e0b40" }}
      >
        <p className="text-xl font-black text-amber-500 leading-none">{total}</p>
        <p className="text-[10px] text-muted-foreground mt-0.5">الكل</p>
      </div>

      {/* Per-status pills */}
      {sorted.map(item => {
        const cfg = STATUS_CFG[item.status] ?? { label: item.status, color: "#888", bg: "#88881a" };
        return (
          <div
            key={item.status}
            className="flex-none rounded-xl px-3 py-3 text-center min-w-[72px]"
            style={{ background: cfg.bg, border: `1px solid ${cfg.color}40` }}
          >
            <p className="text-xl font-black leading-none" style={{ color: cfg.color }}>{item.count}</p>
            <p className="text-[10px] font-bold mt-0.5" style={{ color: cfg.color }}>{item.pct}%</p>
            <p className="text-[9px] text-muted-foreground mt-0.5 leading-tight">{cfg.label}</p>
          </div>
        );
      })}
    </div>
  );
});

// ─── Filtered Orders List ─────────────────────────────────────────────────────
export function FilteredOrdersList({ status }: { status: string }) {
  const cfg = STATUS_CFG[status] ?? { label: status, color: "#888", bg: "#88881a" };

  const { data: orders, isLoading, error } = useQuery<any[]>({
    queryKey: ["orders-by-status-chart", status],
    queryFn: () => apiFetch<any[]>(`/analytics/orders-by-status?status=${status}`),
    staleTime: 0,
    refetchOnMount: true,
    retry: 1,
  });
  const fc = (n: number) =>
    new Intl.NumberFormat("ar-EG", { style: "currency", currency: "EGP", maximumFractionDigits: 0 }).format(n);

  return (
    <div
      className="mt-3 rounded-xl border overflow-hidden"
      style={{ borderColor: cfg.color + "44", background: cfg.bg }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b" style={{ borderColor: cfg.color + "33" }}>
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full" style={{ background: cfg.color }} />
          <span className="text-xs font-bold" style={{ color: cfg.color }}>{cfg.label}</span>
          {!isLoading && orders && (
            <span className="text-[10px] text-muted-foreground">({orders.length} طلب)</span>
          )}
        </div>
        <Link href={`/orders?status=${status}`} className="text-[10px] font-bold hover:underline" style={{ color: cfg.color }}>
          عرض الكل ←
        </Link>
      </div>

      {/* Body */}
      {isLoading ? (
        <div className="p-4 text-center text-xs text-muted-foreground animate-pulse">جاري التحميل...</div>
      ) : error ? (
        <div className="p-4 text-center text-xs text-red-500">
          خطأ في تحميل الطلبات — {(error as Error).message}
          <br />
          <Link href={`/orders?status=${status}`} className="underline mt-1 inline-block" style={{ color: cfg.color }}>
            افتح قسم الطلبات مباشرةً ←
          </Link>
        </div>
      ) : !orders?.length ? (
        <div className="p-4 text-center text-xs text-muted-foreground">
          لا توجد طلبات بحالة &quot;{cfg.label}&quot;
          <br />
          <Link href={`/orders?status=${status}`} className="underline mt-1 inline-block" style={{ color: cfg.color }}>
            تحقق في قسم الطلبات ←
          </Link>
        </div>
      ) : (
        <div className="divide-y" style={{ borderColor: cfg.color + "22" }}>
          {orders.slice(0, 8).map(order => (
            <Link
              key={order.id}
              href={`/orders/${order.id}`}
              className="flex items-center justify-between px-4 py-2.5 hover:bg-black/5 transition-colors"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-black shrink-0 text-white"
                  style={{ background: cfg.color }}>
                  {order.customerName.charAt(0)}
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-bold truncate">{order.customerName}</p>
                  <p className="text-[10px] text-muted-foreground truncate">
                    #{order.id.toString().padStart(4, "0")} • {order.product}
                    {order.city ? ` • ${order.city}` : ""}
                  </p>
                </div>
              </div>
              <div className="text-left shrink-0 mr-2">
                <p className="text-xs font-black" style={{ color: cfg.color }}>{fc(order.totalPrice)}</p>
                <p className="text-[9px] text-muted-foreground">
                  {format(new Date(order.createdAt), "dd/MM")}
                </p>
              </div>
            </Link>
          ))}
          {orders.length > 8 && (
            <div className="px-4 py-2 text-center">
              <Link href={`/orders?status=${status}`} className="text-[10px] font-bold hover:underline" style={{ color: cfg.color }}>
                + {orders.length - 8} طلب آخر
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Exported Weekly Bars (standalone) ───────────────────────────────────────
export { WeeklyBars };

// ─── Exported Chart Card Wrapper ─────────────────────────────────────────────
export { ChartCard };

// ─── Status Donut + Expandable Orders (للاستخدام في الداشبورد) ───────────────
export function StatusDonutWithOrders({ data, total }: { data: ChartsData["statusBreakdown"]; total: number }) {
  const [selectedStatus, setSelectedStatus] = useState<string | null>(null);

  return (
    <div>
      <StatusDonut
        data={data}
        total={total}
        selectedStatus={selectedStatus}
        onStatusClick={setSelectedStatus}
      />
      {selectedStatus && (
        <FilteredOrdersList status={selectedStatus} />
      )}
    </div>
  );
}

// ─── Exported Component ──────────────────────────────────────────────────────
export function ChartsSection() {
  const { data, isLoading } = useQuery({
    queryKey: ["analytics-charts"],
    queryFn: analyticsApi.charts,
    staleTime: 30000,
    refetchInterval: 60000,
  });

  if (isLoading) return <Skeleton />;
  if (!data) return null;

  return (
    <div className="space-y-4">
      {/* Section header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold text-foreground">مركز التحليلات</h2>
          <p className="text-[11px] text-muted-foreground">ANALYTICS CENTER — بيانات حقيقية من قاعدة البيانات</p>
        </div>
        <span className="flex items-center gap-1.5 text-[11px] font-bold text-emerald-500">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          مباشر
        </span>
      </div>

      {/* KPI strip */}
      <KpiStrip data={data.statusBreakdown} total={data.total} />

      {/* Charts grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* 1 — Donut with expandable orders */}
        <ChartCard
          title="توزيع حالات الطلبات"
          subtitle="اضغط على الحالة لعرض طلباتها"
          dot="#22c55e"
          liveTag
        >
          <StatusDonutWithOrders data={data.statusBreakdown} total={data.total} />
        </ChartCard>

        {/* 2 — Weekly Bar */}
        <ChartCard
          title="المبيعات الأسبوعية"
          subtitle="Weekly Sales — Last 7 Days"
          dot="#f59e0b"
        >
          <WeeklyBars data={data.weeklySales} weekComparison={data.weekComparison} />
        </ChartCard>

        {/* 3 — Ad Sources */}
        <ChartCard
          title="مصادر الطلبات"
          subtitle="Ad Attribution Sources"
          dot="#8b5cf6"
        >
          <AdSources data={data.adSourceBreakdown} />
        </ChartCard>
      </div>
    </div>
  );
}
