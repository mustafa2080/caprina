import { useState } from "react";
import { authApi } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { useLocation } from "wouter";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Eye, EyeOff, Lock, User } from "lucide-react";
import { BrandLogoMark } from "@/components/brand-logo";
import { useBrand } from "@/contexts/BrandContext";

export default function Login() {
  const { brand } = useBrand();
  const { login } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password) return;
    setLoading(true);
    try {
      const { token, user } = await authApi.login(username.trim(), password);
      login(token, user);
      setLocation("/");
    } catch (err: any) {
      toast({ title: "خطأ في تسجيل الدخول", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4" dir="rtl">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <BrandLogoMark size="lg" />
          </div>
          <h1 className="text-2xl font-black tracking-tight text-foreground">{brand.name}</h1>
          {brand.tagline && (
            <p className="text-xs text-muted-foreground mt-1 uppercase tracking-widest">{brand.tagline}</p>
          )}
        </div>

        {/* Form */}
        <div className="bg-card border border-border rounded-xl p-6 shadow-lg">
          <h2 className="text-lg font-bold mb-5">تسجيل الدخول</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label className="text-xs mb-1.5 block">اسم المستخدم</Label>
              <div className="relative">
                <User className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  placeholder="admin"
                  className="pr-9 h-10 text-sm bg-background"
                  autoComplete="username"
                  autoFocus
                />
              </div>
            </div>

            <div>
              <Label className="text-xs mb-1.5 block">كلمة المرور</Label>
              <div className="relative">
                <Lock className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="pr-9 pl-9 h-10 text-sm bg-background"
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(v => !v)}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <Button
              type="submit"
              className="w-full h-10 font-bold bg-primary text-primary-foreground mt-2"
              disabled={loading || !username.trim() || !password}
            >
              {loading ? "جاري تسجيل الدخول..." : "دخول"}
            </Button>
          </form>

          <p className="text-[10px] text-muted-foreground mt-4 text-center">
            للدخول الأول: المستخدم <code className="bg-muted px-1 rounded">admin</code> / كلمة المرور <code className="bg-muted px-1 rounded">admin123</code>
          </p>
        </div>
      </div>
    </div>
  );
}
