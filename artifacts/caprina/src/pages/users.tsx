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
import { UserPlus, Edit2, Trash2, Shield, Users, Eye, EyeOff, TrendingUp, Package, BarChart3, LayoutGrid, Lock, User, Settings2, ChevronDown, ChevronUp, ToggleLeft } from "lucide-react";

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
const EDIT_DELETE_INVENTORY_PERMISSION = { key: "edit_delete_inventory", label: "إظهار أزرار التعديل والحذف في المخزون", desc: "يظهر أزرار تعديل وحذف المنتجات والـ SKU في صفحة المخزون" };
const VIEW_PRODUCT_PERF_PERMISSION = { key: "view_product_performance", label: "عرض أداء المنتجات", desc: "يرى تحليل أداء وأرباح كل منتج" };
const ADD_TEAM_MEMBER_PERMISSION = { key: "add_team_member", label: "إضافة موظف جديد", desc: "يظهر زرار إضافة موظف جديد في إدارة الفريق" };
const EDIT_BRAND_PERMISSION = { key: "edit_brand", label: "تعديل هوية الشركة", desc: "يقدر يغير اسم الشركة والشعار والـ Tagline من أيقونة البروفايل" };

// صلاحيات ظهور الأقسام في الـ Sidebar — per-user
const SIDEBAR_SECTION_PERMISSIONS = [
  // ── عام ──
  { key: "section_dashboard",        label: "لوحة التحكم",       desc: "الصفحة الرئيسية ولوحة التحكم"                              },
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
    EDIT_DELETE_INVENTORY_PERMISSION.key,
    VIEW_PRODUCT_PERF_PERMISSION.key,
    ADD_TEAM_MEMBER_PERMISSION.key,
    EDIT_BRAND_PERMISSION.key,
    ...SIDEBAR_SECTION_PERMISSIONS.map(p => p.key),
  ],
  employee: () => ["dashboard", "orders", "section_orders", "section_new_order", "section_archive", "section_shipping_followup"],
  warehouse: () => ["dashboard", "inventory", "movements", EDIT_INVENTORY_PERMISSION.key, EDIT_DELETE_INVENTORY_PERMISSION.key, "section_inventory", "section_warehouses", "section_movements"],
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
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({
    "🏠 عام": true, "📊 التحليلات": true, "📦 الطلبات": true,
    "🏪 المخزون": true, "🚚 الشحن والفواتير": true, "📁 البيانات": true, "⚙️ الإدارة": true,
  });

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
      // دايماً نعمل invalidate عشان القايمة تتحدث
      qc.invalidateQueries({ queryKey: ["users"] });
      setDialogOpen(false);
      setResetPasswordOpen(false);
      toast({ title: "تم تحديث المستخدم بنجاح" });
      // لو الأدمن عدّل نفسه — نعمل refreshUser عشان الـ sidebar يتحدث فوراً
      // لو عدّل حد تاني — الـ polling بتاعه هيجيب البيانات الجديدة في 3 ثواني
      if (variables.id === currentUser?.id) {
        refreshUser();
      }
    },
    onError: (e: any) => toast({ title: "خطأ في الحفظ", description: e.message, variant: "destructive" }),
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
    // الأدمن اللي عنده [] في الـ DB (قديم) نفرد ليه كل الصلاحيات تلقائياً
    if (role === "admin" && perms.length === 0) return DEFAULT_PERMISSIONS["admin"]!();
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
      const data: any = {
        displayName: form.displayName,
        role: form.role,
        // الأدمن دايماً يشوف كل حاجة بحكم الـ can() — بس نحفظ الـ permissions الفعلية عشان الـ DB يكون صح
        // مانمسحش الـ permissions للأدمن — نبعتها كما هي
        permissions: form.permissions,
      };
      if (form.password) data.password = form.password;
      updateMutation.mutate({ id: editingUser.id, data });
    } else {
      if (!form.username.trim()) { toast({ title: "خطأ", description: "اسم المستخدم مطلوب", variant: "destructive" }); return; }
      if (form.password.length < 6) { toast({ title: "خطأ", description: "كلمة المرور 6 أحرف على الأقل", variant: "destructive" }); return; }
      // نبعت الـ permissions كما هي دايماً — سواء أدمن أو موظف
      const permissions = form.permissions;
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
                <label
                  className={`flex flex-col items-center gap-1 cursor-pointer group ${u.id === currentUser?.id ? "opacity-40 pointer-events-none" : ""}`}
                  title={u.isActive ? "تعطيل الحساب" : "تفعيل الحساب"}
                >
                  <input
                    type="checkbox"
                    checked={u.isActive}
                    onChange={() => handleToggleActive(u)}
                    disabled={u.id === currentUser?.id}
                    className="w-4 h-4 rounded accent-primary cursor-pointer"
                  />
                  <span className={`text-[9px] font-bold ${u.isActive ? "text-emerald-500" : "text-red-500"}`}>
                    {u.isActive ? "نشط" : "معطل"}
                  </span>
                </label>
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
        <DialogContent className="bg-card border-border w-[95vw] max-w-lg flex flex-col max-h-[92dvh]" dir="rtl">

          {/* ── Header ── */}
          <DialogHeader className="shrink-0 pb-3 border-b border-border">
            <DialogTitle className="flex items-center gap-2 text-base font-black">
              {editingUser
                ? <><Edit2 className="w-4 h-4 text-primary" /> تعديل: {editingUser.displayName}</>
                : <><UserPlus className="w-4 h-4 text-primary" /> إضافة مستخدم جديد</>}
            </DialogTitle>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto space-y-5 py-4 px-1">

            {/* ── القسم 1: بيانات الحساب ── */}
            <section>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <User className="w-3.5 h-3.5 text-primary" />
                </div>
                <span className="text-xs font-black text-foreground uppercase tracking-wide">بيانات الحساب</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs text-muted-foreground mb-1.5 block">الاسم الكامل *</Label>
                  <Input className="h-9 text-sm bg-background" value={form.displayName}
                    onChange={e => setForm(f => ({ ...f, displayName: e.target.value }))} placeholder="مثال: أحمد محمد" />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground mb-1.5 block">اسم المستخدم *</Label>
                  <Input className="h-9 text-sm bg-background font-mono" value={form.username}
                    onChange={e => setForm(f => ({ ...f, username: e.target.value.toLowerCase() }))}
                    placeholder="ahmed" disabled={!!editingUser} />
                </div>
              </div>
              <div className="mt-3">
                <Label className="text-xs text-muted-foreground mb-1.5 block">
                  <Lock className="w-3 h-3 inline ml-1" />
                  {editingUser ? "كلمة مرور جديدة (اتركها فارغة إن لم تريد تغييرها)" : "كلمة المرور *"}
                </Label>
                <div className="relative">
                  <Input type={showPassword ? "text" : "password"} className="h-9 text-sm bg-background pl-9"
                    value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                    placeholder={editingUser ? "••••••••" : "6 أحرف على الأقل"} />
                  <button type="button" onClick={() => setShowPassword(v => !v)}
                    className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            </section>

            <Separator />

            {/* ── القسم 2: الدور الوظيفي ── */}
            <section>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <Shield className="w-3.5 h-3.5 text-primary" />
                </div>
                <span className="text-xs font-black text-foreground uppercase tracking-wide">الدور الوظيفي</span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {(["admin", "employee", "warehouse"] as const).map(role => (
                  <button key={role} type="button" onClick={() => handleRoleChange(role)}
                    className={`py-3 rounded-xl border-2 text-xs font-bold transition-all flex flex-col items-center gap-1
                      ${form.role === role ? ROLE_COLORS[role] + " scale-[1.03]" : "border-border text-muted-foreground hover:border-muted-foreground bg-muted/10"}`}>
                    {role === "admin" && <Shield className="w-4 h-4" />}
                    {role === "employee" && <User className="w-4 h-4" />}
                    {role === "warehouse" && <Package className="w-4 h-4" />}
                    {ROLE_LABELS[role]}
                  </button>
                ))}
              </div>
            </section>

            <Separator />

            {/* ── القسم 3: الصلاحيات الخاصة ── */}
            <section>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <Settings2 className="w-3.5 h-3.5 text-primary" />
                </div>
                <span className="text-xs font-black text-foreground uppercase tracking-wide">الصلاحيات الخاصة</span>
              </div>
              <div className="space-y-2">
                {[
                  { perm: FINANCIAL_PERMISSION,              color: "amber",   icon: <TrendingUp  className="w-3.5 h-3.5 text-amber-500" />,   badge: "حساسة" },
                  { perm: EDIT_INVENTORY_PERMISSION,         color: "emerald", icon: <Package     className="w-3.5 h-3.5 text-emerald-500" />, badge: null    },
                  { perm: EDIT_DELETE_INVENTORY_PERMISSION,  color: "rose",    icon: <ToggleLeft  className="w-3.5 h-3.5 text-rose-500" />,    badge: null    },
                  { perm: VIEW_PRODUCT_PERF_PERMISSION,      color: "blue",    icon: <BarChart3   className="w-3.5 h-3.5 text-blue-500" />,    badge: null    },
                  { perm: ADD_TEAM_MEMBER_PERMISSION,        color: "violet",  icon: <Users       className="w-3.5 h-3.5 text-violet-500" />,  badge: null    },
                  { perm: EDIT_BRAND_PERMISSION,             color: "orange",  icon: <Settings2   className="w-3.5 h-3.5 text-orange-500" />,  badge: null    },
                ].map(({ perm, color, icon, badge }) => {
                  const active = form.permissions.includes(perm.key);
                  return (
                    <label key={perm.key} className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all
                      ${active
                        ? color === "amber"   ? "border-amber-500/50 bg-amber-500/5"
                        : color === "emerald" ? "border-emerald-500/50 bg-emerald-500/5"
                        : color === "rose"    ? "border-rose-500/50 bg-rose-500/5"
                        : color === "violet"  ? "border-violet-500/50 bg-violet-500/5"
                        : color === "orange"  ? "border-orange-500/50 bg-orange-500/5"
                                             : "border-blue-500/50 bg-blue-500/5"
                        : "border-border bg-muted/10 hover:border-muted-foreground/40"}`}>
                      <input type="checkbox" checked={active} onChange={() => togglePermission(perm.key)}
                        className={`w-4 h-4 rounded shrink-0 ${color === "amber" ? "accent-amber-500" : color === "emerald" ? "accent-emerald-500" : color === "rose" ? "accent-rose-500" : color === "violet" ? "accent-violet-500" : color === "orange" ? "accent-orange-500" : "accent-blue-500"}`} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          {icon}
                          <span className="text-xs font-bold">{perm.label}</span>
                          {badge && <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold bg-amber-500/20 text-amber-600 dark:text-amber-400`}>{badge}</span>}
                        </div>
                        <p className="text-[10px] text-muted-foreground mt-0.5">{perm.desc}</p>
                      </div>
                      <div className={`w-2 h-2 rounded-full shrink-0 ${active ? "bg-emerald-500" : "bg-muted-foreground/30"}`} />
                    </label>
                  );
                })}
              </div>
            </section>

            <Separator />

            {/* ── القسم 4: صلاحيات الصفحات + الـ Sidebar مدمجين ── */}
            <section>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <LayoutGrid className="w-3.5 h-3.5 text-primary" />
                </div>
                <span className="text-xs font-black text-foreground uppercase tracking-wide">الصفحات والأقسام</span>
                <span className="text-[10px] text-muted-foreground mr-auto">الوصول + الظهور في القائمة</span>
              </div>

              {/* كل group فيه: صلاحية الصفحة + صلاحية الظهور مدمجين */}
              {[
                {
                  group: "🏠 عام",
                  items: [
                    { label: "لوحة التحكم", pageKey: "dashboard", sectionKey: "section_dashboard" },
                  ]
                },
                {
                  group: "📊 التحليلات",
                  items: [
                    { label: "التحليلات والتقارير",  pageKey: "analytics",               sectionKey: null },
                    { label: "أداء المنتجات",         pageKey: "view_product_performance", sectionKey: "section_product_performance" },
                    { label: "أداء الفريق",            pageKey: null,                       sectionKey: "section_team_performance" },
                    { label: "إدارة الفريق",           pageKey: null,                       sectionKey: "section_team_management" },
                    { label: "التحليل الذكي 🧠",      pageKey: null,                       sectionKey: "section_smart_analytics" },
                    { label: "تحليل الإعلانات",        pageKey: null,                       sectionKey: "section_ads_analytics" },
                  ]
                },
                {
                  group: "📦 الطلبات",
                  items: [
                    { label: "الطلبات",        pageKey: "orders", sectionKey: "section_orders" },
                    { label: "طلب جديد",       pageKey: null,     sectionKey: "section_new_order" },
                    { label: "الأرشيف 🗂️",    pageKey: null,     sectionKey: "section_archive" },
                    { label: "متابعة الشحن ⏱️",pageKey: null,     sectionKey: "section_shipping_followup" },
                    { label: "إعدادات واتساب", pageKey: "whatsapp",sectionKey: "section_whatsapp" },
                  ]
                },
                {
                  group: "🏪 المخزون",
                  items: [
                    { label: "المخزون",        pageKey: "inventory", sectionKey: "section_inventory" },
                    { label: "المخازن",         pageKey: null,        sectionKey: "section_warehouses" },
                    { label: "حركات المخزون",   pageKey: "movements", sectionKey: "section_movements" },
                  ]
                },
                {
                  group: "🚚 الشحن والفواتير",
                  items: [
                    { label: "شركات الشحن", pageKey: "shipping",  sectionKey: "section_shipping" },
                    { label: "الفواتير",     pageKey: "invoices",  sectionKey: "section_invoices" },
                  ]
                },
                {
                  group: "📁 البيانات",
                  items: [
                    { label: "استيراد Excel",  pageKey: "import", sectionKey: "section_import" },
                    { label: "تصدير البيانات", pageKey: null,     sectionKey: "section_export_data" },
                  ]
                },
                {
                  group: "⚙️ الإدارة",
                  items: [
                    { label: "إدارة المستخدمين", pageKey: "users", sectionKey: "section_users" },
                    { label: "تقرير الجلسات",     pageKey: null,    sectionKey: "section_sessions_report" },
                    { label: "سجل التعديلات",     pageKey: "audit", sectionKey: "section_audit" },
                  ]
                },
              ].map(({ group, items }) => {
                const allKeys = items.flatMap(i => [i.pageKey, i.sectionKey].filter(Boolean) as string[]);
                const allOn  = allKeys.every(k => form.permissions.includes(k));
                const someOn = allKeys.some(k => form.permissions.includes(k));
                const open = openGroups[group] ?? true;
                const toggleGroup = () => {
                  if (allOn) setForm(f => ({ ...f, permissions: f.permissions.filter(k => !allKeys.includes(k)) }));
                  else       setForm(f => ({ ...f, permissions: [...new Set([...f.permissions, ...allKeys])] }));
                };
                return (
                  <div key={group} className="rounded-xl border border-border overflow-hidden mb-2">
                    {/* Group Header */}
                    <div className="flex items-center gap-2 px-3 py-2 bg-muted/20">
                      <button type="button" onClick={() => setOpenGroups(g => ({ ...g, [group]: !open }))} className="flex items-center gap-2 flex-1 text-right">
                        {open ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />}
                        <span className="text-[11px] font-black text-foreground">{group}</span>
                      </button>
                      <button type="button" onClick={toggleGroup}
                        className={`text-[9px] px-2 py-0.5 rounded-full font-bold transition-colors
                          ${allOn  ? "bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/30"
                          : someOn ? "bg-amber-500/20 text-amber-600 dark:text-amber-400 hover:bg-amber-500/30"
                                   : "bg-red-500/15 text-red-500 hover:bg-red-500/25"}`}>
                        {allOn ? "✓ الكل" : someOn ? "جزئي" : "× لا شيء"}
                      </button>
                    </div>
                    {/* Group Items */}
                    {open && (
                      <div className="divide-y divide-border/50">
                        {items.map(({ label, pageKey, sectionKey }) => {
                          const pageActive    = pageKey    ? form.permissions.includes(pageKey)    : null;
                          const sectionActive = sectionKey ? form.permissions.includes(sectionKey) : null;
                          return (
                            <div key={label} className="flex items-center gap-3 px-3 py-2.5 hover:bg-muted/10 transition-colors">
                              <span className="text-xs text-foreground flex-1 font-medium">{label}</span>
                              {/* صلاحية الصفحة */}
                              {pageKey ? (
                                <label className="flex items-center gap-1.5 cursor-pointer">
                                  <input type="checkbox" checked={!!pageActive} onChange={() => togglePermission(pageKey)}
                                    className="w-3.5 h-3.5 rounded accent-primary" />
                                  <span className={`text-[9px] font-bold w-10 text-center ${pageActive ? "text-primary" : "text-muted-foreground/50"}`}>
                                    وصول
                                  </span>
                                </label>
                              ) : (
                                <div className="w-[74px]" />
                              )}
                              {/* صلاحية الظهور في Sidebar */}
                              {sectionKey ? (
                                <label className="flex items-center gap-1.5 cursor-pointer">
                                  <input type="checkbox" checked={!!sectionActive} onChange={() => togglePermission(sectionKey)}
                                    className="w-3.5 h-3.5 rounded accent-emerald-500" />
                                  <span className={`text-[9px] font-bold w-10 text-center ${sectionActive ? "text-emerald-500" : "text-muted-foreground/50"}`}>
                                    قائمة
                                  </span>
                                </label>
                              ) : (
                                <div className="w-[74px]" />
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Legend */}
              <div className="flex items-center gap-4 mt-2 px-1">
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded border-2 border-primary bg-primary/20" />
                  <span className="text-[10px] text-muted-foreground">وصول = يقدر يفتح الصفحة</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded border-2 border-emerald-500 bg-emerald-500/20" />
                  <span className="text-[10px] text-muted-foreground">قائمة = يظهر في الـ Sidebar</span>
                </div>
              </div>
            </section>

          </div>

          {/* ── Footer ── */}
          <div className="shrink-0 flex gap-2 pt-3 border-t border-border">
            <Button variant="outline" className="h-10 text-sm border-border px-5" onClick={() => setDialogOpen(false)}>إلغاء</Button>
            <Button className="flex-1 h-10 text-sm font-bold" onClick={handleSubmit}
              disabled={createMutation.isPending || updateMutation.isPending}>
              {createMutation.isPending || updateMutation.isPending
                ? <span className="flex items-center gap-2"><span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />جاري الحفظ...</span>
                : editingUser ? "💾 حفظ التعديلات" : "✚ إضافة المستخدم"}
            </Button>
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
