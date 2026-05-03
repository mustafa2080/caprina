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
    <>
      {/* Responsive styles for login layout */}
      <style>{`
        .login-outer {
          position: fixed;
          inset: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 1.5rem;
          background: transparent;
          z-index: 10;
        }
        /* On mobile: push form toward bottom so video is visible on top */
        @media (max-width: 640px) {
          .login-outer {
            align-items: flex-end;
            padding-bottom: 2.5rem;
          }
        }
        /* Very small screens (iPhone SE etc) */
        @media (max-width: 380px) {
          .login-outer {
            padding-bottom: 1.5rem;
          }
        }
        .login-logo {
          text-align: center;
          margin-bottom: 1.5rem;
        }
        @media (max-width: 640px) {
          .login-logo {
            margin-bottom: 1rem;
          }
        }
      `}</style>

      <div dir="rtl" className="login-outer">
        <div style={{ width: "100%", maxWidth: "384px" }}>
          {/* Logo */}
          <div className="login-logo">
            <div style={{ display: "flex", justifyContent: "center", marginBottom: "0.75rem" }}>
              <BrandLogoMark size="lg" />
            </div>
            <h1 style={{ fontSize: "1.5rem", fontWeight: 900, color: "#fff", letterSpacing: "-0.025em" }}>
              {brand.name}
            </h1>
            {brand.tagline && (
              <p style={{ fontSize: "0.7rem", color: "rgba(255,255,255,0.6)", marginTop: "0.25rem", textTransform: "uppercase", letterSpacing: "0.1em" }}>
                {brand.tagline}
              </p>
            )}
          </div>

          {/* Form Card */}
          <div style={{
            background: "rgba(0,0,0,0.55)",
            backdropFilter: "blur(16px)",
            WebkitBackdropFilter: "blur(16px)",
            border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: "0.75rem",
            padding: "1.5rem",
            boxShadow: "0 25px 50px rgba(0,0,0,0.5)",
          }}>
            <h2 style={{ fontSize: "1.1rem", fontWeight: 700, marginBottom: "1.25rem", color: "#fff" }}>
              تسجيل الدخول
            </h2>
            <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              <div>
                <Label className="text-xs mb-1.5 block" style={{ color: "rgba(255,255,255,0.75)" }}>اسم المستخدم</Label>
                <div className="relative">
                  <User className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: "rgba(255,255,255,0.4)" }} />
                  <Input
                    value={username}
                    onChange={e => setUsername(e.target.value)}
                    placeholder="admin"
                    className="pr-9 h-10 text-sm"
                    style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.15)", color: "#fff" }}
                    autoComplete="username"
                    autoFocus
                  />
                </div>
              </div>

              <div>
                <Label className="text-xs mb-1.5 block" style={{ color: "rgba(255,255,255,0.75)" }}>كلمة المرور</Label>
                <div className="relative">
                  <Lock className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: "rgba(255,255,255,0.4)" }} />
                  <Input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="pr-9 pl-9 h-10 text-sm"
                    style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.15)", color: "#fff" }}
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(v => !v)}
                    className="absolute left-3 top-1/2 -translate-y-1/2"
                    style={{ color: "rgba(255,255,255,0.4)" }}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <Button
                type="submit"
                className="w-full h-10 font-bold bg-primary text-primary-foreground mt-1"
                disabled={loading || !username.trim() || !password}
              >
                {loading ? "جاري تسجيل الدخول..." : "دخول"}
              </Button>
            </form>
          </div>
        </div>
      </div>
    </>
  );
}
