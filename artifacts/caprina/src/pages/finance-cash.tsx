import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Wallet, ArrowUpCircle, ArrowDownCircle, ArrowRightLeft, Building2, Star, Trash2, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";

const apiFetch = async (url: string, options?: RequestInit) => {
  const res = await fetch(url, { credentials: "include", ...options });
  if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error ?? "خطأ في الخادم"); }
  return res.json();
};

// ─── types ────────────────────────────────────────────────────────────────────
interface CashRegister {
  id: number;
  name: string;
  type: "main" | "branch";
  balance: string;
  description?: string;
  isActive: boolean;
  createdAt: string;
}

interface CashTransaction {
  id: number;
  registerId: number;
  type: string;
  amount: string;
  balanceBefore: string;
  balanceAfter: string;
  description?: string;
  referenceNumber?: string;
  transactionDate: string;
  createdByName?: string;
}

// ─── helpers ──────────────────────────────────────────────────────────────────
const fmt = (v: string | number) =>
  Number(v).toLocaleString("ar-EG", { minimumFractionDigits: 2 }) + " ج.م";

const TX_LABELS: Record<string, string> = {
  deposit:          "إيداع",
  withdrawal:       "سحب",
  order_collected:  "تحصيل طلب",
  shipping_transfer:"تحويل شحن",
  cash_sale:        "مبيعات نقدية",
  expense_paid:     "دفع مصروف",
  purchase_paid:    "دفع مورد",
  transfer_in:      "تحويل وارد",
  transfer_out:     "تحويل صادر",
};

const CREDIT_TYPES = ["deposit", "order_collected", "shipping_transfer", "cash_sale", "transfer_in"];

// ─── component ────────────────────────────────────────────────────────────────
export default function FinanceCashPage() {
  const qc = useQueryClient();
  const { toast } = useToast();

  // dialogs
  const [addRegisterOpen, setAddRegisterOpen]   = useState(false);
  const [txOpen, setTxOpen]                     = useState(false);
  const [transferOpen, setTransferOpen]         = useState(false);
  const [viewTxOpen, setViewTxOpen]             = useState(false);
  const [selectedReg, setSelectedReg]           = useState<CashRegister | null>(null);

  // forms
  const [newReg, setNewReg]     = useState({ name: "", type: "branch", description: "", initialBalance: "" });
  const [txForm, setTxForm]     = useState({ type: "deposit", amount: "", description: "", referenceNumber: "" });
  const [transfer, setTransfer] = useState({ toId: "", amount: "", description: "" });

  // ── queries ──────────────────────────────────────────────────────────────────
  const { data: regData, isLoading } = useQuery<{ registers: CashRegister[]; totalBalance: number }>({
    queryKey: ["/api/cash-registers"],
    queryFn: () => apiFetch("/api/cash-registers"),
  });

  const { data: transactions = [] } = useQuery<CashTransaction[]>({
    queryKey: ["/api/cash-registers", selectedReg?.id, "transactions"],
    queryFn: () => apiFetch(`/api/cash-registers/${selectedReg!.id}/transactions?limit=100`),
    enabled: !!selectedReg && viewTxOpen,
  });

  const addRegMut = useMutation({
    mutationFn: (data: any) => apiFetch("/api/cash-registers", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/cash-registers"] }); setAddRegisterOpen(false); setNewReg({ name: "", type: "branch", description: "", initialBalance: "" }); toast({ title: "✅ تم إنشاء الخزنة" }); },
    onError: (e: any) => toast({ title: "❌ خطأ", description: e.message, variant: "destructive" }),
  });

  const txMut = useMutation({
    mutationFn: (data: any) => apiFetch(`/api/cash-registers/${selectedReg!.id}/transaction`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/cash-registers"] }); setTxOpen(false); setTxForm({ type: "deposit", amount: "", description: "", referenceNumber: "" }); toast({ title: "✅ تم تسجيل الحركة" }); },
    onError: (e: any) => toast({ title: "❌ خطأ", description: e.message, variant: "destructive" }),
  });

  const transferMut = useMutation({
    mutationFn: (data: any) => apiFetch("/api/cash-registers/transfer", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/cash-registers"] }); setTransferOpen(false); setTransfer({ toId: "", amount: "", description: "" }); toast({ title: "✅ تم التحويل بنجاح" }); },
    onError: (e: any) => toast({ title: "❌ خطأ", description: e.message, variant: "destructive" }),
  });

  const deleteRegMut = useMutation({
    mutationFn: (id: number) => apiFetch(`/api/cash-registers/${id}`, { method: "DELETE" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/cash-registers"] }); toast({ title: "✅ تم تعطيل الخزنة" }); },
    onError: (e: any) => toast({ title: "❌ خطأ", description: e.message, variant: "destructive" }),
  });

  const registers   = regData?.registers ?? [];
  const totalBalance = regData?.totalBalance ?? 0;
  const mainReg     = registers.find(r => r.type === "main");
  const branchRegs  = registers.filter(r => r.type === "branch");

  if (isLoading) return <div className="flex items-center justify-center h-64 text-muted-foreground">جارٍ التحميل...</div>;

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><Wallet className="text-emerald-500" /> الخزنة</h1>
          <p className="text-sm text-muted-foreground mt-1">إدارة الخزنة الرئيسية والفروع</p>
        </div>
        <Button onClick={() => setAddRegisterOpen(true)} className="gap-2">
          <Plus className="w-4 h-4" /> خزنة فرعية جديدة
        </Button>
      </div>

      {/* إجمالي الكاش */}
      <div className="rounded-2xl bg-gradient-to-l from-emerald-500 to-teal-600 text-white p-6 shadow-lg">
        <p className="text-sm opacity-80 mb-1">إجمالي الكاش (كل الخزن)</p>
        <p className="text-4xl font-bold">{fmt(totalBalance)}</p>
        <p className="text-xs opacity-70 mt-2">{registers.length} خزنة نشطة</p>
      </div>

      {/* الخزنة الرئيسية */}
      {mainReg && (
        <div>
          <h2 className="font-semibold text-base mb-3 flex items-center gap-2"><Star className="w-4 h-4 text-yellow-500" />الخزنة الرئيسية</h2>
          <RegisterCard
            register={mainReg}
            isMain
            onTx={(r) => { setSelectedReg(r); setTxOpen(true); }}
            onTransfer={(r) => { setSelectedReg(r); setTransferOpen(true); }}
            onView={(r) => { setSelectedReg(r); setViewTxOpen(true); }}
          />
        </div>
      )}

      {/* الخزن الفرعية */}
      {branchRegs.length > 0 && (
        <div>
          <h2 className="font-semibold text-base mb-3 flex items-center gap-2"><Building2 className="w-4 h-4 text-blue-500" />الخزن الفرعية</h2>
          <div className="grid gap-4 md:grid-cols-2">
            {branchRegs.map(r => (
              <RegisterCard
                key={r.id}
                register={r}
                onTx={(r) => { setSelectedReg(r); setTxOpen(true); }}
                onView={(r) => { setSelectedReg(r); setViewTxOpen(true); }}
                onDelete={(id) => { if (confirm("هتعطل الخزنة دي؟")) deleteRegMut.mutate(id); }}
              />
            ))}
          </div>
        </div>
      )}

      {registers.length === 0 && (
        <div className="text-center py-16 text-muted-foreground">
          <Wallet className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>مفيش خزن بعد. ابدأ بإنشاء الخزنة الرئيسية.</p>
          <Button className="mt-4" onClick={() => { setNewReg(p => ({...p, type: "main"})); setAddRegisterOpen(true); }}>
            إنشاء الخزنة الرئيسية
          </Button>
        </div>
      )}

      {/* ─── Dialog: خزنة جديدة ─── */}
      <Dialog open={addRegisterOpen} onOpenChange={setAddRegisterOpen}>
        <DialogContent dir="rtl" className="max-w-md">
          <DialogHeader><DialogTitle>إضافة خزنة جديدة</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-2">
            <div><Label>اسم الخزنة</Label><Input placeholder="مثال: خزنة فرع المعادي" value={newReg.name} onChange={e => setNewReg(p => ({...p, name: e.target.value}))} /></div>
            <div><Label>نوع الخزنة</Label>
              <Select value={newReg.type} onValueChange={v => setNewReg(p => ({...p, type: v}))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {!mainReg && <SelectItem value="main">رئيسية</SelectItem>}
                  <SelectItem value="branch">فرعية</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label>رصيد افتتاحي (اختياري)</Label><Input type="number" placeholder="0" value={newReg.initialBalance} onChange={e => setNewReg(p => ({...p, initialBalance: e.target.value}))} /></div>
            <div><Label>ملاحظات</Label><Textarea placeholder="وصف اختياري" value={newReg.description} onChange={e => setNewReg(p => ({...p, description: e.target.value}))} /></div>
            <Button className="w-full" onClick={() => addRegMut.mutate(newReg)} disabled={!newReg.name || addRegMut.isPending}>
              {addRegMut.isPending ? "جارٍ الحفظ..." : "إنشاء الخزنة"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ─── Dialog: حركة (إيداع/سحب) ─── */}
      <Dialog open={txOpen} onOpenChange={setTxOpen}>
        <DialogContent dir="rtl" className="max-w-md">
          <DialogHeader><DialogTitle>حركة على خزنة: {selectedReg?.name}</DialogTitle></DialogHeader>
          <div className="text-sm text-muted-foreground mb-2">الرصيد الحالي: <span className="font-bold text-foreground">{fmt(selectedReg?.balance ?? 0)}</span></div>
          <div className="space-y-4">
            <div><Label>نوع الحركة</Label>
              <Select value={txForm.type} onValueChange={v => setTxForm(p => ({...p, type: v}))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(TX_LABELS).filter(([k]) => !["transfer_in","transfer_out"].includes(k)).map(([k,v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div><Label>المبلغ</Label><Input type="number" placeholder="0.00" value={txForm.amount} onChange={e => setTxForm(p => ({...p, amount: e.target.value}))} /></div>
            <div><Label>رقم مرجعي (اختياري)</Label><Input placeholder="رقم الفاتورة أو الأمر..." value={txForm.referenceNumber} onChange={e => setTxForm(p => ({...p, referenceNumber: e.target.value}))} /></div>
            <div><Label>ملاحظة</Label><Input placeholder="وصف الحركة..." value={txForm.description} onChange={e => setTxForm(p => ({...p, description: e.target.value}))} /></div>
            <Button className="w-full" onClick={() => txMut.mutate(txForm)} disabled={!txForm.amount || txMut.isPending}>
              {txMut.isPending ? "جارٍ التسجيل..." : "تسجيل الحركة"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ─── Dialog: تحويل للفرع ─── */}
      <Dialog open={transferOpen} onOpenChange={setTransferOpen}>
        <DialogContent dir="rtl" className="max-w-md">
          <DialogHeader><DialogTitle>تحويل من الخزنة الرئيسية</DialogTitle></DialogHeader>
          <div className="text-sm text-muted-foreground mb-2">رصيد الرئيسية: <span className="font-bold text-foreground">{fmt(mainReg?.balance ?? 0)}</span></div>
          <div className="space-y-4">
            <div><Label>الخزنة الفرعية المستقبِلة</Label>
              <Select value={transfer.toId} onValueChange={v => setTransfer(p => ({...p, toId: v}))}>
                <SelectTrigger><SelectValue placeholder="اختر الفرع..." /></SelectTrigger>
                <SelectContent>
                  {branchRegs.map(r => <SelectItem key={r.id} value={String(r.id)}>{r.name} — {fmt(r.balance)}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div><Label>المبلغ</Label><Input type="number" placeholder="0.00" value={transfer.amount} onChange={e => setTransfer(p => ({...p, amount: e.target.value}))} /></div>
            <div><Label>ملاحظة (اختياري)</Label><Input placeholder="سبب التحويل..." value={transfer.description} onChange={e => setTransfer(p => ({...p, description: e.target.value}))} /></div>
            <Button className="w-full" onClick={() => transferMut.mutate({ fromId: mainReg?.id, toId: parseInt(transfer.toId), amount: transfer.amount, description: transfer.description })} disabled={!transfer.toId || !transfer.amount || transferMut.isPending}>
              {transferMut.isPending ? "جارٍ التحويل..." : "تحويل"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ─── Dialog: كشف حساب ─── */}
      <Dialog open={viewTxOpen} onOpenChange={setViewTxOpen}>
        <DialogContent dir="rtl" className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader><DialogTitle>كشف حساب: {selectedReg?.name}</DialogTitle></DialogHeader>
          <div className="text-sm text-muted-foreground mb-3">الرصيد الحالي: <span className="font-bold text-foreground">{fmt(selectedReg?.balance ?? 0)}</span></div>
          {transactions.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">مفيش حركات بعد</p>
          ) : (
            <div className="space-y-2">
              {transactions.map(tx => {
                const isCredit = CREDIT_TYPES.includes(tx.type);
                return (
                  <div key={tx.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/40 border border-border">
                    <div className="flex items-center gap-3">
                      {isCredit
                        ? <ArrowUpCircle className="w-5 h-5 text-emerald-500 shrink-0" />
                        : <ArrowDownCircle className="w-5 h-5 text-red-500 shrink-0" />}
                      <div>
                        <p className="text-sm font-medium">{TX_LABELS[tx.type] ?? tx.type}</p>
                        {tx.description && <p className="text-xs text-muted-foreground">{tx.description}</p>}
                        <p className="text-xs text-muted-foreground">{new Date(tx.transactionDate).toLocaleDateString("ar-EG")}</p>
                      </div>
                    </div>
                    <div className="text-end">
                      <p className={`font-semibold ${isCredit ? "text-emerald-600" : "text-red-500"}`}>
                        {isCredit ? "+" : "-"}{fmt(tx.amount)}
                      </p>
                      <p className="text-xs text-muted-foreground">الرصيد: {fmt(tx.balanceAfter)}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── RegisterCard component ────────────────────────────────────────────────────
function RegisterCard({ register, isMain = false, onTx, onTransfer, onView, onDelete }: {
  register: CashRegister;
  isMain?: boolean;
  onTx: (r: CashRegister) => void;
  onTransfer?: (r: CashRegister) => void;
  onView: (r: CashRegister) => void;
  onDelete?: (id: number) => void;
}) {
  const fmt = (v: string | number) =>
    Number(v).toLocaleString("ar-EG", { minimumFractionDigits: 2 }) + " ج.م";

  return (
    <div className={`rounded-xl border p-5 shadow-sm bg-card ${isMain ? "border-yellow-300 bg-yellow-50/30 dark:bg-yellow-900/10" : ""}`}>
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="flex items-center gap-2">
            {isMain ? <Star className="w-4 h-4 text-yellow-500" /> : <Building2 className="w-4 h-4 text-blue-500" />}
            <span className="font-semibold">{register.name}</span>
            <Badge variant={isMain ? "default" : "secondary"} className="text-xs">{isMain ? "رئيسية" : "فرعية"}</Badge>
          </div>
          {register.description && <p className="text-xs text-muted-foreground mt-1">{register.description}</p>}
        </div>
        <p className="text-2xl font-bold text-emerald-600">{fmt(register.balance)}</p>
      </div>
      <Separator className="my-3" />
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="outline" className="gap-1" onClick={() => onTx(register)}>
          <Plus className="w-3 h-3" /> حركة
        </Button>
        {isMain && onTransfer && (
          <Button size="sm" variant="outline" className="gap-1 text-blue-600" onClick={() => onTransfer(register)}>
            <ArrowRightLeft className="w-3 h-3" /> تحويل للفرع
          </Button>
        )}
        <Button size="sm" variant="ghost" className="gap-1" onClick={() => onView(register)}>
          <Eye className="w-3 h-3" /> الحركات
        </Button>
        {!isMain && onDelete && (
          <Button size="sm" variant="ghost" className="gap-1 text-red-500 hover:text-red-600" onClick={() => onDelete(register.id)}>
            <Trash2 className="w-3 h-3" />
          </Button>
        )}
      </div>
    </div>
  );
}
