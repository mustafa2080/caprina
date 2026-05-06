import { useState } from "react";
import { authApi } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { Eye, EyeOff, Lock, User, LogIn, ExternalLink, X } from "lucide-react";

export default function Login() {
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
        /* ── Animations ── */
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(22px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        @keyframes formSlideIn {
          from { opacity: 0; transform: translateY(28px) scale(0.95); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes glow {
          0%, 100% { opacity: 1; box-shadow: 0 0 6px #f59e0b; }
          50%       { opacity: 0.5; box-shadow: 0 0 14px #f59e0b; }
        }

        .fade-up-1 { animation: fadeUp 0.7s 0.05s both; }
        .fade-up-2 { animation: fadeUp 0.7s 0.2s  both; }
        .fade-up-3 { animation: fadeUp 0.7s 0.35s both; }
        .fade-up-4 { animation: fadeUp 0.7s 0.5s  both; }
        .fade-up-5 { animation: fadeUp 0.7s 0.65s both; }

        /* ── Full-page layout — content RIGHT side ── */
        .login-page {
          position: fixed;
          inset: 0;
          z-index: 10;
          display: flex;
          align-items: center;
          justify-content: flex-start;   /* اليمين الفعلي في RTL */
          padding: 4rem 6vw;
          direction: rtl;
        }

        /* ── Hero block ── */
        .hero-content {
          direction: rtl;
          text-align: right;
          max-width: 500px;
          width: 100%;
        }

        /* ── Badge ── */
        .os-badge {
          display: inline-flex;
          align-items: center;
          gap: 0.45rem;
          padding: 0.32rem 1rem;
          border: 1px solid rgba(245,158,11,0.35);
          border-radius: 999px;
          font-size: 0.71rem;
          font-weight: 700;
          letter-spacing: 0.1em;
          color: rgba(253,230,138,0.85);
          background: rgba(245,158,11,0.1);
          backdrop-filter: blur(8px);
          margin-bottom: 1.6rem;
        }
        .os-badge-dot {
          width: 7px;
          height: 7px;
          border-radius: 50%;
          background: #f59e0b;
          animation: glow 2.2s infinite;
          flex-shrink: 0;
        }

        /* ── Heading ── */
        .hero-heading {
          font-size: clamp(2.3rem, 5.5vw, 3.8rem);
          font-weight: 900;
          line-height: 1.12;
          color: #fef9ee;
          margin-bottom: 0.55rem;
          text-shadow: 0 2px 24px rgba(0,0,0,0.6);
        }
        .hero-heading .accent {
          background: linear-gradient(135deg, #fbbf24 0%, #f59e0b 45%, #ef4444 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }

        /* ── Sub text ── */
        .hero-desc {
          font-size: 1.15rem;
          font-weight: 600;
          color: rgba(253,230,138,0.8);
          line-height: 1.75;
          margin-bottom: 0.65rem;
          max-width: 420px;
        }

        /* ── Tagline ── */
        .win-die {
          display: inline-block;
          font-size: 1.1rem;
          font-weight: 900;
          letter-spacing: 0.32em;
          text-transform: uppercase;
          color: rgba(245,158,11,0.85);
          margin-bottom: 2.4rem;
          text-shadow: 0 0 18px rgba(245,158,11,0.4);
        }

        /* ── Action row ── */
        .action-row {
          display: flex;
          gap: 0.8rem;
          align-items: center;
          flex-wrap: wrap;
          justify-content: flex-start;
          direction: rtl;
        }

        /* Primary button — gold gradient */
        .btn-login {
          display: inline-flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.78rem 1.8rem;
          background: linear-gradient(135deg, #d97706, #b45309);
          color: #fef9ee;
          font-size: 0.9rem;
          font-weight: 700;
          border-radius: 0.65rem;
          border: none;
          cursor: pointer;
          transition: all 0.22s ease;
          box-shadow: 0 4px 22px rgba(217,119,6,0.5);
          text-decoration: none;
        }
        .btn-login:hover {
          background: linear-gradient(135deg, #b45309, #92400e);
          transform: translateY(-2px);
          box-shadow: 0 8px 30px rgba(217,119,6,0.65);
        }
        .btn-login:active { transform: scale(0.97); }

        /* Ghost button */
        .btn-site {
          display: inline-flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.78rem 1.5rem;
          background: rgba(255,255,255,0.05);
          color: rgba(253,230,138,0.7);
          font-size: 0.85rem;
          font-weight: 600;
          border-radius: 0.65rem;
          border: 1px solid rgba(245,158,11,0.22);
          cursor: pointer;
          transition: all 0.22s ease;
          backdrop-filter: blur(8px);
          text-decoration: none;
        }
        .btn-site:hover {
          background: rgba(245,158,11,0.1);
          border-color: rgba(245,158,11,0.4);
          color: #fef9ee;
          transform: translateY(-2px);
        }

        /* ── Copyright ── */
        .copyright {
          margin-top: 3rem;
          font-size: 0.65rem;
          color: rgba(245,158,11,0.25);
          letter-spacing: 0.05em;
        }

        /* ────────────────────────────────────────
           FORM OVERLAY
        ──────────────────────────────────────── */
        .form-overlay {
          position: fixed;
          inset: 0;
          z-index: 50;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 1.5rem;
          background: rgba(10,8,20,0.7);
          backdrop-filter: blur(10px);
          animation: fadeIn 0.22s ease forwards;
        }

        .form-card {
          background: rgba(18,12,38,0.97);
          backdrop-filter: blur(28px);
          border: 1px solid rgba(245,158,11,0.25);
          border-radius: 1.3rem;
          padding: 2.25rem 2rem;
          width: 100%;
          max-width: 380px;
          box-shadow:
            0 32px 64px rgba(0,0,0,0.75),
            0 0 0 1px rgba(245,158,11,0.08),
            inset 0 1px 0 rgba(255,255,255,0.04);
          animation: formSlideIn 0.35s cubic-bezier(0.22,1,0.36,1) forwards;
          direction: rtl;
        }

        .form-card-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          margin-bottom: 1.8rem;
        }
        .form-card-title {
          font-size: 1.15rem;
          font-weight: 800;
          background: linear-gradient(135deg, #fbbf24 0%, #f59e0b 45%, #ef4444 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }
        .form-card-subtitle {
          font-size: 0.72rem;
          color: rgba(253,230,138,0.7);
          margin-top: 0.22rem;
        }
        .btn-close {
          width: 30px;
          height: 30px;
          border-radius: 50%;
          border: 1px solid rgba(245,158,11,0.18);
          background: rgba(245,158,11,0.06);
          color: rgba(253,230,138,0.45);
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.15s;
          flex-shrink: 0;
        }
        .btn-close:hover {
          background: rgba(245,158,11,0.15);
          color: #fcd34d;
          border-color: rgba(245,158,11,0.4);
        }

        /* Inputs */
        .form-label {
          font-size: 0.77rem;
          font-weight: 700;
          color: #fbbf24;
          display: block;
          margin-bottom: 0.45rem;
        }
        .form-input-wrap {
          position: relative;
          margin-bottom: 1.1rem;
        }
        .form-input-icon {
          position: absolute;
          right: 0.75rem;
          top: 50%;
          transform: translateY(-50%);
          color: rgba(245,158,11,0.4);
          pointer-events: none;
        }
        .form-input-icon-left {
          position: absolute;
          left: 0.75rem;
          top: 50%;
          transform: translateY(-50%);
          color: rgba(245,158,11,0.4);
          cursor: pointer;
          background: none;
          border: none;
          padding: 0;
          transition: color 0.15s;
        }
        .form-input-icon-left:hover { color: #fcd34d; }

        .custom-input {
          width: 100%;
          height: 44px;
          padding: 0 2.5rem;
          background: rgba(245,158,11,0.06);
          border: 1px solid rgba(245,158,11,0.18);
          border-radius: 0.65rem;
          color: #fef9ee;
          font-size: 0.88rem;
          outline: none;
          transition: border-color 0.2s, box-shadow 0.2s;
          box-sizing: border-box;
        }
        .custom-input::placeholder { color: rgba(253,230,138,0.22); }
        .custom-input:focus {
          border-color: rgba(245,158,11,0.55);
          box-shadow: 0 0 0 3px rgba(245,158,11,0.12);
        }

        .btn-submit {
          width: 100%;
          height: 46px;
          background: linear-gradient(135deg, #d97706, #b45309);
          color: #fef9ee;
          font-size: 0.95rem;
          font-weight: 700;
          border: none;
          border-radius: 0.65rem;
          cursor: pointer;
          margin-top: 0.5rem;
          transition: all 0.2s;
          box-shadow: 0 4px 18px rgba(217,119,6,0.4);
        }
        .btn-submit:hover:not(:disabled) {
          background: linear-gradient(135deg, #b45309, #92400e);
          box-shadow: 0 6px 26px rgba(217,119,6,0.55);
        }
        .btn-submit:disabled { opacity: 0.4; cursor: not-allowed; }

        /* ── Mobile ── */
        @media (max-width: 768px) {
          .login-page {
            justify-content: center;
            align-items: flex-end;
            padding: 2rem 1.5rem 3.5rem;
          }
          .hero-content { max-width: 100%; }
          .hero-heading { font-size: 2.1rem; }
          .action-row { justify-content: flex-start; }
        }
      `}</style>

      {/* ══ HERO — على اليمين ══ */}
      <div className="login-page">
        <div className="hero-content">

          {/* Badge */}
          <div className="fade-up-1">
            <span className="os-badge">
              <span className="os-badge-dot" />
              النظام اللوجستي الموحد
            </span>
          </div>

          {/* Heading */}
          <div className="fade-up-2">
            <h1 className="hero-heading">
              مرحبا بك في قسم<br />
              العمليات في <span className="accent">CAPRINA</span>
            </h1>
          </div>

          {/* Description */}
          <div className="fade-up-3">
            <p className="hero-desc">
              نظام متكامل لإدارة العمليات والطلبيات وتنفيذها على نطاق واسع
            </p>
          </div>

          {/* Tagline */}
          <div className="fade-up-4">
            <span className="win-die">WIN OR DIE</span>
          </div>

          {/* Buttons */}
          <div className="fade-up-5 action-row">
            <button className="btn-login" onClick={() => setShowForm(true)}>
              <LogIn size={16} />
              تسجيل الدخول للمتابعة
            </button>
            <a
              href="https://caprinaeg.com"
              target="_blank"
              rel="noopener noreferrer"
              className="btn-site"
            >
              <ExternalLink size={15} />
              الانتقال إلى الموقع الرئيسي
            </a>
          </div>

          {/* Copyright */}
          <p className="copyright fade-up-5">
            جميع الحقوق محفوظة &copy; CAPRINA 2026
          </p>

        </div>
      </div>

      {/* ══ FORM OVERLAY ══ */}
      {showForm && (
        <div className="form-overlay" onClick={() => setShowForm(false)}>
          <div className="form-card" onClick={e => e.stopPropagation()}>

            <div className="form-card-header">
              <div>
                <div className="form-card-title">تسجيل الدخول</div>
                <div className="form-card-subtitle">أدخل بياناتك للمتابعة</div>
              </div>
              <button className="btn-close" onClick={() => setShowForm(false)}>
                <X size={13} />
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              <label className="form-label">اسم المستخدم</label>
              <div className="form-input-wrap">
                <User className="form-input-icon" size={15} />
                <input
                  className="custom-input"
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  placeholder="admin"
                  autoComplete="username"
                  autoFocus
                />
              </div>

              <label className="form-label">كلمة المرور</label>
              <div className="form-input-wrap">
                <Lock className="form-input-icon" size={15} />
                <input
                  className="custom-input"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  style={{ paddingLeft: "2.5rem" }}
                />
                <button
                  type="button"
                  className="form-input-icon-left"
                  onClick={() => setShowPassword(v => !v)}
                >
                  {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>

              <button
                type="submit"
                className="btn-submit"
                disabled={loading || !username.trim() || !password}
              >
                {loading ? "جاري تسجيل الدخول..." : "دخول"}
              </button>
            </form>

          </div>
        </div>
      )}
    </>
  );
}
