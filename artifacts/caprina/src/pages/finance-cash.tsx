import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import {
  Plus, Wallet, ArrowUpCircle, ArrowDownCircle, ArrowRightLeft,
  Star, Trash2, TrendingUp, TrendingDown, RefreshCw,
  Search, Download, ChevronLeft, ChevronRight,
  Building2, CreditCard, Pencil, X, Bell, BellOff, Settings2, BarChart3,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { format, startOfMonth } from "date-fns";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";

const apiFetch = async (url: string, options?: RequestInit) => {
  const res = await fetch(url, { credentials: "include", ...options });
  if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error ?? "خطأ في الخادم"); }
  return res.json();
};

const fmt = (v: string | number) =>
  Number(v).toLocaleString("ar-EG", { minimumFractionDigits: 2 }) + " ج.م";
const fmtShort = (v: number) =>
  v >= 1000 ? (v / 1000).toFixed(1) + "k" : v.toFixed(0);

const TX_LABELS: Record<string, { label: string; color: string }> = {
  deposit:          { label: "إيداع",            color: "text-emerald-500" },
  withdrawal:       { label: "سحب",              color: "text-rose-500"    },
  order_collected:  { label: "تحصيل طلب",        color: "text-emerald-500" },
  shipping_transfer:{ label: "تحويل شحن",        color: "text-emerald-500" },
  cash_sale:        { label: "مبيعات نقدية",     color: "text-emerald-500" },
  expense_paid:     { label: "دفع مصروف",        color: "text-rose-500"    },
  purchase_paid:    { label: "دفع مورد",         color: "text-rose-500"    },
  transfer_in:      { label: "تحويل وارد",       color: "text-sky-500"     },
  transfer_out:     { label: "تحويل صادر",       color: "text-amber-500"   },
};

const CREDIT_TYPES = ["deposit","order_collected","shipping_transfer","cash_sale","transfer_in"];

interface CashRegister {
  id: number; name: string; type: "main"|"branch";
  balance: string; description?: string; isActive: boolean;
  monthlyIn: number; monthlyOut: number; txCount: number;
  lowBalanceThreshold?: string;
}
interface CashTransaction {
  id: number; registerId: number; type: string; amount: string;
  balanceBefore: string; balanceAfter: string;
  description?: string; referenceNumber?: string;
  transactionDate: string; createdByName?: string;
}
interface Alert { registerId: number; name: string; balance: number; threshold: number; type: string; }

export default function FinanceCashPage() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [, navigate] = useLocation();

  const [activeTab, setActiveTab]   = useState<number | "all">("all");
  const [addRegOpen, setAddRegOpen] = useState(false);
  const [txOpen, setTxOpen]         = useState(false);
  const [transferOpen, setTransferOpen] = useState(false);
  const [editOpen, setEditOpen]     = useState(false);
  const [thresholdOpen, setThresholdOpen] = useState(false);
  const [selectedReg, setSelectedReg] = useState<CashRegister | null>(null);

  const [ledgerFrom, setLedgerFrom] = useState(format(startOfMonth(new Date()), "yyyy-MM-dd"));
  const [ledgerTo,   setLedgerTo]   = useState(format(new Date(), "yyyy-MM-dd"));
  const [ledgerType, setLedgerType] = useState("all");
  const [ledgerSearch, setLedgerSearch] = useState("");
  const [ledgerPage, setLedgerPage] = useState(1);

  const [newReg,  setNewReg]  = useState({ name: "", type: "branch", description: "", initialBalance: "" });
  const [txForm,  setTxForm]  = useState({ type: "deposit", amount: "", description: "", referenceNumber: "", transactionDate: format(new Date(), "yyyy-MM-dd") });
  const [transfer, setTransfer] = useState({ fromId: "", toId: "", amount: "", description: "" });
  const [editForm, setEditForm] = useState({ name: "", description: "" });
  const [thresholdVal, setThresholdVal] = useState("");

  const { data: regData, isLoading, isFetching } = useQuery<{ registers: CashRegister[]; totalBalance: number }>({
    queryKey: ["/api/cash-registers"],
    queryFn: () => apiFetch("/api/cash-registers"),
    refetchInterval: 120000,
    staleTime: 60000,
    refetchIntervalInBackground: false,
    placeholderData: (prev) => prev,
  });

  const { data: alertsData } = useQuery<{ alerts: Alert[] }>({
    queryKey: ["/api/cash-registers/alerts"],
    queryFn: () => apiFetch("/api/cash-registers/alerts"),
    refetchInterval: 180000,
    staleTime: 120000,
    refetchIntervalInBackground: false,
    placeholderData: (prev) => prev,
  });

  const { data: smartAlertsData } = useQuery<{ alerts: any[] }>({
    queryKey: ["/api/cash-registers/smart-alerts"],
    queryFn: () => apiFetch("/api/cash-registers/smart-alerts"),
    refetchInterval: 300000,
    staleTime: 180000,
    refetchIntervalInBackground: false,
    placeholderData: (prev) => prev,
  });

  const ledgerRegId = activeTab !== "all" ? activeTab : null;

  const { data: ledgerData, isLoading: ledgerLoading } = useQuery({
    queryKey: ["/api/cash-registers/ledger", ledgerRegId, ledgerFrom, ledgerTo, ledgerType, ledgerPage],
    queryFn: () => apiFetch(`/api/cash-registers/${ledgerRegId}/transactions?from=${ledgerFrom}&to=${ledgerTo}&type=${ledgerType}&page=${ledgerPage}&limit=25`),
    enabled: !!ledgerRegId,
    staleTime: 60000,
    refetchIntervalInBackground: false,
    placeholderData: (prev: any) => prev,
  });

  const { data: flowData } = useQuery({
    queryKey: ["/api/cash-registers/flow", ledgerRegId],
    queryFn: () => apiFetch(`/api/cash-registers/${ledgerRegId}/flow?days=30`),
    enabled: !!ledgerRegId,
    staleTime: 120000,
    refetchIntervalInBackground: false,
    placeholderData: (prev: any) => prev,
  });

  const registers    = regData?.registers ?? [];
  const totalBalance = regData?.totalBalance ?? 0;
  const mainReg      = registers.find(r => r.type === "main");
  const activeReg    = typeof activeTab === "number" ? registers.find(r => r.id === activeTab) ?? null : null;
  const alerts       = alertsData?.alerts ?? [];
  const smartAlerts  = smartAlertsData?.alerts ?? [];
  const transactions: CashTransaction[] = ledgerData?.transactions ?? [];
  const stats        = ledgerData?.stats;
  const pagination   = ledgerData?.pagination;

  const filteredTx = useMemo(() =>
    ledgerSearch ? transactions.filter(tx =>
      tx.description?.includes(ledgerSearch) ||
      tx.referenceNumber?.includes(ledgerSearch) ||
      TX_LABELS[tx.type]?.label.includes(ledgerSearch)
    ) : transactions,
    [transactions, ledgerSearch]
  );

  const handleExport = () => {
    if (!activeReg) return;
    const params = new URLSearchParams({ from: ledgerFrom, to: ledgerTo });
    if (ledgerType !== "all") params.append("type", ledgerType);
    window.open(`/api/cash-registers/${activeReg.id}/export?${params}`, "_blank");
  };

  const addRegMut = useMutation({
    mutationFn: (d: any) => apiFetch("/api/cash-registers", { method: "POST", headers: {"Content-Type":"application/json"}, body: JSON.stringify(d) }),
    onSuccess: () => { qc.invalidateQueries({queryKey:["/api/cash-registers"]}); setAddRegOpen(false); setNewReg({name:"",type:"branch",description:"",initialBalance:""}); toast({title:"✅ تم إنشاء الخزنة"}); },
    onError: (e:any) => toast({title:"❌ خطأ", description:e.message, variant:"destructive"}),
  });

  const txMut = useMutation({
    mutationFn: (d: any) => apiFetch(`/api/cash-registers/${selectedReg!.id}/transaction`, { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify(d) }),
    onSuccess: () => { qc.invalidateQueries({queryKey:["/api/cash-registers"]}); qc.invalidateQueries({queryKey:["/api/cash-registers/ledger"]}); qc.invalidateQueries({queryKey:["/api/cash-registers/alerts"]}); setTxOpen(false); setTxForm({type:"deposit",amount:"",description:"",referenceNumber:"",transactionDate:format(new Date(),"yyyy-MM-dd")}); toast({title:"✅ تم تسجيل الحركة"}); },
    onError: (e:any) => toast({title:"❌ خطأ", description:e.message, variant:"destructive"}),
  });

  const transferMut = useMutation({
    mutationFn: (d: any) => apiFetch("/api/cash-registers/transfer", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify(d) }),
    onSuccess: () => { qc.invalidateQueries({queryKey:["/api/cash-registers"]}); qc.invalidateQueries({queryKey:["/api/cash-registers/ledger"]}); setTransferOpen(false); setTransfer({fromId:"",toId:"",amount:"",description:""}); toast({title:"✅ تم التحويل"}); },
    onError: (e:any) => toast({title:"❌ خطأ", description:e.message, variant:"destructive"}),
  });

  const editMut = useMutation({
    mutationFn: (d: any) => apiFetch(`/api/cash-registers/${selectedReg!.id}`, { method:"PATCH", headers:{"Content-Type":"application/json"}, body:JSON.stringify(d) }),
    onSuccess: () => { qc.invalidateQueries({queryKey:["/api/cash-registers"]}); setEditOpen(false); toast({title:"✅ تم التعديل"}); },
    onError: (e:any) => toast({title:"❌ خطأ", description:e.message, variant:"destructive"}),
  });

  const thresholdMut = useMutation({
    mutationFn: (d: any) => apiFetch(`/api/cash-registers/${selectedReg!.id}/threshold`, { method:"PATCH", headers:{"Content-Type":"application/json"}, body:JSON.stringify(d) }),
    onSuccess: () => { qc.invalidateQueries({queryKey:["/api/cash-registers"]}); qc.invalidateQueries({queryKey:["/api/cash-registers/alerts"]}); setThresholdOpen(false); toast({title:"✅ تم ضبط حد التنبيه"}); },
    onError: (e:any) => toast({title:"❌ خطأ", description:e.message, variant:"destructive"}),
  });

  const delMut = useMutation({
    mutationFn: (id:number) => apiFetch(`/api/cash-registers/${id}`, { method:"DELETE" }),
    onSuccess: () => { qc.invalidateQueries({queryKey:["/api/cash-registers"]}); setActiveTab("all"); toast({title:"✅ تم تعطيل الخزنة"}); },
    onError: (e:any) => toast({title:"❌ خطأ", description:e.message, variant:"destructive"}),
  });

  // أول تحميل فقط (مفيش بيانات خالص) — بعدين placeholderData بيمنع إعادة التحميل
  if (isLoading && !regData) return (
    <div className="flex flex-col items-center justify-center h-64 gap-4 text-muted-foreground">
      <div className="relative w-16 h-16">
        <div className="absolute inset-0 rounded-2xl animate-pulse" style={{background:"#DEA82115"}} />
        <div className="absolute inset-0 flex items-center justify-center">
          <RefreshCw className="w-7 h-7 animate-spin" style={{color:"#DEA821"}} />
        </div>
      </div>
      <div className="text-center">
        <p className="text-sm font-medium text-foreground">جارٍ تحميل الخزنة</p>
        <p className="text-xs text-muted-foreground mt-0.5">يرجى الانتظار...</p>
      </div>
    </div>
  );

  return (
    <div className="space-y-5 animate-in fade-in duration-500" dir="rtl">

      {/* ── Header ── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-black flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl flex items-center justify-center shadow-sm" style={{background:"#DEA82120"}}>
              <Wallet className="w-5 h-5" style={{color:"#DEA821"}} />
            </div>
            إدارة الخزنة
          </h1>
          <p className="text-xs text-muted-foreground mt-1 mr-12">تتبع الرصيد والحركات النقدية لكل الخزن</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" size="sm" className="gap-1.5 h-9 text-xs rounded-xl border-border/60 hover:border-border" onClick={() => navigate("/finance/cash/analytics")}>
            <BarChart3 className="w-3.5 h-3.5" /> تحليلات
          </Button>
          <Button variant="outline" size="sm" className="gap-1.5 h-9 text-xs rounded-xl border-border/60 hover:border-border" onClick={() => setTransferOpen(true)}>
            <ArrowRightLeft className="w-3.5 h-3.5" /> تحويل
          </Button>
          <Button size="sm" className="gap-1.5 h-9 text-xs rounded-xl font-bold shadow-md text-black" style={{background:"#DEA821"}} onMouseEnter={e=>(e.currentTarget.style.background="#c8931c")} onMouseLeave={e=>(e.currentTarget.style.background="#DEA821")} onClick={() => setAddRegOpen(true)}>
            <Plus className="w-3.5 h-3.5" /> خزنة جديدة
          </Button>
        </div>
      </div>

      {/* ── تنبيهات الرصيد المنخفض ── */}
      {alerts.length > 0 && (
        <div className="rounded-xl border border-rose-400/30 bg-rose-50/40 dark:bg-rose-950/20 px-4 py-3 space-y-2">
          <p className="text-xs font-semibold text-rose-600 flex items-center gap-1.5">
            <Bell className="w-3.5 h-3.5" /> تنبيهات الرصيد المنخفض
          </p>
          <div className="flex flex-wrap gap-2">
            {alerts.map(a => (
              <div key={a.registerId} className="flex items-center gap-2 bg-white/60 dark:bg-rose-900/20 border border-rose-300/40 px-3 py-1.5 rounded-lg text-xs">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0" />
                <span className="font-semibold text-rose-700 dark:text-rose-400">{a.name}</span>
                <span className="text-muted-foreground">رصيد: <span className="font-bold text-rose-600">{fmt(a.balance)}</span></span>
                <span className="text-muted-foreground/60">/ {fmt(a.threshold)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── التنبيهات الذكية ── */}
      {smartAlerts.length > 0 && (
        <div className="rounded-xl border border-amber-400/30 bg-amber-50/30 dark:bg-amber-950/20 px-4 py-3 space-y-2">
          <p className="text-xs font-semibold text-amber-700 dark:text-amber-400 flex items-center gap-1.5">
            <Bell className="w-3.5 h-3.5" /> تنبيهات ذكية
          </p>
          <div className="space-y-1.5">
            {smartAlerts.map((a: any, i: number) => (
              <div key={i} className={`flex items-start gap-2.5 text-xs rounded-lg px-3 py-2 ${
                a.type==="danger"  ? "bg-rose-100/50 dark:bg-rose-900/20 text-rose-700 dark:text-rose-400" :
                a.type==="warning" ? "bg-amber-100/50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400" :
                a.type==="success" ? "bg-emerald-100/50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400" :
                "bg-sky-100/50 dark:bg-sky-900/20 text-sky-700 dark:text-sky-400"
              }`}>
                <span className="text-sm leading-none mt-0.5">
                  {a.type==="danger"?"🔴":a.type==="warning"?"🟡":a.type==="success"?"🟢":"🔵"}
                </span>
                <div>
                  <p className="font-semibold">{a.title}</p>
                  {a.detail && <p className="opacity-70 mt-0.5">{a.detail}</p>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── إجمالي الكاش ── */}
      <div className="relative overflow-hidden rounded-2xl text-black p-6 shadow-2xl" style={{background:"linear-gradient(135deg, #DEA821 0%, #f5c842 50%, #DEA821 100%)", boxShadow:"0 20px 60px #DEA82140"}}>
        {/* decorative shapes */}
        <div className="absolute -top-8 -left-8 w-40 h-40 rounded-full bg-black/5" />
        <div className="absolute -bottom-10 -right-6 w-52 h-52 rounded-full bg-black/8" />
        <div className="absolute top-4 left-1/2 w-20 h-20 rounded-full bg-white/10" />
        <div className="relative z-10">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-bold opacity-70 mb-2 flex items-center gap-1.5 uppercase tracking-widest">
                <Wallet className="w-3.5 h-3.5" /> إجمالي الكاش
              </p>
              <p className="text-5xl font-black tracking-tight leading-none drop-shadow-sm">{fmt(totalBalance)}</p>
            </div>
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center backdrop-blur-sm" style={{background:"#00000018"}}>
              <TrendingUp className="w-7 h-7" />
            </div>
          </div>
          <div className="flex items-center gap-2.5 mt-4">
            <span className="text-xs font-bold px-3 py-1 rounded-full" style={{background:"#00000015"}}>{registers.length} خزنة نشطة</span>
            {mainReg && <span className="text-xs font-bold px-3 py-1 rounded-full" style={{background:"#00000015"}}>رئيسية: {fmt(mainReg.balance)}</span>}
          </div>
        </div>
      </div>

      {/* ── Tabs الخزن ── */}
      <div className="flex gap-1.5 flex-wrap border-b border-border/40 pb-3">
        <button onClick={() => setActiveTab("all")}
          className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all duration-200 ${
            activeTab==="all"
              ? "bg-primary text-primary-foreground shadow-md"
              : "text-muted-foreground hover:bg-muted/70 hover:text-foreground"
          }`}>
          كل الخزن
        </button>
        {registers.map(r => (
          <button key={r.id} onClick={() => { setActiveTab(r.id); setLedgerPage(1); }}
            className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all duration-200 flex items-center gap-1.5 ${
              activeTab===r.id
                ? "bg-primary text-primary-foreground shadow-md"
                : "text-muted-foreground hover:bg-muted/70 hover:text-foreground"
            }`}>
            {r.type==="main" ? <Star className="w-3 h-3" /> : <Building2 className="w-3 h-3" />}
            {r.name}
            {alerts.some(a => a.registerId === r.id) && <span className="w-2 h-2 rounded-full bg-rose-500 shrink-0 animate-pulse" />}
          </button>
        ))}
      </div>

      {/* ── Tab: كل الخزن ── */}
      {activeTab === "all" && (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {registers.map(r => {
            const net = r.monthlyIn - r.monthlyOut;
            const hasAlert = alerts.some(a => a.registerId === r.id);
            const isMain = r.type === "main";
            return (
              <div key={r.id}
                className={`group rounded-2xl border p-5 bg-card cursor-pointer
                  hover:shadow-xl hover:-translate-y-1 transition-all duration-300
                  ${hasAlert ? "border-rose-400/50 shadow-rose-500/10 shadow-md"
                    : isMain ? "border-yellow-400/40 shadow-yellow-500/10 shadow-md"
                    : "border-border/50 hover:border-border hover:shadow-md"}`}
                onClick={() => { setActiveTab(r.id); setLedgerPage(1); }}>

                {/* card header */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 shadow-sm
                      ${isMain ? "bg-gradient-to-br from-yellow-500/20 to-amber-500/10" : "bg-gradient-to-br from-primary/15 to-primary/5"}`}>
                      {isMain
                        ? <Star className="w-5 h-5 text-yellow-500" />
                        : <Building2 className="w-5 h-5 text-primary" />}
                    </div>
                    <div>
                      <p className="font-semibold text-sm leading-tight">{r.name}</p>
                      <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full mt-0.5 inline-block
                        ${isMain ? "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400" : "bg-muted text-muted-foreground"}`}>
                        {isMain ? "رئيسية" : "فرعية"}
                      </span>
                    </div>
                  </div>
                  <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    {hasAlert && <Bell className="w-3.5 h-3.5 text-rose-500 mx-1" />}
                    <button className="p-1.5 rounded-lg hover:bg-muted transition-colors"
                      onClick={e => { e.stopPropagation(); setSelectedReg(r); setEditForm({name:r.name, description:r.description??""}); setEditOpen(true); }}>
                      <Pencil className="w-3 h-3 text-muted-foreground" />
                    </button>
                    <button className="p-1.5 rounded-lg hover:bg-muted transition-colors"
                      onClick={e => { e.stopPropagation(); setSelectedReg(r); setThresholdVal(r.lowBalanceThreshold ?? ""); setThresholdOpen(true); }}>
                      <Bell className="w-3 h-3 text-muted-foreground" />
                    </button>
                    {!isMain && (
                      <button className="p-1.5 rounded-lg hover:bg-muted transition-colors"
                        onClick={e => { e.stopPropagation(); if (confirm(`تعطيل "${r.name}"؟`)) delMut.mutate(r.id); }}>
                        <Trash2 className="w-3 h-3 text-rose-400" />
                      </button>
                    )}
                  </div>
                </div>

                {/* balance */}
                <p className={`text-3xl font-black tabular-nums mb-1 ${hasAlert ? "text-rose-600" : "text-emerald-600 dark:text-emerald-400"}`}>
                  {fmt(r.balance)}
                </p>
                {r.lowBalanceThreshold && (
                  <p className="text-[10px] text-muted-foreground mb-2 flex items-center gap-1">
                    <Bell className="w-2.5 h-2.5" /> حد: {fmt(r.lowBalanceThreshold)}
                  </p>
                )}

                {/* monthly mini stats */}
                <div className="grid grid-cols-3 gap-2 text-center mt-3 pt-3 border-t border-border/40">
                  <div className="bg-emerald-50 dark:bg-emerald-900/20 rounded-xl py-2">
                    <p className="text-[10px] text-muted-foreground mb-0.5">دخل</p>
                    <p className="text-xs font-bold text-emerald-600">+{fmtShort(r.monthlyIn)}</p>
                  </div>
                  <div className="bg-rose-50 dark:bg-rose-900/20 rounded-xl py-2">
                    <p className="text-[10px] text-muted-foreground mb-0.5">خروج</p>
                    <p className="text-xs font-bold text-rose-600">-{fmtShort(r.monthlyOut)}</p>
                  </div>
                  <div className={`rounded-xl py-2 ${net>=0 ? "bg-emerald-50 dark:bg-emerald-900/20" : "bg-rose-50 dark:bg-rose-900/20"}`}>
                    <p className="text-[10px] text-muted-foreground mb-0.5">صافي</p>
                    <p className={`text-xs font-bold ${net>=0?"text-emerald-600":"text-rose-600"}`}>{net>=0?"+":""}{fmtShort(net)}</p>
                  </div>
                </div>

                {/* actions */}
                <div className="flex gap-2 mt-3">
                  <Button size="sm" variant="outline" className="flex-1 gap-1 text-[11px] h-8 rounded-xl hover:bg-amber-50 hover:text-amber-700 hover:border-amber-300 dark:hover:bg-amber-900/20"
                    onClick={e => { e.stopPropagation(); setSelectedReg(r); setTxOpen(true); }}>
                    <Plus className="w-3 h-3" /> حركة
                  </Button>
                  <Button size="sm" variant="ghost" className="flex-1 gap-1 text-[11px] h-8 rounded-xl hover:bg-muted"
                    onClick={e => { e.stopPropagation(); setActiveTab(r.id); }}>
                    <CreditCard className="w-3 h-3" /> كشف
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Tab: خزنة محددة ── */}
      {activeReg && (
        <div className="space-y-5">
          {/* بطاقة الخزنة */}
          <div className={`rounded-2xl border p-6 shadow-sm ${alerts.some(a=>a.registerId===activeReg.id) ? "border-rose-400/60 bg-rose-50/20 dark:bg-rose-950/10" : activeReg.type==="main" ? "border-yellow-400/40 bg-yellow-50/20 dark:bg-yellow-900/10" : "border-border bg-card"}`}>
            <div className="flex items-start justify-between flex-wrap gap-3">
              <div className="flex items-center gap-4">
                {activeReg.type==="main"
                  ? <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-yellow-500/20 to-amber-500/10 flex items-center justify-center shadow-sm"><Star className="w-7 h-7 text-yellow-500" /></div>
                  : <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500/15 to-indigo-500/10 flex items-center justify-center shadow-sm"><Building2 className="w-7 h-7 text-blue-500" /></div>}
                <div>
                  <p className="text-2xl font-black">{activeReg.name}</p>
                  {activeReg.description && <p className="text-sm text-muted-foreground mt-0.5">{activeReg.description}</p>}
                  {activeReg.lowBalanceThreshold && (
                    <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1.5 bg-muted/50 w-fit px-2 py-1 rounded-lg"><Bell className="w-3 h-3" /> حد التنبيه: {fmt(activeReg.lowBalanceThreshold)}</p>
                  )}
                </div>
              </div>
              <div className="text-end">
                <p className={`text-4xl font-black tabular-nums ${alerts.some(a=>a.registerId===activeReg.id) ? "text-rose-600" : "text-emerald-600"}`}>{fmt(activeReg.balance)}</p>
                <p className="text-xs text-muted-foreground mt-1.5 bg-muted/50 px-2 py-0.5 rounded-full inline-block">الرصيد الحالي</p>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3 mt-5 pt-5 border-t border-border/50">
              <div className="text-center bg-emerald-50 dark:bg-emerald-900/20 rounded-2xl p-3"><p className="text-xs text-muted-foreground mb-1">دخل الشهر</p><p className="text-lg font-bold text-emerald-500">+{fmt(activeReg.monthlyIn)}</p></div>
              <div className="text-center bg-rose-50 dark:bg-rose-900/20 rounded-2xl p-3"><p className="text-xs text-muted-foreground mb-1">خروج الشهر</p><p className="text-lg font-bold text-rose-500">-{fmt(activeReg.monthlyOut)}</p></div>
              <div className={`text-center rounded-2xl p-3 ${(activeReg.monthlyIn-activeReg.monthlyOut)>=0?"bg-emerald-50 dark:bg-emerald-900/20":"bg-rose-50 dark:bg-rose-900/20"}`}><p className="text-xs text-muted-foreground mb-1">صافي الشهر</p>
                <p className={`text-lg font-bold ${(activeReg.monthlyIn-activeReg.monthlyOut)>=0?"text-emerald-500":"text-rose-500"}`}>{fmt(activeReg.monthlyIn - activeReg.monthlyOut)}</p>
              </div>
            </div>
            <div className="flex gap-2 mt-5 flex-wrap">
              <Button size="sm" className="gap-1.5 rounded-xl h-9 font-bold text-black shadow-md" style={{background:"#DEA821"}} onMouseEnter={e=>(e.currentTarget.style.background="#c8931c")} onMouseLeave={e=>(e.currentTarget.style.background="#DEA821")} onClick={() => { setSelectedReg(activeReg); setTxOpen(true); }}><Plus className="w-4 h-4" /> حركة جديدة</Button>
              <Button size="sm" variant="outline" className="gap-1.5 rounded-xl h-9" onClick={() => setTransferOpen(true)}><ArrowRightLeft className="w-4 h-4" /> تحويل</Button>
              <Button size="sm" variant="outline" className="gap-1.5 rounded-xl h-9" onClick={() => { setSelectedReg(activeReg); setEditForm({name:activeReg.name,description:activeReg.description??""}); setEditOpen(true); }}><Pencil className="w-4 h-4" /> تعديل</Button>
              <Button size="sm" variant="outline" className="gap-1.5 rounded-xl h-9" onClick={() => { setSelectedReg(activeReg); setThresholdVal(activeReg.lowBalanceThreshold ?? ""); setThresholdOpen(true); }}><Bell className="w-4 h-4" /> حد التنبيه</Button>
            </div>
          </div>

          {/* Chart */}
          {flowData && flowData.length > 1 && (
            <div className="rounded-2xl border border-border bg-card p-5">
              <p className="text-sm font-bold mb-4 flex items-center gap-2"><TrendingUp className="w-4 h-4" style={{color:"#DEA821"}} /> التدفق النقدي — آخر 30 يوم</p>
              <ResponsiveContainer width="100%" height={160}>
                <AreaChart data={flowData} margin={{top:4,right:4,left:0,bottom:0}}>
                  <defs>
                    <linearGradient id="gin" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/><stop offset="95%" stopColor="#10b981" stopOpacity={0}/></linearGradient>
                    <linearGradient id="gout" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#f43f5e" stopOpacity={0.3}/><stop offset="95%" stopColor="#f43f5e" stopOpacity={0}/></linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.1}/>
                  <XAxis dataKey="day" tick={{fontSize:10}} tickFormatter={v=>v?.slice(5)}/>
                  <YAxis tick={{fontSize:10}} tickFormatter={v=>fmtShort(v)}/>
                  <Tooltip formatter={(v:any)=>fmt(v)} labelFormatter={v=>`يوم ${v}`}/>
                  <Area type="monotone" dataKey="in"  stroke="#10b981" strokeWidth={1.5} fill="url(#gin)"  name="دخل"/>
                  <Area type="monotone" dataKey="out" stroke="#f43f5e" strokeWidth={1.5} fill="url(#gout)" name="خروج"/>
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* كشف الحساب */}
          <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-sm">
            <div className="p-5 border-b border-border bg-muted/20">
              <div className="flex items-center justify-between mb-4">
                <p className="text-sm font-bold flex items-center gap-2"><CreditCard className="w-4 h-4 text-primary" /> كشف الحساب</p>
                <Button size="sm" variant="outline" className="gap-1.5 text-xs h-8 rounded-xl" onClick={handleExport}>
                  <Download className="w-3.5 h-3.5" /> تصدير CSV
                </Button>
              </div>
              <div className="flex flex-wrap gap-2">
                <div className="flex items-center gap-1.5 text-xs">
                  <label className="text-muted-foreground font-medium">من</label>
                  <input type="date" className="border border-border rounded-lg px-2.5 py-1.5 text-xs bg-card focus:outline-none focus:ring-2 focus:ring-primary/30" value={ledgerFrom} onChange={e=>{setLedgerFrom(e.target.value);setLedgerPage(1);}}/>
                </div>
                <div className="flex items-center gap-1.5 text-xs">
                  <label className="text-muted-foreground font-medium">إلى</label>
                  <input type="date" className="border border-border rounded-lg px-2.5 py-1.5 text-xs bg-card focus:outline-none focus:ring-2 focus:ring-primary/30" value={ledgerTo} onChange={e=>{setLedgerTo(e.target.value);setLedgerPage(1);}}/>
                </div>
                <select className="border border-border rounded-lg px-2.5 py-1.5 text-xs bg-card focus:outline-none focus:ring-2 focus:ring-primary/30" value={ledgerType} onChange={e=>{setLedgerType(e.target.value);setLedgerPage(1);}}>
                  <option value="all">كل الحركات</option>
                  {Object.entries(TX_LABELS).map(([k,v])=><option key={k} value={k}>{v.label}</option>)}
                </select>
                <div className="relative flex-1 min-w-32">
                  <Search className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground"/>
                  <input type="text" placeholder="بحث..." className="w-full border border-border rounded-lg pr-7 pl-2 py-1.5 text-xs bg-card focus:outline-none focus:ring-2 focus:ring-primary/30" value={ledgerSearch} onChange={e=>setLedgerSearch(e.target.value)}/>
                </div>
              </div>
            </div>

            {stats && (
              <div className="grid grid-cols-3 divide-x divide-x-reverse divide-border/50 border-b border-border/50 text-center">
                <div className="px-4 py-4 bg-emerald-50/50 dark:bg-emerald-900/10"><p className="text-xs text-muted-foreground mb-1">إجمالي الدخل</p><p className="text-sm font-bold text-emerald-500">+{fmt(stats.totalIn)}</p></div>
                <div className="px-4 py-4 bg-rose-50/50 dark:bg-rose-900/10"><p className="text-xs text-muted-foreground mb-1">إجمالي الخروج</p><p className="text-sm font-bold text-rose-500">-{fmt(stats.totalOut)}</p></div>
                <div className={`px-4 py-4 ${stats.net>=0?"bg-emerald-50/50 dark:bg-emerald-900/10":"bg-rose-50/50 dark:bg-rose-900/10"}`}><p className="text-xs text-muted-foreground mb-1">الصافي</p><p className={`text-sm font-bold ${stats.net>=0?"text-emerald-500":"text-rose-500"}`}>{fmt(stats.net)}</p></div>
              </div>
            )}

            {ledgerLoading ? (
              <div className="flex items-center justify-center py-14 gap-2 text-muted-foreground text-sm"><RefreshCw className="w-4 h-4 animate-spin text-primary"/> جارٍ التحميل...</div>
            ) : filteredTx.length === 0 ? (
              <div className="text-center py-14 text-muted-foreground">
                <div className="w-16 h-16 rounded-2xl bg-muted/50 flex items-center justify-center mx-auto mb-3">
                  <CreditCard className="w-8 h-8 opacity-30"/>
                </div>
                <p className="text-sm font-medium">مفيش حركات في هذه الفترة</p>
              </div>
            ) : (
              <div className="divide-y divide-border/50">
                {filteredTx.map(tx => {
                  const isCredit = CREDIT_TYPES.includes(tx.type);
                  const meta = TX_LABELS[tx.type] ?? {label:tx.type, color:"text-foreground"};
                  return (
                    <div key={tx.id} className="flex items-center gap-3 px-5 py-3.5 hover:bg-muted/30 transition-colors">
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${isCredit?"bg-emerald-500/10":"bg-rose-500/10"}`}>
                        {isCredit ? <ArrowUpCircle className="w-4.5 h-4.5 text-emerald-500"/> : <ArrowDownCircle className="w-4.5 h-4.5 text-rose-500"/>}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className={`text-xs font-bold ${meta.color}`}>{meta.label}</span>
                          {tx.referenceNumber && <span className="text-xs text-muted-foreground bg-muted/70 px-1.5 py-0.5 rounded-md">#{tx.referenceNumber}</span>}
                        </div>
                        {tx.description && <p className="text-xs text-muted-foreground truncate mt-0.5">{tx.description}</p>}
                        <p className="text-xs text-muted-foreground">{new Date(tx.transactionDate).toLocaleDateString("ar-EG")} — {tx.createdByName??""}</p>
                      </div>
                      <div className="text-end shrink-0">
                        <p className={`text-sm font-bold ${isCredit?"text-emerald-500":"text-rose-500"}`}>{isCredit?"+":"-"}{fmt(tx.amount)}</p>
                        <p className="text-xs text-muted-foreground">رصيد: {fmt(tx.balanceAfter)}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {pagination && pagination.total > pagination.limit && (
              <div className="flex items-center justify-between px-5 py-4 border-t border-border/50 bg-muted/10">
                <p className="text-xs text-muted-foreground font-medium">{pagination.total} حركة إجمالي</p>
                <div className="flex gap-1.5 items-center">
                  <Button size="sm" variant="outline" className="h-8 w-8 p-0 rounded-lg" disabled={ledgerPage===1} onClick={()=>setLedgerPage(p=>p-1)}><ChevronRight className="w-3.5 h-3.5"/></Button>
                  <span className="text-xs px-3 py-1.5 bg-muted rounded-lg text-muted-foreground font-medium">صفحة {ledgerPage}</span>
                  <Button size="sm" variant="outline" className="h-8 w-8 p-0 rounded-lg" disabled={ledgerPage*pagination.limit>=pagination.total} onClick={()=>setLedgerPage(p=>p+1)}><ChevronLeft className="w-3.5 h-3.5"/></Button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}


      {/* ══════════════════ DIALOGS ══════════════════ */}

      {/* خزنة جديدة */}
      <Dialog open={addRegOpen} onOpenChange={setAddRegOpen}>
        <DialogContent dir="rtl" className="max-w-md">
          <DialogHeader><DialogTitle>إضافة خزنة جديدة</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-2">
            <div><Label>اسم الخزنة</Label><Input placeholder="مثال: خزنة فرع المعادي" value={newReg.name} onChange={e=>setNewReg(p=>({...p,name:e.target.value}))}/></div>
            <div><Label>نوع الخزنة</Label>
              <Select value={newReg.type} onValueChange={v=>setNewReg(p=>({...p,type:v}))}>
                <SelectTrigger><SelectValue/></SelectTrigger>
                <SelectContent>
                  {!mainReg && <SelectItem value="main">رئيسية</SelectItem>}
                  <SelectItem value="branch">فرعية</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label>رصيد افتتاحي (اختياري)</Label><Input type="number" placeholder="0" value={newReg.initialBalance} onChange={e=>setNewReg(p=>({...p,initialBalance:e.target.value}))}/></div>
            <div><Label>ملاحظات</Label><Textarea placeholder="وصف اختياري" value={newReg.description} onChange={e=>setNewReg(p=>({...p,description:e.target.value}))}/></div>
            <Button className="w-full" onClick={()=>addRegMut.mutate(newReg)} disabled={!newReg.name||addRegMut.isPending}>{addRegMut.isPending?"جارٍ الحفظ...":"إنشاء الخزنة"}</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* حركة جديدة */}
      <Dialog open={txOpen} onOpenChange={setTxOpen}>
        <DialogContent dir="rtl" className="max-w-md">
          <DialogHeader><DialogTitle>حركة على: {selectedReg?.name}</DialogTitle></DialogHeader>
          <div className="text-sm text-muted-foreground mb-1">الرصيد الحالي: <span className="font-bold text-foreground">{fmt(selectedReg?.balance??0)}</span></div>
          <div className="space-y-4">
            <div><Label>نوع الحركة</Label>
              <Select value={txForm.type} onValueChange={v=>setTxForm(p=>({...p,type:v}))}>
                <SelectTrigger><SelectValue/></SelectTrigger>
                <SelectContent>{Object.entries(TX_LABELS).filter(([k])=>!["transfer_in","transfer_out"].includes(k)).map(([k,v])=><SelectItem key={k} value={k}>{v.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>المبلغ</Label><Input type="number" placeholder="0.00" value={txForm.amount} onChange={e=>setTxForm(p=>({...p,amount:e.target.value}))}/></div>
            <div><Label>التاريخ</Label><Input type="date" value={txForm.transactionDate} onChange={e=>setTxForm(p=>({...p,transactionDate:e.target.value}))}/></div>
            <div><Label>رقم مرجعي (اختياري)</Label><Input placeholder="رقم الفاتورة..." value={txForm.referenceNumber} onChange={e=>setTxForm(p=>({...p,referenceNumber:e.target.value}))}/></div>
            <div><Label>ملاحظة</Label><Input placeholder="وصف الحركة..." value={txForm.description} onChange={e=>setTxForm(p=>({...p,description:e.target.value}))}/></div>
            <Button className="w-full" onClick={()=>txMut.mutate(txForm)} disabled={!txForm.amount||txMut.isPending}>{txMut.isPending?"جارٍ التسجيل...":"تسجيل الحركة"}</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* تحويل بين خزنتين */}
      <Dialog open={transferOpen} onOpenChange={setTransferOpen}>
        <DialogContent dir="rtl" className="max-w-md">
          <DialogHeader><DialogTitle>تحويل بين خزنتين</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-2">
            <div><Label>من خزنة</Label>
              <Select value={transfer.fromId} onValueChange={v=>setTransfer(p=>({...p,fromId:v,toId:p.toId===v?"":p.toId}))}>
                <SelectTrigger><SelectValue placeholder="اختر المصدر..."/></SelectTrigger>
                <SelectContent>{registers.map(r=><SelectItem key={r.id} value={String(r.id)}>{r.name} — {fmt(r.balance)}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>إلى خزنة</Label>
              <Select value={transfer.toId} onValueChange={v=>setTransfer(p=>({...p,toId:v}))}>
                <SelectTrigger><SelectValue placeholder="اختر المستقبل..."/></SelectTrigger>
                <SelectContent>{registers.filter(r=>String(r.id)!==transfer.fromId).map(r=><SelectItem key={r.id} value={String(r.id)}>{r.name} — {fmt(r.balance)}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>المبلغ</Label><Input type="number" placeholder="0.00" value={transfer.amount} onChange={e=>setTransfer(p=>({...p,amount:e.target.value}))}/></div>
            <div><Label>ملاحظة (اختياري)</Label><Input placeholder="سبب التحويل..." value={transfer.description} onChange={e=>setTransfer(p=>({...p,description:e.target.value}))}/></div>
            <Button className="w-full" onClick={()=>transferMut.mutate({fromId:parseInt(transfer.fromId),toId:parseInt(transfer.toId),amount:transfer.amount,description:transfer.description})} disabled={!transfer.fromId||!transfer.toId||!transfer.amount||transfer.fromId===transfer.toId||transferMut.isPending}>{transferMut.isPending?"جارٍ التحويل...":"تحويل"}</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* تعديل اسم الخزنة */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent dir="rtl" className="max-w-md">
          <DialogHeader><DialogTitle>تعديل: {selectedReg?.name}</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-2">
            <div><Label>الاسم</Label><Input value={editForm.name} onChange={e=>setEditForm(p=>({...p,name:e.target.value}))}/></div>
            <div><Label>ملاحظات</Label><Textarea value={editForm.description} onChange={e=>setEditForm(p=>({...p,description:e.target.value}))}/></div>
            <Button className="w-full" onClick={()=>editMut.mutate(editForm)} disabled={!editForm.name||editMut.isPending}>{editMut.isPending?"جارٍ الحفظ...":"حفظ التعديلات"}</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ضبط حد التنبيه */}
      <Dialog open={thresholdOpen} onOpenChange={setThresholdOpen}>
        <DialogContent dir="rtl" className="max-w-md">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><Bell className="w-4 h-4" /> حد التنبيه — {selectedReg?.name}</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-2">
            <p className="text-sm text-muted-foreground">لما الرصيد يوصل للمبلغ ده هيظهر تنبيه. اتركه فاضي لتعطيل التنبيه.</p>
            <div><Label>حد الرصيد (ج.م)</Label><Input type="number" placeholder="مثال: 500" value={thresholdVal} onChange={e=>setThresholdVal(e.target.value)}/></div>
            <div className="flex gap-2">
              <Button className="flex-1" onClick={()=>thresholdMut.mutate({lowBalanceThreshold: thresholdVal ? parseFloat(thresholdVal) : null})} disabled={thresholdMut.isPending}>{thresholdMut.isPending?"جارٍ الحفظ...":"حفظ"}</Button>
              {thresholdVal && <Button variant="outline" onClick={()=>{setThresholdVal(""); thresholdMut.mutate({lowBalanceThreshold:null});}} disabled={thresholdMut.isPending}><BellOff className="w-4 h-4" /> تعطيل</Button>}
            </div>
          </div>
        </DialogContent>
      </Dialog>

    </div>
  );
}
