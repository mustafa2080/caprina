import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import {
  Crown, Plus, RefreshCw, Ban, Trash2, CheckCircle2, Clock, XCircle,
  Users, Building2, Zap, Rocket, X, ChevronDown, Tag, Save, ChevronUp,
  Sparkles, Shield
} from "lucide-react";

interface Tenant {
  id: number; name: string; slug: string; plan: string; planStatus: string;
  expiresAt: string; graceUntil: string | null; contactEmail: string | null;
  contactPhone: string | null; notes: string | null; isActive: boolean; createdAt: string;
}
interface PlanPrice {
  monthlyPrice: number | null; yearlyPrice: number | null;
  yearlySaving: number | null; priceDisplay: string; period: string;
}

const PLAN_LABELS: Record<string, { label: string; glow: string; border: string; bg: string; text: string; icon: any }> = {
  free_trial: { label: "تجريبي",  glow: "shadow-zinc-500/20",   border: "border-zinc-500/30",   bg: "bg-zinc-500/10",   text: "text-zinc-300",   icon: Zap      },
  starter:    { label: "أساسي",   glow: "shadow-blue-500/25",   border: "border-blue-500/30",   bg: "bg-blue-500/10",   text: "text-blue-300",   icon: Rocket   },
  pro:        { label: "احترافي", glow: "shadow-violet-500/25", border: "border-violet-500/30", bg: "bg-violet-500/10", text: "text-violet-300", icon: Crown    },
  enterprise: { label: "مؤسسي",  glow: "shadow-amber-500/25",  border: "border-amber-500/30",  bg: "bg-amber-500/10",  text: "text-amber-300",  icon: Building2},
};

const STATUS_CONFIG: Record<string, { label: string; glow: string; border: string; bg: string; text: string; icon: any }> = {
  active:    { label: "نشط",    glow: "shadow-emerald-500/30", border: "border-emerald-500/40", bg: "bg-emerald-500/10", text: "text-emerald-300", icon: CheckCircle2 },
  expired:   { label: "منتهي",  glow: "shadow-red-500/30",     border: "border-red-500/40",     bg: "bg-red-500/10",     text: "text-red-300",     icon: XCircle      },
  suspended: { label: "موقوف",  glow: "shadow-orange-500/30",  border: "border-orange-500/40",  bg: "bg-orange-500/10",  text: "text-orange-300",  icon: Ban          },
  grace:     { label: "مهلة",   glow: "shadow-yellow-500/30",  border: "border-yellow-500/40",  bg: "bg-yellow-500/10",  text: "text-yellow-300",  icon: Clock        },
};

function daysLeft(expiresAt: string) {
  return Math.ceil((new Date(expiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
}
function formatDate(d: string) {
  return new Date(d).toLocaleDateString("ar-EG", { year: "numeric", month: "short", day: "numeric" });
}

// ─── shared card style ────────────────────────────────────────────────────────
const cardCls = "rounded-2xl border border-border/60 bg-gradient-to-br from-card to-card/80 backdrop-blur-sm shadow-xl shadow-black/20 overflow-hidden";
const glowInputCls = "w-full h-10 px-3 rounded-xl border border-border/60 bg-background/60 text-sm text-foreground outline-none transition-all focus:border-primary/70 focus:ring-2 focus:ring-primary/15 focus:shadow-[0_0_12px_rgba(var(--primary-rgb),.15)]";

// ── PricingManager ────────────────────────────────────────────────────────────
function PricingManager() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [localPrices, setLocalPrices] = useState<Record<string, Partial<PlanPrice>>>({});

  const { data: prices, isLoading } = useQuery<Record<string, PlanPrice>>({
    queryKey: ["admin-plan-prices"],
    queryFn: () => apiFetch("/admin/plan-prices"),
    onSuccess: (data) => setLocalPrices(
      Object.fromEntries(Object.entries(data).map(([k, v]) => [k, { monthlyPrice: v.monthlyPrice, yearlyPrice: v.yearlyPrice }]))
    ),
  });

  const saveMut = useMutation({
    mutationFn: (body: any) => apiFetch("/admin/plan-prices", { method: "PATCH", body: JSON.stringify(body) }),
    onSuccess: () => { toast({ title: "✅ تم حفظ الأسعار" }); qc.invalidateQueries({ queryKey: ["admin-plan-prices"] }); },
    onError: (e: any) => toast({ title: "خطأ", description: e.message, variant: "destructive" }),
  });

  const editablePlans = ["free_trial", "starter", "pro"] as const;

  return (
    <div className={`${cardCls} shadow-amber-500/10`}>
      {/* header */}
      <div
        className="flex items-center justify-between px-4 sm:px-5 py-4 cursor-pointer hover:bg-amber-500/5 transition-colors group"
        onClick={() => setOpen(v => !v)}
      >
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-500/25 to-amber-600/15 border border-amber-500/35 flex items-center justify-center shrink-0 shadow-lg shadow-amber-500/20">
            <Tag className="w-4 h-4 text-amber-400" />
          </div>
          <div>
            <p className="text-sm font-black text-foreground group-hover:text-amber-300 transition-colors">أسعار الباقات</p>
            <p className="text-[11px] text-muted-foreground">تحكم في الأسعار المعروضة في صفحة تسجيل الدخول</p>
          </div>
        </div>
        <div className="w-7 h-7 rounded-lg bg-muted/30 border border-border/40 flex items-center justify-center transition-transform duration-300">
          {open ? <ChevronUp className="w-3.5 h-3.5 text-amber-400" /> : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />}
        </div>
      </div>

      {open && (
        <div className="border-t border-border/50 px-4 sm:px-5 pb-5 pt-4 bg-gradient-to-b from-amber-500/3 to-transparent">
          {isLoading ? (
            <div className="flex justify-center py-8">
              <div className="w-6 h-6 border-2 border-amber-400/40 border-t-amber-400 rounded-full animate-spin" />
            </div>
          ) : (
            <div className="space-y-4">
              {/* free_trial — editable مع تلميح */}
              {(() => {
                const planKey = "free_trial";
                const meta = PLAN_LABELS[planKey];
                const Icon = meta.icon;
                const current = prices?.[planKey];
                const local = localPrices[planKey] ?? {};
                const hasPrice = !!(local.monthlyPrice ?? current?.monthlyPrice);
                return (
                  <div className={`rounded-xl border ${meta.border} bg-gradient-to-br from-zinc-500/8 to-zinc-600/4 p-3.5 sm:p-4 space-y-3 shadow-lg ${meta.glow}`}>
                    <div className="flex items-center gap-2 flex-wrap">
                      <div className={`w-8 h-8 rounded-lg border ${meta.border} ${meta.bg} flex items-center justify-center shrink-0`}>
                        <Icon size={13} className={meta.text} />
                      </div>
                      <span className={`text-sm font-black ${meta.text}`}>{meta.label}</span>
                      <span className="text-[10px] text-muted-foreground bg-muted/30 border border-border/40 px-2 py-0.5 rounded-full mr-auto">
                        {hasPrice ? "💰 مدفوع" : "مجاناً افتراضياً"}
                      </span>
                    </div>
                    <p className="text-[10px] text-muted-foreground leading-relaxed bg-muted/20 border border-border/30 rounded-lg px-3 py-2">
                      💡 اتركه فارغاً لتعرض "مجاناً" في صفحة الأسعار — أو ضع سعراً إذا أردت تحويله لباقة مدفوعة
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className={`text-[10px] font-bold ${meta.text} opacity-70 block mb-1`}>السعر الشهري (ج.م) — اختياري</label>
                        <input type="number" min="0" dir="ltr" placeholder="0 = مجاناً"
                          value={local.monthlyPrice ?? current?.monthlyPrice ?? ""}
                          onChange={e => setLocalPrices(p => ({ ...p, [planKey]: { ...p[planKey], monthlyPrice: e.target.value ? parseInt(e.target.value) : null } }))}
                          className={glowInputCls}
                        />
                      </div>
                      <div>
                        <label className={`text-[10px] font-bold ${meta.text} opacity-70 block mb-1`}>السعر السنوي (ج.م) — اختياري</label>
                        <input type="number" min="0" dir="ltr" placeholder="اتركه فارغاً"
                          value={local.yearlyPrice ?? current?.yearlyPrice ?? ""}
                          onChange={e => setLocalPrices(p => ({ ...p, [planKey]: { ...p[planKey], yearlyPrice: e.target.value ? parseInt(e.target.value) : null } }))}
                          className={glowInputCls}
                        />
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* starter + pro */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                {(["starter", "pro"] as const).map(planKey => {
                  const meta = PLAN_LABELS[planKey];
                  const Icon = meta.icon;
                  const current = prices?.[planKey];
                  const local = localPrices[planKey] ?? {};
                  const isBlue = planKey === "starter";
                  return (
                    <div key={planKey} className={`rounded-xl border ${meta.border} bg-gradient-to-br ${isBlue ? "from-blue-500/8 to-blue-600/4" : "from-violet-500/8 to-violet-600/4"} p-3.5 sm:p-4 space-y-3 shadow-lg ${meta.glow}`}>
                      <div className="flex items-center gap-2">
                        <div className={`w-8 h-8 rounded-lg border ${meta.border} ${meta.bg} flex items-center justify-center shrink-0 shadow-md ${meta.glow}`}>
                          <Icon size={13} className={meta.text} />
                        </div>
                        <span className={`text-sm font-black ${meta.text}`}>{meta.label}</span>
                        {current?.monthlyPrice && (
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${meta.border} ${meta.bg} ${meta.text} mr-auto`}>
                            {current.monthlyPrice} ج.م / شهر
                          </span>
                        )}
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className={`text-[10px] font-bold ${meta.text} opacity-70 block mb-1`}>السعر الشهري (ج.م)</label>
                          <input type="number" min="0" dir="ltr"
                            value={local.monthlyPrice ?? current?.monthlyPrice ?? ""}
                            onChange={e => setLocalPrices(p => ({ ...p, [planKey]: { ...p[planKey], monthlyPrice: e.target.value ? parseInt(e.target.value) : null } }))}
                            className={glowInputCls}
                          />
                        </div>
                        <div>
                          <label className={`text-[10px] font-bold ${meta.text} opacity-70 block mb-1`}>السعر السنوي (ج.م)</label>
                          <input type="number" min="0" dir="ltr"
                            value={local.yearlyPrice ?? current?.yearlyPrice ?? ""}
                            onChange={e => setLocalPrices(p => ({ ...p, [planKey]: { ...p[planKey], yearlyPrice: e.target.value ? parseInt(e.target.value) : null } }))}
                            className={glowInputCls}
                          />
                        </div>
                      </div>
                      {(local.monthlyPrice ?? current?.monthlyPrice) && (local.yearlyPrice ?? current?.yearlyPrice) && (() => {
                        const m = local.monthlyPrice ?? current?.monthlyPrice ?? 0;
                        const y = local.yearlyPrice ?? current?.yearlyPrice ?? 0;
                        const saving = (m! * 12) - y!;
                        return saving > 0 ? (
                          <p className="text-[10px] text-emerald-400 font-bold bg-emerald-500/8 border border-emerald-500/20 rounded-lg px-2.5 py-1.5">
                            💰 التوفير السنوي: {saving.toLocaleString("ar-EG")} ج.م ({Math.round(saving / (m! * 12) * 100)}%)
                          </p>
                        ) : null;
                      })()}
                    </div>
                  );
                })}
              </div>

              {/* enterprise — info only */}
              <div className="grid grid-cols-1 gap-3">
                {(["enterprise"] as const).map(planKey => {
                  const meta = PLAN_LABELS[planKey];
                  const Icon = meta.icon;
                  const current = prices?.[planKey];
                  return (
                    <div key={planKey} className={`rounded-xl border ${meta.border} bg-gradient-to-br from-muted/20 to-muted/10 px-4 py-3 flex items-center gap-3 shadow-md ${meta.glow}`}>
                      <div className={`w-8 h-8 rounded-lg border ${meta.border} ${meta.bg} flex items-center justify-center shrink-0 shadow-sm`}>
                        <Icon size={13} className={meta.text} />
                      </div>
                      <div>
                        <p className={`text-xs font-bold ${meta.text}`}>{meta.label}</p>
                        <p className="text-[10px] text-muted-foreground">{current?.priceDisplay ?? "—"}</p>
                      </div>
                    </div>
                  );
                })}
              </div>

              <button
                onClick={() => saveMut.mutate(localPrices)}
                disabled={saveMut.isPending}
                className="w-full h-11 bg-gradient-to-r from-amber-500/20 to-amber-600/15 border border-amber-500/40 text-amber-300 rounded-xl text-sm font-bold hover:from-amber-500/30 hover:to-amber-600/25 hover:shadow-lg hover:shadow-amber-500/20 active:scale-[.98] transition-all flex items-center justify-center gap-2 disabled:opacity-40 shadow-md shadow-amber-500/10"
              >
                {saveMut.isPending
                  ? <><div className="w-4 h-4 border-2 border-amber-400/40 border-t-amber-400 rounded-full animate-spin" /> جاري الحفظ...</>
                  : <><Save size={14} /> حفظ الأسعار</>}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Modal ─────────────────────────────────────────────────────────────────────
function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-md" onClick={onClose}>
      <div
        className="bg-gradient-to-b from-card to-card/95 border border-border/60 w-full flex flex-col rounded-t-3xl sm:rounded-2xl max-h-[95dvh] sm:max-h-[90vh] sm:max-w-xl sm:w-full shadow-2xl shadow-black/50"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex justify-center pt-2.5 pb-0 sm:hidden shrink-0">
          <div className="w-12 h-1.5 rounded-full bg-muted-foreground/25" />
        </div>
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-border/50 shrink-0">
          <h3 className="font-black text-base text-foreground">{title}</h3>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors">
            <X size={16} />
          </button>
        </div>
        <div className="overflow-y-auto overscroll-contain flex-1 px-5 pt-5 pb-safe">{children}</div>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function SuperAdminPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();

  if (user?.role !== "super_admin") {
    return (
      <div className="flex items-center justify-center min-h-[60vh]" dir="rtl">
        <div className="text-center space-y-3">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-500/20 to-amber-600/10 border border-amber-500/30 flex items-center justify-center mx-auto shadow-xl shadow-amber-500/15">
            <Crown className="w-8 h-8 text-amber-400" />
          </div>
          <p className="text-lg font-black text-foreground">ممنوع الوصول</p>
          <p className="text-sm text-muted-foreground">هذه الصفحة للأدمن الرئيسي فقط</p>
        </div>
      </div>
    );
  }

  const [showCreate, setShowCreate] = useState(false);
  const [showRenew, setShowRenew] = useState<Tenant | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [form, setForm] = useState({
    name: "", slug: "", plan: "starter", contactEmail: "", contactPhone: "",
    notes: "", durationDays: "30", adminUsername: "", adminPassword: "", adminDisplayName: ""
  });
  const [renewPlan, setRenewPlan] = useState("starter");
  const [renewDays, setRenewDays] = useState("30");

  const { data: tenants = [], isLoading } = useQuery<Tenant[]>({
    queryKey: ["admin-tenants"],
    queryFn: () => apiFetch("/admin/tenants"),
    refetchInterval: 30000,
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["admin-tenants"] });

  const createMut = useMutation({
    mutationFn: (body: any) => apiFetch("/admin/tenants", { method: "POST", body: JSON.stringify(body) }),
    onSuccess: () => {
      toast({ title: "✅ تم إنشاء الاشتراك والمستخدم" }); invalidate(); setShowCreate(false);
      setForm({ name: "", slug: "", plan: "starter", contactEmail: "", contactPhone: "", notes: "", durationDays: "30", adminUsername: "", adminPassword: "", adminDisplayName: "" });
    },
    onError: (e: any) => toast({ title: "خطأ", description: e.message, variant: "destructive" }),
  });

  const renewMut = useMutation({
    mutationFn: ({ id, body }: { id: number; body: any }) => apiFetch(`/admin/tenants/${id}/activate`, { method: "PATCH", body: JSON.stringify(body) }),
    onSuccess: () => { toast({ title: "✅ تم تجديد الاشتراك" }); invalidate(); setShowRenew(null); },
    onError: (e: any) => toast({ title: "خطأ", description: e.message, variant: "destructive" }),
  });

  const suspendMut = useMutation({
    mutationFn: (id: number) => apiFetch(`/admin/tenants/${id}/suspend`, { method: "PATCH" }),
    onSuccess: () => { toast({ title: "تم إيقاف الاشتراك" }); invalidate(); },
    onError: (e: any) => toast({ title: "خطأ", description: e.message, variant: "destructive" }),
  });

  const expireMut = useMutation({
    mutationFn: (id: number) => apiFetch(`/admin/tenants/${id}/expire`, { method: "PATCH" }),
    onSuccess: () => { toast({ title: "تم إنهاء الاشتراك" }); invalidate(); },
    onError: (e: any) => toast({ title: "خطأ", description: e.message, variant: "destructive" }),
  });

  const deleteMut = useMutation({
    mutationFn: (id: number) => apiFetch(`/admin/tenants/${id}`, { method: "DELETE" }),
    onSuccess: () => { toast({ title: "تم حذف العميل" }); invalidate(); },
    onError: (e: any) => toast({ title: "خطأ", description: e.message, variant: "destructive" }),
  });

  const active      = tenants.filter(t => t.planStatus === "active").length;
  const expired     = tenants.filter(t => t.planStatus === "expired").length;
  const expiringSoon = tenants.filter(t => t.planStatus === "active" && daysLeft(t.expiresAt) <= 7).length;

  // shared input class for modals
  const inp = "w-full h-11 px-3.5 rounded-xl border border-border/60 bg-background/60 text-sm text-foreground outline-none focus:border-primary/70 focus:ring-2 focus:ring-primary/15 focus:shadow-[0_0_14px_rgba(var(--primary-rgb),.12)] transition-all";

  return (
    <div className="space-y-5 sm:space-y-6 pb-6" dir="rtl">

      {/* ── Header ────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-amber-500/25 to-amber-600/15 border border-amber-500/35 flex items-center justify-center shadow-xl shadow-amber-500/20">
            <Crown className="w-5 h-5 text-amber-400" />
          </div>
          <div>
            <h1 className="text-lg sm:text-xl font-black text-foreground">إدارة الاشتراكات</h1>
            <p className="text-xs text-muted-foreground">لوحة تحكم الأدمن الرئيسي · {tenants.length} عميل</p>
          </div>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 bg-gradient-to-r from-primary to-primary/80 text-primary-foreground px-4 py-2.5 rounded-xl text-sm font-bold hover:shadow-lg hover:shadow-primary/25 hover:-translate-y-0.5 active:translate-y-0 transition-all shadow-md shadow-primary/15"
        >
          <Plus size={15} /> اشتراك جديد
        </button>
      </div>

      {/* ── Stats grid ────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "إجمالي العملاء", value: tenants.length, glow: "shadow-blue-500/15",    border: "border-blue-500/25",    bg: "from-blue-500/10 to-blue-600/5",    text: "text-blue-300",    icon: Users        },
          { label: "نشط",            value: active,          glow: "shadow-emerald-500/15", border: "border-emerald-500/25", bg: "from-emerald-500/10 to-emerald-600/5", text: "text-emerald-300", icon: CheckCircle2 },
          { label: "منتهي",          value: expired,         glow: "shadow-red-500/15",     border: "border-red-500/25",     bg: "from-red-500/10 to-red-600/5",     text: "text-red-300",     icon: XCircle      },
          { label: "ينتهي قريباً",   value: expiringSoon,    glow: "shadow-amber-500/15",   border: "border-amber-500/25",   bg: "from-amber-500/10 to-amber-600/5", text: "text-amber-300",   icon: Clock        },
        ].map(s => (
          <div key={s.label} className={`rounded-2xl border ${s.border} bg-gradient-to-br ${s.bg} backdrop-blur-sm p-4 shadow-xl ${s.glow}`}>
            <div className="flex items-center gap-2 mb-2">
              <s.icon className={`w-4 h-4 ${s.text}`} />
              <span className="text-[11px] sm:text-xs text-muted-foreground font-medium truncate">{s.label}</span>
            </div>
            <p className={`text-2xl sm:text-3xl font-black ${s.text}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* ── Pricing Manager ───────────────────────────────────────────────── */}
      <PricingManager />

      {/* ── Tenants List ──────────────────────────────────────────────────── */}
      <div className={cardCls}>
        {/* list header */}
        <div className="flex items-center gap-3 px-4 sm:px-5 py-3.5 border-b border-border/50 bg-gradient-to-r from-muted/20 to-transparent">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-primary/20 to-primary/10 border border-primary/25 flex items-center justify-center shadow-md shadow-primary/15">
            <Users size={14} className="text-primary" />
          </div>
          <p className="text-sm font-black text-foreground">قائمة العملاء</p>
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border border-primary/25 bg-primary/10 text-primary mr-auto">{tenants.length}</span>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-6 h-6 border-2 border-primary/40 border-t-primary rounded-full animate-spin" />
          </div>
        ) : tenants.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <Users className="w-10 h-10 mx-auto mb-3 opacity-20" />
            <p className="font-bold">لا يوجد عملاء بعد</p>
            <p className="text-sm mt-1">اضغط "اشتراك جديد" لإضافة أول عميل</p>
          </div>
        ) : (
          <div className="divide-y divide-border/40">
            {tenants.map(t => {
              const plan   = PLAN_LABELS[t.plan]   ?? { label: t.plan,      glow: "shadow-zinc-500/10",  border: "border-zinc-500/25",  bg: "bg-zinc-500/10",  text: "text-zinc-300",  icon: Zap   };
              const status = STATUS_CONFIG[t.planStatus] ?? { label: t.planStatus, glow: "shadow-zinc-500/10",  border: "border-zinc-500/25",  bg: "bg-zinc-500/10",  text: "text-zinc-300",  icon: Clock };
              const days = daysLeft(t.expiresAt);
              const isExpanded = expandedId === t.id;
              const PlanIcon = plan.icon;
              const StatusIcon = status.icon;
              return (
                <div key={t.id}>
                  <div
                    className="flex items-center gap-3 px-4 sm:px-5 py-3 sm:py-3.5 hover:bg-muted/15 cursor-pointer transition-colors"
                    onClick={() => setExpandedId(isExpanded ? null : t.id)}
                  >
                    <div className={`w-8 h-8 rounded-xl border ${plan.border} ${plan.bg} flex items-center justify-center shrink-0 shadow-md ${plan.glow}`}>
                      <PlanIcon size={13} className={plan.text} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-foreground truncate">{t.name}</p>
                      <p className="text-[11px] text-muted-foreground truncate">{t.slug}</p>
                    </div>
                    <span className={`hidden sm:inline-flex text-[10px] font-bold px-2 py-0.5 rounded-full border ${plan.border} ${plan.bg} ${plan.text}`}>{plan.label}</span>
                    <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border ${status.border} ${status.bg} ${status.text} shadow-sm ${status.glow}`}>
                      <StatusIcon size={9} />{status.label}
                    </span>
                    <span className={`text-xs font-bold hidden md:block tabular-nums ${days <= 3 ? "text-red-400" : days <= 7 ? "text-amber-400" : "text-muted-foreground"}`}>
                      {days > 0 ? `${days} يوم` : "منتهي"}
                    </span>
                    <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform duration-200 shrink-0 ${isExpanded ? "rotate-180" : ""}`} />
                  </div>

                  {isExpanded && (
                    <div className="px-4 sm:px-5 pb-4 bg-gradient-to-b from-muted/10 to-transparent border-t border-border/30">
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mt-3 text-xs">
                        <div className="bg-muted/20 rounded-lg px-3 py-2 border border-border/30">
                          <span className="text-muted-foreground block text-[10px] mb-0.5">الانتهاء</span>
                          <span className="font-bold text-foreground">{formatDate(t.expiresAt)}</span>
                        </div>
                        <div className="bg-muted/20 rounded-lg px-3 py-2 border border-border/30">
                          <span className="text-muted-foreground block text-[10px] mb-0.5">الإنشاء</span>
                          <span className="font-bold text-foreground">{formatDate(t.createdAt)}</span>
                        </div>
                        {t.contactEmail && (
                          <div className="bg-muted/20 rounded-lg px-3 py-2 border border-border/30">
                            <span className="text-muted-foreground block text-[10px] mb-0.5">إيميل</span>
                            <span className="font-bold text-foreground truncate block">{t.contactEmail}</span>
                          </div>
                        )}
                        {t.contactPhone && (
                          <div className="bg-muted/20 rounded-lg px-3 py-2 border border-border/30">
                            <span className="text-muted-foreground block text-[10px] mb-0.5">هاتف</span>
                            <span className="font-bold text-foreground">{t.contactPhone}</span>
                          </div>
                        )}
                        {t.notes && (
                          <div className="col-span-2 md:col-span-3 bg-muted/20 rounded-lg px-3 py-2 border border-border/30">
                            <span className="text-muted-foreground block text-[10px] mb-0.5">ملاحظات</span>
                            <span className="font-bold text-foreground">{t.notes}</span>
                          </div>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-2 mt-3">
                        <button
                          onClick={() => { setShowRenew(t); setRenewPlan(t.plan); setRenewDays("30"); }}
                          className="flex items-center gap-1.5 bg-gradient-to-r from-emerald-500/15 to-emerald-600/10 text-emerald-300 border border-emerald-500/30 px-3 py-2 rounded-xl text-xs font-bold hover:shadow-md hover:shadow-emerald-500/20 hover:-translate-y-0.5 active:translate-y-0 transition-all"
                        >
                          <RefreshCw size={12} /> تجديد
                        </button>
                        {t.planStatus !== "suspended" && (
                          <button
                            onClick={() => { if (confirm("إيقاف الاشتراك؟")) suspendMut.mutate(t.id); }}
                            className="flex items-center gap-1.5 bg-gradient-to-r from-orange-500/15 to-orange-600/10 text-orange-300 border border-orange-500/30 px-3 py-2 rounded-xl text-xs font-bold hover:shadow-md hover:shadow-orange-500/20 hover:-translate-y-0.5 active:translate-y-0 transition-all"
                          >
                            <Ban size={12} /> إيقاف
                          </button>
                        )}
                        <button
                          onClick={() => { if (confirm("إنهاء الاشتراك فوراً؟")) expireMut.mutate(t.id); }}
                          className="flex items-center gap-1.5 bg-gradient-to-r from-red-500/15 to-red-600/10 text-red-300 border border-red-500/30 px-3 py-2 rounded-xl text-xs font-bold hover:shadow-md hover:shadow-red-500/20 hover:-translate-y-0.5 active:translate-y-0 transition-all"
                        >
                          <XCircle size={12} /> إنهاء
                        </button>
                        <button
                          onClick={() => { if (confirm("حذف العميل نهائياً؟")) deleteMut.mutate(t.id); }}
                          className="flex items-center gap-1.5 bg-muted/30 text-muted-foreground border border-border/50 px-3 py-2 rounded-xl text-xs font-bold hover:text-red-400 hover:border-red-500/30 hover:bg-red-500/10 transition-all mr-auto"
                        >
                          <Trash2 size={12} /> حذف
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Modal: Create ─────────────────────────────────────────────────── */}
      {showCreate && (
        <Modal title="➕ اشتراك جديد" onClose={() => setShowCreate(false)}>
          <div className="space-y-6 pb-28 sm:pb-6">
            {/* company section */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-6 h-6 rounded-lg bg-blue-500/20 border border-blue-500/30 flex items-center justify-center shrink-0 shadow-sm shadow-blue-500/15">
                  <Building2 size={11} className="text-blue-400" />
                </div>
                <p className="text-[11px] font-black text-muted-foreground uppercase tracking-widest">بيانات الشركة</p>
              </div>
              <div>
                <label className="text-xs font-bold text-foreground/70 block mb-1.5">اسم الشركة / العميل <span className="text-red-400">*</span></label>
                <input type="text" placeholder="مثال: شركة النور للتجارة" value={form.name}
                  onChange={e => setForm(v => ({ ...v, name: e.target.value }))} className={inp} />
              </div>
              <div>
                <label className="text-xs font-bold text-foreground/70 block mb-1.5">
                  Slug <span className="text-red-400">*</span>
                  <span className="text-[10px] text-muted-foreground font-normal mr-2">معرّف فريد بالإنجليزية</span>
                </label>
                <input type="text" placeholder="al-noor" dir="ltr" value={form.slug}
                  onChange={e => setForm(v => ({ ...v, slug: e.target.value.replace(/\s/g, "-").toLowerCase() }))} className={inp} />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-foreground/70 block mb-1.5">إيميل التواصل</label>
                  <input type="email" placeholder="client@example.com" dir="ltr" value={form.contactEmail}
                    onChange={e => setForm(v => ({ ...v, contactEmail: e.target.value }))} className={inp} />
                </div>
                <div>
                  <label className="text-xs font-bold text-foreground/70 block mb-1.5">رقم الهاتف</label>
                  <input type="tel" placeholder="01xxxxxxxxx" dir="ltr" value={form.contactPhone}
                    onChange={e => setForm(v => ({ ...v, contactPhone: e.target.value }))} className={inp} />
                </div>
              </div>
              <div>
                <label className="text-xs font-bold text-foreground/70 block mb-1.5">ملاحظات</label>
                <input type="text" placeholder="أي ملاحظات إضافية" value={form.notes}
                  onChange={e => setForm(v => ({ ...v, notes: e.target.value }))} className={inp} />
              </div>
            </div>

            <div className="h-px bg-gradient-to-r from-transparent via-border/60 to-transparent" />

            {/* plan section */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-6 h-6 rounded-lg bg-violet-500/20 border border-violet-500/30 flex items-center justify-center shrink-0 shadow-sm shadow-violet-500/15">
                  <Crown size={11} className="text-violet-400" />
                </div>
                <p className="text-[11px] font-black text-muted-foreground uppercase tracking-widest">الباقة والمدة</p>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {Object.entries(PLAN_LABELS).map(([k, v]) => {
                  const Icon = v.icon; const selected = form.plan === k;
                  return (
                    <button key={k} type="button" onClick={() => setForm(p => ({ ...p, plan: k }))}
                      className={`flex items-center gap-2.5 p-3 rounded-xl border-2 text-right transition-all active:scale-[.97] ${selected ? `border-primary bg-primary/8 shadow-md shadow-primary/15` : "border-border/50 bg-background/40 hover:bg-muted/20"}`}>
                      <div className={`w-8 h-8 rounded-lg border ${v.border} ${v.bg} flex items-center justify-center shrink-0`}>
                        <Icon size={13} className={v.text} />
                      </div>
                      <span className={`text-xs font-bold flex-1 ${selected ? "text-primary" : "text-foreground"}`}>{v.label}</span>
                      {selected && <div className="w-2 h-2 rounded-full bg-primary shrink-0 shadow-sm shadow-primary" />}
                    </button>
                  );
                })}
              </div>
              <div>
                <label className="text-xs font-bold text-foreground/70 block mb-1.5">مدة الاشتراك <span className="text-red-400">*</span></label>
                <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                  {[["14","14 يوم"],["30","شهر"],["90","3 أشهر"],["180","6 أشهر"],["365","سنة"]].map(([val, lbl]) => (
                    <button key={val} type="button" onClick={() => setForm(p => ({ ...p, durationDays: val }))}
                      className={`h-10 rounded-xl border-2 text-xs font-bold transition-all active:scale-[.97] ${form.durationDays === val ? "border-primary bg-primary/8 text-primary shadow-md shadow-primary/15" : "border-border/50 bg-background/40 text-muted-foreground hover:bg-muted/20"}`}>
                      {lbl}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="h-px bg-gradient-to-r from-transparent via-border/60 to-transparent" />

            {/* admin user section */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-6 h-6 rounded-lg bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center shrink-0 shadow-sm shadow-emerald-500/15">
                  <Shield size={11} className="text-emerald-400" />
                </div>
                <p className="text-[11px] font-black text-muted-foreground uppercase tracking-widest">بيانات دخول العميل</p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-foreground/70 block mb-1.5">اسم المستخدم <span className="text-red-400">*</span></label>
                  <input type="text" placeholder="alnoor_admin" dir="ltr" value={form.adminUsername}
                    onChange={e => setForm(v => ({ ...v, adminUsername: e.target.value.replace(/\s/g, "") }))} className={inp} />
                </div>
                <div>
                  <label className="text-xs font-bold text-foreground/70 block mb-1.5">كلمة المرور <span className="text-red-400">*</span></label>
                  <input type="text" placeholder="كلمة مرور قوية" value={form.adminPassword}
                    onChange={e => setForm(v => ({ ...v, adminPassword: e.target.value }))} className={inp} />
                </div>
                <div className="sm:col-span-2">
                  <label className="text-xs font-bold text-foreground/70 block mb-1.5">الاسم الظاهر</label>
                  <input type="text" placeholder={form.name || "اسم المدير"} value={form.adminDisplayName}
                    onChange={e => setForm(v => ({ ...v, adminDisplayName: e.target.value }))} className={inp} />
                </div>
              </div>
            </div>
          </div>

          <div className="sticky bottom-0 left-0 right-0 bg-gradient-to-t from-card to-card/95 border-t border-border/50 px-5 py-3 flex gap-2 shrink-0">
            <button
              onClick={() => createMut.mutate({ name: form.name, slug: form.slug.toLowerCase().replace(/\s+/g, "-"), plan: form.plan, contactEmail: form.contactEmail || undefined, contactPhone: form.contactPhone || undefined, notes: form.notes || undefined, durationDays: parseInt(form.durationDays), adminUsername: form.adminUsername, adminPassword: form.adminPassword, adminDisplayName: form.adminDisplayName || undefined })}
              disabled={!form.name || !form.slug || !form.adminUsername || !form.adminPassword || createMut.isPending}
              className="flex-1 h-12 bg-gradient-to-r from-primary to-primary/80 text-primary-foreground rounded-xl text-sm font-bold disabled:opacity-40 hover:shadow-lg hover:shadow-primary/25 active:scale-[.98] transition-all flex items-center justify-center gap-2 shadow-md shadow-primary/15"
            >
              {createMut.isPending
                ? <><div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> جاري الإنشاء...</>
                : <><Plus size={15} /> إنشاء الاشتراك والمستخدم</>}
            </button>
            <button onClick={() => setShowCreate(false)} className="h-12 px-5 border border-border/50 rounded-xl text-sm text-muted-foreground hover:bg-muted/20 active:scale-[.98] transition-all">إلغاء</button>
          </div>
        </Modal>
      )}

      {/* ── Modal: Renew ──────────────────────────────────────────────────── */}
      {showRenew && (
        <Modal title={`🔄 تجديد: ${showRenew.name}`} onClose={() => setShowRenew(null)}>
          <div className="space-y-5 pb-24 sm:pb-4">
            <div>
              <label className="text-xs font-bold text-foreground/70 block mb-2">الباقة</label>
              <div className="grid grid-cols-2 gap-2">
                {Object.entries(PLAN_LABELS).map(([k, v]) => {
                  const Icon = v.icon; const selected = renewPlan === k;
                  return (
                    <button key={k} type="button" onClick={() => setRenewPlan(k)}
                      className={`flex items-center gap-2.5 p-3 rounded-xl border-2 text-right transition-all active:scale-[.97] ${selected ? "border-primary bg-primary/8 shadow-md shadow-primary/15" : "border-border/50 bg-background/40 hover:bg-muted/20"}`}>
                      <div className={`w-7 h-7 rounded-lg border ${v.border} ${v.bg} flex items-center justify-center shrink-0`}>
                        <Icon size={12} className={v.text} />
                      </div>
                      <span className={`text-xs font-bold flex-1 ${selected ? "text-primary" : "text-foreground"}`}>{v.label}</span>
                      {selected && <div className="w-2 h-2 rounded-full bg-primary shrink-0" />}
                    </button>
                  );
                })}
              </div>
            </div>
            <div>
              <label className="text-xs font-bold text-foreground/70 block mb-2">مدة التجديد</label>
              <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                {[["14","14 يوم"],["30","شهر"],["90","3 أشهر"],["180","6 أشهر"],["365","سنة"]].map(([val, lbl]) => (
                  <button key={val} type="button" onClick={() => setRenewDays(val)}
                    className={`h-10 rounded-xl border-2 text-xs font-bold transition-all active:scale-[.97] ${renewDays === val ? "border-primary bg-primary/8 text-primary shadow-md shadow-primary/15" : "border-border/50 bg-background/40 text-muted-foreground hover:bg-muted/20"}`}>
                    {lbl}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="sticky bottom-0 bg-gradient-to-t from-card to-card/95 border-t border-border/50 px-5 py-3 flex gap-2">
            <button
              onClick={() => renewMut.mutate({ id: showRenew.id, body: { plan: renewPlan, durationDays: parseInt(renewDays) } })}
              disabled={renewMut.isPending}
              className="flex-1 h-12 bg-gradient-to-r from-emerald-600 to-emerald-500 text-white rounded-xl text-sm font-bold disabled:opacity-40 hover:shadow-lg hover:shadow-emerald-500/30 active:scale-[.98] transition-all flex items-center justify-center gap-2 shadow-md shadow-emerald-500/20"
            >
              {renewMut.isPending
                ? <><div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> جاري التجديد...</>
                : <><RefreshCw size={14} /> تجديد الاشتراك</>}
            </button>
            <button onClick={() => setShowRenew(null)} className="h-12 px-5 border border-border/50 rounded-xl text-sm text-muted-foreground hover:bg-muted/20 active:scale-[.98] transition-all">إلغاء</button>
          </div>
        </Modal>
      )}
    </div>
  );
}
