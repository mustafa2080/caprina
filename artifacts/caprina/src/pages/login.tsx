import { useState } from "react";
import { authApi } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { Eye, EyeOff, ShieldCheck, UserCircle2, Fingerprint, Globe, X, Sparkles } from "lucide-react";

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
        /* ══════════════════════════════════════
           KEYFRAMES
        ══════════════════════════════════════ */
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
        @keyframes glowPulse {
          0%, 100% { box-shadow: 0 0 8px #d97706, 0 0 20px rgba(217,119,6,0.4); }
          50%       { box-shadow: 0 0 16px #f59e0b, 0 0 40px rgba(245,158,11,0.6); }
        }
        @keyframes orbitSpin {
          from { transform: rotate(0deg) translateX(38px) rotate(0deg); }
          to   { transform: rotate(360deg) translateX(38px) rotate(-360deg); }
        }
        @keyframes flamePulse {
          0%   { filter: drop-shadow(0 0 4px rgba(245,158,11,0.2)) brightness(0.75); }
          50%  { filter: drop-shadow(0 0 28px rgba(245,158,11,1)) brightness(1.35); }
          100% { filter: drop-shadow(0 0 4px rgba(245,158,11,0.2)) brightness(0.75); }
        }
        @keyframes float3d {
          0%   { transform: perspective(600px) rotateX(0deg) rotateY(0deg) translateY(0); }
          25%  { transform: perspective(600px) rotateX(3deg) rotateY(-4deg) translateY(-6px); }
          50%  { transform: perspective(600px) rotateX(0deg) rotateY(0deg) translateY(-10px); }
          75%  { transform: perspective(600px) rotateX(-3deg) rotateY(4deg) translateY(-6px); }
          100% { transform: perspective(600px) rotateX(0deg) rotateY(0deg) translateY(0); }
        }
        @keyframes shimmer {
          0%   { background-position: -200% center; }
          100% { background-position: 200% center; }
        }
        @keyframes dotGlow {
          0%, 100% { opacity: 1; transform: scale(1); box-shadow: 0 0 6px #f59e0b; }
          50%       { opacity: 0.5; transform: scale(1.4); box-shadow: 0 0 14px #f59e0b; }
        }
        @keyframes iconFloat {
          0%, 100% { transform: translateY(0px) rotate(0deg); }
          50%       { transform: translateY(-5px) rotate(5deg); }
        }
        @keyframes scanline {
          0%   { top: 0%; }
          100% { top: 100%; }
        }

        .fade-up-1 { animation: fadeUp 0.7s 0.05s both; }
        .fade-up-2 { animation: fadeUp 0.7s 0.2s  both; }
        .fade-up-3 { animation: fadeUp 0.7s 0.35s both; }
        .fade-up-4 { animation: fadeUp 0.7s 0.5s  both; }
        .fade-up-5 { animation: fadeUp 0.7s 0.65s both; }

        /* ══ Page layout ══ */
        .login-page {
          position: fixed;
          inset: 0;
          z-index: 10;
          display: flex;
          align-items: center;
          justify-content: flex-start;
          padding: 4rem 6vw;
          direction: rtl;
        }

        /* ══ 3D floating logo orb ══ */
        .logo-orb {
          width: 90px;
          height: 90px;
          border-radius: 50%;
          background: radial-gradient(circle at 35% 35%,
            #fbbf24 0%, #d97706 40%, #92400e 75%, #1c0a00 100%);
          box-shadow:
            0 8px 32px rgba(217,119,6,0.55),
            inset 0 -6px 18px rgba(0,0,0,0.5),
            inset 0 6px 18px rgba(255,220,100,0.25),
            0 0 0 2px rgba(245,158,11,0.35);
          display: flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 1.6rem;
          animation: float3d 6s ease-in-out infinite;
          position: relative;
          cursor: default;
        }
        .logo-orb::before {
          content: '';
          position: absolute;
          inset: 4px;
          border-radius: 50%;
          border: 1px solid rgba(255,220,100,0.18);
          pointer-events: none;
        }
        .logo-orb::after {
          content: '';
          position: absolute;
          width: 14px;
          height: 14px;
          border-radius: 50%;
          background: radial-gradient(circle, #fef3c7 0%, #f59e0b 60%, transparent 100%);
          top: 12px;
          right: 16px;
          opacity: 0.7;
        }
        .logo-orb-letter {
          font-size: 2.2rem;
          font-weight: 900;
          color: #fef9ee;
          text-shadow: 0 2px 8px rgba(0,0,0,0.7), 0 0 20px rgba(245,158,11,0.6);
          z-index: 1;
          letter-spacing: -0.02em;
        }

        /* ══ Badge ══ */
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
          margin-bottom: 1.2rem;
        }
        .os-badge-dot {
          width: 7px;
          height: 7px;
          border-radius: 50%;
          background: #f59e0b;
          animation: dotGlow 2.2s infinite;
          flex-shrink: 0;
        }

        /* ══ Hero content ══ */
        .hero-content {
          direction: rtl;
          text-align: right;
          max-width: 500px;
          width: 100%;
        }

        /* ══ Heading ══ */
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
          animation: flamePulse 2.8s ease-in-out infinite;
          display: inline-block;
          filter: drop-shadow(0 0 18px rgba(245,158,11,0.9));
        }

        /* ══ Description ══ */
        .hero-desc {
          font-size: 1.1rem;
          font-weight: 600;
          color: #fef3c7;
          line-height: 1.75;
          margin-bottom: 0.65rem;
          max-width: 420px;
          text-shadow: 0 1px 8px rgba(0,0,0,0.5);
        }

        /* ══ Tagline ══ */
        .win-die {
          display: inline-block;
          font-size: 1.05rem;
          font-weight: 900;
          letter-spacing: 0.32em;
          text-transform: uppercase;
          background: linear-gradient(90deg,
            #f59e0b 0%, #fbbf24 30%, #fde68a 50%, #fbbf24 70%, #f59e0b 100%);
          background-size: 200% auto;
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          animation: shimmer 3s linear infinite;
          margin-bottom: 2.4rem;
        }

        /* ══ 3D Feature cards row ══ */
        .feature-cards {
          display: flex;
          gap: 0.6rem;
          margin-bottom: 2rem;
          flex-wrap: wrap;
          direction: rtl;
        }
        .feat-card {
          display: inline-flex;
          align-items: center;
          gap: 0.4rem;
          padding: 0.4rem 0.75rem;
          background: linear-gradient(145deg, rgba(30,15,5,0.9), rgba(20,10,2,0.95));
          border: 1px solid rgba(245,158,11,0.2);
          border-radius: 0.5rem;
          font-size: 0.7rem;
          font-weight: 700;
          color: rgba(253,230,138,0.8);
          box-shadow:
            0 4px 12px rgba(0,0,0,0.4),
            inset 0 1px 0 rgba(255,220,100,0.08);
          transform: perspective(300px) rotateX(0deg);
          transition: transform 0.25s, box-shadow 0.25s;
        }
        .feat-card:hover {
          transform: perspective(300px) rotateX(-8deg) translateY(-2px);
          box-shadow:
            0 8px 24px rgba(217,119,6,0.3),
            inset 0 1px 0 rgba(255,220,100,0.12);
          border-color: rgba(245,158,11,0.4);
        }
        .feat-card svg { color: #f59e0b; flex-shrink: 0; animation: iconFloat 3s ease-in-out infinite; }

        /* ══ Action buttons ══ */
        .action-row {
          display: flex;
          flex-direction: row;
          gap: 1rem;
          align-items: center;
          flex-wrap: nowrap;
          justify-content: flex-start;
          direction: rtl;
        }

        /* Primary — 3D gold button */
        .btn-login {
          display: inline-flex;
          align-items: center;
          gap: 0.55rem;
          padding: 0.82rem 1.8rem;
          background: linear-gradient(145deg, #fbbf24, #d97706, #92400e);
          color: #1c0a00;
          font-size: 0.9rem;
          font-weight: 800;
          border-radius: 0.7rem;
          border: none;
          cursor: pointer;
          transition: all 0.22s ease;
          box-shadow:
            0 6px 0 #7c2d12,
            0 8px 24px rgba(217,119,6,0.5),
            inset 0 1px 0 rgba(255,240,180,0.4);
          text-decoration: none;
          position: relative;
          overflow: hidden;
        }
        .btn-login::before {
          content: '';
          position: absolute;
          top: 0; left: -100%;
          width: 60%;
          height: 100%;
          background: linear-gradient(90deg, transparent, rgba(255,255,255,0.18), transparent);
          transform: skewX(-20deg);
          transition: left 0.5s;
        }
        .btn-login:hover::before { left: 150%; }
        .btn-login:hover {
          background: linear-gradient(145deg, #fcd34d, #f59e0b, #b45309);
          transform: translateY(-3px);
          box-shadow:
            0 8px 0 #7c2d12,
            0 12px 32px rgba(217,119,6,0.65),
            inset 0 1px 0 rgba(255,240,180,0.5);
        }
        .btn-login:active {
          transform: translateY(2px);
          box-shadow: 0 2px 0 #7c2d12, 0 4px 12px rgba(217,119,6,0.4);
        }
        .btn-login svg { animation: iconFloat 3s ease-in-out infinite; }

        /* Ghost button */
        .btn-site {
          display: inline-flex;
          align-items: center;
          gap: 0.6rem;
          padding: 0.82rem 1.8rem;
          background: rgba(10,5,0,0.6);
          color: #fef3c7;
          font-size: 0.9rem;
          font-weight: 800;
          border-radius: 0.7rem;
          border: 1.5px solid rgba(245,158,11,0.5);
          cursor: pointer;
          transition: all 0.22s ease;
          text-decoration: none;
          letter-spacing: 0.03em;
          box-shadow:
            0 0 20px rgba(245,158,11,0.2),
            inset 0 0 20px rgba(245,158,11,0.04);
          animation: glowPulse 3s ease-in-out infinite;
        }
        .btn-site:hover {
          background: rgba(245,158,11,0.12);
          border-color: #fbbf24;
          transform: translateY(-2px);
          box-shadow: 0 0 32px rgba(245,158,11,0.5);
        }
        .btn-site svg { animation: iconFloat 3s ease-in-out infinite 0.5s; }

        /* ══ Copyright ══ */
        .copyright {
          margin-top: 2.8rem;
          font-size: 0.65rem;
          color: rgba(245,158,11,0.22);
          letter-spacing: 0.05em;
        }

        /* ══════════════════════════════════════
           FORM OVERLAY
        ══════════════════════════════════════ */
        .form-overlay {
          position: fixed;
          inset: 0;
          z-index: 50;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 1.5rem;
          background: rgba(8,4,0,0.75);
          backdrop-filter: blur(12px);
          animation: fadeIn 0.22s ease forwards;
        }

        .form-card {
          background: linear-gradient(160deg,
            rgba(40,20,5,0.98) 0%,
            rgba(25,12,2,0.99) 60%,
            rgba(15,7,1,1) 100%);
          backdrop-filter: blur(32px);
          border: 1px solid rgba(245,158,11,0.22);
          border-radius: 1.4rem;
          padding: 2.4rem 2.1rem;
          width: 100%;
          max-width: 390px;
          box-shadow:
            0 40px 80px rgba(0,0,0,0.8),
            0 0 0 1px rgba(245,158,11,0.06),
            0 0 60px rgba(217,119,6,0.1),
            inset 0 1px 0 rgba(255,220,100,0.06);
          animation: formSlideIn 0.38s cubic-bezier(0.22,1,0.36,1) forwards;
          direction: rtl;
          position: relative;
          overflow: hidden;
        }
        /* scanline shimmer on card */
        .form-card::before {
          content: '';
          position: absolute;
          left: 0; right: 0;
          height: 2px;
          background: linear-gradient(90deg,
            transparent 0%, rgba(245,158,11,0.3) 50%, transparent 100%);
          animation: scanline 4s linear infinite;
          pointer-events: none;
          opacity: 0.6;
        }
        /* top golden accent line */
        .form-card::after {
          content: '';
          position: absolute;
          top: 0; left: 10%; right: 10%;
          height: 1px;
          background: linear-gradient(90deg,
            transparent, rgba(245,158,11,0.6), rgba(251,191,36,0.8), rgba(245,158,11,0.6), transparent);
          border-radius: 1px;
        }

        .form-card-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          margin-bottom: 1.8rem;
        }

        /* small shield icon in header */
        .form-card-icon {
          width: 42px;
          height: 42px;
          border-radius: 0.75rem;
          background: linear-gradient(145deg, rgba(245,158,11,0.2), rgba(217,119,6,0.1));
          border: 1px solid rgba(245,158,11,0.3);
          display: flex;
          align-items: center;
          justify-content: center;
          color: #fbbf24;
          box-shadow:
            0 4px 12px rgba(217,119,6,0.2),
            inset 0 1px 0 rgba(255,220,100,0.15);
          flex-shrink: 0;
          margin-left: 0.75rem;
        }

        .form-card-title {
          font-size: 1.2rem;
          font-weight: 900;
          background: linear-gradient(135deg, #fbbf24 0%, #f59e0b 50%, #ef4444 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }
        .form-card-subtitle {
          font-size: 0.72rem;
          color: rgba(253,230,138,0.55);
          margin-top: 0.22rem;
        }
        .btn-close {
          width: 32px;
          height: 32px;
          border-radius: 50%;
          border: 1px solid rgba(245,158,11,0.2);
          background: rgba(245,158,11,0.06);
          color: rgba(253,230,138,0.4);
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
          border-color: rgba(245,158,11,0.5);
          transform: rotate(90deg);
        }

        /* ══ Form fields ══ */
        .form-label {
          font-size: 0.77rem;
          font-weight: 700;
          color: #fbbf24;
          display: flex;
          align-items: center;
          gap: 0.4rem;
          margin-bottom: 0.45rem;
        }
        .form-label svg { color: rgba(245,158,11,0.7); }

        .form-input-wrap {
          position: relative;
          margin-bottom: 1.15rem;
        }
        .form-input-icon {
          position: absolute;
          right: 0.8rem;
          top: 50%;
          transform: translateY(-50%);
          color: rgba(245,158,11,0.5);
          pointer-events: none;
        }
        .form-input-icon-left {
          position: absolute;
          left: 0.8rem;
          top: 50%;
          transform: translateY(-50%);
          color: rgba(245,158,11,0.4);
          cursor: pointer;
          background: none;
          border: none;
          padding: 0;
          transition: color 0.15s;
          display: flex;
          align-items: center;
        }
        .form-input-icon-left:hover { color: #fcd34d; }

        .custom-input {
          width: 100%;
          height: 46px;
          padding: 0 2.5rem;
          background: linear-gradient(145deg, rgba(30,15,3,0.9), rgba(20,10,2,0.95));
          border: 1px solid rgba(245,158,11,0.2);
          border-radius: 0.7rem;
          color: #fef9ee;
          font-size: 0.88rem;
          outline: none;
          transition: border-color 0.2s, box-shadow 0.2s;
          box-sizing: border-box;
          box-shadow: inset 0 2px 6px rgba(0,0,0,0.3);
        }
        .custom-input::placeholder { color: rgba(253,230,138,0.2); }
        .custom-input:focus {
          border-color: rgba(245,158,11,0.6);
          box-shadow:
            inset 0 2px 6px rgba(0,0,0,0.3),
            0 0 0 3px rgba(245,158,11,0.1),
            0 0 12px rgba(245,158,11,0.15);
        }

        /* ══ Submit button ══ */
        .btn-submit {
          width: 100%;
          height: 48px;
          background: linear-gradient(145deg, #fbbf24, #d97706, #92400e);
          color: #1c0a00;
          font-size: 0.95rem;
          font-weight: 800;
          border: none;
          border-radius: 0.75rem;
          cursor: pointer;
          margin-top: 0.6rem;
          transition: all 0.22s;
          box-shadow:
            0 5px 0 #7c2d12,
            0 8px 22px rgba(217,119,6,0.4),
            inset 0 1px 0 rgba(255,240,180,0.35);
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.5rem;
          position: relative;
          overflow: hidden;
        }
        .btn-submit::before {
          content: '';
          position: absolute;
          top: 0; left: -100%;
          width: 60%;
          height: 100%;
          background: linear-gradient(90deg, transparent, rgba(255,255,255,0.18), transparent);
          transform: skewX(-20deg);
          transition: left 0.5s;
        }
        .btn-submit:hover:not(:disabled)::before { left: 150%; }
        .btn-submit:hover:not(:disabled) {
          background: linear-gradient(145deg, #fcd34d, #f59e0b, #b45309);
          transform: translateY(-2px);
          box-shadow:
            0 7px 0 #7c2d12,
            0 12px 28px rgba(217,119,6,0.55);
        }
        .btn-submit:active:not(:disabled) {
          transform: translateY(3px);
          box-shadow: 0 2px 0 #7c2d12, 0 4px 10px rgba(217,119,6,0.35);
        }
        .btn-submit:disabled { opacity: 0.35; cursor: not-allowed; }

        /* ══ Responsive ══ */
        @media (max-width: 1024px) {
          .hero-heading { font-size: 2.8rem; }
          .login-page { padding: 3rem 4vw; }
        }
        @media (max-width: 768px) {
          .login-page {
            justify-content: center;
            align-items: center;
            padding: 2.5rem 2rem;
          }
          .hero-content {
            max-width: 100%;
            text-align: right;
            display: flex;
            flex-direction: column;
            align-items: flex-end;
          }
          .hero-heading { font-size: 2.4rem; line-height: 1.18; }
          .hero-desc { font-size: 1.05rem; max-width: 100%; }
          .action-row { flex-wrap: wrap; justify-content: flex-end; gap: 0.75rem; width: 100%; }
          .btn-login, .btn-site { font-size: 0.9rem; padding: 0.82rem 1.4rem; }
        }
        @media (max-width: 480px) {
          .login-page { padding: 2rem 1.25rem; }
          .hero-heading { font-size: 2rem; line-height: 1.22; }
          .hero-desc { font-size: 0.97rem; max-width: 100%; }
          .win-die { font-size: 0.88rem; letter-spacing: 0.22em; margin-bottom: 1.8rem; }
          .action-row { flex-direction: column; align-items: stretch; gap: 0.65rem; }
          .btn-login, .btn-site { width: 100%; justify-content: center; font-size: 0.93rem; padding: 0.85rem 1rem; }
          .logo-orb { width: 72px; height: 72px; }
          .logo-orb-letter { font-size: 1.8rem; }
          .feature-cards { gap: 0.45rem; }
        }
        @media (max-width: 360px) {
          .hero-heading { font-size: 1.75rem; }
          .hero-desc { font-size: 0.88rem; }
          .btn-login, .btn-site { font-size: 0.83rem; padding: 0.75rem 0.9rem; }
          .login-page { padding: 1.5rem 1rem; }
        }
      `}</style>

      {/* ══ HERO PAGE ══ */}
      <div className="login-page">
        <div className="hero-content">

          {/* 3D Floating Orb Logo */}
          <div className="fade-up-1">
            <div className="logo-orb">
              <span className="logo-orb-letter">C</span>
            </div>
          </div>

          {/* Badge */}
          <div className="fade-up-1">
            <div className="os-badge">
              <div className="os-badge-dot" />
              <Sparkles size={11} />
              نظام إدارة العمليات · الإصدار الأخير
            </div>
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

          {/* Feature mini-cards */}
          <div className="fade-up-4 feature-cards">
            <div className="feat-card"><ShieldCheck size={13} /> حماية كاملة</div>
            <div className="feat-card"><Fingerprint size={13} /> دخول آمن</div>
            <div className="feat-card"><Globe size={13} /> متعدد المستخدمين</div>
          </div>

          {/* Buttons */}
          <div className="fade-up-5 action-row">
            <button className="btn-login" onClick={() => setShowForm(true)}>
              <Fingerprint size={20} />
              تسجيل الدخول للمتابعة
            </button>
            <a
              href="https://caprinaeg.com"
              target="_blank"
              rel="noopener noreferrer"
              className="btn-site"
            >
              <Globe size={20} />
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
              <div style={{ display: "flex", alignItems: "flex-start", gap: "0", flexDirection: "row-reverse" }}>
                <div className="form-card-icon">
                  <ShieldCheck size={20} />
                </div>
                <div>
                  <div className="form-card-title">تسجيل الدخول</div>
                  <div className="form-card-subtitle">أدخل بياناتك للمتابعة إلى لوحة التحكم</div>
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
                  <>جاري التحقق...</>
                ) : (
                  <><Fingerprint size={18} /> دخول آمن</>
                )}
              </button>
            </form>

          </div>
        </div>
      )}
    </>
  );
}
