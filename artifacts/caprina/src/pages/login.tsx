import { useState } from "react";
import { authApi } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { useLocation } from "wouter";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
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
          from { opacity: 0; transform: translateY(20px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        @keyframes formSlideIn {
          from { opacity: 0; transform: translateY(24px) scale(0.96); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }

        .fade-up-1 { animation: fadeUp 0.65s 0.1s both; }
        .fade-up-2 { animation: fadeUp 0.65s 0.25s both; }
        .fade-up-3 { animation: fadeUp 0.65s 0.4s both; }
        .fade-up-4 { animation: fadeUp 0.65s 0.55s both; }
        .fade-up-5 { animation: fadeUp 0.65s 0.7s both; }

        /* ── Page layout ── */
        .login-page {
          position: fixed;
          inset: 0;
          z-index: 10;
          display: flex;
          align-items: center;
          justify-content: flex-end;
          padding: 4rem 6vw;
        }

        /* ── Hero content (right side, no card) ── */
        .hero-content {
          direction: rtl;
          max-width: 520px;
          width: 100%;
        }

        /* ── OS Badge ── */
        .os-badge {
          display: inline-flex;
          align-items: center;
          gap: 0.4rem;
          padding: 0.3rem 0.9rem;
          border: 1px solid rgba(255,255,255,0.25);
          border-radius: 999px;
          font-size: 0.72rem;
          font-weight: 700;
          letter-spacing: 0.12em;
          color: rgba(255,255,255,0.75);
          background: rgba(255,255,255,0.08);
          backdrop-filter: blur(8px);
          margin-bottom: 1.5rem;
        }
        .os-badge-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: #4ade80;
          box-shadow: 0 0 6px #4ade80;
          animation: pulse 2s infinite;
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }

        /* ── Main heading ── */
        .hero-heading {
          font-size: clamp(2.4rem, 6vw, 4rem);
          font-weight: 900;
          line-height: 1.1;
          color: #fff;
          margin-bottom: 0.5rem;
          text-shadow: 0 2px 20px rgba(0,0,0,0.4);
        }
        .hero-heading span {
          color: #1d4ed8;
          text-shadow: 0 0 30px rgba(29,78,216,0.6);
        }

        /* ── Sub description ── */
        .hero-desc {
          font-size: 0.95rem;
          color: rgba(255,255,255,0.65);
          line-height: 1.7;
          margin-bottom: 0.75rem;
          max-width: 400px;
        }

        /* ── Win or Die ── */
        .win-die {
          display: inline-block;
          font-size: 0.82rem;
          font-weight: 900;
          letter-spacing: 0.3em;
          text-transform: uppercase;
          color: rgba(255,255,255,0.35);
          margin-bottom: 2.5rem;
        }

        /* ── Action buttons (free, no card) ── */
        .action-row {
          display: flex;
          gap: 0.75rem;
          align-items: center;
          flex-wrap: wrap;
        }

        .btn-login {
          display: inline-flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.75rem 1.75rem;
          background: #1d4ed8;
          color: #fff;
          font-size: 0.9rem;
          font-weight: 700;
          border-radius: 0.6rem;
          border: none;
          cursor: pointer;
          transition: all 0.2s ease;
          box-shadow: 0 4px 20px rgba(29,78,216,0.45);
          text-decoration: none;
        }
        .btn-login:hover {
          background: #1e40af;
          transform: translateY(-2px);
          box-shadow: 0 8px 28px rgba(29,78,216,0.55);
        }
        .btn-login:active { transform: scale(0.97); }

        .btn-site {
          display: inline-flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.75rem 1.5rem;
          background: rgba(255,255,255,0.08);
          color: rgba(255,255,255,0.8);
          font-size: 0.85rem;
          font-weight: 600;
          border-radius: 0.6rem;
          border: 1px solid rgba(255,255,255,0.18);
          cursor: pointer;
          transition: all 0.2s ease;
          backdrop-filter: blur(8px);
          text-decoration: none;
        }
        .btn-site:hover {
          background: rgba(255,255,255,0.14);
          border-color: rgba(255,255,255,0.32);
          color: #fff;
          transform: translateY(-2px);
        }

        /* ── Copyright ── */
        .copyright {
          margin-top: 3rem;
          font-size: 0.65rem;
          color: rgba(255,255,255,0.25);
          letter-spacing: 0.06em;
        }

        /* ── Form overlay ── */
        .form-overlay {
          position: fixed;
          inset: 0;
          z-index: 50;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 1.5rem;
          background: rgba(0,0,0,0.55);
          backdrop-filter: blur(6px);
          animation: fadeIn 0.25s ease forwards;
        }

        .form-card {
          background: rgba(10,20,40,0.92);
          backdrop-filter: blur(24px);
          border: 1px solid rgba(29,78,216,0.3);
          border-radius: 1.25rem;
          padding: 2.25rem 2rem;
          width: 100%;
          max-width: 380px;
          box-shadow: 0 30px 60px rgba(0,0,0,0.6), 0 0 0 1px rgba(29,78,216,0.15);
          animation: formSlideIn 0.35s cubic-bezier(0.22,1,0.36,1) forwards;
          direction: rtl;
        }

        .form-card-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 1.75rem;
        }
        .form-card-title {
          font-size: 1.1rem;
          font-weight: 800;
          color: #fff;
        }
        .form-card-subtitle {
          font-size: 0.72rem;
          color: rgba(255,255,255,0.45);
          margin-top: 0.2rem;
        }
        .btn-close {
          width: 32px;
          height: 32px;
          border-radius: 50%;
          border: 1px solid rgba(255,255,255,0.12);
          background: rgba(255,255,255,0.06);
          color: rgba(255,255,255,0.5);
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.15s;
          flex-shrink: 0;
        }
        .btn-close:hover {
          background: rgba(255,255,255,0.12);
          color: #fff;
        }

        .form-label {
          font-size: 0.78rem;
          font-weight: 600;
          color: rgba(255,255,255,0.65);
          display: block;
          margin-bottom: 0.45rem;
        }
        .form-input-wrap {
          position: relative;
          margin-bottom: 1rem;
        }
        .form-input-icon {
          position: absolute;
          right: 0.75rem;
          top: 50%;
          transform: translateY(-50%);
          color: rgba(255,255,255,0.3);
          pointer-events: none;
        }
        .form-input-icon-left {
          position: absolute;
          left: 0.75rem;
          top: 50%;
          transform: translateY(-50%);
          color: rgba(255,255,255,0.3);
          cursor: pointer;
          background: none;
          border: none;
          padding: 0;
        }
        .form-input-icon-left:hover { color: rgba(255,255,255,0.7); }

        .custom-input {
          width: 100%;
          height: 44px;
          padding: 0 2.5rem;
          background: rgba(255,255,255,0.06);
          border: 1px solid rgba(255,255,255,0.12);
          border-radius: 0.6rem;
          color: #fff;
          font-size: 0.88rem;
          outline: none;
          transition: border-color 0.2s, box-shadow 0.2s;
          box-sizing: border-box;
        }
        .custom-input::placeholder { color: rgba(255,255,255,0.25); }
        .custom-input:focus {
          border-color: rgba(29,78,216,0.6);
          box-shadow: 0 0 0 3px rgba(29,78,216,0.15);
        }

        .btn-submit {
          width: 100%;
          height: 46px;
          background: #1d4ed8;
          color: #fff;
          font-size: 0.95rem;
          font-weight: 700;
          border: none;
          border-radius: 0.6rem;
          cursor: pointer;
          margin-top: 0.5rem;
          transition: all 0.2s;
          box-shadow: 0 4px 16px rgba(29,78,216,0.4);
        }
        .btn-submit:hover:not(:disabled) {
          background: #1e40af;
          box-shadow: 0 6px 22px rgba(29,78,216,0.5);
        }
        .btn-submit:disabled {
          opacity: 0.45;
          cursor: not-allowed;
        }

        /* ── Mobile ── */
        @media (max-width: 768px) {
          .login-page {
            justify-content: center;
            align-items: flex-end;
            padding: 2rem 1.5rem 3.5rem;
          }
          .hero-content { max-width: 100%; }
          .hero-heading { font-size: 2.2rem; }
        }
      `}</style>

      {/* ══════════════════════════════════════════
          HERO — النص والأزرار حرة على الصفحة
      ══════════════════════════════════════════ */}
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
              العمليات في <span>CAPRINA</span>
            </h1>
          </div>

          {/* Description */}
          <div className="fade-up-3">
            <p className="hero-desc">
              نظام متكامل لإدارة العمليات والطلبيات وتنفيذها على نطاق واسع
            </p>
          </div>

          {/* Win or Die */}
          <div className="fade-up-4">
            <span className="win-die">WIN OR DIE</span>
          </div>

          {/* Action buttons */}
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

      {/* ══════════════════════════════════════════
          FORM OVERLAY — يظهر فوق كل حاجة
      ══════════════════════════════════════════ */}
      {showForm && (
        <div className="form-overlay" onClick={() => setShowForm(false)}>
          <div className="form-card" onClick={e => e.stopPropagation()}>

            <div className="form-card-header">
              <div>
                <div className="form-card-title">تسجيل الدخول</div>
                <div className="form-card-subtitle">أدخل بياناتك للمتابعة</div>
              </div>
              <button className="btn-close" onClick={() => setShowForm(false)}>
                <X size={14} />
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              {/* Username */}
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

              {/* Password */}
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
