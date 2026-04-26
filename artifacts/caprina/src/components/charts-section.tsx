import React, { useState, useMemo, memo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useListOrders } from "@workspace/api-client-react";
import { analyticsApi, type ChartsData } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Link } from "wouter";
import { format } from "date-fns";
import {
  PieChart, Pie, Cell, Sector, Tooltip, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
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

// ─── Hover (active) shape — expands and shows detail in center ──────────────
function ActiveDonutShape(props: any) {
  const {
    cx, cy, innerRadius, outerRadius,
    startAngle, endAngle, fill,
    payload, percent, value,
  } = props;
  const cfg = STATUS_CFG[payload.status] ?? { label: payload.status, color: fill };

  return (
    <g>
      {/* Outer glow ring */}
      <Sector
        cx={cx} cy={cy}
        innerRadius={outerRadius + 4}
        outerRadius={outerRadius + 7}
        startAngle={startAngle}
        endAngle={endAngle}
        fill={fill}
        opacity={0.25}
        cornerRadius={4}
      />
      {/* Main segment (expanded) */}
      <Sector
        cx={cx} cy={cy}
        innerRadius={innerRadius - 3}
        outerRadius={outerRadius + 6}
        startAngle={startAngle}
        endAngle={endAngle}
        fill={fill}
        cornerRadius={5}
      />
      {/* Center: count */}
      <text
        x={cx} y={cy - 14}
        textAnchor="middle"
        fill="hsl(var(--foreground))"
        fontSize={26}
        fontWeight={900}
        fontFamily="inherit"
      >
        {value}
      </text>
      {/* Center: label */}
      <text
        x={cx} y={cy + 8}
        textAnchor="middle"
        fill="hsl(var(--muted-foreground))"
        fontSize={11}
        fontFamily="inherit"
      >
        {cfg.label}
      </text>
      {/* Center: percentage */}
      <text
        x={cx} y={cy + 26}
        textAnchor="middle"
        fill={fill}
        fontSize={14}
        fontWeight={800}
        fontFamily="inherit"
      >
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
          <PieChart>
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
              onMouseEnter={(_, index) => setActiveIndex(index)}
              onMouseLeave={() => setActiveIndex(null)}
              onClick={(entry) => onStatusClick?.(
                selectedStatus === entry.status ? null : entry.status
              )}
              style={{ cursor: onStatusClick ? "pointer" : "default" }}
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

// ─── Weekly Sales Card ────────────────────────────────────────────────────────
const WeeklyBars = memo(function WeeklyBars({ data }: { data: ChartsData["weeklySales"] }) {
  // Mark today and enrich data
  const todayStr = new Date().toISOString().split("T")[0];
  const enriched = useMemo(() =>
    data.map(d => ({ ...d, isToday: d.date === todayStr }))
  , [data, todayStr]);

  const { total, peak, revenue, hasData, todayOrders } = useMemo(() => {
    const total = enriched.reduce((s, d) => s + d.orders, 0);
    const peak = enriched.reduce((a, b) => b.orders > a.orders ? b : a, enriched[0] ?? { label: "—", orders: 0, revenue: 0, date: "", isToday: false });
    const revenue = enriched.reduce((s, d) => s + d.revenue, 0);
    const todayOrders = enriched.find(d => d.isToday)?.orders ?? 0;
    return { total, peak, revenue, hasData: total > 0, todayOrders };
  }, [enriched]);

  // avg per day (excluding zero days)
  const activeDays = enriched.filter(d => d.orders > 0).length;
  const avgPerDay = activeDays > 0 ? Math.round(total / activeDays) : 0;

  return (
    <div className="space-y-4">
      {/* KPI row */}
      <div className="grid grid-cols-4 gap-1.5">
        {[
          { label: "طلبات الأسبوع", value: String(total), color: "#f59e0b" },
          { label: "اليوم", value: String(todayOrders), color: "#3b82f6" },
          { label: "أعلى يوم", value: `${peak.label} (${peak.orders})`, color: "#22c55e", small: true },
          { label: "متوسط يومي", value: String(avgPerDay), color: "#8b5cf6" },
        ].map(s => (
          <div
            key={s.label}
            className="rounded-xl px-1.5 py-2 text-center"
            style={{ background: s.color + "14", border: `1px solid ${s.color}30` }}
          >
            <p
              className={`font-black leading-none ${s.small ? "text-[9px]" : "text-sm"}`}
              style={{ color: s.color }}
            >
              {s.value}
            </p>
            <p className="text-[8px] text-muted-foreground mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Bar chart */}
      {hasData ? (
        <div style={{ height: 190 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={enriched} margin={{ top: 10, right: 4, left: -26, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
              <XAxis
                dataKey={(d) => d}
                tick={<CustomXTick />}
                axisLine={false}
                tickLine={false}
                interval={0}
              />
              <YAxis
                tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }}
                axisLine={false}
                tickLine={false}
                allowDecimals={false}
              />
              <Tooltip content={<BarTip />} cursor={{ fill: "hsl(var(--muted))", opacity: 0.3, radius: 4 }} />
              <Bar dataKey="orders" radius={[6, 6, 0, 0]} maxBarSize={36}>
                {enriched.map((d, i) => (
                  <Cell
                    key={i}
                    fill={d.isToday ? "#3b82f6" : d.orders > 0 ? BAR_COLOR : "hsl(var(--muted))"}
                    opacity={d.orders > 0 ? 1 : 0.3}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center h-44 gap-2">
          <span className="text-4xl opacity-20">📊</span>
          <p className="text-xs text-muted-foreground">لا طلبات في آخر 7 أيام</p>
        </div>
      )}

      {/* Day-by-day detail row */}
      <div className="grid grid-cols-7 gap-1 pt-2 border-t border-border/40">
        {enriched.map((d, i) => {
          const max = Math.max(...enriched.map(x => x.orders), 1);
          const barH = Math.max(3, Math.round((d.orders / max) * 20));
          const isToday = d.isToday;
          const shortDate = d.date
            ? new Date(d.date).toLocaleDateString("ar-EG", { day: "numeric", month: "numeric" })
            : "";
          return (
            <div key={i} className="flex flex-col items-center gap-1">
              {/* Orders count */}
              <p className={`text-[10px] font-black ${isToday ? "text-blue-500" : d.orders > 0 ? "text-amber-500" : "text-muted-foreground/40"}`}>
                {d.orders > 0 ? d.orders : "·"}
              </p>
              {/* Mini bar */}
              <div
                className="w-full rounded-sm"
                style={{
                  height: barH,
                  background: isToday ? "#3b82f6" : d.orders > 0 ? BAR_COLOR : "hsl(var(--muted))",
                  opacity: d.orders > 0 ? 1 : 0.25,
                }}
              />
              {/* Day name short */}
              <p className={`text-[8px] font-bold ${isToday ? "text-blue-500" : "text-muted-foreground"}`}>
                {d.label.slice(0, 2)}
              </p>
              {/* Date */}
              <p className="text-[7px] text-muted-foreground/60">{shortDate}</p>
            </div>
          );
        })}
      </div>
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
}: {
  title: string;
  subtitle: string;
  dot: string;
  children: React.ReactNode;
  liveTag?: boolean;
}) {
  return (
    <div
      className="rounded-2xl border border-border/50 overflow-hidden"
      style={{
        background: "hsl(var(--card))",
        boxShadow:
          "0 1px 3px rgba(0,0,0,0.07), 0 4px 16px rgba(0,0,0,0.06), 0 0 0 1px rgba(255,255,255,0.04) inset",
      }}
    >
      {/* Header */}
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
      {/* Body */}
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
  const { data: orders, isLoading } = useListOrders({ status });
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
        <div className="p-4 text-center text-xs text-muted-foreground">جاري التحميل...</div>
      ) : !orders?.length ? (
        <div className="p-4 text-center text-xs text-muted-foreground">لا توجد طلبات</div>
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
        {/* 1 — Donut */}
        <ChartCard
          title="توزيع حالات الطلبات"
          subtitle="Order Status Breakdown"
          dot="#22c55e"
          liveTag
        >
          <StatusDonut data={data.statusBreakdown} total={data.total} />
        </ChartCard>

        {/* 2 — Weekly Bar */}
        <ChartCard
          title="المبيعات الأسبوعية"
          subtitle="Weekly Sales — Last 7 Days"
          dot="#f59e0b"
        >
          <WeeklyBars data={data.weeklySales} />
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
