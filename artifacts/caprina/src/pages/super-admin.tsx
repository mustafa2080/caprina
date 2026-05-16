import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Crown, Plus, RefreshCw, Ban, Trash2, CheckCircle2, Clock, XCircle, Users, Building2, Zap, Rocket, X, ChevronDown } from "lucide-react";

interface Tenant {
  id: number; name: string; slug: string; plan: string; planStatus: string;
  expiresAt: string; graceUntil: string | null; contactEmail: string | null;
  contactPhone: string | null; notes: string | null; isActive: boolean; createdAt: string;
}

const PLAN_LABELS: Record<string, { label: string; color: string; icon: any }> = {
  free_trial: { label: "تجريبي",  color: "text-zinc-400 bg-zinc-400/10 border-zinc-400/20",      icon: Zap      },
  starter:    { label: "أساسي",   color: "text-blue-400 bg-blue-400/10 border-blue-400/20",       icon: Rocket   },
  pro:        { label: "احترافي", color: "text-violet-400 bg-violet-400/10 border-violet-400/20", icon: Crown    },
  enterprise: { label: "مؤسسي",  color: "text-amber-400 bg-amber-400/10 border-amber-400/20",    icon: Building2},
};

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: any }> = {
  active:    { label: "نشط",    color: "text-emerald-400 bg-emerald-400/10 border-emerald-400/30", icon: CheckCircle2 },
  expired:   { label: "منتهي",  color: "text-red-400 bg-red-400/10 border-red-400/30",             icon: XCircle      },
  suspended: { label: "موقوف",  color: "text-orange-400 bg-orange-400/10 border-orange-400/30",    icon: Ban          },
  grace:     { label: "مهلة",   color: "text-yellow-400 bg-yellow-400/10 border-yellow-400/30",    icon: Clock        },
};

function daysLeft(expiresAt: string) {
  return Math.ceil((new Date(expiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
}
function formatDate(d: string) {
  return new Date(d).toLocaleDateString("ar-EG", { year: "numeric", month: "short", day: "numeric" });
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-card border border-border rounded-xl w-full max-w-md shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h3 className="font-bold text-base text-foreground">{title}</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X size={16} /></button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

export default function SuperAdminPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();

  if (user?.role !== "super_admin") {
    return (
      <div className="flex items-center justify-center min-h-[60vh]" dir="rtl">
        <div className="text-center space-y-3">
          <Crown className="w-12 h-12 text-muted-foreground mx-auto" />
          <p className="text-lg font-bold">ممنوع الوصول</p>
          <p className="text-sm text-muted-foreground">هذه الصفحة للأدمن الرئيسي فقط</p>
        </div>
      </div>
    );
  }

  const [showCreate, setShowCreate] = useState(false);
  const [showRenew, setShowRenew] = useState<Tenant | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [form, setForm] = useState({ name: "", slug: "", plan: "starter", contactEmail: "", contactPhone: "", notes: "", durationDays: "30" });
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
    onSuccess: () => { toast({ title: "✅ تم إنشاء الاشتراك" }); invalidate(); setShowCreate(false); setForm({ name: "", slug: "", plan: "starter", contactEmail: "", contactPhone: "", notes: "", durationDays: "30" }); },
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

  const active = tenants.filter(t => t.planStatus === "active").length;
  const expired = tenants.filter(t => t.planStatus === "expired").length;
  const expiringSoon = tenants.filter(t => t.planStatus === "active" && daysLeft(t.expiresAt) <= 7).length;

  return (
    <div className="space-y-6" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/25 flex items-center justify-center">
            <Crown className="w-5 h-5 text-amber-400" />
          </div>
          <div>
            <h1 className="text-xl font-black text-foreground">إدارة الاشتراكات</h1>
            <p className="text-xs text-muted-foreground">لوحة تحكم الأدمن الرئيسي · {tenants.length} عميل</p>
          </div>
        </div>
        <button onClick={() => setShowCreate(true)} className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-bold hover:bg-primary/90 transition-colors">
          <Plus size={15} /> اشتراك جديد
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "إجمالي العملاء", value: tenants.length, color: "text-blue-400",    icon: Users        },
          { label: "نشط",            value: active,          color: "text-emerald-400", icon: CheckCircle2 },
          { label: "منتهي",          value: expired,         color: "text-red-400",     icon: XCircle      },
          { label: "ينتهي قريباً",   value: expiringSoon,    color: "text-amber-400",   icon: Clock        },
        ].map(s => (
          <div key={s.label} className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center gap-2 mb-1">
              <s.icon className={`w-4 h-4 ${s.color}`} />
              <span className="text-xs text-muted-foreground">{s.label}</span>
            </div>
            <p className={`text-2xl font-black ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* List */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : tenants.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <Users className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="font-bold">لا يوجد عملاء بعد</p>
            <p className="text-sm mt-1">اضغط "اشتراك جديد" لإضافة أول عميل</p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {tenants.map(t => {
              const plan = PLAN_LABELS[t.plan] ?? { label: t.plan, color: "text-zinc-400 bg-zinc-400/10 border-zinc-400/20", icon: Zap };
              const status = STATUS_CONFIG[t.planStatus] ?? { label: t.planStatus, color: "text-zinc-400 bg-zinc-400/10 border-zinc-400/30", icon: Clock };
              const days = daysLeft(t.expiresAt);
              const isExpanded = expandedId === t.id;
              const PlanIcon = plan.icon;
              const StatusIcon = status.icon;
              return (
                <div key={t.id}>
                  <div className="flex items-center gap-3 px-4 py-3 hover:bg-muted/20 cursor-pointer transition-colors" onClick={() => setExpandedId(isExpanded ? null : t.id)}>
                    <div className={`w-8 h-8 rounded-lg border flex items-center justify-center shrink-0 ${plan.color}`}>
                      <PlanIcon size={14} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-foreground truncate">{t.name}</p>
                      <p className="text-[11px] text-muted-foreground">{t.slug}</p>
                    </div>
                    <span className={`hidden sm:inline-flex text-[10px] font-bold px-2 py-0.5 rounded-full border ${plan.color}`}>{plan.label}</span>
                    <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border ${status.color}`}>
                      <StatusIcon size={10} />{status.label}
                    </span>
                    <span className={`text-xs font-bold hidden md:block ${days <= 3 ? "text-red-400" : days <= 7 ? "text-amber-400" : "text-muted-foreground"}`}>
                      {days > 0 ? `${days} يوم` : "منتهي"}
                    </span>
                    <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform shrink-0 ${isExpanded ? "rotate-180" : ""}`} />
                  </div>

                  {isExpanded && (
                    <div className="px-4 pb-4 bg-muted/10 border-t border-border/50">
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mt-3 text-xs">
                        <div><span className="text-muted-foreground">الانتهاء: </span><span className="font-bold">{formatDate(t.expiresAt)}</span></div>
                        <div><span className="text-muted-foreground">الإنشاء: </span><span className="font-bold">{formatDate(t.createdAt)}</span></div>
                        {t.contactEmail && <div><span className="text-muted-foreground">إيميل: </span><span className="font-bold">{t.contactEmail}</span></div>}
                        {t.contactPhone && <div><span className="text-muted-foreground">هاتف: </span><span className="font-bold">{t.contactPhone}</span></div>}
                        {t.notes && <div className="col-span-2 md:col-span-3"><span className="text-muted-foreground">ملاحظات: </span><span className="font-bold">{t.notes}</span></div>}
                      </div>
                      <div className="flex flex-wrap gap-2 mt-4">
                        <button onClick={() => { setShowRenew(t); setRenewPlan(t.plan); setRenewDays("30"); }} className="flex items-center gap-1.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/25 px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-emerald-500/20 transition-colors">
                          <RefreshCw size={12} /> تجديد
                        </button>
                        {t.planStatus !== "suspended" && (
                          <button onClick={() => { if (confirm("إيقاف الاشتراك؟")) suspendMut.mutate(t.id); }} className="flex items-center gap-1.5 bg-orange-500/10 text-orange-400 border border-orange-500/25 px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-orange-500/20 transition-colors">
                            <Ban size={12} /> إيقاف
                          </button>
                        )}
                        <button onClick={() => { if (confirm("إنهاء الاشتراك فوراً؟")) expireMut.mutate(t.id); }} className="flex items-center gap-1.5 bg-red-500/10 text-red-400 border border-red-500/25 px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-red-500/20 transition-colors">
                          <XCircle size={12} /> إنهاء
                        </button>
                        <button onClick={() => { if (confirm("حذف العميل نهائياً؟")) deleteMut.mutate(t.id); }} className="flex items-center gap-1.5 bg-muted text-muted-foreground border border-border px-3 py-1.5 rounded-lg text-xs font-bold hover:text-destructive transition-colors mr-auto">
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

      {/* Modal: Create */}
      {showCreate && (
        <Modal title="اشتراك جديد" onClose={() => setShowCreate(false)}>
          <div className="space-y-3">
            {[
              { label: "اسم الشركة / العميل *", key: "name",         type: "text",  placeholder: "مثال: شركة النور" },
              { label: "Slug (معرف فريد) *",    key: "slug",         type: "text",  placeholder: "al-noor"          },
              { label: "إيميل التواصل",          key: "contactEmail", type: "email", placeholder: "client@example.com" },
              { label: "رقم الهاتف",             key: "contactPhone", type: "tel",   placeholder: "01xxxxxxxxx"      },
              { label: "ملاحظات",                key: "notes",        type: "text",  placeholder: "أي ملاحظات"       },
            ].map(f => (
              <div key={f.key}>
                <label className="text-xs font-bold text-muted-foreground block mb-1">{f.label}</label>
                <input type={f.type} placeholder={f.placeholder} value={(form as any)[f.key]} onChange={e => setForm(v => ({ ...v, [f.key]: e.target.value }))} className="w-full h-9 px-3 rounded-lg border border-border bg-background text-sm text-foreground outline-none focus:border-primary/50" />
              </div>
            ))}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold text-muted-foreground block mb-1">الباقة *</label>
                <select value={form.plan} onChange={e => setForm(v => ({ ...v, plan: e.target.value }))} className="w-full h-9 px-3 rounded-lg border border-border bg-background text-sm text-foreground outline-none">
                  {Object.entries(PLAN_LABELS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-bold text-muted-foreground block mb-1">المدة (أيام) *</label>
                <select value={form.durationDays} onChange={e => setForm(v => ({ ...v, durationDays: e.target.value }))} className="w-full h-9 px-3 rounded-lg border border-border bg-background text-sm text-foreground outline-none">
                  {[["14","14 يوم (تجريبي)"],["30","30 يوم"],["90","3 أشهر"],["180","6 أشهر"],["365","سنة"]].map(([v,l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </div>
            </div>
            <div className="flex gap-2 pt-2">
              <button onClick={() => createMut.mutate({ name: form.name, slug: form.slug.toLowerCase().replace(/\s+/g,"-"), plan: form.plan, contactEmail: form.contactEmail||undefined, contactPhone: form.contactPhone||undefined, notes: form.notes||undefined, durationDays: parseInt(form.durationDays) })} disabled={!form.name||!form.slug||createMut.isPending} className="flex-1 h-9 bg-primary text-primary-foreground rounded-lg text-sm font-bold disabled:opacity-40 hover:bg-primary/90 transition-colors">
                {createMut.isPending ? "جاري الإنشاء..." : "إنشاء الاشتراك"}
              </button>
              <button onClick={() => setShowCreate(false)} className="h-9 px-4 border border-border rounded-lg text-sm text-muted-foreground hover:bg-muted/20 transition-colors">إلغاء</button>
            </div>
          </div>
        </Modal>
      )}

      {/* Modal: Renew */}
      {showRenew && (
        <Modal title={`تجديد: ${showRenew.name}`} onClose={() => setShowRenew(null)}>
          <div className="space-y-4">
            <div>
              <label className="text-xs font-bold text-muted-foreground block mb-1">الباقة</label>
              <select value={renewPlan} onChange={e => setRenewPlan(e.target.value)} className="w-full h-9 px-3 rounded-lg border border-border bg-background text-sm text-foreground outline-none">
                {Object.entries(PLAN_LABELS).map(([k,v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-bold text-muted-foreground block mb-1">مدة التجديد</label>
              <select value={renewDays} onChange={e => setRenewDays(e.target.value)} className="w-full h-9 px-3 rounded-lg border border-border bg-background text-sm text-foreground outline-none">
                {[["14","14 يوم"],["30","شهر"],["90","3 أشهر"],["180","6 أشهر"],["365","سنة"]].map(([v,l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
            <div className="flex gap-2">
              <button onClick={() => renewMut.mutate({ id: showRenew.id, body: { plan: renewPlan, durationDays: parseInt(renewDays) } })} disabled={renewMut.isPending} className="flex-1 h-9 bg-emerald-600 text-white rounded-lg text-sm font-bold disabled:opacity-40 hover:bg-emerald-500 transition-colors">
                {renewMut.isPending ? "جاري التجديد..." : "تجديد الاشتراك"}
              </button>
              <button onClick={() => setShowRenew(null)} className="h-9 px-4 border border-border rounded-lg text-sm text-muted-foreground hover:bg-muted/20 transition-colors">إلغاء</button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
