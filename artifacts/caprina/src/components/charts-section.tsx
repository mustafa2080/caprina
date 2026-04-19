import { useQuery } from "@tanstack/react-query";
import { analyticsApi, type ChartsData } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from "recharts";
import { PieChart as PieChartIcon, BarChart3, Globe } from "lucide-react";

// ─── Status config ─────────────────────────────────────────────────────────
const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  received:         { label: "مُسلَّم",        color: "#10b981" },
  returned:         { label: "مرتجع",          color: "#ef4444" },
  pending:          { label: "قيد الانتظار",   color: "#f59e0b" },
  in_shipping:      { label: "قيد الشحن",      color: "#0ea5e9" },
  delayed:          { label: "مؤجل",           color: "#3b82f6" },
  partial_received: { label: "استلم جزئي",     color: "#a855f7" },
  cancelled:        { label: "ملغي",           color: "#6b7280" },
};

// ─── Ad source config ───────────────────────────────────────────────────────
const SOURCE_CONFIG: Record<string, { label: string; color: string; emoji: string }> = {
  facebook:  { label: "فيسبوك",    color: "#1877F2", emoji: "📘" },
  tiktok:    { label: "تيك توك",   color: "#ff0050", emoji: "🎵" },
  instagram: { label: "إنستجرام",  color: "#E1306C", emoji: "📷" },
  whatsapp:  { label: "واتساب",    color: "#25D366", emoji: "💬" },
  organic:   { label: "عضوي",      color: "#10b981", emoji: "🌱" },
  other:     { label: "أخرى",      color: "#8b5cf6", emoji: "📌" },
};

// ─── Helpers ────────────────────────────────────────────────────────────────
const fc = (n: number) =>
  new Intl.NumberFormat("ar-EG", { style: "currency", currency: "EGP", maximumFractionDigits: 0 }).format(n);

// ─── Custom Donut Label ─────────────────────────────────────────────────────
function DonutCenterLabel({ total }: { total: number }) {
  return (
    <text x="50%" y="50%" textAnchor="middle" dominantBaseline="middle" style={{ direction: "rtl" }}>
      <tspan x="50%" dy="-8" fontSize="22" fontWeight="900" fill="currentColor">{total}</tspan>
      <tspan x="50%" dy="20" fontSize="11" fill="#6b7280">إجمالي</tspan>
    </text>
  );
}

// ─── Custom Tooltip ─────────────────────────────────────────────────────────
function StatusTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  const cfg = STATUS_CONFIG[d.status] ?? { label: d.status, color: "#6b7280" };
  return (
    <div className="bg-card border border-border rounded-lg shadow-lg px-3 py-2 text-xs">
      <p className="font-bold" style={{ color: cfg.color }}>{cfg.label}</p>
      <p className="text-muted-foreground">{d.count} طلب — {d.pct}%</p>
    </div>
  );
}

function BarTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-card border border-border rounded-lg shadow-lg px-3 py-2 text-xs space-y-1">
      <p className="font-bold text-foreground">{label}</p>
      {payload.map((p: any) => (
        <p key={p.dataKey} style={{ color: p.color }}>
          {p.dataKey === "orders" ? `${p.value} طلب` : fc(p.value)}
        </p>
      ))}
    </div>
  );
}

function SourceTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  const cfg = SOURCE_CONFIG[d.source] ?? { label: d.source, color: "#6b7280", emoji: "📌" };
  return (
    <div className="bg-card border border-border rounded-lg shadow-lg px-3 py-2 text-xs">
      <p className="font-bold" style={{ color: cfg.color }}>{cfg.emoji} {cfg.label}</p>
      <p className="text-muted-foreground">{d.count} طلب — {d.pct}%</p>
    </div>
  );
}

// ─── Donut Chart: Order Status ───────────────────────────────────────────────
function OrderStatusDonut({ data, total }: { data: ChartsData["statusBreakdown"]; total: number }) {
  if (!data.length) return (
    <div className="flex items-center justify-center h-48 text-muted-foreground text-xs">لا توجد بيانات</div>
  );

  const chartData = data.map(d => ({
    ...d,
    color: STATUS_CONFIG[d.status]?.color ?? "#6b7280",
    label: STATUS_CONFIG[d.status]?.label ?? d.status,
  }));

  return (
    <div className="space-y-4">
      <div className="relative" style={{ height: 200 }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              innerRadius={58}
              outerRadius={82}
              paddingAngle={2}
              dataKey="count"
              stroke="none"
            >
              {chartData.map((entry, i) => (
                <Cell key={i} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip content={<StatusTooltip />} />
          </PieChart>
        </ResponsiveContainer>
        {/* Center text */}
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <p className="text-3xl font-black text-foreground">{total}</p>
          <p className="text-[10px] text-muted-foreground">إجمالي</p>
        </div>
      </div>

      {/* Legend */}
      <div className="grid grid-cols-2 gap-1.5">
        {chartData.map(item => (
          <div key={item.status} className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
            <div className="min-w-0">
              <p className="text-[11px] font-semibold text-foreground truncate">{item.label}</p>
              <p className="text-[10px] text-muted-foreground">{item.count} • {item.pct}%</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Bar Chart: Weekly Sales ─────────────────────────────────────────────────
function WeeklySalesBar({ data }: { data: ChartsData["weeklySales"] }) {
  const hasData = data.some(d => d.orders > 0);
  if (!hasData) return (
    <div className="flex items-center justify-center h-48 text-muted-foreground text-xs">لا توجد بيانات هذا الأسبوع</div>
  );

  return (
    <div style={{ height: 220 }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }} barGap={2}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            yAxisId="orders"
            orientation="right"
            tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }}
            axisLine={false}
            tickLine={false}
            allowDecimals={false}
          />
          <Tooltip content={<BarTooltip />} cursor={{ fill: "hsl(var(--muted))", opacity: 0.3 }} />
          <Bar yAxisId="orders" dataKey="orders" name="الطلبات" fill="#f59e0b" radius={[4, 4, 0, 0]} maxBarSize={32} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// ─── Pie Chart: Ad Sources ───────────────────────────────────────────────────
function AdSourcePie({ data, total }: { data: ChartsData["adSourceBreakdown"]; total: number }) {
  const filteredData = data.filter(d => d.count > 0);
  if (!filteredData.length) return (
    <div className="flex items-center justify-center h-48 text-muted-foreground text-xs">لا توجد بيانات مصادر الإعلانات</div>
  );

  const chartData = filteredData.map(d => ({
    ...d,
    color: SOURCE_CONFIG[d.source]?.color ?? "#6b7280",
    label: SOURCE_CONFIG[d.source]?.label ?? d.source,
    emoji: SOURCE_CONFIG[d.source]?.emoji ?? "📌",
  }));

  return (
    <div className="space-y-4">
      <div style={{ height: 180 }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              outerRadius={72}
              paddingAngle={2}
              dataKey="count"
              stroke="none"
            >
              {chartData.map((entry, i) => (
                <Cell key={i} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip content={<SourceTooltip />} />
          </PieChart>
        </ResponsiveContainer>
      </div>

      {/* Legend */}
      <div className="space-y-1.5">
        {chartData.map(item => (
          <div key={item.source} className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
            <p className="text-[11px] font-semibold flex-1 text-foreground">{item.emoji} {item.label}</p>
            <p className="text-[11px] text-muted-foreground">{item.count}</p>
            <p className="text-[11px] font-bold" style={{ color: item.color }}>{item.pct}%</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Main ChartsSection ──────────────────────────────────────────────────────
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
          <Card key={i} className="animate-pulse border-border">
            <CardContent className="h-64" />
          </Card>
        ))}
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {/* Donut: Order Status */}
      <Card className="border-border">
        <CardHeader className="py-3 px-4 border-b border-border">
          <CardTitle className="text-sm font-bold flex items-center gap-2">
            <PieChartIcon className="w-3.5 h-3.5 text-primary" />
            توزيع حالات الطلبات
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4">
          <OrderStatusDonut data={data.statusBreakdown} total={data.total} />
        </CardContent>
      </Card>

      {/* Bar: Weekly Sales */}
      <Card className="border-border">
        <CardHeader className="py-3 px-4 border-b border-border">
          <CardTitle className="text-sm font-bold flex items-center gap-2">
            <BarChart3 className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
            أداء المبيعات (آخر 7 أيام)
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4">
          <WeeklySalesBar data={data.weeklySales} />
          <p className="text-[10px] text-muted-foreground text-center mt-2">عدد الطلبات يومياً</p>
        </CardContent>
      </Card>

      {/* Pie: Ad Sources */}
      <Card className="border-border">
        <CardHeader className="py-3 px-4 border-b border-border">
          <CardTitle className="text-sm font-bold flex items-center gap-2">
            <Globe className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
            مصادر الطلبات
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4">
          <AdSourcePie data={data.adSourceBreakdown} total={data.total} />
        </CardContent>
      </Card>
    </div>
  );
}
