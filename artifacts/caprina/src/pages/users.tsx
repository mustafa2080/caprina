import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { usersApi, type AppUser } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { UserPlus, Edit2, Trash2, Shield, Users, Eye, EyeOff, TrendingUp, Package, BarChart3, UserCheck, UserCog, Brain, Megaphone, LayoutGrid, FileSpreadsheet } from "lucide-react";

const ROLE_LABELS: Record<string, string> = {
  admin: "مدير",
  employee: "موظف مبيعات",
  warehouse: "مسؤول مخزون",
};

const ROLE_COLORS: Record<string, string> = {
  admin: "border-yellow-700 bg-yellow-900/20 text-yellow-400",
  employee: "border-blue-700 bg-blue-900/20 text-blue-400",
  warehouse: "border-emerald-700 bg-emerald-900/20 text-emerald-400",
};

const ALL_PERMISSIONS = [
  { key: "dashboard", label: "لوحة التحكم" },
  { key: "orders", label: "الطلبات" },
  { key: "inventory", label: "المخزون" },
  { key: "movements", label: "حركات المخزون" },
  { key: "shipping", label: "شركات الشحن" },
  { key: "invoices", label: "الفواتير" },
  { key: "import", label: "استيراد Excel" },
  { key: "analytics", label: "التحليلات والتقارير" },
  { key: "users", label: "إدارة المستخدمين" },
  { key: "audit", label: "سجل التعديلات" },
  { key: "whatsapp", label: "إعدادات واتساب" },
];

const FINANCIAL_PERMISSION = { key: "view_financials", label: "عرض الأرباح والتكاليف", desc: "يرى الأرباح والخسائر والتكاليف في كل التقارير" };
const EDIT_INVENTORY_PERMISSION = { key: "edit_inventory", label: "تعديل المخزون", desc: "يقدر يضيف ويعدل ويحذف المنتجات والمقاسات" };
const VIEW_PRODUCT_PERF_PERMISSION = { key: "view_product_performance", label: "عرض أداء المنتجات", desc: "يرى تحليل أداء وأرباح كل منتج" };

// صلاحيات ظهور الأقسام في الـ Sidebar — per-user
const SIDEBAR_SECTION_PERMISSIONS = [
  // ── التحليلات ──
  { key: "section_product_performance", label: "أداء المنتجات",      desc: "قسم تحليل أداء وأرباح كل منتج"                              },
  { key: "section_team_performance",    label: "أداء الفريق",        desc: "قسم عرض تقارير وإحصائيات أداء الفريق"                      },
  { key: "section_team_management",     label: "إدارة الفريق",       desc: "قسم إدارة أعضاء الفريق وبياناتهم"                          },
  { key: "section_smart_analytics",     label: "التحليل الذكي 🧠",   desc: "قسم التحليلات الذكية المدعومة بالذكاء الاصطناعي"           },
  { key: "section_ads_analytics",       label: "تحليل الإعلانات",    desc: "قسم تحليل أداء الحملات الإعلانية"                          },
  // ── الطلبات ──
  { key: "section_orders",              label: "الطلبات",             desc: "قسم عرض وإدارة الطلبات"                                    },
  { key: "section_new_order",           label: "طلب جديد",            desc: "زر وصفحة إضافة طلب جديد"                                   },
  { key: "section_archive",             label: "الأرشيف 🗂️",          desc: "قسم أرشيف الطلبات القديمة والمنتهية"                       },
  { key: "section_shipping_followup",   label: "متابعة الشحن ⏱️",     desc: "قسم متابعة حالة شحن الطلبات"                               },
  { key: "section_whatsapp",            label: "إعدادات واتساب",      desc: "قسم إعدادات وتكامل واتساب"                                 },
  // ── المخزون ──
  { key: "section_inventory",           label: "المخزون",             desc: "قسم عرض وإدارة المنتجات والمخزون"                          },
  { key: "section_warehouses",          label: "المخازن",             desc: "قسم إدارة المخازن المختلفة"                                },
  { key: "section_movements",           label: "حركات المخزون",       desc: "قسم تتبع حركات الدخول والخروج في المخزون"                  },
  // ── الشحن والفواتير ──
  { key: "section_shipping",            label: "شركات الشحن",         desc: "قسم إدارة شركات الشحن وتفاصيلها"                           },
  { key: "section_invoices",            label: "الفواتير",             desc: "قسم عرض وإدارة الفواتير"                                   },
  // ── البيانات ──
  { key: "section_import",              label: "استيراد Excel",        desc: "قسم استيراد البيانات من ملفات Excel"                        },
  { key: "section_export_data",         label: "تصدير البيانات",       desc: "قسم تصدير البيانات إلى ملفات Excel والنسخ الاحتياطية"     },
  // ── الإدارة ──
  { key: "section_users",               label: "إدارة المستخدمين",    desc: "قسم إدارة المستخدمين والصلاحيات"                           },
  { key: "section_sessions_report",     label: "تقرير الجلسات",        desc: "قسم عرض سجل دخول وخروج الموظفين"                           },
  { key: "section_audit",               label: "سجل التعديلات",        desc: "قسم تتبع كل التعديلات والعمليات في النظام"                 },
];

const DEFAULT_PERMISSIONS: Record<string, () => string[]> = {
  admin: () => [
    ...ALL_PERMISSIONS.map(p => p.key),
    FINANCIAL_PERMISSION.key,
    EDIT_INVENTORY_PERMISSION.key,
    VIEW_PRODUCT_PERF_PERMISSION.key,
    ...SIDEBAR_SECTION_PERMISSIONS.map(p => p.key),
  ],
  employee: () => ["dashboard", "orders", "section_orders", "section_new_order", "section_archive", "section_shipping_followup"],
  warehouse: () => ["dashboard", "inventory", "movements", EDIT_INVENTORY_PERMISSION.key, "section_inventory", "section_warehouses", "section_movements"],
};

interface UserForm {
  username: string;
  password: string;
  displayName: string;
  role: string;
  permissions: string[];
}

const emptyForm = (): UserForm => ({
  username: "", password: "", displayName: "",
  role: "employee", permissions: DEFAULT_PERMISSIONS["employee"]?.() ?? [],
});

export default function UsersPage() {
  const { user: currentUser, isAdmin, refreshUser } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<AppUser | null>(null);
  const [form, setForm] = useState<UserForm>(emptyForm());
  const [showPassword, setShowPassword] = useState(false);
  const [resetPasswordOpen, setResetPasswordOpen] = useState(false);
  const [resetTarget, setResetTarget] = useState<AppUser | null>(null);
  const [newPassword, setNewPassword] = useState("");

  const { data: users = [], isLoading } = useQuery({
    queryKey: ["users"],
    queryFn: usersApi.list,
  });

  const createMutation = useMutation({
    mutationFn: usersApi.create,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["users"] }); setDialogOpen(false); toast({ title: "تم إضافة المستخدم" }); },
    onError: (e: any) => toast({ title: "خطأ", description: e.message, variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => usersApi.update(id, data),
    onSuccess: (_result, variables) => {
      qc.invalidateQueries({ queryKey: ["users"] });
      setDialogOpen(false);
      setResetPasswordOpen(false);
      toast({ title: "تم تحديث المستخدم" });
      // تحديث الـ sidebar فوراً — سواء عدّل نفسه أو عدّل حد تاني
      // لو عدّل نفسه: refreshUser بيجيب البيانات الجديدة فوراً
      // لو عدّل حد تاني: نعمل invalidate للـ cache عشان أي صفحة تاخد البيانات الجديدة
      refreshUser();
    },
    onError: (e: any) => toast({ title: "خطأ", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: usersApi.delete,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["users"] }); toast({ title: "تم حذف المستخدم" }); },
    onError: (e: any) => toast({ title: "خطأ", description: e.message, variant: "destructive" }),
  });

  const openCreate = () => { setEditingUser(null); setForm(emptyForm()); setShowPassword(false); setDialogOpen(true); };

  // لو اليوزر عنده "*" في الـ DB (الأدمن القديم)، نفرد كل الصلاحيات الحقيقية
  const expandPermissions = (perms: string[], role: string): string[] => {
    if (perms.includes("*")) return DEFAULT_PERMISSIONS[role]?.() ?? DEFAULT_PERMISSIONS["admin"]!();
    return perms;
  };

  const openEdit = (u: AppUser) => {
    setEditingUser(u);
    const rawPerms = Array.isArray(u.permissions) ? u.permissions : [];
    setForm({ username: u.username, password: "", displayName: u.displayName, role: u.role, permissions: expandPermissions(rawPerms, u.role) });
    setShowPassword(false);
    setDialogOpen(true);
  };

  const handleRoleChange = (role: string) => setForm(f => ({ ...f, role, permissions: DEFAULT_PERMISSIONS[role]?.() ?? [] }));

  const togglePermission = (key: string) => setForm(f => {
    const has = f.permissions.includes(key);
    return { ...f, permissions: has ? f.permissions.filter(p => p !== key) : [...f.permissions, key] };
  });

  const handleSubmit = () => {
    if (!form.displayName.trim()) { toast({ title: "خطأ", description: "الاسم مطلوب", variant: "destructive" }); return; }
    if (editingUser) {
      const data: any = { displayName: form.displayName, role: form.role, permissions: form.permissions };
      // الأدمن دايماً يشوف كل حاجة — مش محتاج permissions محددة (بيتجاهلها الـ can())
      // بس لازم نبعتها عشان مياجيبش خطأ — نبعت array فاضي للأدمن
      if (form.role === "admin") data.permissions = [];
      if (form.password) data.password = form.password;
      updateMutation.mutate({ id: editingUser.id, data });
    } else {
      if (!form.username.trim()) { toast({ title: "خطأ", description: "اسم المستخدم مطلوب", variant: "destructive" }); return; }
      if (form.password.length < 6) { toast({ title: "خطأ", description: "كلمة المرور 6 أحرف على الأقل", variant: "destructive" }); return; }
      const permissions = form.role === "admin" ? [] : form.permissions;
      createMutation.mutate({ username: form.username.trim(), password: form.password, displayName: form.displayName.trim(), role: form.role, permissions });
    }
  };

  const handleDelete = (u: AppUser) => {
    if (!confirm(`حذف المستخدم "${u.displayName}"؟ هذا الإجراء لا يمكن التراجع عنه.`)) return;
    deleteMutation.mutate(u.id);
  };

  const handleToggleActive = (u: AppUser) => updateMutation.mutate({ id: u.id, data: { isActive: !u.isActive } });

  return (
    <div className="p-3 sm:p-6 max-w-4xl mx-auto" dir="rtl">
      <div className="flex items-center justify-between mb-4 sm:mb-6 gap-2">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-black flex items-center gap-2">
            <Users className="w-5 h-5 sm:w-6 sm:h-6 text-primary shrink-0" /> إدارة المستخدمين
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">تحكم في الأدوار والصلاحيات</p>
        </div>
        {isAdmin && (
          <Button onClick={openCreate} className="h-9 text-xs sm:text-sm font-bold gap-1.5 shrink-0">
            <UserPlus className="w-4 h-4" />
            <span className="hidden sm:inline">إضافة مستخدم جديد</span>
            <span className="sm:hidden">إضافة</span>
          </Button>
        )}
      </div>

      {isLoading ? (
        <p className="text-muted-foreground text-sm">جاري التحميل...</p>
      ) : (
        <div className="space-y-3">
          {users.map(u => (
            <div key={u.id} className={`flex items-start gap-2 sm:gap-4 p-3 sm:p-4 rounded-xl border ${u.isActive ? "border-border bg-card" : "border-border/40 bg-muted/20 opacity-60"}`}>
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-muted/30 flex items-center justify-center text-sm sm:text-base font-bold border border-border shrink-0 mt-0.5">
                {u.displayName.charAt(0)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="font-bold text-sm">{u.displayName}</span>
                  {u.id === currentUser?.id && <Badge variant="outline" className="text-[9px] border-primary/50 text-primary">أنت</Badge>}
                  <Badge variant="outline" className={`text-[10px] font-bold ${ROLE_COLORS[u.role]}`}>
                    <Shield className="w-2.5 h-2.5 mr-1" />{ROLE_LABELS[u.role]}
                  </Badge>
                  {!u.isActive && <Badge variant="outline" className="text-[9px] border-red-800 text-red-400">معطل</Badge>}
                </div>
                <p className="text-[11px] text-muted-foreground mt-0.5 font-mono truncate">{u.username}</p>
                <div className="flex flex-wrap gap-1 mt-1">
                  {(u.permissions?.includes(FINANCIAL_PERMISSION.key) || u.role === "admin") && (
                    <Badge variant="outline" className="text-[9px] font-bold border-amber-600/50 bg-amber-500/10 text-amber-600 dark:text-amber-400 gap-1"><TrendingUp className="w-2.5 h-2.5" />يرى الأرباح</Badge>
                  )}
                  {(u.permissions?.includes(EDIT_INVENTORY_PERMISSION.key) || u.role === "admin") && (
                    <Badge variant="outline" className="text-[9px] font-bold border-emerald-600/50 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 gap-1"><Package className="w-2.5 h-2.5" />يعدل المخزون</Badge>
                  )}
                  {(u.permissions?.includes(VIEW_PRODUCT_PERF_PERMISSION.key) || u.role === "admin") && (
                    <Badge variant="outline" className="text-[9px] font-bold border-blue-600/50 bg-blue-500/10 text-blue-600 dark:text-blue-400 gap-1"><BarChart3 className="w-2.5 h-2.5" />أداء المنتجات</Badge>
                  )}
                </div>
                <p className="hidden sm:block text-[10px] text-muted-foreground/70 mt-0.5 line-clamp-1">
                  الصلاحيات: {(u.permissions?.filter(p => p !== FINANCIAL_PERMISSION.key && p !== EDIT_INVENTORY_PERMISSION.key && p !== VIEW_PRODUCT_PERF_PERMISSION.key) ?? []).join("، ") || "—"}
                </p>
              </div>
              <div className="flex flex-col sm:flex-row items-center gap-1 sm:gap-2 shrink-0">
                <Switch checked={u.isActive} onCheckedChange={() => handleToggleActive(u)} disabled={u.id === currentUser?.id} title={u.isActive ? "تعطيل الحساب" : "تفعيل الحساب"} />
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="icon" className="h-8 w-8 hover:text-primary" onClick={() => openEdit(u)}><Edit2 className="w-3.5 h-3.5" /></Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 hover:text-destructive" onClick={() => handleDelete(u)} disabled={u.id === currentUser?.id}><Trash2 className="w-3.5 h-3.5" /></Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Create / Edit Dialog ── */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="bg-card border-border w-[95vw] max-w-md flex flex-col max-h-[90dvh] sm:max-h-[90vh]" dir="rtl">
          <DialogHeader className="shrink-0">
            <DialogTitle>{editingUser ? "تعديل مستخدم" : "إضافة مستخدم جديد"}</DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto space-y-4 mt-2 pb-2 px-1">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label className="text-xs mb-1.5 block">الاسم الكامل *</Label>
                <Input className="h-9 text-sm bg-background" value={form.displayName} onChange={e => setForm(f => ({ ...f, displayName: e.target.value }))} placeholder="مثال: أحمد محمد" />
              </div>
              <div>
                <Label className="text-xs mb-1.5 block">اسم المستخدم *</Label>
                <Input className="h-9 text-sm bg-background font-mono" value={form.username} onChange={e => setForm(f => ({ ...f, username: e.target.value.toLowerCase() }))} placeholder="ahmed" disabled={!!editingUser} />
              </div>
            </div>
            <div>
              <Label className="text-xs mb-1.5 block">{editingUser ? "كلمة مرور جديدة (اتركها فارغة إن لم تريد تغييرها)" : "كلمة المرور *"}</Label>
              <div className="relative">
                <Input type={showPassword ? "text" : "password"} className="h-9 text-sm bg-background pl-9" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} placeholder={editingUser ? "••••••••" : "6 أحرف على الأقل"} />
                <button type="button" onClick={() => setShowPassword(v => !v)} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground">
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <Separator />
            <div>
              <Label className="text-xs mb-2 block">الدور الوظيفي</Label>
              <div className="grid grid-cols-3 gap-2">
                {["admin", "employee", "warehouse"].map(role => (
                  <button key={role} type="button" onClick={() => handleRoleChange(role)} className={`p-2.5 rounded-lg border text-xs font-bold transition-all ${form.role === role ? ROLE_COLORS[role] : "border-border text-muted-foreground hover:border-muted-foreground"}`}>
                    {ROLE_LABELS[role]}
                  </button>
                ))}
              </div>
            </div>
            {/* صلاحية الأرباح */}
            <div className={`rounded-xl border-2 p-3 transition-colors ${form.permissions.includes(FINANCIAL_PERMISSION.key) ? "border-amber-500/60 bg-amber-500/5" : "border-border bg-muted/10"}`}>
              <label className="flex items-center gap-3 cursor-pointer">
                <input type="checkbox" checked={form.permissions.includes(FINANCIAL_PERMISSION.key)} onChange={() => togglePermission(FINANCIAL_PERMISSION.key)} className="w-4 h-4 rounded accent-amber-500 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                    <span className="text-xs font-bold text-foreground">{FINANCIAL_PERMISSION.label}</span>
                    <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-600 dark:text-amber-400 font-bold">حساسة</span>
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-0.5">{FINANCIAL_PERMISSION.desc}</p>
                </div>
              </label>
            </div>
            {/* صلاحية المخزون */}
            <div className={`rounded-xl border-2 p-3 transition-colors ${form.permissions.includes(EDIT_INVENTORY_PERMISSION.key) ? "border-emerald-500/60 bg-emerald-500/5" : "border-border bg-muted/10"}`}>
              <label className="flex items-center gap-3 cursor-pointer">
                <input type="checkbox" checked={form.permissions.includes(EDIT_INVENTORY_PERMISSION.key)} onChange={() => togglePermission(EDIT_INVENTORY_PERMISSION.key)} className="w-4 h-4 rounded accent-emerald-500 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <Package className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                    <span className="text-xs font-bold text-foreground">{EDIT_INVENTORY_PERMISSION.label}</span>
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-0.5">{EDIT_INVENTORY_PERMISSION.desc}</p>
                </div>
              </label>
            </div>
            {/* صلاحية أداء المنتجات */}
            <div className={`rounded-xl border-2 p-3 transition-colors ${form.permissions.includes(VIEW_PRODUCT_PERF_PERMISSION.key) ? "border-blue-500/60 bg-blue-500/5" : "border-border bg-muted/10"}`}>
              <label className="flex items-center gap-3 cursor-pointer">
                <input type="checkbox" checked={form.permissions.includes(VIEW_PRODUCT_PERF_PERMISSION.key)} onChange={() => togglePermission(VIEW_PRODUCT_PERF_PERMISSION.key)} className="w-4 h-4 rounded accent-blue-500 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <BarChart3 className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                    <span className="text-xs font-bold text-foreground">{VIEW_PRODUCT_PERF_PERMISSION.label}</span>
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-0.5">{VIEW_PRODUCT_PERF_PERMISSION.desc}</p>
                </div>
              </label>
            </div>
            {/* صلاحيات الصفحات */}
            <div>
              <Label className="text-xs mb-2 block">صلاحيات الوصول للصفحات</Label>
              <div className="grid grid-cols-2 gap-1.5">
                {ALL_PERMISSIONS.map(p => (
                  <label key={p.key} className="flex items-center gap-2 cursor-pointer group">
                    <input type="checkbox" checked={form.permissions.includes(p.key)} onChange={() => togglePermission(p.key)} className="w-3.5 h-3.5 rounded accent-primary" />
                    <span className="text-xs text-muted-foreground group-hover:text-foreground">{p.label}</span>
                  </label>
                ))}
              </div>
            </div>
            {/* ظهور الأقسام في الـ Sidebar لهذا المستخدم */}
            <Separator />
            <div>
              <Label className="text-xs mb-2 flex items-center gap-1.5 text-muted-foreground">
                <LayoutGrid className="w-3.5 h-3.5" /> ظهور الأقسام في الـ Sidebar
              </Label>
              {[
                { group: "📊 التحليلات", keys: ["section_product_performance","section_team_performance","section_team_management","section_smart_analytics","section_ads_analytics"] },
                { group: "📦 الطلبات",   keys: ["section_orders","section_new_order","section_archive","section_shipping_followup","section_whatsapp"] },
                { group: "🏪 المخزون",   keys: ["section_inventory","section_warehouses","section_movements"] },
                { group: "🚚 الشحن والفواتير", keys: ["section_shipping","section_invoices"] },
                { group: "📁 البيانات",  keys: ["section_import","section_export_data"] },
                { group: "⚙️ الإدارة",   keys: ["section_users","section_sessions_report","section_audit"] },
              ].map(({ group, keys }) => {
                const groupItems = SIDEBAR_SECTION_PERMISSIONS.filter(p => keys.includes(p.key));
                if (!groupItems.length) return null;
                const allOn  = groupItems.every(p => form.permissions.includes(p.key));
                const someOn = groupItems.some(p => form.permissions.includes(p.key));
                const toggleGroup = () => {
                  if (allOn) {
                    setForm(f => ({ ...f, permissions: f.permissions.filter(k => !keys.includes(k)) }));
                  } else {
                    setForm(f => ({ ...f, permissions: [...new Set([...f.permissions, ...keys])] }));
                  }
                };
                return (
                  <div key={group} className="mb-3">
                    <button type="button" onClick={toggleGroup} className="flex items-center gap-2 mb-1.5 w-full text-right group">
                      <span className="text-[11px] font-bold text-muted-foreground group-hover:text-foreground transition-colors">{group}</span>
                      <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold ml-auto ${allOn ? "bg-emerald-500/20 text-emerald-600 dark:text-emerald-400" : someOn ? "bg-amber-500/20 text-amber-600 dark:text-amber-400" : "bg-red-500/20 text-red-500"}`}>
                        {allOn ? "كل شيء ظاهر" : someOn ? "جزئي" : "كل شيء مخفي"}
                      </span>
                    </button>
                    <div className="space-y-1">
                      {groupItems.map(p => {
                        const active = form.permissions.includes(p.key);
                        return (
                          <div key={p.key} className={`rounded-lg border px-2.5 py-2 transition-colors ${active ? "border-primary/40 bg-primary/5" : "border-border bg-muted/10"}`}>
                            <label className="flex items-center gap-2.5 cursor-pointer">
                              <input type="checkbox" checked={active} onChange={() => togglePermission(p.key)} className="w-3.5 h-3.5 rounded accent-primary shrink-0" />
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-1.5">
                                  <span className="text-xs font-bold text-foreground">{p.label}</span>
                                  <span className={`text-[9px] px-1 py-0.5 rounded-full font-bold ${active ? "bg-emerald-500/20 text-emerald-600 dark:text-emerald-400" : "bg-red-500/20 text-red-600 dark:text-red-400"}`}>
                                    {active ? "ظاهر" : "مخفي"}
                                  </span>
                                </div>
                                <p className="text-[10px] text-muted-foreground">{p.desc}</p>
                              </div>
                            </label>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          <div className="shrink-0 flex gap-2 pt-3 border-t border-border mt-1">
            <Button className="flex-1 h-10 text-sm font-bold bg-primary text-primary-foreground" onClick={handleSubmit} disabled={createMutation.isPending || updateMutation.isPending}>
              {createMutation.isPending || updateMutation.isPending ? "جاري الحفظ..." : editingUser ? "حفظ التعديلات" : "إضافة المستخدم"}
            </Button>
            <Button variant="outline" className="h-10 text-sm border-border" onClick={() => setDialogOpen(false)}>إلغاء</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Reset Password Dialog ── */}
      <Dialog open={resetPasswordOpen} onOpenChange={setResetPasswordOpen}>
        <DialogContent className="bg-card border-border w-[95vw] max-w-sm" dir="rtl">
          <DialogHeader><DialogTitle>إعادة تعيين كلمة المرور</DialogTitle></DialogHeader>
          <div className="space-y-3 mt-2">
            <p className="text-sm text-muted-foreground">تغيير كلمة مرور: <span className="font-bold text-foreground">{resetTarget?.displayName}</span></p>
            <div className="relative">
              <Input type={showPassword ? "text" : "password"} className="h-9 text-sm bg-background pl-9" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="كلمة المرور الجديدة (6 أحرف على الأقل)" />
              <button type="button" onClick={() => setShowPassword(v => !v)} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground">
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <div className="flex gap-2 pt-1">
              <Button className="flex-1 h-9 text-sm font-bold" onClick={() => {
                if (resetTarget && newPassword.length >= 6) { updateMutation.mutate({ id: resetTarget.id, data: { password: newPassword } }); setNewPassword(""); }
                else toast({ title: "خطأ", description: "كلمة المرور 6 أحرف على الأقل", variant: "destructive" });
              }} disabled={updateMutation.isPending}>
                {updateMutation.isPending ? "جاري الحفظ..." : "تغيير"}
              </Button>
              <Button variant="outline" className="h-9 text-sm" onClick={() => setResetPasswordOpen(false)}>إلغاء</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

    </div>
  );
}
