import { useState, useRef } from "react";
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
import { UserPlus, Edit2, Trash2, Shield, Users, Eye, EyeOff, TrendingUp, Package, BarChart3, LayoutGrid, Lock, User, Settings2, ChevronDown, ChevronUp, ToggleLeft, Camera, X, Crown, AlertTriangle, Search, KeyRound, Power } from "lucide-react";

// ── User Avatar Component ────────────────────────────────────────────────────
function getInitialsColor(name: string): string {
  const colors = [
    "from-violet-500 to-purple-600",
    "from-blue-500 to-cyan-600",
    "from-emerald-500 to-teal-600",
    "from-orange-500 to-amber-600",
    "from-rose-500 to-pink-600",
    "from-indigo-500 to-blue-600",
    "from-teal-500 to-emerald-600",
    "from-fuchsia-500 to-violet-600",
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
}

function UserAvatar({ avatar, name, size = "md" }: {
  avatar?: string | null; name: string; size?: "sm" | "md" | "lg";
}) {
  const sz    = size === "sm" ? "w-8 h-8 text-xs"    : size === "lg" ? "w-16 h-16 text-xl" : "w-10 h-10 text-sm";
  const initials = (name || "?").split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();
  if (avatar) {
    return <img src={avatar} className={`${sz} rounded-full object-cover border-2 border-primary/20 shrink-0`} alt={name} />;
  }
  return (
    <div className={`${sz} rounded-full bg-gradient-to-br ${getInitialsColor(name)} flex items-center justify-center font-bold text-white border-2 border-white/10 shrink-0`}>
      {initials}
    </div>
  );
}

// ── Avatar Upload Picker ─────────────────────────────────────────────────────
function AvatarUpload({ avatar, name, onChange }: {
  avatar: string; name: string; onChange: (val: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState("");

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { setError("الصورة أكبر من 2MB، اختار صورة أصغر"); return; }
    if (!file.type.startsWith("image/")) { setError("الملف ده مش صورة"); return; }
    setError("");
    const reader = new FileReader();
    reader.onload = () => onChange(reader.result as string);
    reader.readAsDataURL(file);
  };

  return (
    <div className="space-y-3">
      <Label className="text-xs text-muted-foreground">صورة المستخدم</Label>
      <div className="flex items-center gap-4">
        {/* Preview */}
        <div className="relative group">
          <UserAvatar avatar={avatar || null} name={name || "U"} size="lg" />
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="absolute inset-0 rounded-full bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
          >
            <Camera className="w-5 h-5 text-white" />
          </button>
        </div>

        <div className="flex-1 space-y-2">
          <p className="text-[11px] text-muted-foreground">
            اضغط على الصورة أو على زر الرفع لتغييرها
            <br />
            <span className="text-muted-foreground/60">الحد الأقصى 2MB — JPG أو PNG أو WebP</span>
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="flex items-center gap-1.5 text-xs bg-primary/10 hover:bg-primary/20 text-primary border border-primary/30 rounded-lg px-3 py-1.5 transition-all"
            >
              <Camera className="w-3 h-3" /> رفع صورة
            </button>
            {avatar && (
              <button
                type="button"
                onClick={() => { onChange(""); setError(""); }}
                className="flex items-center gap-1.5 text-xs bg-destructive/10 hover:bg-destructive/20 text-destructive border border-destructive/30 rounded-lg px-3 py-1.5 transition-all"
              >
                <X className="w-3 h-3" /> حذف
              </button>
            )}
          </div>
          {error && <p className="text-[11px] text-destructive">{error}</p>}
        </div>
      </div>
      <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
    </div>
  );
}

const ROLE_LABELS: Record<string, string> = {
  super_admin: "Super Admin 👑",
  admin: "مدير",
  employee: "موظف مبيعات",
  warehouse: "مسؤول مخزون",
};

const ROLE_COLORS: Record<string, string> = {
  super_admin: "border-yellow-500 bg-yellow-900/30 text-yellow-300",
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
  { key: "finance", label: "الماليات" },
];

const ORDERS_WRITE_PERMISSION = { key: "orders_write", label: "تعديل الطلبات", desc: "يقدر يضيف ويعدل ويحذف الطلبات ويشوف أيقونة واتساب — بدون هذه الصلاحية يكون الوصول للطلبات للعرض فقط" };
const FINANCIAL_PERMISSION = { key: "view_financials", label: "عرض الأرباح والتكاليف", desc: "يرى الأرباح والخسائر والتكاليف في كل التقارير" };
const EDIT_INVENTORY_PERMISSION = { key: "edit_inventory", label: "تعديل المخزون", desc: "يقدر يضيف ويعدل ويحذف المنتجات والمقاسات" };
const EDIT_DELETE_INVENTORY_PERMISSION = { key: "edit_delete_inventory", label: "إظهار أزرار التعديل والحذف في المخزون", desc: "يظهر أزرار تعديل وحذف المنتجات والـ SKU في صفحة المخزون" };
const VIEW_PRODUCT_PERF_PERMISSION = { key: "view_product_performance", label: "عرض أداء المنتجات", desc: "يرى تحليل أداء وأرباح كل منتج" };
const ADD_TEAM_MEMBER_PERMISSION = { key: "add_team_member", label: "إضافة موظف جديد", desc: "يظهر زرار إضافة موظف جديد في إدارة الفريق" };
const EDIT_BRAND_PERMISSION = { key: "edit_brand", label: "تعديل هوية الشركة", desc: "يقدر يغير اسم الشركة والشعار والـ Tagline من أيقونة البروفايل" };

const SIDEBAR_SECTION_PERMISSIONS = [
  { key: "section_dashboard",        label: "لوحة التحكم",       desc: "الصفحة الرئيسية ولوحة التحكم"                              },
  { key: "section_product_performance", label: "أداء المنتجات",      desc: "قسم تحليل أداء وأرباح كل منتج"                              },
  { key: "section_team_performance",    label: "أداء الفريق",        desc: "قسم عرض تقارير وإحصائيات أداء الفريق"                      },
  { key: "section_team_management",     label: "إدارة الفريق",       desc: "قسم إدارة أعضاء الفريق وبياناتهم"                          },
  { key: "section_smart_analytics",     label: "التحليل الذكي 🧠",   desc: "قسم التحليلات الذكية المدعومة بالذكاء الاصطناعي"           },
  { key: "section_ads_analytics",       label: "تحليل الإعلانات",    desc: "قسم تحليل أداء الحملات الإعلانية"                          },
  { key: "section_orders",              label: "الطلبات",             desc: "قسم عرض وإدارة الطلبات"                                    },
  { key: "section_new_order",           label: "طلب جديد",            desc: "زر وصفحة إضافة طلب جديد"                                   },
  { key: "section_archive",             label: "الأرشيف 🗂️",          desc: "قسم أرشيف الطلبات القديمة والمنتهية"                       },
  { key: "section_shipping_followup",   label: "متابعة الشحن ⏱️",     desc: "قسم متابعة حالة شحن الطلبات"                               },
  { key: "section_whatsapp",            label: "إعدادات واتساب",      desc: "قسم إعدادات وتكامل واتساب"                                 },
  { key: "section_inventory",           label: "المخزون",             desc: "قسم عرض وإدارة المنتجات والمخزون"                          },
  { key: "section_warehouses",          label: "المخازن",             desc: "قسم إدارة المخازن المختلفة"                                },
  { key: "section_movements",           label: "حركات المخزون",       desc: "قسم تتبع حركات الدخول والخروج في المخزون"                  },
  { key: "section_shipping",            label: "شركات الشحن",         desc: "قسم إدارة شركات الشحن وتفاصيلها"                           },
  { key: "section_invoices",            label: "الفواتير",             desc: "قسم عرض وإدارة الفواتير"                                   },
  { key: "section_import",              label: "استيراد Excel",        desc: "قسم استيراد البيانات من ملفات Excel"                        },
  { key: "section_export_data",         label: "تصدير البيانات",       desc: "قسم تصدير البيانات إلى ملفات Excel والنسخ الاحتياطية"     },
  { key: "section_users",               label: "إدارة المستخدمين",    desc: "قسم إدارة المستخدمين والصلاحيات"                           },
  { key: "section_sessions_report",     label: "تقرير الجلسات",        desc: "قسم عرض سجل دخول وخروج الموظفين"                           },
  { key: "section_audit",               label: "سجل التعديلات",        desc: "قسم تتبع كل التعديلات والعمليات في النظام"                 },
  { key: "section_finance",             label: "قسم الماليات",         desc: "عرض جميع صفحات الماليات: لوحة، أوامر شراء، موردين، مصروفات، فواتير شحن" },
];

// ── Permission Templates ─────────────────────────────────────────────────────
const PERMISSION_TEMPLATES: Array<{
  key: string;
  label: string;
  icon: string;
  desc: string;
  color: string;
  permissions: string[];
}> = [
  {
    key: "sales_rep",
    label: "موظف مبيعات",
    icon: "🛒",
    desc: "يشوف الطلبات ويضيف ويعدل — بدون تقارير مالية",
    color: "border-blue-500/40 bg-blue-500/5 text-blue-400",
    permissions: [
      "dashboard", "orders", "orders_write",
      "section_dashboard", "section_orders", "section_new_order",
      "section_archive", "section_shipping_followup",
    ],
  },
  {
    key: "warehouse_mgr",
    label: "مسؤول مخزون",
    icon: "📦",
    desc: "يتحكم في المخزون والحركات بالكامل",
    color: "border-emerald-500/40 bg-emerald-500/5 text-emerald-400",
    permissions: [
      "dashboard", "inventory", "movements",
      "edit_inventory", "edit_delete_inventory",
      "section_dashboard", "section_inventory",
      "section_warehouses", "section_movements",
    ],
  },
  {
    key: "manager",
    label: "مدير",
    icon: "👔",
    desc: "صلاحيات واسعة بما فيها التقارير والماليات",
    color: "border-amber-500/40 bg-amber-500/5 text-amber-400",
    permissions: [
      "dashboard", "orders", "orders_write", "inventory", "movements",
      "shipping", "invoices", "analytics", "audit", "finance",
      "view_financials", "edit_inventory", "edit_delete_inventory",
      "view_product_performance", "add_team_member",
      "section_dashboard", "section_orders", "section_new_order",
      "section_archive", "section_shipping_followup", "section_inventory",
      "section_warehouses", "section_movements", "section_shipping",
      "section_invoices", "section_product_performance",
      "section_team_performance", "section_team_management",
      "section_ads_analytics", "section_export_data", "section_finance",
    ],
  },
  {
    key: "custom",
    label: "مخصص",
    icon: "⚙️",
    desc: "ابدأ من صفر وحدد الصلاحيات يدوياً",
    color: "border-muted text-muted-foreground",
    permissions: [],
  },
];

const DEFAULT_PERMISSIONS: Record<string, () => string[]> = {
  super_admin: () => ["*"],
  admin: () => [
    ...ALL_PERMISSIONS.map(p => p.key),
    FINANCIAL_PERMISSION.key,
    ORDERS_WRITE_PERMISSION.key,
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
  avatar: string;
}

const emptyForm = (): UserForm => ({
  username: "", password: "", displayName: "",
  role: "employee", permissions: DEFAULT_PERMISSIONS["employee"]?.() ?? [],
  avatar: "",
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
  const [searchQuery, setSearchQuery] = useState("");
  const [filterRole, setFilterRole] = useState<string>("all");
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
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
      qc.invalidateQueries({ queryKey: ["users"] });
      setDialogOpen(false);
      setResetPasswordOpen(false);
      toast({ title: "تم تحديث المستخدم بنجاح" });
      if (variables.id === currentUser?.id) refreshUser();
    },
    onError: (e: any) => toast({ title: "خطأ في الحفظ", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: usersApi.delete,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["users"] }); toast({ title: "تم حذف المستخدم" }); },
    onError: (e: any) => toast({ title: "خطأ", description: e.message, variant: "destructive" }),
  });

  const openCreate = () => { setEditingUser(null); setForm(emptyForm()); setShowPassword(false); setDialogOpen(true); };

  const expandPermissions = (perms: string[], role: string): string[] => {
    const clean = perms
      .map(p => (typeof p === "string" ? p : null))
      .filter((p): p is string => p !== null && p.trim() !== "");
    if (clean.includes("*")) return DEFAULT_PERMISSIONS[role]?.() ?? DEFAULT_PERMISSIONS["admin"]!();
    if (clean.length === 0)  return DEFAULT_PERMISSIONS[role]?.() ?? [];
    return clean;
  };

  const openEdit = (u: AppUser) => {
    setEditingUser(u);
    const rawPerms = Array.isArray(u.permissions) ? u.permissions : [];
    setForm({
      username: u.username,
      password: "",
      displayName: u.displayName,
      role: u.role,
      permissions: expandPermissions(rawPerms, u.role),
      avatar: (u as any).avatar ?? "",
    });
    setShowPassword(false);
    setDialogOpen(true);
  };

  const handleRoleChange = (role: string) => setForm(f => ({ ...f, role, permissions: DEFAULT_PERMISSIONS[role]?.() ?? [] }));

  const applyTemplate = (templateKey: string) => {
    const tmpl = PERMISSION_TEMPLATES.find(t => t.key === templateKey);
    if (!tmpl) return;
    setSelectedTemplate(templateKey);
    if (tmpl.key === "custom") {
      setForm(f => ({ ...f, permissions: [] }));
    } else {
      setForm(f => ({ ...f, permissions: tmpl.permissions }));
    }
  };

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
        permissions: form.permissions,
        avatar: form.avatar || null,
      };
      if (form.password) data.password = form.password;
      updateMutation.mutate({ id: editingUser.id, data });
    } else {
      if (!form.username.trim()) { toast({ title: "خطأ", description: "اسم المستخدم مطلوب", variant: "destructive" }); return; }
      if (form.password.length < 6) { toast({ title: "خطأ", description: "كلمة المرور 6 أحرف على الأقل", variant: "destructive" }); return; }
      createMutation.mutate({
        username: form.username.trim(),
        password: form.password,
        displayName: form.displayName.trim(),
        role: form.role,
        permissions: form.permissions,
        avatar: form.avatar || undefined,
      });
    }
  };

  const handleDelete = (u: AppUser) => {
    if (!confirm(`حذف المستخدم "${u.displayName}"؟ هذا الإجراء لا يمكن التراجع عنه.`)) return;
    deleteMutation.mutate(u.id);
  };

  const handleToggleActive = (u: AppUser) => updateMutation.mutate({ id: u.id, data: { isActive: !u.isActive } });

  const filteredUsers = users.filter(u => {
    const matchSearch = searchQuery === "" ||
      u.displayName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.username.toLowerCase().includes(searchQuery.toLowerCase());
    const matchRole = filterRole === "all" || u.role === filterRole;
    return matchSearch && matchRole;
  });

  const roleCounts = {
    all: users.length,
    super_admin: users.filter(u => u.role === "super_admin").length,
    admin: users.filter(u => u.role === "admin").length,
    employee: users.filter(u => u.role === "employee").length,
    warehouse: users.filter(u => u.role === "warehouse").length,
  };

  return (
    <div className="p-3 sm:p-6 max-w-5xl mx-auto" dir="rtl">

      {/* ── Header ── */}
      <div className="flex items-center justify-between mb-5 gap-3">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-black flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
              <Users className="w-4 h-4 text-primary" />
            </div>
            إدارة المستخدمين
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5 mr-10">{users.length} مستخدم — تحكم في الأدوار والصلاحيات</p>
        </div>
        {isAdmin && (
          <Button onClick={openCreate} className="h-9 text-xs sm:text-sm font-bold gap-1.5 shrink-0">
            <UserPlus className="w-4 h-4" />
            <span className="hidden sm:inline">إضافة مستخدم</span>
            <span className="sm:hidden">إضافة</span>
          </Button>
        )}
      </div>

      {/* ── Search + Filter ── */}
      <div className="mb-4 space-y-3">
        {/* Search */}
        <div className="relative">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
          <Input
            placeholder="ابحث بالاسم أو اسم المستخدم..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="pr-9 h-9 text-sm bg-muted/30 border-border/60"
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery("")} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Role filter tabs */}
        <div className="flex gap-1.5 flex-wrap">
          {[
            { key: "all", label: "الكل" },
            { key: "super_admin", label: "👑 Super Admin" },
            { key: "admin", label: "مدير" },
            { key: "employee", label: "موظف" },
            { key: "warehouse", label: "مخزون" },
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => setFilterRole(tab.key)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${
                filterRole === tab.key
                  ? "bg-primary text-primary-foreground border-primary shadow-sm"
                  : "bg-muted/30 text-muted-foreground border-border/50 hover:bg-muted/60"
              }`}
            >
              {tab.label}
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-black ${
                filterRole === tab.key ? "bg-white/20" : "bg-muted"
              }`}>
                {roleCounts[tab.key as keyof typeof roleCounts] ?? 0}
              </span>
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-44 rounded-2xl border border-border/40 bg-muted/20 animate-pulse" />
          ))}
        </div>
      ) : filteredUsers.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Users className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">لا يوجد مستخدمون مطابقون</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filteredUsers.map(u => {
            const isSuperAdmin = u.role === "super_admin";
            const canManage = !isSuperAdmin || currentUser?.role === "super_admin";
            const isMe = u.id === currentUser?.id;

            return (
              <div
                key={u.id}
                className={`relative rounded-2xl border p-4 flex flex-col gap-3 transition-all group ${
                  u.isActive
                    ? "border-border bg-card hover:border-primary/40 hover:shadow-md hover:shadow-primary/5"
                    : "border-border/30 bg-muted/10 opacity-55"
                } ${isSuperAdmin ? "border-yellow-500/30 bg-yellow-500/5" : ""}`}
              >
                {/* ── Status dot ── */}
                <div className={`absolute top-3 left-3 w-2 h-2 rounded-full ${u.isActive ? "bg-emerald-500" : "bg-red-500"}`} title={u.isActive ? "نشط" : "معطل"} />

                {/* ── Top row: avatar + badges ── */}
                <div className="flex items-start gap-3">
                  <div className="relative shrink-0">
                    <UserAvatar avatar={(u as any).avatar} name={u.displayName} size="lg" />
                    {isSuperAdmin && (
                      <span className="absolute -top-1 -right-1 text-sm">👑</span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-black text-sm truncate">{u.displayName}</span>
                      {isMe && <Badge variant="outline" className="text-[9px] border-primary/50 text-primary px-1.5">أنت</Badge>}
                    </div>
                    <p className="text-[11px] text-muted-foreground font-mono truncate mt-0.5">@{u.username}</p>
                    <Badge variant="outline" className={`mt-1.5 text-[10px] font-bold ${ROLE_COLORS[u.role]}`}>
                      {ROLE_LABELS[u.role]}
                    </Badge>
                  </div>
                </div>

                {/* ── Permission chips ── */}
                <div className="flex flex-wrap gap-1 min-h-[20px]">
                  {isSuperAdmin ? (
                    <span className="text-[10px] text-yellow-400 font-bold">كل الصلاحيات ✦</span>
                  ) : (
                    <>
                      {(u.permissions?.includes(FINANCIAL_PERMISSION.key) || u.role === "admin") && (
                        <Badge variant="outline" className="text-[9px] font-bold border-amber-600/40 bg-amber-500/10 text-amber-500 gap-1 px-1.5"><TrendingUp className="w-2.5 h-2.5" />الأرباح</Badge>
                      )}
                      {(u.permissions?.includes(EDIT_INVENTORY_PERMISSION.key) || u.role === "admin") && (
                        <Badge variant="outline" className="text-[9px] font-bold border-emerald-600/40 bg-emerald-500/10 text-emerald-500 gap-1 px-1.5"><Package className="w-2.5 h-2.5" />المخزون</Badge>
                      )}
                      {(u.permissions?.includes(VIEW_PRODUCT_PERF_PERMISSION.key) || u.role === "admin") && (
                        <Badge variant="outline" className="text-[9px] font-bold border-blue-600/40 bg-blue-500/10 text-blue-500 gap-1 px-1.5"><BarChart3 className="w-2.5 h-2.5" />الأداء</Badge>
                      )}
                      {u.permissions?.includes("orders_write") && (
                        <Badge variant="outline" className="text-[9px] font-bold border-violet-600/40 bg-violet-500/10 text-violet-500 gap-1 px-1.5"><Edit2 className="w-2.5 h-2.5" />تعديل الطلبات</Badge>
                      )}
                    </>
                  )}
                </div>

                {/* ── Divider ── */}
                <div className="border-t border-border/40" />

                {/* ── Action buttons ── */}
                <div className="flex items-center gap-1.5">
                  {canManage ? (
                    <>
                      {/* تفعيل/تعطيل */}
                      <button
                        onClick={() => !isMe && handleToggleActive(u)}
                        disabled={isMe}
                        title={u.isActive ? "تعطيل الحساب" : "تفعيل الحساب"}
                        className={`flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-lg border transition-all ${
                          isMe ? "opacity-30 cursor-not-allowed" : "cursor-pointer hover:opacity-80"
                        } ${u.isActive
                          ? "border-emerald-600/40 bg-emerald-500/10 text-emerald-500"
                          : "border-red-600/40 bg-red-500/10 text-red-500"
                        }`}
                      >
                        <Power className="w-2.5 h-2.5" />
                        {u.isActive ? "نشط" : "معطل"}
                      </button>

                      <div className="flex-1" />

                      {/* تعديل */}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 hover:bg-primary/10 hover:text-primary"
                        onClick={() => openEdit(u)}
                        title="تعديل"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </Button>

                      {/* حذف */}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 hover:bg-destructive/10 hover:text-destructive"
                        onClick={() => handleDelete(u)}
                        disabled={isMe}
                        title="حذف"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </>
                  ) : (
                    <div className="flex items-center gap-1.5 text-[10px] text-yellow-500/60 font-bold">
                      <Lock className="w-3 h-3" /> محمي — Super Admin فقط
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Create / Edit Dialog ── */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent
          className="bg-[#0f0f11] border border-white/[0.07] w-[96vw] max-w-2xl p-0 overflow-hidden flex flex-col gap-0 rounded-2xl shadow-2xl"
          dir="rtl"
          style={{ maxHeight: "92dvh" }}
        >
          {/* ── Hero Header ── */}
          <div className="relative shrink-0 overflow-hidden">
            {/* gradient bg */}
            <div className="absolute inset-0 bg-gradient-to-bl from-primary/20 via-primary/5 to-transparent pointer-events-none" />
            <div className="absolute top-0 left-0 w-40 h-40 rounded-full bg-primary/10 blur-3xl pointer-events-none -translate-x-1/2 -translate-y-1/2" />

            <div className="relative flex items-center gap-4 px-6 py-5">
              {/* Avatar */}
              <div className="relative shrink-0">
                <div className="w-14 h-14 rounded-2xl overflow-hidden border-2 border-primary/30 shadow-lg shadow-primary/20">
                  <UserAvatar avatar={form.avatar || null} name={form.displayName || form.username || "U"} size="lg" />
                </div>
                <button
                  type="button"
                  onClick={() => (document.getElementById("modal-avatar-input") as HTMLInputElement)?.click()}
                  className="absolute -bottom-1 -left-1 w-5 h-5 rounded-full bg-primary flex items-center justify-center shadow-md hover:bg-primary/80 transition-colors"
                >
                  <Camera className="w-2.5 h-2.5 text-primary-foreground" />
                </button>
                <input
                  id="modal-avatar-input" type="file" accept="image/*" className="hidden"
                  onChange={e => {
                    const file = e.target.files?.[0];
                    if (!file || file.size > 2 * 1024 * 1024) return;
                    const reader = new FileReader();
                    reader.onload = () => setForm(f => ({ ...f, avatar: reader.result as string }));
                    reader.readAsDataURL(file);
                  }}
                />
              </div>

              {/* Title */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  {editingUser
                    ? <><Edit2 className="w-3.5 h-3.5 text-primary" /><span className="text-[10px] font-bold text-primary uppercase tracking-widest">تعديل مستخدم</span></>
                    : <><UserPlus className="w-3.5 h-3.5 text-primary" /><span className="text-[10px] font-bold text-primary uppercase tracking-widest">مستخدم جديد</span></>
                  }
                </div>
                <h2 className="text-base font-black text-white truncate">
                  {form.displayName || form.username || "بدون اسم"}
                </h2>
                <div className="flex items-center gap-2 mt-1">
                  <span className={`text-[9px] font-black px-2 py-0.5 rounded-full border ${ROLE_COLORS[form.role] || "border-border text-muted-foreground"}`}>
                    {ROLE_LABELS[form.role] || form.role}
                  </span>
                  {form.permissions.length > 0 && form.role !== "super_admin" && (
                    <span className="text-[9px] text-muted-foreground">{form.permissions.length} صلاحية</span>
                  )}
                </div>
              </div>

              {/* Close */}
              <button
                onClick={() => setDialogOpen(false)}
                className="shrink-0 w-8 h-8 rounded-xl border border-white/10 flex items-center justify-center text-muted-foreground hover:text-white hover:border-white/30 transition-all"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* ── Tab Bar ── */}
            {(() => {
              const tabs = [
                { id: "account", icon: <User className="w-3.5 h-3.5" />, label: "الحساب" },
                { id: "role",    icon: <Shield className="w-3.5 h-3.5" />, label: "الدور" },
                ...( form.role !== "super_admin" ? [{ id: "perms", icon: <KeyRound className="w-3.5 h-3.5" />, label: "الصلاحيات" }] : [] ),
              ];
              const active = (window as any).__modalTab || "account";
              return (
                <div className="flex border-t border-white/[0.06] bg-white/[0.02]">
                  {tabs.map(tab => (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => { (window as any).__modalTab = tab.id; setForm(f => ({ ...f })); }}
                      className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-[11px] font-bold transition-all border-b-2
                        ${active === tab.id
                          ? "border-primary text-primary bg-primary/5"
                          : "border-transparent text-muted-foreground hover:text-white hover:bg-white/[0.03]"}`}
                    >
                      {tab.icon}{tab.label}
                    </button>
                  ))}
                </div>
              );
            })()}
          </div>

          {/* ── Tab Content ── */}
          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
            {(() => {
              const tab = (window as any).__modalTab || "account";

              /* ────── TAB: الحساب ────── */
              if (tab === "account") return (
                <div className="space-y-5">
                  {/* Name + Username */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label className="text-[11px] text-muted-foreground font-semibold">الاسم الكامل *</Label>
                      <Input
                        className="h-10 text-sm bg-white/[0.04] border-white/[0.08] focus:border-primary/50 rounded-xl"
                        value={form.displayName}
                        onChange={e => setForm(f => ({ ...f, displayName: e.target.value }))}
                        placeholder="أحمد محمد"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-[11px] text-muted-foreground font-semibold">اسم المستخدم *</Label>
                      <Input
                        className="h-10 text-sm bg-white/[0.04] border-white/[0.08] focus:border-primary/50 rounded-xl font-mono"
                        value={form.username}
                        onChange={e => setForm(f => ({ ...f, username: e.target.value.toLowerCase() }))}
                        placeholder="ahmed123"
                        disabled={!!editingUser}
                      />
                    </div>
                  </div>

                  {/* Password */}
                  <div className="space-y-1.5">
                    <Label className="text-[11px] text-muted-foreground font-semibold flex items-center gap-1">
                      <Lock className="w-3 h-3" />
                      {editingUser ? "كلمة مرور جديدة (اتركها فارغة للإبقاء على القديمة)" : "كلمة المرور *"}
                    </Label>
                    <div className="relative">
                      <Input
                        type={showPassword ? "text" : "password"}
                        className="h-10 text-sm bg-white/[0.04] border-white/[0.08] focus:border-primary/50 rounded-xl pl-10"
                        value={form.password}
                        onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                        placeholder={editingUser ? "••••••••" : "6 أحرف على الأقل"}
                      />
                      <button type="button" onClick={() => setShowPassword(v => !v)}
                        className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-white transition-colors">
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {/* Avatar hint */}
                  <div className="flex items-center gap-3 p-3.5 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                    <Camera className="w-4 h-4 text-primary/70 shrink-0" />
                    <div>
                      <p className="text-xs font-semibold text-white/80">صورة الملف الشخصي</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">اضغط على الأيقونة في الأعلى لتغيير الصورة — PNG أو JPG بحد أقصى 2MB</p>
                    </div>
                  </div>
                </div>
              );

              /* ────── TAB: الدور ────── */
              if (tab === "role") return (
                <div className="space-y-5">
                  {/* Role cards */}
                  <div>
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-3">اختر الدور الوظيفي</p>
                    <div className={`grid gap-3 ${currentUser?.role === "super_admin" ? "grid-cols-2" : "grid-cols-3"}`}>
                      {(currentUser?.role === "super_admin"
                        ? ["super_admin", "admin", "employee", "warehouse"]
                        : ["admin", "employee", "warehouse"]
                      ).map(role => (
                        <button key={role} type="button" onClick={() => handleRoleChange(role)}
                          className={`flex flex-col items-center gap-2 py-4 rounded-2xl border-2 text-xs font-bold transition-all
                            ${form.role === role
                              ? ROLE_COLORS[role] + " scale-[1.04] shadow-lg"
                              : "border-white/[0.07] text-muted-foreground hover:border-white/20 bg-white/[0.02]"}`}>
                          <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${form.role === role ? "bg-current/10" : "bg-white/[0.05]"}`}>
                            {role === "super_admin" && <Crown className="w-4.5 h-4.5" />}
                            {role === "admin"       && <Shield className="w-4.5 h-4.5" />}
                            {role === "employee"    && <User className="w-4.5 h-4.5" />}
                            {role === "warehouse"   && <Package className="w-4.5 h-4.5" />}
                          </div>
                          {ROLE_LABELS[role]}
                        </button>
                      ))}
                    </div>
                    {form.role === "super_admin" && (
                      <div className="mt-3 flex items-center gap-2.5 p-3 rounded-xl bg-yellow-500/10 border border-yellow-500/20">
                        <AlertTriangle className="w-4 h-4 text-yellow-500 shrink-0" />
                        <p className="text-[10px] text-yellow-500/90">Super Admin له كل الصلاحيات تلقائياً ولا يمكن تقييدها</p>
                      </div>
                    )}
                  </div>

                  {/* Templates */}
                  {form.role !== "super_admin" && (
                    <div>
                      <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-3">قوالب الصلاحيات السريعة</p>
                      <div className="grid grid-cols-2 gap-2.5">
                        {PERMISSION_TEMPLATES.map(tmpl => {
                          const isSelected = selectedTemplate === tmpl.key;
                          return (
                            <button
                              key={tmpl.key}
                              type="button"
                              onClick={() => applyTemplate(tmpl.key)}
                              className={`flex flex-col items-start gap-1.5 p-3.5 rounded-xl border-2 text-right transition-all
                                ${isSelected
                                  ? tmpl.color + " scale-[1.02] shadow-md"
                                  : "border-white/[0.07] bg-white/[0.02] hover:border-white/20 text-muted-foreground"}`}
                            >
                              <div className="flex items-center gap-2 w-full">
                                <span className="text-lg leading-none">{tmpl.icon}</span>
                                <span className="text-xs font-black">{tmpl.label}</span>
                                {isSelected && (
                                  <span className="mr-auto text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-current/20">✓</span>
                                )}
                              </div>
                              <p className="text-[10px] opacity-70 leading-relaxed">{tmpl.desc}</p>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              );

              /* ────── TAB: الصلاحيات ────── */
              if (tab === "perms") return (
                <div className="space-y-5">
                  {/* Special permissions */}
                  <div>
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-3">صلاحيات خاصة</p>
                    <div className="space-y-2">
                      {[
                        { perm: ORDERS_WRITE_PERMISSION,         color: "indigo",  icon: <Package    className="w-3.5 h-3.5 text-indigo-400" />, badge: null },
                        { perm: FINANCIAL_PERMISSION,             color: "amber",   icon: <TrendingUp className="w-3.5 h-3.5 text-amber-500" />,  badge: "حساسة" },
                        { perm: EDIT_INVENTORY_PERMISSION,        color: "emerald", icon: <Package    className="w-3.5 h-3.5 text-emerald-500" />,badge: null },
                        { perm: EDIT_DELETE_INVENTORY_PERMISSION, color: "rose",    icon: <ToggleLeft className="w-3.5 h-3.5 text-rose-500" />,   badge: null },
                        { perm: VIEW_PRODUCT_PERF_PERMISSION,     color: "blue",    icon: <BarChart3  className="w-3.5 h-3.5 text-blue-500" />,   badge: null },
                        { perm: ADD_TEAM_MEMBER_PERMISSION,       color: "violet",  icon: <Users      className="w-3.5 h-3.5 text-violet-500" />, badge: null },
                        { perm: EDIT_BRAND_PERMISSION,            color: "orange",  icon: <Settings2  className="w-3.5 h-3.5 text-orange-500" />, badge: null },
                      ].map(({ perm, color, icon, badge }) => {
                        const active = form.permissions.includes(perm.key);
                        const borderMap: Record<string,string> = {
                          amber:"border-amber-500/40 bg-amber-500/5", emerald:"border-emerald-500/40 bg-emerald-500/5",
                          rose:"border-rose-500/40 bg-rose-500/5",    violet:"border-violet-500/40 bg-violet-500/5",
                          orange:"border-orange-500/40 bg-orange-500/5", indigo:"border-indigo-500/40 bg-indigo-500/5",
                          blue:"border-blue-500/40 bg-blue-500/5",
                        };
                        return (
                          <label key={perm.key}
                            className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all
                              ${active ? borderMap[color] : "border-white/[0.06] bg-white/[0.02] hover:border-white/15"}`}>
                            <input type="checkbox" checked={active} onChange={() => togglePermission(perm.key)}
                              className="w-4 h-4 rounded shrink-0 accent-primary" />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                {icon}
                                <span className="text-xs font-bold text-white/90">{perm.label}</span>
                                {badge && <span className="text-[9px] px-1.5 py-0.5 rounded-full font-bold bg-amber-500/20 text-amber-400">{badge}</span>}
                              </div>
                              <p className="text-[10px] text-muted-foreground mt-0.5">{perm.desc}</p>
                            </div>
                            <div className={`w-2 h-2 rounded-full shrink-0 transition-colors ${active ? "bg-emerald-500" : "bg-white/10"}`} />
                          </label>
                        );
                      })}
                    </div>
                  </div>

                  <Separator className="bg-white/[0.06]" />

                  {/* Pages & Sections */}
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">الصفحات والأقسام</p>
                      <div className="flex items-center gap-3">
                        <span className="flex items-center gap-1 text-[9px] text-muted-foreground">
                          <div className="w-2.5 h-2.5 rounded border border-primary bg-primary/20" />وصول
                        </span>
                        <span className="flex items-center gap-1 text-[9px] text-muted-foreground">
                          <div className="w-2.5 h-2.5 rounded border border-emerald-500 bg-emerald-500/20" />قائمة
                        </span>
                      </div>
                    </div>
                    {[
                      { group: "🏠 عام",          items: [{ label: "لوحة التحكم",       pageKey: "dashboard",              sectionKey: "section_dashboard" }] },
                      { group: "📊 التحليلات",     items: [
                        { label: "التحليلات",        pageKey: "analytics",               sectionKey: null },
                        { label: "أداء المنتجات",    pageKey: "view_product_performance", sectionKey: "section_product_performance" },
                        { label: "أداء الفريق",      pageKey: null,                       sectionKey: "section_team_performance" },
                        { label: "إدارة الفريق",     pageKey: null,                       sectionKey: "section_team_management" },
                        { label: "التحليل الذكي 🧠", pageKey: null,                       sectionKey: "section_smart_analytics" },
                        { label: "تحليل الإعلانات",  pageKey: null,                       sectionKey: "section_ads_analytics" },
                      ]},
                      { group: "📦 الطلبات",       items: [
                        { label: "الطلبات",         pageKey: "orders",    sectionKey: "section_orders" },
                        { label: "طلب جديد",        pageKey: null,        sectionKey: "section_new_order" },
                        { label: "الأرشيف",          pageKey: null,        sectionKey: "section_archive" },
                        { label: "متابعة الشحن",    pageKey: null,        sectionKey: "section_shipping_followup" },
                        { label: "إعدادات واتساب",  pageKey: "whatsapp",  sectionKey: "section_whatsapp" },
                      ]},
                      { group: "🏪 المخزون",       items: [
                        { label: "المخزون",          pageKey: "inventory", sectionKey: "section_inventory" },
                        { label: "المخازن",           pageKey: null,        sectionKey: "section_warehouses" },
                        { label: "حركات المخزون",    pageKey: "movements", sectionKey: "section_movements" },
                      ]},
                      { group: "🚚 الشحن والفواتير", items: [
                        { label: "شركات الشحن",     pageKey: "shipping",  sectionKey: "section_shipping" },
                        { label: "الفواتير",          pageKey: "invoices",  sectionKey: "section_invoices" },
                      ]},
                      { group: "📁 البيانات",      items: [
                        { label: "استيراد Excel",   pageKey: "import",    sectionKey: "section_import" },
                        { label: "تصدير البيانات",  pageKey: null,        sectionKey: "section_export_data" },
                      ]},
                      { group: "⚙️ الإدارة",       items: [
                        { label: "إدارة المستخدمين", pageKey: "users",    sectionKey: "section_users" },
                        { label: "تقرير الجلسات",    pageKey: null,       sectionKey: "section_sessions_report" },
                        { label: "سجل التعديلات",    pageKey: "audit",    sectionKey: "section_audit" },
                      ]},
                    ].map(({ group, items }) => {
                      const allKeys = items.flatMap(i => [i.pageKey, i.sectionKey].filter(Boolean) as string[]);
                      const allOn   = allKeys.every(k => form.permissions.includes(k));
                      const someOn  = allKeys.some(k => form.permissions.includes(k));
                      const open    = openGroups[group] ?? true;
                      const toggleGroup = () => {
                        if (allOn) setForm(f => ({ ...f, permissions: f.permissions.filter(k => !allKeys.includes(k)) }));
                        else       setForm(f => ({ ...f, permissions: [...new Set([...f.permissions, ...allKeys])] }));
                      };
                      return (
                        <div key={group} className="rounded-xl border border-white/[0.07] overflow-hidden mb-2 bg-white/[0.01]">
                          <div className="flex items-center gap-2 px-3 py-2.5 bg-white/[0.03] border-b border-white/[0.05]">
                            <button type="button" onClick={() => setOpenGroups(g => ({ ...g, [group]: !open }))}
                              className="flex items-center gap-2 flex-1 text-right">
                              {open ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />}
                              <span className="text-[11px] font-black text-white/90">{group}</span>
                            </button>
                            <button type="button" onClick={toggleGroup}
                              className={`text-[9px] px-2.5 py-0.5 rounded-full font-bold transition-colors
                                ${allOn  ? "bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30"
                                : someOn ? "bg-amber-500/20 text-amber-400 hover:bg-amber-500/30"
                                         : "bg-white/[0.06] text-muted-foreground hover:bg-white/10"}`}>
                              {allOn ? "✓ الكل" : someOn ? "جزئي" : "لا شيء"}
                            </button>
                          </div>
                          {open && (
                            <div className="divide-y divide-white/[0.04]">
                              {items.map(({ label, pageKey, sectionKey }) => {
                                const pageActive    = pageKey    ? form.permissions.includes(pageKey)    : null;
                                const sectionActive = sectionKey ? form.permissions.includes(sectionKey) : null;
                                return (
                                  <div key={label} className="flex items-center gap-3 px-3 py-2.5 hover:bg-white/[0.03] transition-colors">
                                    <span className="text-xs text-white/80 flex-1 font-medium">{label}</span>
                                    {pageKey ? (
                                      <label className="flex items-center gap-1.5 cursor-pointer">
                                        <input type="checkbox" checked={!!pageActive} onChange={() => togglePermission(pageKey)} className="w-3.5 h-3.5 rounded accent-primary" />
                                        <span className={`text-[9px] font-bold w-10 text-center ${pageActive ? "text-primary" : "text-muted-foreground/40"}`}>وصول</span>
                                      </label>
                                    ) : <div className="w-[74px]" />}
                                    {sectionKey ? (
                                      <label className="flex items-center gap-1.5 cursor-pointer">
                                        <input type="checkbox" checked={!!sectionActive} onChange={() => togglePermission(sectionKey)} className="w-3.5 h-3.5 rounded accent-emerald-500" />
                                        <span className={`text-[9px] font-bold w-10 text-center ${sectionActive ? "text-emerald-500" : "text-muted-foreground/40"}`}>قائمة</span>
                                      </label>
                                    ) : <div className="w-[74px]" />}
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );

              return null;
            })()}
          </div>

          {/* ── Footer ── */}
          <div className="shrink-0 flex items-center gap-3 px-6 py-4 border-t border-white/[0.07] bg-white/[0.02]">
            <Button
              variant="outline"
              className="h-10 px-5 text-sm border-white/[0.1] bg-transparent hover:bg-white/[0.05] text-muted-foreground hover:text-white rounded-xl"
              onClick={() => setDialogOpen(false)}
            >
              إلغاء
            </Button>
            <Button
              className="flex-1 h-10 text-sm font-bold rounded-xl bg-primary hover:bg-primary/90 shadow-lg shadow-primary/20"
              onClick={handleSubmit}
              disabled={createMutation.isPending || updateMutation.isPending}
            >
              {createMutation.isPending || updateMutation.isPending
                ? <span className="flex items-center gap-2">
                    <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    جاري الحفظ...
                  </span>
                : editingUser
                  ? <span className="flex items-center gap-2"><Shield className="w-4 h-4" />حفظ التعديلات</span>
                  : <span className="flex items-center gap-2"><UserPlus className="w-4 h-4" />إضافة المستخدم</span>
              }
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
