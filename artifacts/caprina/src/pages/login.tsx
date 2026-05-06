import { useState } from "react";
import { authApi } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { useLocation } from "wouter";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Eye, EyeOff, Lock, User, LogIn, ExternalLink } from "lucide-react";
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
  const [showForm, setShowForm] = useState(false);

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
        @media (max-width: 640px) {
          .login-outer {
            align-items: flex-end;
            padding-bottom: 2.5rem;
          }
        }
        @media (max-width: 380px) {
          .login-outer {
            padding-bottom: 1.5rem;
          }
        }

        /* ── Welcome card ── */
        .welcome-card {
          cursor: pointer;
          transition: transform 0.2s ease, box-shadow 0.2s ease;
        }
        .welcome-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 32px 60px rgba(0,0,0,0.6);
        }
        .welcome-card:active {
          transform: scale(0.98);
        }

        /* ── Form reveal animation ── */
        @keyframes formReveal {
          from {
            opacity: 0;
            transform: translateY(18px) scale(0.97);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
        .form-reveal {
          animation: formReveal 0.38s cubic-bezier(0.22, 1, 0.36, 1) forwards;
        }

        /* ── Welcome text animations ── */
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(14px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .fade-up-1 { animation: fadeUp 0.5s 0.05s both; }
        .fade-up-2 { animation: fadeUp 0.5s 0.15s both; }
        .fade-up-3 { animation: fadeUp 0.5s 0.25s both; }
        .fade-up-4 { animation: fadeUp 0.5s 0.35s both; }
        .fade-up-5 { animation: fadeUp 0.5s 0.45s both; }

        /* ── Glowing divider ── */
        .glow-line {
          height: 1px;
          background: linear-gradient(90deg, transparent, rgba(255,255,255,0.35), transparent);
          margin: 1rem 0;
        }

        /* ── Tagline badge ── */
        .tagline-badge {
          display: inline-block;
          padding: 0.2rem 0.75rem;
          border: 1px solid rgba(255,255,255,0.18);
          border-radius: 999px;
          font-size: 0.65rem;
          font-weight: 700;
          letter-spacing: 0.15em;
          text-transform: uppercase;
          color: rgba(255,255,255,0.55);
          background: rgba(255,255,255,0.05);
        }

        /* ── Win or die text ── */
        .win-die {
          font-size: 1rem;
          font-weight: 900;
          letter-spacing: 0.25em;
          text-transform: uppercase;
          background: linear-gradient(90deg, #fff 0%, rgba(255,255,255,0.55) 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }

        /* ── Action buttons ── */
        .action-btn {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.5rem 1rem;
          border-radius: 0.5rem;
          font-size: 0.75rem;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.18s ease;
          border: 1px solid rgba(255,255,255,0.15);
          background: rgba(255,255,255,0.06);
          color: rgba(255,255,255,0.75);
          text-decoration: none;
        }
        .action-btn:hover {
          background: rgba(255,255,255,0.12);
          border-color: rgba(255,255,255,0.28);
          color: #fff;
          transform: translateY(-1px);
        }
        .action-btn.primary-btn {
          background: rgba(var(--primary-rgb, 99,102,241), 0.85);
          border-color: rgba(255,255,255,0.2);
          color: #fff;
        }
        .action-btn.primary-btn:hover {
          background: rgba(var(--primary-rgb, 99,102,241), 1);
        }

        /* ── Copyright ── */
        .copyright {
          font-size: 0.6rem;
          color: rgba(255,255,255,0.28);
          letter-spacing: 0.05em;
          text-align: center;
          margin-top: 1.25rem;
        }
      `}</style>

      <div dir="rtl" className="login-outer">
        <div style={{ width: "100%", maxWidth: "400px" }}>

          {/* ═══════════════════════════════════════════
              WELCOME CARD — مرئي دائماً
          ════════════════════════════════════════════ */}
          <div
            className="welcome-card"
            onClick={() => !showForm && setShowForm(true)}
            style={{
              background: "rgba(0,0,0,0.55)",
              backdropFilter: "blur(20px)",
              WebkitBackdropFilter: "blur(20px)",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: "1rem",
              padding: "2rem 1.75rem 1.5rem",
              boxShadow: "0 25px 50px rgba(0,0,0,0.5)",
              cursor: showForm ? "default" : "pointer",
            }}
          >
            {/* Logo */}
            <div className="fade-up-1" style={{ display: "flex", justifyContent: "center", marginBottom: "1rem" }}>
              <BrandLogoMark size="lg" />
            </div>

            {/* Main welcome text */}
            <div className="fade-up-2" style={{ textAlign: "center", marginBottom: "0.5rem" }}>
              <p style={{ fontSize: "0.72rem", color: "rgba(255,255,255,0.5)", letterSpacing: "0.05em", marginBottom: "0.35rem" }}>
                مرحبا بك في قسم العمليات في
              </p>
              <h1 style={{ fontSize: "2rem", fontWeight: 900, color: "#fff", letterSpacing: "-0.02em", lineHeight: 1 }}>
                CAPRINA
              </h1>
            </div>

            <div className="fade-up-3" style={{ textAlign: "center", marginBottom: "0.75rem" }}>
              <span className="tagline-badge">CAPRINA OS</span>
            </div>

            <div className="glow-line fade-up-3" />

            <div className="fade-up-4" style={{ textAlign: "center", marginBottom: "0.75rem" }}>
              <p style={{ fontSize: "0.78rem", color: "rgba(255,255,255,0.55)", lineHeight: 1.6 }}>
                نظام متكامل لإدارة العمليات والطلبيات
                <br />
                وتنفيذها على نطاق واسع
              </p>
            </div>

            <div className="fade-up-5" style={{ textAlign: "center", marginBottom: "1.5rem" }}>
              <span className="win-die">WIN Or DIE</span>
            </div>

            {/* ── Action buttons ── */}
            <div style={{ display: "flex", gap: "0.6rem", justifyContent: "center" }}>
              <button
                type="button"
                className="action-btn primary-btn"
                onClick={(e) => { e.stopPropagation(); setShowForm(true); }}
              >
                <LogIn className="w-3.5 h-3.5" />
                تسجيل الدخول
              </button>
              <a
                href="https://caprinaeg.com"
                target="_blank"
                rel="noopener noreferrer"
                className="action-btn"
                onClick={(e) => e.stopPropagation()}
              >
                <ExternalLink className="w-3.5 h-3.5" />
                الموقع الرئيسي
              </a>
            </div>

            {/* ── Login form — revealed on click ── */}
            {showForm && (
              <div className="form-reveal" style={{ marginTop: "1.5rem" }}>
                <div className="glow-line" style={{ marginTop: 0 }} />
                <h2 style={{ fontSize: "0.9rem", fontWeight: 700, marginBottom: "1rem", color: "#fff", textAlign: "center" }}>
                  تسجيل الدخول للمتابعة
                </h2>
                <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "0.875rem" }}>
                  <div>
                    <Label className="text-xs mb-1.5 block" style={{ color: "rgba(255,255,255,0.7)" }}>اسم المستخدم</Label>
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
                    <Label className="text-xs mb-1.5 block" style={{ color: "rgba(255,255,255,0.7)" }}>كلمة المرور</Label>
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
            )}

            {/* ── Copyright ── */}
            <p className="copyright">
              جميع الحقوق محفوظة &copy; CAPRINA 2026
            </p>
          </div>

        </div>
      </div>
    </>
  );
}
