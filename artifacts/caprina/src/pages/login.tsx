import { useState } from "react";
import { authApi } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { Eye, EyeOff, ShieldCheck, UserCircle2, Fingerprint, X, LogIn, ExternalLink } from "lucide-react";

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
        :root {
          --gold:       #C9A84C;
          --gold-light: #E8C96A;
          --gold-dim:   #8B6914;
          --gold-pale:  #F0E0A8;
          --black:      #090807;
          --black-card: #1A1714;
          --white:      #FFFFFF;
          --white-off:  #F5F0E8;
          --border:     rgba(201,168,76,0.28);
        }
        @keyframes fadeUp  { from{opacity:0;transform:translateY(20px)} to{opacity:1;transform:translateY(0)} }
        @keyframes fadeIn  { from{opacity:0} to{opacity:1} }
        @keyframes slideUp { from{opacity:0;transform:translateY(30px) scale(0.96)} to{opacity:1;transform:translateY(0) scale(1)} }
        @keyframes shimmer { 0%{background-position:-200% center} 100%{background-position:200% center} }
        @keyframes floatY  { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-8px)} }
        @keyframes logoGlow{ 0%,100%{box-shadow:0 0 24px rgba(201,168,76,0.35),0 8px 40px rgba(0,0,0,0.7)} 50%{box-shadow:0 0 48px rgba(201,168,76,0.6),0 8px 40px rgba(0,0,0,0.7)} }
        @keyframes scanline{ 0%{top:-2px} 100%{top:100%} }
        @keyframes bglow  { 0%,100%{opacity:0.4} 50%{opacity:1} }
        .fu1{animation:fadeUp .6s .05s both} .fu2{animation:fadeUp .6s .18s both}
        .fu3{animation:fadeUp .6s .30s both} .fu4{animation:fadeUp .6s .42s both}
        .fu5{animation:fadeUp .6s .54s both}

        .lp { position:fixed;inset:0;z-index:10;display:flex;align-items:center;justify-content:flex-start;padding:0 8vw;direction:rtl; }
        .hc { max-width:520px;width:100%;display:flex;flex-direction:column;align-items:flex-start; }

        .logo-wrap { display:flex;align-items:center;gap:1.1rem;margin-bottom:2.2rem;animation:floatY 5s ease-in-out infinite; }
        .logo-ring {
          width:88px;height:88px;border-radius:50%;
          background:linear-gradient(145deg,#1e1a14,#0d0b08);
          border:2px solid var(--gold);
          display:flex;align-items:center;justify-content:center;
          box-shadow:0 0 0 6px rgba(201,168,76,0.08),0 0 32px rgba(201,168,76,0.3),0 8px 32px rgba(0,0,0,0.7);
          animation:logoGlow 3s ease-in-out infinite;
          flex-shrink:0;position:relative;overflow:hidden;
        }
        .logo-ring::before { content:'';position:absolute;inset:0;border-radius:50%;background:radial-gradient(circle at 35% 30%, rgba(201,168,76,0.15) 0%, transparent 65%); }
        .logo-ring img { width:64px;height:64px;border-radius:50%;object-fit:cover;position:relative;z-index:1; }
        .logo-text-block { display:flex;flex-direction:column;gap:2px; }
        .logo-brand {
          font-size:1.9rem;font-weight:900;letter-spacing:0.18em;
          background:linear-gradient(135deg,var(--gold-pale) 0%,var(--gold) 45%,var(--gold-dim) 100%);
          background-size:200% auto;-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;
          animation:shimmer 4s linear infinite;line-height:1;
        }
        .logo-sub { font-size:0.65rem;font-weight:600;letter-spacing:0.35em;color:rgba(201,168,76,0.55);text-transform:uppercase; }

        .gold-divider { width:100%;height:1px;background:linear-gradient(90deg,var(--gold) 0%,rgba(201,168,76,0.1) 100%);margin-bottom:2rem;animation:bglow 3s ease-in-out infinite; }

        .h-title { font-size:clamp(1.9rem,4.5vw,3.2rem);font-weight:900;line-height:1.15;color:var(--white);margin-bottom:.6rem;text-shadow:0 2px 20px rgba(0,0,0,0.8);letter-spacing:-.01em; }
        .h-title .g {
          background:linear-gradient(135deg,var(--gold-light) 0%,var(--gold) 50%,var(--gold-dim) 100%);
          background-size:200% auto;-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;animation:shimmer 3s linear infinite;
        }
        .h-desc { font-size:1rem;font-weight:400;color:rgba(255,255,255,0.55);line-height:1.8;margin-bottom:.5rem;max-width:400px; }

        .tagline {
          font-size:.78rem;font-weight:700;letter-spacing:.4em;color:var(--gold-dim);text-transform:uppercase;
          margin-bottom:2.2rem;display:flex;align-items:center;gap:.7rem;
        }
        .tagline::before,.tagline::after { content:'';flex:1;max-width:40px;height:1px;background:linear-gradient(90deg,var(--gold-dim),transparent); }
        .tagline::after { background:linear-gradient(270deg,var(--gold-dim),transparent); }

        .btn-row { display:flex;flex-direction:row;gap:.9rem;flex-wrap:wrap;margin-bottom:2.5rem; }
        .btn-primary {
          display:inline-flex;align-items:center;gap:.6rem;padding:.85rem 2rem;
          background:linear-gradient(135deg,var(--gold-light) 0%,var(--gold) 50%,var(--gold-dim) 100%);
          color:var(--black);font-size:.88rem;font-weight:800;border:none;border-radius:.6rem;cursor:pointer;
          letter-spacing:.04em;box-shadow:0 4px 0 var(--gold-dim),0 8px 28px rgba(201,168,76,0.35);
          transition:all .2s ease;position:relative;overflow:hidden;text-decoration:none;
        }
        .btn-primary::after { content:'';position:absolute;inset:0;background:linear-gradient(135deg,rgba(255,255,255,0.18) 0%,transparent 60%);border-radius:.6rem;pointer-events:none; }
        .btn-primary:hover { transform:translateY(-2px);box-shadow:0 6px 0 var(--gold-dim),0 12px 36px rgba(201,168,76,0.5);background:linear-gradient(135deg,#f0e0a8 0%,var(--gold-light) 50%,var(--gold) 100%); }
        .btn-primary:active { transform:translateY(2px);box-shadow:0 2px 0 var(--gold-dim); }
        .btn-ghost {
          display:inline-flex;align-items:center;gap:.6rem;padding:.85rem 2rem;
          background:transparent;color:var(--white-off);font-size:.88rem;font-weight:700;
          border:1.5px solid var(--border);border-radius:.6rem;cursor:pointer;letter-spacing:.04em;
          transition:all .2s ease;text-decoration:none;
        }
        .btn-ghost:hover { background:rgba(201,168,76,0.08);border-color:rgba(201,168,76,0.6);color:var(--gold-light);transform:translateY(-2px);box-shadow:0 0 24px rgba(201,168,76,0.2); }

        .copy-bar { display:flex;align-items:center;gap:.8rem;width:100%; }
        .copy-line { flex:1;height:1px;background:linear-gradient(90deg,rgba(201,168,76,0.35),transparent); }
        .copy-line.r { background:linear-gradient(270deg,rgba(201,168,76,0.35),transparent); }
        .copy-text { font-size:.72rem;font-weight:900;letter-spacing:.2em;color:rgba(201,168,76,0.6);white-space:nowrap;text-transform:uppercase; }

        .ov { position:fixed;inset:0;z-index:50;display:flex;align-items:center;justify-content:center;padding:1.5rem;background:rgba(6,5,4,0.82);backdrop-filter:blur(16px);animation:fadeIn .2s ease; }
        .card {
          background:var(--black-card);border:1px solid var(--border);border-radius:1.2rem;
          padding:2.2rem 2rem;width:100%;max-width:380px;direction:rtl;position:relative;overflow:hidden;
          box-shadow:0 32px 80px rgba(0,0,0,0.9),0 0 48px rgba(201,168,76,0.06);
          animation:slideUp .35s cubic-bezier(.22,1,.36,1);
        }
        .card::before { content:'';position:absolute;left:0;right:0;height:1.5px;background:linear-gradient(90deg,transparent,rgba(201,168,76,0.5),transparent);animation:scanline 5s linear infinite;pointer-events:none; }
        .card-top-line { position:absolute;top:0;left:15%;right:15%;height:1px;background:linear-gradient(90deg,transparent,var(--gold),rgba(201,168,76,0.6),var(--gold),transparent); }
        .card-head { display:flex;align-items:center;justify-content:space-between;margin-bottom:1.8rem;padding-bottom:1.2rem;border-bottom:1px solid rgba(201,168,76,0.12); }
        .card-head-left { display:flex;align-items:center;gap:.75rem;flex-direction:row-reverse; }
        .card-icon { width:40px;height:40px;border-radius:.65rem;background:linear-gradient(135deg,rgba(201,168,76,0.15),rgba(139,105,20,0.08));border:1px solid rgba(201,168,76,0.3);display:flex;align-items:center;justify-content:center;color:var(--gold);flex-shrink:0; }
        .card-title { font-size:1.15rem;font-weight:900;color:var(--white); }
        .card-sub { font-size:.7rem;color:rgba(255,255,255,0.35);margin-top:.15rem; }
        .btn-x { width:30px;height:30px;border-radius:50%;border:1px solid rgba(255,255,255,0.1);background:rgba(255,255,255,0.04);color:rgba(255,255,255,0.35);cursor:pointer;display:flex;align-items:center;justify-content:center;transition:all .15s;flex-shrink:0; }
        .btn-x:hover { background:rgba(255,255,255,0.1);color:var(--white);transform:rotate(90deg);border-color:rgba(255,255,255,0.25); }

        .f-label { font-size:.72rem;font-weight:700;color:rgba(201,168,76,0.8);display:flex;align-items:center;gap:.4rem;margin-bottom:.4rem;letter-spacing:.05em; }
        .f-wrap { position:relative;margin-bottom:1rem; }
        .f-ico-r { position:absolute;right:.85rem;top:50%;transform:translateY(-50%);color:rgba(201,168,76,0.4);pointer-events:none; }
        .f-ico-l { position:absolute;left:.85rem;top:50%;transform:translateY(-50%);color:rgba(255,255,255,0.25);cursor:pointer;background:none;border:none;padding:0;display:flex;align-items:center;transition:color .15s; }
        .f-ico-l:hover { color:var(--gold); }
        .f-input { width:100%;height:46px;padding:0 2.6rem;box-sizing:border-box;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.1);border-radius:.6rem;color:var(--white);font-size:.88rem;outline:none;transition:border-color .2s,box-shadow .2s; }
        .f-input::placeholder { color:rgba(255,255,255,0.18); }
        .f-input:focus { border-color:rgba(201,168,76,0.5);box-shadow:0 0 0 3px rgba(201,168,76,0.08),0 0 12px rgba(201,168,76,0.1);background:rgba(201,168,76,0.04); }
        .btn-sub {
          width:100%;height:48px;margin-top:.5rem;
          background:linear-gradient(135deg,var(--gold-light),var(--gold),var(--gold-dim));
          color:var(--black);font-size:.92rem;font-weight:800;border:none;border-radius:.6rem;cursor:pointer;
          letter-spacing:.06em;box-shadow:0 4px 0 var(--gold-dim),0 8px 24px rgba(201,168,76,0.3);
          display:flex;align-items:center;justify-content:center;gap:.5rem;transition:all .2s;position:relative;overflow:hidden;
        }
        .btn-sub::after { content:'';position:absolute;inset:0;background:linear-gradient(135deg,rgba(255,255,255,0.15) 0%,transparent 60%);border-radius:.6rem;pointer-events:none; }
        .btn-sub:hover:not(:disabled) { transform:translateY(-2px);box-shadow:0 6px 0 var(--gold-dim),0 12px 32px rgba(201,168,76,0.45); }
        .btn-sub:active:not(:disabled) { transform:translateY(2px);box-shadow:0 1px 0 var(--gold-dim); }
        .btn-sub:disabled { opacity:.3;cursor:not-allowed; }

        @media(max-width:768px){
          .lp{justify-content:center;padding:2rem 1.5rem;}
          .hc{align-items:center;text-align:center;}
          .h-title{font-size:2.2rem;text-align:center;}
          .h-desc{text-align:center;}
          .btn-row{justify-content:center;}
          .copy-bar{justify-content:center;}
          .gold-divider{display:none;}
        }
        @media(max-width:480px){
          .h-title{font-size:1.85rem;}
          .btn-primary,.btn-ghost{width:100%;justify-content:center;}
          .btn-row{flex-direction:column;gap:.7rem;width:100%;}
          .logo-ring{width:72px;height:72px;}
          .logo-ring img{width:52px;height:52px;}
          .logo-brand{font-size:1.55rem;}
        }
      `}</style>

      <div className="lp">
        <div className="hc">
          <div className="fu1 logo-wrap">
            <div className="logo-ring">
              <img src="/logo.jpg" alt="Caprina" />
            </div>
            <div className="logo-text-block">
              <span className="logo-brand">CAPRINA</span>
              <span className="logo-sub">Operations System</span>
            </div>
          </div>

          <div className="fu2 gold-divider" />

          <div className="fu2">
            <h1 className="h-title">
              مرحباً بك في<br />
              <span className="g">مركز العمليات</span>
            </h1>
          </div>

          <div className="fu3">
            <p className="h-desc">نظام متكامل لإدارة الطلبيات والعمليات وتنفيذها على نطاق واسع</p>
          </div>

          <div className="fu3">
            <span className="tagline">WIN OR DIE</span>
          </div>

          <div className="fu4 btn-row">
            <button className="btn-primary" onClick={() => setShowForm(true)}>
              <LogIn size={18} /> تسجيل الدخول
            </button>
            <a href="https://caprinaeg.com" target="_blank" rel="noopener noreferrer" className="btn-ghost">
              <ExternalLink size={18} /> الموقع الرئيسي
            </a>
          </div>

          <div className="fu5 copy-bar">
            <div className="copy-line" />
            <span className="copy-text">جميع الحقوق محفوظة &copy; CAPRINA 2026</span>
            <div className="copy-line r" />
          </div>
        </div>
      </div>

      {showForm && (
        <div className="ov" onClick={() => setShowForm(false)}>
          <div className="card" onClick={e => e.stopPropagation()}>
            <div className="card-top-line" />
            <div className="card-head">
              <div className="card-head-left">
                <div className="card-icon"><ShieldCheck size={19} /></div>
                <div>
                  <div className="card-title">تسجيل الدخول</div>
                  <div className="card-sub">أدخل بياناتك للمتابعة إلى لوحة التحكم</div>
                </div>
              </div>
              <button className="btn-x" onClick={() => setShowForm(false)}><X size={13} /></button>
            </div>
            <form onSubmit={handleSubmit}>
              <label className="f-label"><UserCircle2 size={12} /> اسم المستخدم</label>
              <div className="f-wrap">
                <UserCircle2 className="f-ico-r" size={15} />
                <input className="f-input" value={username} onChange={e => setUsername(e.target.value)}
                  placeholder="أدخل اسم المستخدم" autoComplete="username" autoFocus />
              </div>
              <label className="f-label"><ShieldCheck size={12} /> كلمة المرور</label>
              <div className="f-wrap">
                <Fingerprint className="f-ico-r" size={15} />
                <input className="f-input" type={showPassword ? "text" : "password"}
                  value={password} onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••" autoComplete="current-password" style={{ paddingLeft: "2.6rem" }} />
                <button type="button" className="f-ico-l" onClick={() => setShowPassword(v => !v)}>
                  {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
              <button type="submit" className="btn-sub" disabled={loading || !username.trim() || !password}>
                {loading ? <>جاري التحقق...</> : <><LogIn size={17} /> دخول آمن</>}
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
