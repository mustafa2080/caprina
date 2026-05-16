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
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/75 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className={[
          "bg-card border border-border w-full flex flex-col",
          // موبايل: bottom-sheet يأخذ 95% من الشاشة
          "rounded-t-3xl sm:rounded-2xl",
          "max-h-[95dvh] sm:max-h-[90vh]",
          // ديسكتوب: عرض ثابت ومناسب
          "sm:max-w-xl sm:w-full",
          "shadow-2xl",
        ].join(" ")}
        onClick={e => e.stopPropagation()}
      >
        {/* drag handle — موبايل فقط */}
        <div className="flex justify-center pt-2.5 pb-0 sm:hidden shrink-0">
          <div className="w-12 h-1.5 rounded-full bg-muted-foreground/30" />
        </div>

        {/* header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-border shrink-0">
          <h3 className="font-black text-base text-foreground">{title}</h3>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* scrollable body — padding bottom كبير على موبايل لو فيه safe area */}
        <div className="overflow-y-auto overscroll-contain flex-1 px-5 pt-5 pb-safe">
          {children}
        </div>
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
  const [form, setForm] = useState({ name: "", slug: "", plan: "starter", contactEmail: "", contactPhone: "", notes: "", durationDays: "30", adminUsername: "", adminPassword: "", adminDisplayName: "" });
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
    onSuccess: () => { toast({ title: "✅ تم إنشاء الاشتراك والمستخدم" }); invalidate(); setShowCreate(false); setForm({ name: "", slug: "", plan: "starter", contactEmail: "", contactPhone: "", notes: "", durationDays: "30", adminUsername: "", adminPassword: "", adminDisplayName: "" }); },
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

      {showCreate && (
        <Modal title="➕ اشتراك جديد" onClose={() => setShowCreate(false)}>
          {/* wrapper: padding bottom ضخم على الموبايل عشان الـ sticky button ميغطيش المحتوى */}
          <div className="space-y-6 pb-28 sm:pb-6">

            {/* ── Section 1: بيانات الشركة ── */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 mb-1">
                <div className="w-6 h-6 rounded-full bg-blue-500/20 border border-blue-500/30 flex items-center justify-center shrink-0">
                  <Building2 size={12} className="text-blue-400" />
                </div>
                <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest">بيانات الشركة</p>
              </div>

              {/* اسم الشركة */}
              <div>
                <label className="text-xs font-bold text-foreground/70 block mb-1.5">
                  اسم الشركة / العميل <span className="text-red-400">*</span>
                </label>
                <input
                  type="text" placeholder="مثال: شركة النور للتجارة" value={form.name}
                  onChange={e => setForm(v => ({ ...v, name: e.target.value }))}
                  className="w-full h-11 px-3.5 rounded-xl border border-border bg-background text-sm text-foreground outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/10 transition-all"
                />
              </div>

              {/* Slug */}
              <div>
                <label className="text-xs font-bold text-foreground/70 block mb-1.5">
                  Slug <span className="text-red-400">*</span>
                  <span className="text-[10px] text-muted-foreground font-normal mr-2">معرّف فريد بالإنجليزية</span>
                </label>
                <input
                  type="text" placeholder="al-noor" value={form.slug}
                  onChange={e => setForm(v => ({ ...v, slug: e.target.value.replace(/\s/g, "-").toLowerCase() }))}
                  className="w-full h-11 px-3.5 rounded-xl border border-border bg-background text-sm text-foreground outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/10 transition-all"
                  dir="ltr"
                />
              </div>

              {/* إيميل + هاتف — جنب بعض على sm فأكبر */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-foreground/70 block mb-1.5">إيميل التواصل</label>
                  <input
                    type="email" placeholder="client@example.com" value={form.contactEmail}
                    onChange={e => setForm(v => ({ ...v, contactEmail: e.target.value }))}
                    className="w-full h-11 px-3.5 rounded-xl border border-border bg-background text-sm text-foreground outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/10 transition-all"
                    dir="ltr"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-foreground/70 block mb-1.5">رقم الهاتف</label>
                  <input
                    type="tel" placeholder="01xxxxxxxxx" value={form.contactPhone}
                    onChange={e => setForm(v => ({ ...v, contactPhone: e.target.value }))}
                    className="w-full h-11 px-3.5 rounded-xl border border-border bg-background text-sm text-foreground outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/10 transition-all"
                    dir="ltr"
                  />
                </div>
              </div>

              {/* ملاحظات */}
              <div>
                <label className="text-xs font-bold text-foreground/70 block mb-1.5">ملاحظات</label>
                <input
                  type="text" placeholder="أي ملاحظات إضافية" value={form.notes}
                  onChange={e => setForm(v => ({ ...v, notes: e.target.value }))}
                  className="w-full h-11 px-3.5 rounded-xl border border-border bg-background text-sm text-foreground outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/10 transition-all"
                />
              </div>
            </div>

            {/* divider */}
            <div className="border-t border-border/50" />

            {/* ── Section 2: الباقة والمدة ── */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 mb-1">
                <div className="w-6 h-6 rounded-full bg-violet-500/20 border border-violet-500/30 flex items-center justify-center shrink-0">
                  <Crown size={12} className="text-violet-400" />
                </div>
                <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest">الباقة والمدة</p>
              </div>

              {/* Plan cards — 2 × 2 */}
              <div className="grid grid-cols-2 gap-2">
                {Object.entries(PLAN_LABELS).map(([k, v]) => {
                  const Icon = v.icon;
                  const selected = form.plan === k;
                  return (
                    <button
                      key={k} type="button"
                      onClick={() => setForm(p => ({ ...p, plan: k }))}
                      className={`flex items-center gap-2.5 p-3 rounded-xl border-2 text-right transition-all active:scale-[.97] ${
                        selected ? "border-primary bg-primary/5" : "border-border bg-background hover:bg-muted/20"
                      }`}
                    >
                      <div className={`w-8 h-8 rounded-lg border flex items-center justify-center shrink-0 ${v.color}`}>
                        <Icon size={14} />
                      </div>
                      <span className={`text-xs font-bold flex-1 ${selected ? "text-primary" : "text-foreground"}`}>
                        {v.label}
                      </span>
                      {selected && <div className="w-2 h-2 rounded-full bg-primary shrink-0" />}
                    </button>
                  );
                })}
              </div>

              {/* Duration — 3 على موبايل / 5 على ديسكتوب */}
              <div>
                <label className="text-xs font-bold text-foreground/70 block mb-1.5">
                  مدة الاشتراك <span className="text-red-400">*</span>
                </label>
                <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                  {[["14","14 يوم"],["30","شهر"],["90","3 أشهر"],["180","6 أشهر"],["365","سنة"]].map(([val, lbl]) => (
                    <button
                      key={val} type="button"
                      onClick={() => setForm(p => ({ ...p, durationDays: val }))}
                      className={`h-10 rounded-xl border-2 text-xs font-bold transition-all active:scale-[.97] ${
                        form.durationDays === val
                          ? "border-primary bg-primary/5 text-primary"
                          : "border-border bg-background text-muted-foreground hover:bg-muted/20"
                      }`}
                    >
                      {lbl}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* divider */}
            <div className="border-t border-border/50" />

            {/* ── Section 3: بيانات دخول العميل ── */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 mb-1">
                <div className="w-6 h-6 rounded-full bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center shrink-0">
                  <Users size={12} className="text-emerald-400" />
                </div>
                <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest">بيانات دخول العميل</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-foreground/70 block mb-1.5">
                    اسم المستخدم <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text" placeholder="alnoor_admin" value={form.adminUsername}
                    onChange={e => setForm(v => ({ ...v, adminUsername: e.target.value.replace(/\s/g, "") }))}
                    className="w-full h-11 px-3.5 rounded-xl border border-border bg-background text-sm text-foreground outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/10 transition-all"
                    dir="ltr"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-foreground/70 block mb-1.5">
                    كلمة المرور <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text" placeholder="كلمة مرور قوية" value={form.adminPassword}
                    onChange={e => setForm(v => ({ ...v, adminPassword: e.target.value }))}
                    className="w-full h-11 px-3.5 rounded-xl border border-border bg-background text-sm text-foreground outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/10 transition-all"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="text-xs font-bold text-foreground/70 block mb-1.5">الاسم الظاهر</label>
                  <input
                    type="text" placeholder={form.name || "اسم المدير"} value={form.adminDisplayName}
                    onChange={e => setForm(v => ({ ...v, adminDisplayName: e.target.value }))}
                    className="w-full h-11 px-3.5 rounded-xl border border-border bg-background text-sm text-foreground outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/10 transition-all"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* ── Sticky action bar — بتثبت في أسفل الـ modal على أي شاشة ── */}
          <div className="sticky bottom-0 left-0 right-0 bg-card border-t border-border px-5 py-3 flex gap-2 shrink-0">
            <button
              onClick={() => createMut.mutate({
                name: form.name,
                slug: form.slug.toLowerCase().replace(/\s+/g, "-"),
                plan: form.plan,
                contactEmail: form.contactEmail || undefined,
                contactPhone: form.contactPhone || undefined,
                notes: form.notes || undefined,
                durationDays: parseInt(form.durationDays),
                adminUsername: form.adminUsername,
                adminPassword: form.adminPassword,
                adminDisplayName: form.adminDisplayName || undefined,
              })}
              disabled={!form.name || !form.slug || !form.adminUsername || !form.adminPassword || createMut.isPending}
              className="flex-1 h-12 bg-primary text-primary-foreground rounded-xl text-sm font-bold disabled:opacity-40 hover:bg-primary/90 active:scale-[.98] transition-all flex items-center justify-center gap-2"
            >
              {createMut.isPending ? (
                <><div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> جاري الإنشاء...</>
              ) : (
                <><Plus size={15} /> إنشاء الاشتراك والمستخدم</>
              )}
            </button>
            <button
              onClick={() => setShowCreate(false)}
              className="h-12 px-5 border border-border rounded-xl text-sm text-muted-foreground hover:bg-muted/20 active:scale-[.98] transition-all"
            >
              إلغاء
            </button>
          </div>
        </Modal>
      )}

      {/* Modal: Renew */}
      {showRenew && (
        <Modal title={`🔄 تجديد: ${showRenew.name}`} onClose={() => setShowRenew(null)}>
          <div className="space-y-5 pb-24 sm:pb-4">
            <div>
              <label className="text-xs font-bold text-foreground/70 block mb-2">الباقة</label>
              <div className="grid grid-cols-2 gap-2">
                {Object.entries(PLAN_LABELS).map(([k, v]) => {
                  const Icon = v.icon;
                  const selected = renewPlan === k;
                  return (
                    <button key={k} type="button" onClick={() => setRenewPlan(k)}
                      className={`flex items-center gap-2.5 p-3 rounded-xl border-2 text-right transition-all active:scale-[.97] ${
                        selected ? "border-primary bg-primary/5" : "border-border bg-background hover:bg-muted/20"
                      }`}>
                      <div className={`w-7 h-7 rounded-lg border flex items-center justify-center shrink-0 ${v.color}`}>
                        <Icon size={13} />
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
                    className={`h-10 rounded-xl border-2 text-xs font-bold transition-all active:scale-[.97] ${
                      renewDays === val ? "border-primary bg-primary/5 text-primary" : "border-border bg-background text-muted-foreground hover:bg-muted/20"
                    }`}>
                    {lbl}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div className="sticky bottom-0 bg-card border-t border-border px-5 py-3 flex gap-2">
            <button
              onClick={() => renewMut.mutate({ id: showRenew.id, body: { plan: renewPlan, durationDays: parseInt(renewDays) } })}
              disabled={renewMut.isPending}
              className="flex-1 h-12 bg-emerald-600 text-white rounded-xl text-sm font-bold disabled:opacity-40 hover:bg-emerald-500 active:scale-[.98] transition-all flex items-center justify-center gap-2">
              {renewMut.isPending ? (
                <><div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> جاري التجديد...</>
              ) : (
                <><RefreshCw size={14} /> تجديد الاشتراك</>
              )}
            </button>
            <button onClick={() => setShowRenew(null)}
              className="h-12 px-5 border border-border rounded-xl text-sm text-muted-foreground hover:bg-muted/20 active:scale-[.98] transition-all">
              إلغاء
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
