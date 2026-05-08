import { useQuery } from "@tanstack/react-query";
import {
  TrendingUp, TrendingDown, Minus, BarChart3,
  Wallet, RefreshCw, ArrowUpCircle, ArrowDownCircle,
  Star, Building2, Activity,
} from "lucide-react";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, Legend, PieChart, Pie, Cell,
} from "recharts";

const apiFetch = async (url: string) => {
  const token = localStorage.getItem("caprina_token");
  const res = await fetch(url, {
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
  if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error ?? "خطأ"); }
  return res.json();
};

const fmt = (v: number) =>
  v >= 1000000 ? (v / 1000000).toFixed(2) + "م" :
  v >= 1000    ? (v / 1000).toFixed(1)    + "k" :
  v.toLocaleString("ar-EG", { minimumFractionDigits: 0 });

const fmtFull = (v: number) =>
  Number(v).toLocaleString("ar-EG", { minimumFractionDigits: 2 }) + " ج.م";

const TX_LABELS: Record<string, string> = {
  deposit: "إيداع", withdrawal: "سحب", order_collected: "تحصيل طلب",
  shipping_transfer: "تحويل شحن", cash_sale: "مبيعات نقدية",
  expense_paid: "دفع مصروف", purchase_paid: "دفع مورد",
  transfer_in: "تحويل وارد", transfer_out: "تحويل صادر",
};
const CREDIT_TYPES = ["deposit","order_collected","shipping_transfer","cash_sale","transfer_in"];

const MONTH_NAMES: Record<string, string> = {
  "01":"يناير","02":"فبراير","03":"مارس","04":"أبريل","05":"مايو","06":"يونيو",
  "07":"يوليو","08":"أغسطس","09":"سبتمبر","10":"أكتوبر","11":"نوفمبر","12":"ديسمبر",
};

const PIE_COLORS = ["#10b981","#f43f5e","#3b82f6","#f59e0b","#8b5cf6","#06b6d4","#ec4899","#84cc16","#f97316"];

interface Analytics {
  currentMonth: { totalIn: number; totalOut: number; net: number; txCount: number };
  lastMonth:    { totalIn: number; totalOut: number; net: number; txCount: number };
  changes:      { inPct: number|null; outPct: number|null; netPct: number|null };
  monthlyChart: { month: string; in: number; out: number; net: number }[];
  typeBreakdown: { type: string; total: number; count: number }[];
  registerComparison: { id:number; name:string; type:string; balance:number; monthlyIn:number; monthlyOut:number; txCount:number }[];
  topTransactions: any[];
}

function PctBadge({ pct }: { pct: number | null }) {
  if (pct === null) return <span className="text-xs text-muted-foreground">—</span>;
  const up = pct >= 0;
  return (
    <span className={`inline-flex items-center gap-0.5 text-xs font-semibold px-1.5 py-0.5 rounded-full ${up ? "bg-emerald-500/10 text-emerald-600" : "bg-rose-500/10 text-rose-600"}`}>
      {up ? <TrendingUp className="w-3 h-3"/> : <TrendingDown className="w-3 h-3"/>}
      {Math.abs(pct)}%
    </span>
  );
}

function StatCard({ label, value, sub, pct, color = "emerald" }: { label:string; value:number; sub:string; pct:number|null; color?:string }) {
  const colorMap: Record<string,string> = { emerald:"text-emerald-600", rose:"text-rose-600", sky:"text-sky-600", amber:"text-amber-600" };
  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-1.5">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`text-2xl font-black ${colorMap[color]}`}>{fmtFull(value)}</p>
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">{sub}</p>
        <PctBadge pct={pct}/>
      </div>
    </div>
  );
}

export default function FinanceCashAnalyticsPage() {
  const { data, isLoading } = useQuery<Analytics>({
    queryKey: ["/api/cash-registers/analytics"],
    queryFn: () => apiFetch("/api/cash-registers/analytics"),
    refetchInterval: 120000,
  });

  if (isLoading) return (
    <div className="flex items-center justify-center h-64 gap-3 text-muted-foreground" dir="rtl">
      <RefreshCw className="w-5 h-5 animate-spin"/> جارٍ تحميل التحليلات...
    </div>
  );
  if (!data) return null;

  const { currentMonth, lastMonth, changes, monthlyChart, typeBreakdown, registerComparison, topTransactions } = data;

  const creditBreakdown = typeBreakdown.filter(t => CREDIT_TYPES.includes(t.type));
  const debitBreakdown  = typeBreakdown.filter(t => !CREDIT_TYPES.includes(t.type));

  const chartData = monthlyChart.map(r => ({
    ...r,
    label: MONTH_NAMES[r.month?.split("-")[1]] ?? r.month,
  }));

  const maxReg = registerComparison.reduce((m, r) => r.txCount > (m?.txCount??0) ? r : m, registerComparison[0]);

  return (
    <div className="space-y-6 animate-in fade-in duration-500" dir="rtl">

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <BarChart3 className="w-6 h-6 text-blue-500"/> تحليلات الخزنة
        </h1>
        <p className="text-sm text-muted-foreground">ملخص مالي مقارن — الشهر الحالي vs السابق</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="إجمالي الدخل" value={currentMonth.totalIn}  sub={`الشهر السابق: ${fmtFull(lastMonth.totalIn)}`}  pct={changes.inPct}  color="emerald"/>
        <StatCard label="إجمالي الخروج" value={currentMonth.totalOut} sub={`الشهر السابق: ${fmtFull(lastMonth.totalOut)}`} pct={changes.outPct} color="rose"/>
        <StatCard label="الصافي"         value={currentMonth.net}      sub={`الشهر السابق: ${fmtFull(lastMonth.net)}`}      pct={changes.netPct} color={currentMonth.net>=0?"emerald":"rose"}/>
        <div className="rounded-xl border border-border bg-card p-4 space-y-1.5">
          <p className="text-xs text-muted-foreground">عدد الحركات</p>
          <p className="text-2xl font-black text-sky-600">{currentMonth.txCount.toLocaleString("ar-EG")}</p>
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">السابق: {lastMonth.txCount}</p>
            <PctBadge pct={lastMonth.txCount===0?null:Math.round(((currentMonth.txCount-lastMonth.txCount)/lastMonth.txCount)*100)}/>
          </div>
        </div>
      </div>

      {/* Chart شهري */}
      <div className="rounded-xl border border-border bg-card p-4">
        <p className="text-sm font-bold mb-4 flex items-center gap-2"><TrendingUp className="w-4 h-4 text-emerald-500"/> التدفق المالي — آخر 6 شهور</p>
        {chartData.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground text-sm">لا توجد بيانات كافية</div>
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={chartData} margin={{top:4,right:4,left:0,bottom:0}}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.1}/>
              <XAxis dataKey="label" tick={{fontSize:11}}/>
              <YAxis tick={{fontSize:10}} tickFormatter={v=>fmt(v)}/>
              <Tooltip formatter={(v:any)=>fmtFull(Number(v))} labelFormatter={v=>`${v}`}/>
              <Legend formatter={(v:any) => v==="in"?"دخل":v==="out"?"خروج":"صافي"}/>
              <Bar dataKey="in"  fill="#10b981" radius={[3,3,0,0]} name="in"/>
              <Bar dataKey="out" fill="#f43f5e" radius={[3,3,0,0]} name="out"/>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* توزيع + مقارنة الخزن */}
      <div className="grid gap-4 lg:grid-cols-2">

        {/* Pie Chart توزيع نوع الحركة */}
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-sm font-bold mb-3 flex items-center gap-2"><Activity className="w-4 h-4 text-purple-500"/> توزيع الحركات (الشهر الحالي)</p>
          {typeBreakdown.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground text-sm">لا توجد حركات هذا الشهر</div>
          ) : (
            <div className="flex gap-4 items-start">
              <PieChart width={140} height={140}>
                <Pie data={typeBreakdown} dataKey="total" nameKey="type" cx="50%" cy="50%" outerRadius={65} innerRadius={35}>
                  {typeBreakdown.map((_,i) => <Cell key={i} fill={PIE_COLORS[i%PIE_COLORS.length]}/>)}
                </Pie>
                <Tooltip formatter={(v:any)=>fmtFull(Number(v))} labelFormatter={(v:any)=>TX_LABELS[v]??v}/>
              </PieChart>
              <div className="flex-1 space-y-1.5 overflow-hidden">
                {typeBreakdown.map((t,i) => (
                  <div key={t.type} className="flex items-center gap-2 text-xs">
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{background:PIE_COLORS[i%PIE_COLORS.length]}}/>
                    <span className="flex-1 truncate text-muted-foreground">{TX_LABELS[t.type]??t.type}</span>
                    <span className="font-semibold shrink-0">{fmt(t.total)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* مقارنة الخزن */}
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-sm font-bold mb-3 flex items-center gap-2"><Wallet className="w-4 h-4 text-sky-500"/> مقارنة الخزن (الشهر الحالي)</p>
          {registerComparison.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground text-sm">لا توجد خزن</div>
          ) : (
            <div className="space-y-3">
              {registerComparison.sort((a,b)=>b.txCount-a.txCount).map(r => {
                const maxTx = Math.max(...registerComparison.map(x=>x.txCount), 1);
                const pctBar = Math.round((r.txCount/maxTx)*100);
                return (
                  <div key={r.id}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="flex items-center gap-1.5 text-xs font-medium">
                        {r.type==="main"?<Star className="w-3 h-3 text-yellow-500"/>:<Building2 className="w-3 h-3 text-blue-500"/>}
                        {r.name}
                        {r.id===maxReg?.id && <span className="bg-emerald-500/10 text-emerald-600 text-[10px] px-1 rounded">الأكثر نشاطاً</span>}
                      </span>
                      <span className="text-xs text-muted-foreground">{r.txCount} حركة</span>
                    </div>
                    <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                      <div className="h-full bg-sky-500 rounded-full transition-all" style={{width:`${pctBar}%`}}/>
                    </div>
                    <div className="flex justify-between text-[10px] text-muted-foreground mt-0.5">
                      <span className="text-emerald-600">+{fmt(r.monthlyIn)}</span>
                      <span className="text-rose-600">-{fmt(r.monthlyOut)}</span>
                      <span className="font-medium">رصيد: {fmt(r.balance)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* أكبر حركات الشهر */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="p-4 border-b border-border bg-muted/30">
          <p className="text-sm font-bold flex items-center gap-2"><TrendingUp className="w-4 h-4 text-amber-500"/> أكبر 5 حركات هذا الشهر</p>
        </div>
        {topTransactions.length === 0 ? (
          <div className="text-center py-10 text-muted-foreground text-sm">لا توجد حركات هذا الشهر</div>
        ) : (
          <div className="divide-y divide-border">
            {topTransactions.map((tx:any, i:number) => {
              const isCredit = CREDIT_TYPES.includes(tx.type);
              return (
                <div key={tx.id} className="flex items-center gap-3 px-4 py-3">
                  <span className="w-6 h-6 rounded-full bg-muted flex items-center justify-center text-xs font-bold text-muted-foreground shrink-0">{i+1}</span>
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${isCredit?"bg-emerald-500/10":"bg-rose-500/10"}`}>
                    {isCredit?<ArrowUpCircle className="w-4 h-4 text-emerald-500"/>:<ArrowDownCircle className="w-4 h-4 text-rose-500"/>}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium">{TX_LABELS[tx.type]??tx.type}</p>
                    {tx.description && <p className="text-xs text-muted-foreground truncate">{tx.description}</p>}
                    <p className="text-xs text-muted-foreground">{new Date(tx.transactionDate).toLocaleDateString("ar-EG")}</p>
                  </div>
                  <p className={`text-sm font-black shrink-0 ${isCredit?"text-emerald-600":"text-rose-600"}`}>
                    {isCredit?"+":"-"}{fmtFull(parseFloat(tx.amount))}
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </div>

    </div>
  );
}
