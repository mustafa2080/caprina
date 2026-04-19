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
import { UserPlus, Edit2, Trash2, Shield, Users, Eye, EyeOff, KeyRound, TrendingUp } from "lucide-react";

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
  { key: "analytics", label: "أداء المنتجات" },
  { key: "users", label: "إدارة المستخدمين" },
  { key: "audit", label: "سجل التعديلات" },
];

const FINANCIAL_PERMISSION = { key: "view_financials", label: "عرض الأرباح والتكاليف", desc: "يرى الأرباح والخسائر والتكاليف في كل التقارير" };

const DEFAULT_PERMISSIONS: Record<string, string[]> = {
  admin: [...ALL_PERMISSIONS.map(p => p.key), FINANCIAL_PERMISSION.key],
  employee: ["dashboard", "orders"],
  warehouse: ["dashboard", "inventory", "movements"],
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
  role: "employee", permissions: DEFAULT_PERMISSIONS["employee"],
});

export default function UsersPage() {
  const { user: currentUser } = useAuth();
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
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["users"] }); setDialogOpen(false); setResetPasswordOpen(false); toast({ title: "تم تحديث المستخدم" }); },
    onError: (e: any) => toast({ title: "خطأ", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: usersApi.delete,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["users"] }); toast({ title: "تم حذف المستخدم" }); },
    onError: (e: any) => toast({ title: "خطأ", description: e.message, variant: "destructive" }),
  });

  const openCreate = () => {
    setEditingUser(null);
    setForm(emptyForm());
    setShowPassword(false);
    setDialogOpen(true);
  };

  const openEdit = (u: AppUser) => {
    setEditingUser(u);
    setForm({
      username: u.username,
      password: "",
      displayName: u.displayName,
      role: u.role,
      permissions: u.permissions?.length ? u.permissions : DEFAULT_PERMISSIONS[u.role] ?? [],
    });
    setShowPassword(false);
    setDialogOpen(true);
  };

  const handleRoleChange = (role: string) => {
    setForm(f => ({ ...f, role, permissions: DEFAULT_PERMISSIONS[role] ?? [] }));
  };

  const togglePermission = (key: string) => {
    setForm(f => {
      const has = f.permissions.includes(key);
      return { ...f, permissions: has ? f.permissions.filter(p => p !== key) : [...f.permissions, key] };
    });
  };

  const handleSubmit = () => {
    if (!form.displayName.trim()) { toast({ title: "خطأ", description: "الاسم مطلوب", variant: "destructive" }); return; }
    if (editingUser) {
      const data: any = { displayName: form.displayName, role: form.role, permissions: form.permissions };
      if (form.password) data.password = form.password;
      updateMutation.mutate({ id: editingUser.id, data });
    } else {
      if (!form.username.trim()) { toast({ title: "خطأ", description: "اسم المستخدم مطلوب", variant: "destructive" }); return; }
      if (form.password.length < 6) { toast({ title: "خطأ", description: "كلمة المرور 6 أحرف على الأقل", variant: "destructive" }); return; }
      createMutation.mutate({ username: form.username.trim(), password: form.password, displayName: form.displayName.trim(), role: form.role, permissions: form.permissions });
    }
  };

  const handleDelete = (u: AppUser) => {
    if (!confirm(`حذف المستخدم "${u.displayName}"؟ هذا الإجراء لا يمكن التراجع عنه.`)) return;
    deleteMutation.mutate(u.id);
  };

  const handleToggleActive = (u: AppUser) => {
    updateMutation.mutate({ id: u.id, data: { isActive: !u.isActive } });
  };

  return (
    <div className="p-6 max-w-4xl mx-auto" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-black flex items-center gap-2">
            <Users className="w-6 h-6 text-primary" /> إدارة المستخدمين
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">تحكم في الأدوار والصلاحيات</p>
        </div>
        <Button onClick={openCreate} className="gap-2 bg-primary text-primary-foreground font-bold">
          <UserPlus className="w-4 h-4" /> مستخدم جديد
        </Button>
      </div>

      {/* Users list */}
      {isLoading ? (
        <p className="text-muted-foreground text-sm">جاري التحميل...</p>
      ) : (
        <div className="space-y-3">
          {users.map(u => (
            <div key={u.id} className={`flex items-center gap-4 p-4 rounded-xl border ${u.isActive ? "border-border bg-card" : "border-border/40 bg-muted/20 opacity-60"}`}>
              <div className="w-10 h-10 rounded-full bg-muted/30 flex items-center justify-center text-base font-bold border border-border">
                {u.displayName.charAt(0)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-bold text-sm">{u.displayName}</span>
                  {u.id === currentUser?.id && <Badge variant="outline" className="text-[9px] border-primary/50 text-primary">أنت</Badge>}
                  <Badge variant="outline" className={`text-[10px] font-bold ${ROLE_COLORS[u.role]}`}>
                    <Shield className="w-2.5 h-2.5 mr-1" />{ROLE_LABELS[u.role]}
                  </Badge>
                  {(u.permissions?.includes(FINANCIAL_PERMISSION.key) || u.role === "admin") && (
                    <Badge variant="outline" className="text-[9px] font-bold border-amber-600/50 bg-amber-500/10 text-amber-600 dark:text-amber-400 gap-1">
                      <TrendingUp className="w-2.5 h-2.5" />يرى الأرباح
                    </Badge>
                  )}
                  {!u.isActive && <Badge variant="outline" className="text-[9px] border-red-800 text-red-400">معطل</Badge>}
                </div>
                <p className="text-[11px] text-muted-foreground mt-0.5 font-mono">{u.username}</p>
                <p className="text-[10px] text-muted-foreground/70 mt-0.5 line-clamp-1">
                  الصلاحيات: {(u.permissions?.filter(p => p !== FINANCIAL_PERMISSION.key).length ? u.permissions.filter(p => p !== FINANCIAL_PERMISSION.key) : DEFAULT_PERMISSIONS[u.role]?.filter(p => p !== FINANCIAL_PERMISSION.key) ?? []).join("، ")}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Switch
                  checked={u.isActive}
                  onCheckedChange={() => handleToggleActive(u)}
                  disabled={u.id === currentUser?.id}
                  title={u.isActive ? "تعطيل الحساب" : "تفعيل الحساب"}
                />
                <Button variant="ghost" size="icon" className="h-8 w-8 hover:text-primary" onClick={() => openEdit(u)}>
                  <Edit2 className="w-3.5 h-3.5" />
                </Button>
                <Button
                  variant="ghost" size="icon" className="h-8 w-8 hover:text-destructive"
                  onClick={() => handleDelete(u)}
                  disabled={u.id === currentUser?.id}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="bg-card border-border max-w-md" dir="rtl">
          <DialogHeader>
            <DialogTitle>{editingUser ? "تعديل مستخدم" : "إضافة مستخدم جديد"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs mb-1.5 block">الاسم الكامل *</Label>
                <Input
                  className="h-9 text-sm bg-background"
                  value={form.displayName}
                  onChange={e => setForm(f => ({ ...f, displayName: e.target.value }))}
                  placeholder="مثال: أحمد محمد"
                />
              </div>
              <div>
                <Label className="text-xs mb-1.5 block">اسم المستخدم *</Label>
                <Input
                  className="h-9 text-sm bg-background font-mono"
                  value={form.username}
                  onChange={e => setForm(f => ({ ...f, username: e.target.value.toLowerCase() }))}
                  placeholder="ahmed"
                  disabled={!!editingUser}
                />
              </div>
            </div>

            <div>
              <Label className="text-xs mb-1.5 block">{editingUser ? "كلمة مرور جديدة (اتركها فارغة إن لم تريد تغييرها)" : "كلمة المرور *"}</Label>
              <div className="relative">
                <Input
                  type={showPassword ? "text" : "password"}
                  className="h-9 text-sm bg-background pl-9"
                  value={form.password}
                  onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                  placeholder={editingUser ? "••••••••" : "6 أحرف على الأقل"}
                />
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
                  <button
                    key={role}
                    type="button"
                    onClick={() => handleRoleChange(role)}
                    className={`p-2.5 rounded-lg border text-xs font-bold transition-all ${form.role === role ? ROLE_COLORS[role] : "border-border text-muted-foreground hover:border-muted-foreground"}`}
                  >
                    {ROLE_LABELS[role]}
                  </button>
                ))}
              </div>
            </div>

            {/* Financial visibility — prominent toggle */}
            <div className={`rounded-xl border-2 p-3 transition-colors ${form.permissions.includes(FINANCIAL_PERMISSION.key) ? "border-amber-500/60 bg-amber-500/5" : "border-border bg-muted/10"}`}>
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.permissions.includes(FINANCIAL_PERMISSION.key)}
                  onChange={() => togglePermission(FINANCIAL_PERMISSION.key)}
                  className="w-4 h-4 rounded accent-amber-500 shrink-0"
                />
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

            <div>
              <Label className="text-xs mb-2 block">صلاحيات الوصول للصفحات</Label>
              <div className="grid grid-cols-2 gap-1.5">
                {ALL_PERMISSIONS.map(p => (
                  <label key={p.key} className="flex items-center gap-2 cursor-pointer group">
                    <input
                      type="checkbox"
                      checked={form.permissions.includes(p.key)}
                      onChange={() => togglePermission(p.key)}
                      className="w-3.5 h-3.5 rounded accent-primary"
                    />
                    <span className="text-xs text-muted-foreground group-hover:text-foreground">{p.label}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="flex gap-2 pt-1">
              <Button
                className="flex-1 h-9 text-sm font-bold bg-primary text-primary-foreground"
                onClick={handleSubmit}
                disabled={createMutation.isPending || updateMutation.isPending}
              >
                {editingUser ? "حفظ التعديلات" : "إضافة المستخدم"}
              </Button>
              <Button variant="outline" className="h-9 text-sm border-border" onClick={() => setDialogOpen(false)}>إلغاء</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
