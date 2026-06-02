import { useState, useRef, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  User, KeyRound, Camera, TrendingUp, TrendingDown,
  Package, CheckCircle2, XCircle, Hourglass, Star,
  Flame, Zap, Trophy, BarChart3, Clock, Target,
  Shield, Save, Eye, EyeOff, Upload,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/contexts/AuthContext";
import { authApi, teamAnalyticsApi, type TeamMemberExtStats } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

/* ── helpers ── */
const fmt = (n: number) =>
  new Intl.NumberFormat("ar-EG", { style: "currency", currency: "EGP", maximumFractionDigits: 0 }).format(n);
const fmtNum = (n: number) => new Intl.NumberFormat("ar-EG").format(n);
const pct = (n: number) => `${n.toFixed(1)}%`;

const ROLE_LABELS: Record<string, string> = {
  super_admin: "سوبر أدمن", admin: "مدير", employee: "موظف مبيعات", warehouse: "مسؤول مخزون",
};

function getRoleColor(role: string) {
  if (role === "super_admin") return "from-yellow-500/20 to-amber-500/10 border-yellow-500/30 text-yellow-400";
  if (role === "admin") return "from-blue-500/20 to-blue-600/10 border-blue-500/30 text-blue-400";
  if (role === "employee") return "from-emerald-500/20 to-green-500/10 border-emerald-500/30 text-emerald-400";
  return "from-violet-500/20 to-purple-500/10 border-violet-500/30 text-violet-400";
}

function ScoreBadge({ score }: { score: number }) {
  if (score >= 80) return <span className="flex items-center gap-1 text-emerald-400 font-bold"><Trophy className="w-3.5 h-3.5" />ممتاز</span>;
  if (score >= 60) return <span className="flex items-center gap-1 text-blue-400 font-bold"><Star className="w-3.5 h-3.5" />جيد</span>;
  if (score >= 40) return <span className="flex items-center gap-1 text-amber-400 font-bold"><Flame className="w-3.5 h-3.5" />متوسط</span>;
  return <span className="flex items-center gap-1 text-rose-400 font-bold"><Zap className="w-3.5 h-3.5" />يحتاج تحسين</span>;
}

function StatCard({ icon: Icon, label, value, sub, color }: {
  icon: any; label: string; value: string | number; sub?: string; color: string;
}) {
  return (
    <div className={`rounded-2xl p-4 border bg-gradient-to-br ${color} flex flex-col gap-1`}>
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-muted-foreground">{label}</span>
        <Icon className="w-4 h-4 opacity-60" />
      </div>
      <p className="text-xl font-black">{value}</p>
      {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}

function AnimatedBar({ pct: p, color }: { pct: number; color: string }) {
  return (
    <div className="h-2 bg-muted/30 rounded-full overflow-hidden">
      <div className={`h-full rounded-full ${color} transition-all duration-700`} style={{ width: `${Math.min(100, p)}%` }} />
    </div>
  );
}

/* ── Avatar Upload Section ── */
function AvatarUpload({ currentAvatar, displayName, onUpload }: {
  currentAvatar?: string | null;
  displayName: string;
  onUpload: (base64: string | null) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(currentAvatar ?? null);
  const [dragging, setDragging] = useState(false);

  const processFile = useCallback((file: File) => {
    if (!file.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result as string;
      // resize to max 300px via canvas
      const img = new Image();
      img.onload = () => {
        const MAX = 300;
        const scale = Math.min(1, MAX / Math.max(img.width, img.height));
        const canvas = document.createElement("canvas");
        canvas.width = img.width * scale;
        canvas.height = img.height * scale;
        const ctx = canvas.getContext("2d")!;
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        const base64 = canvas.toDataURL("image/jpeg", 0.85);
        setPreview(base64);
        onUpload(base64);
      };
      img.src = result;
    };
    reader.readAsDataURL(file);
  }, [onUpload]);

  return (
    <div className="flex flex-col items-center gap-3">
      <div
        className={`relative group cursor-pointer rounded-full transition-all duration-200 ${dragging ? "ring-4 ring-primary/60 scale-105" : "hover:ring-2 hover:ring-primary/40"}`}
        style={{ width: 100, height: 100 }}
        onClick={() => inputRef.current?.click()}
        onDragOver={e => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={e => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files[0]; if (f) processFile(f); }}
      >
        {preview
          ? <img src={preview} alt={displayName} className="w-full h-full rounded-full object-cover border-4 border-primary/30" />
          : <div className="w-full h-full rounded-full flex items-center justify-center text-3xl font-black border-4 border-primary/30"
              style={{ background: "linear-gradient(135deg,hsl(var(--primary)/0.8),hsl(var(--primary)/0.4))", color: "hsl(var(--primary-foreground))" }}>
              {displayName.charAt(0).toUpperCase()}
            </div>}
        <div className="absolute inset-0 rounded-full bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
          <Camera className="w-7 h-7 text-white" />
        </div>
      </div>
      <input ref={inputRef} type="file" accept="image/*" className="hidden"
        onChange={e => { const f = e.target.files?.[0]; if (f) processFile(f); }} />
      {preview && (
        <button type="button" className="text-xs text-muted-foreground hover:text-rose-400 transition-colors"
          onClick={() => { setPreview(null); onUpload(null); }}>
          إزالة الصورة
        </button>
      )}
    </div>
  );
}

/* ── Main Profile Page ── */
export default function ProfilePage() {
  const { user, refreshUser } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();

  // state
  const [avatarB64, setAvatarB64] = useState<string | null | undefined>(undefined); // undefined = not changed
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [activeTab, setActiveTab] = useState<"stats" | "settings">("stats");

  // Fetch team performance to get current user's stats
  const { data: allStats, isLoading: statsLoading } = useQuery({
    queryKey: ["team-perf-profile"],
    queryFn: () => teamAnalyticsApi.getExtended(),
    staleTime: 2 * 60_000,
  });

  // Find current user's stats
  const myStats: TeamMemberExtStats | undefined = allStats?.find(
    (s) => s.userId === user?.id
  );

  // mutations
  const avatarMutation = useMutation({
    mutationFn: (data: { avatar?: string | null }) => authApi.updateProfile(data),
    onSuccess: () => {
      toast({ title: "✅ تم تحديث الصورة الشخصية" });
      refreshUser();
      qc.invalidateQueries({ queryKey: ["users"] });
      setAvatarB64(undefined);
    },
    onError: (e: any) => toast({ title: "خطأ", description: e.message, variant: "destructive" }),
  });

  const pwMutation = useMutation({
    mutationFn: () => authApi.changePassword(currentPw, newPw),
    onSuccess: () => {
      toast({ title: "✅ تم تغيير كلمة المرور" });
      setCurrentPw(""); setNewPw(""); setConfirmPw("");
    },
    onError: (e: any) => toast({ title: "خطأ", description: e.message, variant: "destructive" }),
  });

  const handleSaveAvatar = () => {
    if (avatarB64 === undefined) return;
    avatarMutation.mutate({ avatar: avatarB64 });
  };

  const handleChangePassword = () => {
    if (!currentPw) { toast({ title: "خطأ", description: "أدخل كلمة المرور الحالية", variant: "destructive" }); return; }
    if (newPw.length < 6) { toast({ title: "خطأ", description: "كلمة المرور الجديدة يجب أن تكون 6 أحرف على الأقل", variant: "destructive" }); return; }
    if (newPw !== confirmPw) { toast({ title: "خطأ", description: "كلمتا المرور غير متطابقتين", variant: "destructive" }); return; }
    pwMutation.mutate();
  };

  if (!user) return null;

  const roleColor = getRoleColor(user.role);

  return (
    <div className="max-w-3xl mx-auto space-y-5" dir="rtl">
      {/* ── Header Card ── */}
      <Card className="overflow-hidden border-0" style={{ background: "hsl(var(--card))" }}>
        <div className="h-24 relative" style={{
          background: "linear-gradient(135deg, hsl(var(--primary)/0.35) 0%, hsl(var(--primary)/0.1) 60%, transparent 100%)",
        }}>
          <div className="absolute inset-0" style={{
            backgroundImage: "radial-gradient(circle at 20% 50%, hsl(var(--primary)/0.2) 0%, transparent 50%), radial-gradient(circle at 80% 20%, hsl(var(--primary)/0.15) 0%, transparent 40%)",
          }} />
        </div>
        <CardContent className="px-6 pb-6 -mt-12">
          <div className="flex flex-col sm:flex-row sm:items-end gap-4">
            {/* Avatar */}
            <div className="relative shrink-0">
              {(user as any).avatar
                ? <img src={(user as any).avatar} className="w-20 h-20 rounded-2xl object-cover border-4 border-card shadow-xl" alt={user.displayName} />
                : <div className="w-20 h-20 rounded-2xl flex items-center justify-center text-2xl font-black border-4 border-card shadow-xl"
                    style={{ background: "linear-gradient(135deg,hsl(var(--primary)/0.9),hsl(var(--primary)/0.5))", color: "hsl(var(--primary-foreground))" }}>
                    {user.displayName.charAt(0).toUpperCase()}
                  </div>}
              <span className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-emerald-400 border-2 border-card"
                style={{ boxShadow: "0 0 8px rgba(52,211,153,0.8)" }} />
            </div>
            {/* Info */}
            <div className="flex-1 min-w-0 pt-2">
              <h1 className="text-xl font-black text-foreground truncate">{user.displayName}</h1>
              <p className="text-sm text-muted-foreground">@{user.username}</p>
              <div className={`inline-flex items-center gap-1.5 mt-2 px-3 py-1 rounded-full text-xs font-bold border bg-gradient-to-r ${roleColor}`}>
                <Shield className="w-3 h-3" />
                {ROLE_LABELS[user.role] ?? user.role}
              </div>
            </div>
            {/* Score badge if available */}
            {myStats && (
              <div className="sm:text-left shrink-0">
                <div className="text-xs text-muted-foreground mb-1">نقاط الأداء</div>
                <div className="text-3xl font-black text-foreground">{myStats.score}<span className="text-sm text-muted-foreground">/100</span></div>
                <ScoreBadge score={myStats.score} />
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* ── Tabs ── */}
      <div className="flex gap-2 bg-muted/30 rounded-xl p-1 border">
        {[
          { key: "stats", label: "إحصائيات الأداء", icon: BarChart3 },
          { key: "settings", label: "إعدادات الحساب", icon: User },
        ].map(({ key, label, icon: Icon }) => (
          <button key={key} type="button"
            onClick={() => setActiveTab(key as any)}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-bold transition-all duration-200 ${
              activeTab === key
                ? "bg-card text-foreground shadow-sm border border-border/50"
                : "text-muted-foreground hover:text-foreground"
            }`}>
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </div>

      {/* ── Stats Tab ── */}
      {activeTab === "stats" && (
        <div className="space-y-4">
          {statsLoading && (
            <Card><CardContent className="py-12 text-center text-muted-foreground">
              <div className="w-6 h-6 rounded-full border-2 border-primary border-t-transparent animate-spin mx-auto mb-2" />
              جاري تحميل إحصائياتك...
            </CardContent></Card>
          )}
          {!statsLoading && !myStats && (
            <Card><CardContent className="py-12 text-center text-muted-foreground">
              <BarChart3 className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="font-semibold">لا توجد إحصائيات متاحة بعد</p>
              <p className="text-xs mt-1">ستظهر هنا إحصائياتك بمجرد تسجيل طلبات باسمك</p>
            </CardContent></Card>
          )}
          {myStats && (<>
            {/* KPI Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <StatCard icon={Package} label="إجمالي الطلبات" value={fmtNum(myStats.total)} color="from-blue-500/15 to-blue-600/5 border-blue-500/20 text-blue-400" />
              <StatCard icon={CheckCircle2} label="الطلبات المسلّمة" value={fmtNum(myStats.delivered)} sub={pct(myStats.deliveryRate)} color="from-emerald-500/15 to-green-600/5 border-emerald-500/20 text-emerald-400" />
              <StatCard icon={XCircle} label="المرتجعات" value={fmtNum(myStats.returned)} sub={pct(myStats.returnRate)} color="from-rose-500/15 to-red-600/5 border-rose-500/20 text-rose-400" />
              <StatCard icon={Hourglass} label="قيد التنفيذ" value={fmtNum(myStats.pending)} color="from-amber-500/15 to-yellow-600/5 border-amber-500/20 text-amber-400" />
            </div>

            {/* Profit + Speed */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Card className="border">
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-emerald-400" />
                    <span className="font-bold text-sm">الأداء المالي</span>
                  </div>
                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-muted-foreground">الأرباح الإجمالية</span>
                      <span className="font-bold text-emerald-400">{fmt(myStats.profit)}</span>
                    </div>
                    <AnimatedBar pct={Math.min(100, (myStats.profit / Math.max(1, myStats.profit)) * 100)} color="bg-emerald-500" />
                  </div>
                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-muted-foreground">معدل التسليم</span>
                      <span className="font-bold text-blue-400">{pct(myStats.deliveryRate)}</span>
                    </div>
                    <AnimatedBar pct={myStats.deliveryRate} color="bg-blue-500" />
                  </div>
                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-muted-foreground">معدل الإرجاع</span>
                      <span className="font-bold text-rose-400">{pct(myStats.returnRate)}</span>
                    </div>
                    <AnimatedBar pct={myStats.returnRate} color="bg-rose-500" />
                  </div>
                </CardContent>
              </Card>

              <Card className="border">
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <Zap className="w-4 h-4 text-amber-400" />
                    <span className="font-bold text-sm">السرعة والكفاءة</span>
                  </div>
                  <div className="flex flex-col gap-2">
                    {myStats.avgProcessingHours != null && (
                      <div className="flex justify-between items-center py-2 border-b border-border/30">
                        <span className="text-xs text-muted-foreground flex items-center gap-1"><Clock className="w-3 h-3" />متوسط وقت المعالجة</span>
                        <span className="font-bold text-sm">{myStats.avgProcessingHours.toFixed(1)} س</span>
                      </div>
                    )}
                    <div className="flex justify-between items-center py-2 border-b border-border/30">
                      <span className="text-xs text-muted-foreground flex items-center gap-1"><Target className="w-3 h-3" />طلبات يومياً</span>
                      <span className="font-bold text-sm">{myStats.ordersPerDay.toFixed(1)}</span>
                    </div>
                    {myStats.topSource && (
                      <div className="flex justify-between items-center py-2">
                        <span className="text-xs text-muted-foreground">المصدر الأعلى</span>
                        <Badge variant="outline" className="text-xs">{myStats.topSource}</Badge>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Score bar */}
            <Card className="border">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Trophy className="w-4 h-4 text-amber-400" />
                    <span className="font-bold text-sm">نقاط الأداء الإجمالية</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <ScoreBadge score={myStats.score} />
                    <span className="text-xl font-black">{myStats.score}<span className="text-xs text-muted-foreground">/100</span></span>
                  </div>
                </div>
                <div className="h-3 bg-muted/30 rounded-full overflow-hidden">
                  <div className="h-full rounded-full transition-all duration-700"
                    style={{
                      width: `${myStats.score}%`,
                      background: myStats.score >= 80
                        ? "linear-gradient(90deg, #10b981, #34d399)"
                        : myStats.score >= 60
                          ? "linear-gradient(90deg, #3b82f6, #60a5fa)"
                          : myStats.score >= 40
                            ? "linear-gradient(90deg, #f59e0b, #fbbf24)"
                            : "linear-gradient(90deg, #ef4444, #f87171)",
                    }} />
                </div>
              </CardContent>
            </Card>
          </>)}
        </div>
      )}

      {/* ── Settings Tab ── */}
      {activeTab === "settings" && (
        <div className="space-y-4">
          {/* Avatar Card */}
          <Card className="border">
            <CardContent className="p-6">
              <h3 className="font-bold text-sm mb-4 flex items-center gap-2">
                <Camera className="w-4 h-4 text-primary" />الصورة الشخصية
              </h3>
              <div className="flex flex-col sm:flex-row items-center gap-6">
                <AvatarUpload
                  currentAvatar={(user as any).avatar}
                  displayName={user.displayName}
                  onUpload={(b64) => setAvatarB64(b64)}
                />
                <div className="flex-1 space-y-2 text-sm text-muted-foreground">
                  <p className="font-semibold text-foreground">تعليمات رفع الصورة</p>
                  <ul className="space-y-1 text-xs">
                    <li className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-primary/60 shrink-0" />اضغط على الصورة أو اسحب ملف إليها</li>
                    <li className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-primary/60 shrink-0" />الصيغ المقبولة: JPG, PNG, WebP</li>
                    <li className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-primary/60 shrink-0" />ستظهر الصورة في قائمة المستخدمين</li>
                  </ul>
                  <Button
                    size="sm"
                    onClick={handleSaveAvatar}
                    disabled={avatarB64 === undefined || avatarMutation.isPending}
                    className="mt-2 gap-2">
                    {avatarMutation.isPending
                      ? <><div className="w-3.5 h-3.5 rounded-full border-2 border-primary-foreground border-t-transparent animate-spin" />جاري الحفظ...</>
                      : <><Save className="w-3.5 h-3.5" />حفظ الصورة</>}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Password Card */}
          <Card className="border">
            <CardContent className="p-6">
              <h3 className="font-bold text-sm mb-4 flex items-center gap-2">
                <KeyRound className="w-4 h-4 text-primary" />تغيير كلمة المرور
              </h3>
              <div className="space-y-3 max-w-sm">
                <div className="space-y-1.5">
                  <Label className="text-xs">كلمة المرور الحالية</Label>
                  <div className="relative">
                    <Input
                      type={showCurrent ? "text" : "password"}
                      value={currentPw}
                      onChange={e => setCurrentPw(e.target.value)}
                      placeholder="••••••••"
                      className="pr-4 pl-10"
                    />
                    <button type="button" className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      onClick={() => setShowCurrent(v => !v)}>
                      {showCurrent ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">كلمة المرور الجديدة</Label>
                  <div className="relative">
                    <Input
                      type={showNew ? "text" : "password"}
                      value={newPw}
                      onChange={e => setNewPw(e.target.value)}
                      placeholder="6 أحرف على الأقل"
                      className="pr-4 pl-10"
                    />
                    <button type="button" className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      onClick={() => setShowNew(v => !v)}>
                      {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">تأكيد كلمة المرور</Label>
                  <Input
                    type="password"
                    value={confirmPw}
                    onChange={e => setConfirmPw(e.target.value)}
                    placeholder="أعد كتابة كلمة المرور"
                    className={confirmPw && confirmPw !== newPw ? "border-rose-500" : ""}
                  />
                  {confirmPw && confirmPw !== newPw && (
                    <p className="text-xs text-rose-400">كلمتا المرور غير متطابقتين</p>
                  )}
                </div>
                <Button
                  onClick={handleChangePassword}
                  disabled={pwMutation.isPending || !currentPw || !newPw || !confirmPw}
                  className="gap-2 w-full sm:w-auto">
                  {pwMutation.isPending
                    ? <><div className="w-3.5 h-3.5 rounded-full border-2 border-primary-foreground border-t-transparent animate-spin" />جاري التغيير...</>
                    : <><KeyRound className="w-3.5 h-3.5" />تغيير كلمة المرور</>}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
