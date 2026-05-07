import { useState } from "react";
import { authApi } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import {
  CheckCircle2,
  ExternalLink,
  Eye,
  EyeOff,
  Fingerprint,
  LogIn,
  ShieldCheck,
  UserCircle2,
  X,
} from "lucide-react";

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
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(24px); }
          to   { opacity: 1; transform: translateY(0); }
        }

        @keyframes fadeIn {
          from { opacity: 0; }
          to   { opacity: 1; }
        }

        @keyframes formSlideIn {
          from { opacity: 0; transform: translateY(28px) scale(0.96); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }

        @keyframes pulseAura {
          0%, 100% { transform: scale(1); opacity: 0.7; }
          50% { transform: scale(1.06); opacity: 1; }
        }

        .fade-up-1 { animation: fadeUp 0.7s 0.05s both; }
        .fade-up-2 { animation: fadeUp 0.7s 0.2s  both; }
        .fade-up-3 { animation: fadeUp 0.7s 0.35s both; }
        .fade-up-4 { animation: fadeUp 0.7s 0.5s  both; }
        .fade-up-5 { animation: fadeUp 0.7s 0.65s both; }

        .login-page {
          position: fixed;
          inset: 0;
          z-index: 10;
          display: flex;
          align-items: center;
          justify-content: center;
          overflow: auto;
          padding: 3rem 5vw;
          direction: rtl;
          background:
            radial-gradient(circle at top right, rgba(210, 170, 72, 0.16), transparent 28%),
            radial-gradient(circle at bottom left, rgba(181, 137, 53, 0.12), transparent 30%),
            linear-gradient(135deg, #080807 0%, #11100d 42%, #17140f 100%);
        }
        .login-page::before {
          content: "";
          position: absolute;
          inset: 0;
          background:
            linear-gradient(rgba(255,255,255,0.025) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.025) 1px, transparent 1px);
          background-size: 42px 42px;
          mask-image: radial-gradient(circle at center, black 50%, transparent 92%);
          pointer-events: none;
          opacity: 0.28;
        }

        .login-shell {
          position: relative;
          z-index: 1;
          width: min(1180px, 100%);
          display: grid;
          grid-template-columns: minmax(0, 1.15fr) minmax(360px, 430px);
          gap: 2rem;
          align-items: stretch;
        }

        .hero-panel,
        .preview-panel {
          position: relative;
          overflow: hidden;
          border: 1px solid rgba(214, 175, 83, 0.16);
          background: linear-gradient(180deg, rgba(24, 22, 18, 0.88), rgba(12, 11, 9, 0.96));
          box-shadow:
            0 24px 80px rgba(0, 0, 0, 0.42),
            inset 0 1px 0 rgba(255, 255, 255, 0.04);
          backdrop-filter: blur(18px);
        }

        .hero-panel {
          border-radius: 2rem;
          padding: 2.4rem;
          min-height: 640px;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
        }

        .hero-panel::after,
        .preview-panel::after {
          content: "";
          position: absolute;
          inset: 0;
          pointer-events: none;
          background: linear-gradient(135deg, rgba(255,255,255,0.03), transparent 35%, transparent 65%, rgba(214,175,83,0.04));
        }

        .preview-panel {
          border-radius: 1.75rem;
          padding: 2rem 1.75rem;
          align-self: center;
          width: 100%;
        }

        .brand-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 1rem;
          margin-bottom: 2.25rem;
        }

        .brand-badge {
          display: inline-flex;
          align-items: center;
          gap: 0.6rem;
          padding: 0.58rem 0.9rem;
          border-radius: 999px;
          background: rgba(228, 195, 115, 0.08);
          border: 1px solid rgba(228, 195, 115, 0.2);
          color: #f5e6be;
          font-size: 0.85rem;
          font-weight: 700;
          letter-spacing: 0.01em;
        }

        .brand-dot {
          width: 0.62rem;
          height: 0.62rem;
          border-radius: 999px;
          background: linear-gradient(135deg, #f1d48d, #b88b34);
          box-shadow: 0 0 0 4px rgba(214, 175, 83, 0.12);
          animation: pulseAura 2.4s ease-in-out infinite;
        }

        .logo-orb {
          width: 96px;
          height: 96px;
          border-radius: 28px;
          background: linear-gradient(145deg, rgba(255,255,255,0.08), rgba(214,175,83,0.08));
          border: 1px solid rgba(214,175,83,0.24);
          box-shadow:
            0 18px 36px rgba(0,0,0,0.3),
            inset 0 1px 0 rgba(255,255,255,0.08);
          display: flex;
          align-items: center;
          justify-content: center;
          position: relative;
        }
        .logo-orb::before {
          content: "";
          position: absolute;
          inset: 10px;
          border-radius: 22px;
          border: 1px solid rgba(255,255,255,0.05);
        }

        .hero-content {
          text-align: right;
        }

        .hero-heading {
          font-size: clamp(2.3rem, 4.9vw, 4.15rem);
          font-weight: 900;
          line-height: 1.08;
          color: #fcf7ea;
          margin-bottom: 1rem;
          max-width: 10ch;
        }
        .hero-heading .accent {
          background: linear-gradient(135deg, #fff2c8 0%, #deb15f 55%, #ab7a28 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }

        .hero-desc {
          font-size: 1.05rem;
          font-weight: 500;
          color: rgba(250, 241, 219, 0.8);
          line-height: 1.95;
          max-width: 55ch;
          margin-bottom: 1.5rem;
        }

        .hero-note {
          display: inline-flex;
          align-items: center;
          gap: 0.5rem;
          margin-bottom: 1.6rem;
          padding: 0.62rem 0.88rem;
          border-radius: 1rem;
          background: rgba(255, 248, 230, 0.05);
          border: 1px solid rgba(214, 175, 83, 0.16);
          color: #efd69b;
          font-size: 0.88rem;
          font-weight: 700;
        }

        .feature-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 0.9rem;
          margin-bottom: 2rem;
        }

        .feature-card {
          padding: 1rem;
          border-radius: 1.15rem;
          background: rgba(255, 255, 255, 0.035);
          border: 1px solid rgba(214, 175, 83, 0.12);
          color: #f6eac8;
          min-height: 118px;
        }

        .feature-card-icon {
          width: 2rem;
          height: 2rem;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border-radius: 0.8rem;
          margin-bottom: 0.8rem;
          background: linear-gradient(145deg, rgba(234, 203, 128, 0.16), rgba(168, 123, 36, 0.12));
          color: #f3d892;
        }

        .feature-card-title {
          font-size: 0.98rem;
          font-weight: 800;
          color: #fff7e3;
          margin-bottom: 0.3rem;
        }

        .feature-card-text {
          font-size: 0.84rem;
          line-height: 1.7;
          color: rgba(246, 234, 200, 0.74);
        }

        .action-row {
          display: flex;
          flex-wrap: wrap;
          gap: 1rem;
          align-items: center;
          justify-content: flex-start;
          margin-top: auto;
        }

        .btn-login {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 0.6rem;
          min-height: 3.35rem;
          padding: 0.95rem 1.5rem;
          background: linear-gradient(135deg, #fff0c3 0%, #d5a44b 58%, #9f7024 100%);
          color: #100d08;
          font-size: 0.95rem;
          font-weight: 800;
          border-radius: 1rem;
          border: none;
          cursor: pointer;
          transition: transform 0.2s ease, box-shadow 0.2s ease, filter 0.2s ease;
          box-shadow:
            0 14px 30px rgba(173, 125, 36, 0.28),
            inset 0 1px 0 rgba(255,255,255,0.5);
          text-decoration: none;
        }
        .btn-login:hover {
          transform: translateY(-2px);
          box-shadow: 0 18px 36px rgba(173, 125, 36, 0.34);
          filter: saturate(1.05);
        }

        .btn-site {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 0.6rem;
          min-height: 3.35rem;
          padding: 0.95rem 1.35rem;
          background: rgba(255,255,255,0.03);
          color: #f3e5bd;
          font-size: 0.93rem;
          font-weight: 800;
          border-radius: 1rem;
          border: 1px solid rgba(214, 175, 83, 0.24);
          cursor: pointer;
          transition: transform 0.2s ease, background 0.2s ease, border-color 0.2s ease;
          text-decoration: none;
        }
        .btn-site:hover {
          background: rgba(214, 175, 83, 0.08);
          border-color: rgba(214, 175, 83, 0.42);
          transform: translateY(-2px);
        }

        .copyright-bar {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          margin-top: 2rem;
        }
        .copyright-line {
          flex: 1;
          height: 1px;
          background: linear-gradient(90deg, rgba(214, 175, 83, 0.38), transparent);
        }
        .copyright-line.left {
          background: linear-gradient(270deg, rgba(214, 175, 83, 0.38), transparent);
        }
        .copyright-text {
          font-size: 0.75rem;
          font-weight: 800;
          letter-spacing: 0.08em;
          color: rgba(248, 233, 191, 0.72);
          white-space: nowrap;
          padding: 0.45rem 0.9rem;
          border-radius: 999px;
          border: 1px solid rgba(214, 175, 83, 0.14);
          background: rgba(255,255,255,0.025);
        }

        .preview-header {
          margin-bottom: 1.5rem;
        }

        .preview-kicker {
          display: inline-flex;
          align-items: center;
          gap: 0.45rem;
          color: #f0d89b;
          font-size: 0.8rem;
          font-weight: 800;
          margin-bottom: 0.7rem;
        }

        .preview-title {
          font-size: 1.55rem;
          font-weight: 900;
          color: #fff8e6;
          margin-bottom: 0.55rem;
        }

        .preview-text {
          font-size: 0.92rem;
          line-height: 1.8;
          color: rgba(249, 237, 204, 0.72);
        }

        .preview-list {
          display: grid;
          gap: 0.8rem;
          margin-bottom: 1.5rem;
        }

        .preview-item {
          display: flex;
          align-items: flex-start;
          gap: 0.75rem;
          padding: 0.88rem 0.95rem;
          border-radius: 1rem;
          background: rgba(255,255,255,0.03);
          border: 1px solid rgba(214, 175, 83, 0.1);
        }

        .preview-item svg {
          margin-top: 0.1rem;
          flex-shrink: 0;
          color: #f0d18c;
        }

        .preview-item-title {
          font-size: 0.9rem;
          font-weight: 800;
          color: #fff2ce;
          margin-bottom: 0.22rem;
        }

        .preview-item-text {
          font-size: 0.82rem;
          line-height: 1.7;
          color: rgba(246, 234, 200, 0.66);
        }

        .form-overlay {
          position: fixed;
          inset: 0;
          z-index: 50;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 1.5rem;
          background: rgba(8, 8, 7, 0.72);
          backdrop-filter: blur(14px);
          animation: fadeIn 0.22s ease forwards;
        }

        .form-card {
          background: linear-gradient(180deg, rgba(25, 22, 17, 0.98), rgba(12, 11, 8, 1));
          border: 1px solid rgba(214, 175, 83, 0.18);
          border-radius: 1.5rem;
          padding: 2rem;
          width: 100%;
          max-width: 420px;
          box-shadow:
            0 32px 84px rgba(0,0,0,0.6),
            inset 0 1px 0 rgba(255,255,255,0.05);
          animation: formSlideIn 0.38s cubic-bezier(0.22,1,0.36,1) forwards;
          direction: rtl;
          position: relative;
          overflow: hidden;
        }
        .form-card::before {
          content: "";
          position: absolute;
          inset: 0;
          pointer-events: none;
          background: radial-gradient(circle at top right, rgba(214, 175, 83, 0.12), transparent 35%);
        }

        .form-card-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 1rem;
          margin-bottom: 1.7rem;
        }
        .form-card-icon {
          width: 2.9rem;
          height: 2.9rem;
          border-radius: 1rem;
          background: linear-gradient(145deg, rgba(214, 175, 83, 0.18), rgba(126, 92, 25, 0.14));
          border: 1px solid rgba(214, 175, 83, 0.24);
          display: flex;
          align-items: center;
          justify-content: center;
          color: #f1d48d;
          flex-shrink: 0;
        }
        .form-card-title {
          font-size: 1.18rem;
          font-weight: 900;
          color: #fff5da;
        }
        .form-card-subtitle {
          font-size: 0.78rem;
          color: rgba(243, 229, 189, 0.58);
          margin-top: 0.28rem;
          line-height: 1.7;
        }
        .btn-close {
          width: 2.15rem;
          height: 2.15rem;
          border-radius: 999px;
          border: 1px solid rgba(214, 175, 83, 0.16);
          background: rgba(255,255,255,0.03);
          color: rgba(243, 229, 189, 0.48);
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.15s;
          flex-shrink: 0;
        }
        .btn-close:hover {
          background: rgba(214, 175, 83, 0.1);
          color: #f0d18c;
          border-color: rgba(214, 175, 83, 0.28);
        }
        .form-label {
          font-size: 0.78rem;
          font-weight: 700;
          color: #f0d18c;
          display: flex;
          align-items: center;
          gap: 0.4rem;
          margin-bottom: 0.45rem;
        }
        .form-label svg { color: rgba(240, 209, 140, 0.7); }
        .form-input-wrap { position: relative; margin-bottom: 1.1rem; }
        .form-input-icon {
          position: absolute;
          right: 0.8rem;
          top: 50%;
          transform: translateY(-50%);
          color: rgba(240, 209, 140, 0.48);
          pointer-events: none;
        }
        .form-input-icon-left {
          position: absolute;
          left: 0.8rem;
          top: 50%;
          transform: translateY(-50%);
          color: rgba(240, 209, 140, 0.45);
          cursor: pointer;
          background: none;
          border: none;
          padding: 0;
          transition: color 0.15s;
          display: flex;
          align-items: center;
        }
        .form-input-icon-left:hover { color: #fff0cb; }
        .custom-input {
          width: 100%;
          height: 3rem;
          padding: 0 2.65rem;
          background: rgba(255,255,255,0.03);
          border: 1px solid rgba(214, 175, 83, 0.14);
          border-radius: 0.9rem;
          color: #fff6df;
          font-size: 0.9rem;
          outline: none;
          transition: border-color 0.2s, box-shadow 0.2s, background 0.2s;
          box-sizing: border-box;
        }
        .custom-input::placeholder { color: rgba(243, 229, 189, 0.26); }
        .custom-input:focus {
          border-color: rgba(214, 175, 83, 0.4);
          background: rgba(255,255,255,0.05);
          box-shadow: 0 0 0 4px rgba(214, 175, 83, 0.08);
        }
        .btn-submit {
          width: 100%;
          height: 3.2rem;
          background: linear-gradient(135deg, #fff0c3 0%, #d5a44b 58%, #9f7024 100%);
          color: #100d08;
          font-size: 0.95rem;
          font-weight: 900;
          border: none;
          border-radius: 1rem;
          cursor: pointer;
          margin-top: 0.7rem;
          transition: transform 0.22s, box-shadow 0.22s, filter 0.22s;
          box-shadow: 0 14px 28px rgba(173, 125, 36, 0.26);
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.5rem;
        }
        .btn-submit:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 18px 34px rgba(173, 125, 36, 0.34);
          filter: saturate(1.06);
        }
        .btn-submit:disabled { opacity: 0.45; cursor: not-allowed; }

        @media (max-width: 1100px) {
          .login-shell {
            grid-template-columns: 1fr;
            max-width: 760px;
          }
          .hero-panel {
            min-height: auto;
          }
        }

        @media (max-width: 768px) {
          .login-page { padding: 1.5rem; }
          .hero-panel, .preview-panel { padding: 1.4rem; }
          .brand-row {
            flex-direction: column;
            align-items: flex-start;
            margin-bottom: 1.5rem;
          }
          .hero-heading {
            font-size: 2.2rem;
            max-width: none;
          }
          .hero-desc {
            font-size: 0.97rem;
            max-width: none;
          }
          .feature-grid {
            grid-template-columns: 1fr;
          }
          .action-row {
            flex-direction: column;
            align-items: stretch;
          }
          .btn-login, .btn-site {
            width: 100%;
          }
          .copyright-bar {
            justify-content: center;
          }
        }

        @media (max-width: 480px) {
          .login-page { padding: 1rem; }
          .hero-heading { font-size: 1.9rem; }
          .logo-orb { width: 82px; height: 82px; border-radius: 24px; }
          .form-card { padding: 1.4rem; }
        }
      `}</style>

      <div className="login-page">
        <div className="login-shell">
          <section className="hero-panel">
            <div className="hero-content">
              <div className="brand-row fade-up-1">
                <span className="brand-badge">
                  <span className="brand-dot" />
                  منصة تشغيل الطلبات
                </span>
                <div className="logo-orb">
                  <img
                    src="/logo.jpg"
                    alt="Caprina Logo"
                    style={{
                      width: "68px",
                      height: "68px",
                      borderRadius: "20px",
                      objectFit: "cover",
                      zIndex: 1,
                      position: "relative",
                    }}
                  />
                </div>
              </div>

              <div className="fade-up-2">
                <h1 className="hero-heading">
                  إدارة العمليات في <span className="accent">CAPRINA</span>
                  <br />
                  بشكل أوضح وأكثر احترافية
                </h1>
              </div>

              <div className="fade-up-3">
                <p className="hero-desc">
                  لوحة موحدة لمتابعة الطلبات وتنظيم سير العمل اليومي بدقة، مع تجربة دخول
                  مريحة وسريعة تساعد فريق التشغيل على الوصول لما يحتاجه بدون تعقيد.
                </p>
              </div>

              <div className="fade-up-4">
                <div className="hero-note">
                  <ShieldCheck size={16} />
                  وصول آمن ومنظم إلى أدوات التشغيل والمتابعة
                </div>
              </div>

              <div className="feature-grid fade-up-4">
                <div className="feature-card">
                  <div className="feature-card-icon">
                    <CheckCircle2 size={18} />
                  </div>
                  <div className="feature-card-title">متابعة واضحة</div>
                  <div className="feature-card-text">
                    عرض منظم للطلبات والمهام لتقليل التشتت وتسريع اتخاذ القرار.
                  </div>
                </div>

                <div className="feature-card">
                  <div className="feature-card-icon">
                    <Fingerprint size={18} />
                  </div>
                  <div className="feature-card-title">دخول آمن</div>
                  <div className="feature-card-text">
                    حماية أفضل لبيانات الفريق مع تجربة وصول مباشرة وسلسة.
                  </div>
                </div>

                <div className="feature-card">
                  <div className="feature-card-icon">
                    <LogIn size={18} />
                  </div>
                  <div className="feature-card-title">تنفيذ أسرع</div>
                  <div className="feature-card-text">
                    الوصول السريع للأقسام الرئيسية لتسليم العمل بكفاءة أعلى.
                  </div>
                </div>
              </div>

              <div className="fade-up-5 action-row">
                <button className="btn-login" onClick={() => setShowForm(true)}>
                  <LogIn size={18} />
                  ابدأ تسجيل الدخول
                </button>
                <a
                  href="https://caprinaeg.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-site"
                >
                  <ExternalLink size={18} />
                  زيارة الموقع الرئيسي
                </a>
              </div>
            </div>

            <div className="fade-up-5 copyright-bar">
              <div className="copyright-line" />
              <span className="copyright-text">CAPRINA © 2026 جميع الحقوق محفوظة</span>
              <div className="copyright-line left" />
            </div>
          </section>

          <aside className="preview-panel fade-up-3">
            <div className="preview-header">
              <div className="preview-kicker">
                <ShieldCheck size={15} />
                تجربة دخول محسنة
              </div>
              <div className="preview-title">واجهة هادئة وواضحة لفريق التشغيل</div>
              <div className="preview-text">
                تم تبسيط الرسائل والعناصر الأساسية لتكون الصفحة أكثر احترافية وراحة للعين،
                مع إبراز زر الدخول بشكل مباشر وواضح.
              </div>
            </div>

            <div className="preview-list">
              <div className="preview-item">
                <CheckCircle2 size={18} />
                <div>
                  <div className="preview-item-title">صياغة أكثر مهنية</div>
                  <div className="preview-item-text">
                    استبدال العبارات الحادة برسائل مناسبة لبيئة عمل احترافية وواضحة.
                  </div>
                </div>
              </div>

              <div className="preview-item">
                <CheckCircle2 size={18} />
                <div>
                  <div className="preview-item-title">أزرار أوضح في الأولوية</div>
                  <div className="preview-item-text">
                    زر رئيسي بارز لتسجيل الدخول وزر ثانوي متزن لزيارة الموقع الرئيسي.
                  </div>
                </div>
              </div>

              <div className="preview-item">
                <CheckCircle2 size={18} />
                <div>
                  <div className="preview-item-title">تجربة مريحة على الجوال</div>
                  <div className="preview-item-text">
                    توزيع أفضل للعناصر واستجابة محسنة على الشاشات الصغيرة.
                  </div>
                </div>
              </div>
            </div>
          </aside>
        </div>
      </div>

      {showForm && (
        <div className="form-overlay" onClick={() => setShowForm(false)}>
          <div className="form-card" onClick={e => e.stopPropagation()}>
            <div className="form-card-header">
              <div style={{ display: "flex", alignItems: "flex-start", gap: "0.9rem", flexDirection: "row-reverse" }}>
                <div className="form-card-icon">
                  <ShieldCheck size={20} />
                </div>
                <div>
                  <div className="form-card-title">تسجيل الدخول إلى النظام</div>
                  <div className="form-card-subtitle">
                    استخدم بيانات حسابك للوصول إلى لوحة العمليات ومتابعة العمل اليومي.
                  </div>
                </div>
              </div>
              <button className="btn-close" onClick={() => setShowForm(false)}>
                <X size={13} />
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              <label className="form-label">
                <UserCircle2 size={13} />
                اسم المستخدم
              </label>
              <div className="form-input-wrap">
                <UserCircle2 className="form-input-icon" size={16} />
                <input
                  className="custom-input"
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  placeholder="أدخل اسم المستخدم"
                  autoComplete="username"
                  autoFocus
                />
              </div>

              <label className="form-label">
                <ShieldCheck size={13} />
                كلمة المرور
              </label>
              <div className="form-input-wrap">
                <Fingerprint className="form-input-icon" size={16} />
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
                {loading ? (
                  <>جاري تسجيل الدخول...</>
                ) : (
                  <><Fingerprint size={18} /> دخول إلى لوحة التحكم</>
                )}
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
