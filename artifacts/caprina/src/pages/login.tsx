import { useState, useEffect } from "react";
import { authApi } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { Eye, EyeOff, ShieldCheck, UserCircle2, Fingerprint, X, LogIn, ExternalLink, Check, MessageCircle, Mail, Zap, Building2, Rocket, Crown, Download, Smartphone } from "lucide-react";

const DEFAULT_PLANS = [
  {
    key: "free_trial",
    icon: Zap,
    label: "تجريبي",
    monthlyPrice: null as number | null,
    yearlyPrice: null as number | null,
    yearlySaving: null as number | null,
    priceDisplay: "مجاناً",
    period: "14 يوم",
    highlight: false,
    features: ["100 طلب", "20 منتج", "2 مستخدمين", "دعم أساسي"],
  },  {
    key: "starter",
    icon: Rocket,
    label: "أساسي",
    monthlyPrice: 199,
    yearlyPrice: 1990,
    yearlySaving: 398,
    priceDisplay: "١٩٩",
    period: "شهرياً",
    highlight: false,
    features: ["2,000 طلب", "100 منتج", "5 مستخدمين", "تقارير متقدمة", "دعم أولوية"],
  },
  {
    key: "pro",
    icon: Crown,
    label: "احترافي",
    monthlyPrice: 399,
    yearlyPrice: 3990,
    yearlySaving: 798,
    priceDisplay: "٣٩٩",
    period: "شهرياً",
    highlight: true,
    badge: "الأكثر طلباً",
    features: ["طلبات غير محدودة", "999 منتج", "20 مستخدم", "تحليلات ذكية", "إدارة مخازن", "دعم 24/7"],
  },
  {
    key: "enterprise",
    icon: Building2,
    label: "مؤسسي",
    monthlyPrice: null as number | null,
    yearlyPrice: null as number | null,
    yearlySaving: null as number | null,
    priceDisplay: "تواصل معنا",
    period: "",
    highlight: false,
    features: ["غير محدود بالكامل", "99 مستخدم", "API مخصص", "تدريب الفريق", "مدير حساب مخصص"],
  },
];

type PlanPrices = Record<string, {
  monthlyPrice: number | null;
  yearlyPrice: number | null;
  yearlySaving: number | null;
  priceDisplay: string;
  period: string;
}>;


export default function Login() {
  const { login } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [showPricing, setShowPricing] = useState(false);
  const [billingYearly, setBillingYearly] = useState(false);
  const [planPrices, setPlanPrices] = useState<PlanPrices | null>(null);

  // PWA install
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [pwaInstalled, setPwaInstalled] = useState(false);
  const [pwaInstalling, setPwaInstalling] = useState(false);

  useEffect(() => {
    const handler = (e: Event) => { e.preventDefault(); setDeferredPrompt(e); };
    window.addEventListener("beforeinstallprompt", handler);
    window.addEventListener("appinstalled", () => { setPwaInstalled(true); setDeferredPrompt(null); });
    // لو فعلاً مثبت كـ PWA
    if (window.matchMedia("(display-mode: standalone)").matches) setPwaInstalled(true);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const handleInstallPwa = async () => {
    if (!deferredPrompt) return;
    setPwaInstalling(true);
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") { setPwaInstalled(true); setDeferredPrompt(null); }
    setPwaInstalling(false);
  };

  // جلب الأسعار من الـ API عند فتح الصفحة
  useEffect(() => {
    fetch("/api/public/plan-prices")
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data) setPlanPrices(data); })
      .catch(() => {});
  }, []);

  // دمج الأسعار الديناميكية مع الـ default plans
  const PLANS = DEFAULT_PLANS.map(plan => {
    if (!planPrices || !planPrices[plan.key]) return plan;
    const p = planPrices[plan.key];
    return {
      ...plan,
      monthlyPrice: p.monthlyPrice,
      yearlyPrice: p.yearlyPrice,
      yearlySaving: p.yearlySaving,
      priceDisplay: p.priceDisplay,
      period: p.period,
    };
  });

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
        .lp{position:fixed;inset:0;z-index:10;display:flex;align-items:center;justify-content:flex-start;padding:0 8vw;direction:rtl;}
        .hc{max-width:500px;width:100%;display:flex;flex-direction:column;align-items:flex-start;background:linear-gradient(145deg,rgba(9,8,7,0.45) 0%,rgba(18,14,5,0.4) 100%);backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);border:1px solid rgba(201,168,76,0.18);border-radius:1.4rem;padding:2.5rem 2.8rem;box-shadow:0 24px 80px rgba(0,0,0,0.75),0 0 0 1px rgba(201,168,76,0.06),inset 0 1px 0 rgba(201,168,76,0.1);position:relative;overflow:hidden;}
        .hc::before{content:'';position:absolute;top:0;left:15%;right:15%;height:1px;background:linear-gradient(90deg,transparent,var(--gold),rgba(201,168,76,0.5),var(--gold),transparent);}
        .logo-wrap{display:flex;align-items:center;gap:1.1rem;margin-bottom:2.2rem;animation:floatY 5s ease-in-out infinite;}
        .logo-ring{width:88px;height:88px;border-radius:50%;background:linear-gradient(145deg,#1e1a14,#0d0b08);border:2px solid var(--gold);display:flex;align-items:center;justify-content:center;box-shadow:0 0 0 6px rgba(201,168,76,0.08),0 0 32px rgba(201,168,76,0.3),0 8px 32px rgba(0,0,0,0.7);animation:logoGlow 3s ease-in-out infinite;flex-shrink:0;position:relative;overflow:hidden;}
        .logo-ring::before{content:'';position:absolute;inset:0;border-radius:50%;background:radial-gradient(circle at 35% 30%,rgba(201,168,76,0.15) 0%,transparent 65%);}
        .logo-ring img{width:64px;height:64px;border-radius:50%;object-fit:cover;position:relative;z-index:1;}
        .logo-text-block{display:flex;flex-direction:column;gap:2px;}
        .logo-brand{font-size:1.9rem;font-weight:900;letter-spacing:0.18em;background:linear-gradient(135deg,var(--gold-pale) 0%,var(--gold) 45%,var(--gold-dim) 100%);background-size:200% auto;-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;animation:shimmer 4s linear infinite;line-height:1;}
        .logo-sub{font-size:0.65rem;font-weight:600;letter-spacing:0.35em;color:rgba(201,168,76,0.55);text-transform:uppercase;}
        .gold-divider{width:100%;height:1px;background:linear-gradient(90deg,var(--gold) 0%,rgba(201,168,76,0.1) 100%);margin-bottom:2rem;animation:bglow 3s ease-in-out infinite;}
        .h-title{font-size:clamp(1.9rem,4.5vw,3.2rem);font-weight:900;line-height:1.15;color:var(--white);margin-bottom:.6rem;text-shadow:0 2px 4px rgba(0,0,0,1),0 4px 20px rgba(0,0,0,0.9);letter-spacing:-.01em;}
        .h-title .g{background:linear-gradient(135deg,var(--gold-light) 0%,var(--gold) 50%,var(--gold-dim) 100%);background-size:200% auto;-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;animation:shimmer 3s linear infinite;}
        .h-desc{font-size:1rem;font-weight:500;color:rgba(255,255,255,0.75);line-height:1.8;margin-bottom:.5rem;max-width:400px;text-shadow:0 1px 6px rgba(0,0,0,0.9);}
        .tagline{font-size:.78rem;font-weight:700;letter-spacing:.4em;color:var(--gold-dim);text-transform:uppercase;margin-bottom:2.2rem;display:flex;align-items:center;gap:.7rem;}
        .tagline::before,.tagline::after{content:'';flex:1;max-width:40px;height:1px;background:linear-gradient(90deg,var(--gold-dim),transparent);}
        .tagline::after{background:linear-gradient(270deg,var(--gold-dim),transparent);}
        .btn-row{display:flex;flex-direction:row;gap:.9rem;flex-wrap:wrap;margin-bottom:2.5rem;}
        .btn-primary{display:inline-flex;align-items:center;gap:.6rem;padding:.85rem 2rem;background:linear-gradient(135deg,var(--gold-light) 0%,var(--gold) 50%,var(--gold-dim) 100%);color:var(--black);font-size:.88rem;font-weight:800;border:none;border-radius:.6rem;cursor:pointer;letter-spacing:.04em;box-shadow:0 4px 0 var(--gold-dim),0 8px 28px rgba(201,168,76,0.35);transition:all .2s ease;position:relative;overflow:hidden;text-decoration:none;}
        .btn-primary::after{content:'';position:absolute;inset:0;background:linear-gradient(135deg,rgba(255,255,255,0.18) 0%,transparent 60%);border-radius:.6rem;pointer-events:none;}
        .btn-primary:hover{transform:translateY(-2px);box-shadow:0 6px 0 var(--gold-dim),0 12px 36px rgba(201,168,76,0.5);}
        .btn-primary:active{transform:translateY(2px);box-shadow:0 2px 0 var(--gold-dim);}
        .btn-ghost{display:inline-flex;align-items:center;gap:.6rem;padding:.85rem 2rem;background:transparent;color:var(--white-off);font-size:.88rem;font-weight:700;border:1.5px solid var(--border);border-radius:.6rem;cursor:pointer;letter-spacing:.04em;transition:all .2s ease;text-decoration:none;}
        .btn-ghost:hover{background:rgba(201,168,76,0.08);border-color:rgba(201,168,76,0.6);color:var(--gold-light);transform:translateY(-2px);box-shadow:0 0 24px rgba(201,168,76,0.2);}
        .copy-bar{display:flex;align-items:center;gap:.8rem;width:100%;}
        .copy-line{flex:1;height:1px;background:linear-gradient(90deg,rgba(201,168,76,0.35),transparent);}
        .copy-line.r{background:linear-gradient(270deg,rgba(201,168,76,0.35),transparent);}
        .copy-text{font-size:.72rem;font-weight:900;letter-spacing:.2em;color:rgba(201,168,76,0.6);white-space:nowrap;text-transform:uppercase;}
        .ov{position:fixed;inset:0;z-index:50;display:flex;align-items:center;justify-content:center;padding:1.5rem;background:rgba(6,5,4,0.82);backdrop-filter:blur(16px);animation:fadeIn .2s ease;}
        .card{background:var(--black-card);border:1px solid var(--border);border-radius:1.2rem;padding:2.2rem 2rem;width:100%;max-width:380px;direction:rtl;position:relative;overflow:hidden;box-shadow:0 32px 80px rgba(0,0,0,0.9),0 0 48px rgba(201,168,76,0.06);animation:slideUp .35s cubic-bezier(.22,1,.36,1);}
        .card::before{content:'';position:absolute;left:0;right:0;height:1.5px;background:linear-gradient(90deg,transparent,rgba(201,168,76,0.5),transparent);animation:scanline 5s linear infinite;pointer-events:none;}
        .card-top-line{position:absolute;top:0;left:15%;right:15%;height:1px;background:linear-gradient(90deg,transparent,var(--gold),rgba(201,168,76,0.6),var(--gold),transparent);}
        .card-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:1.8rem;padding-bottom:1.2rem;border-bottom:1px solid rgba(201,168,76,0.12);}
        .card-head-left{display:flex;align-items:center;gap:.75rem;flex-direction:row-reverse;}
        .card-icon{width:40px;height:40px;border-radius:.65rem;background:linear-gradient(135deg,rgba(201,168,76,0.15),rgba(139,105,20,0.08));border:1px solid rgba(201,168,76,0.3);display:flex;align-items:center;justify-content:center;color:var(--gold);flex-shrink:0;}
        .card-title{font-size:1.15rem;font-weight:900;color:var(--white);}
        .card-sub{font-size:.7rem;color:rgba(255,255,255,0.35);margin-top:.15rem;}
        .btn-x{width:30px;height:30px;border-radius:50%;border:1px solid rgba(255,255,255,0.1);background:rgba(255,255,255,0.04);color:rgba(255,255,255,0.35);cursor:pointer;display:flex;align-items:center;justify-content:center;transition:all .15s;flex-shrink:0;}
        .btn-x:hover{background:rgba(255,255,255,0.1);color:var(--white);transform:rotate(90deg);border-color:rgba(255,255,255,0.25);}
        .f-label{font-size:.72rem;font-weight:700;color:rgba(201,168,76,0.8);display:flex;align-items:center;gap:.4rem;margin-bottom:.4rem;letter-spacing:.05em;}
        .f-wrap{position:relative;margin-bottom:1rem;}
        .f-ico-r{position:absolute;right:.85rem;top:50%;transform:translateY(-50%);color:rgba(201,168,76,0.4);pointer-events:none;}
        .f-ico-l{position:absolute;left:.85rem;top:50%;transform:translateY(-50%);color:rgba(255,255,255,0.25);cursor:pointer;background:none;border:none;padding:0;display:flex;align-items:center;transition:color .15s;}
        .f-ico-l:hover{color:var(--gold);}
        .f-input{width:100%;height:46px;padding:0 2.6rem;box-sizing:border-box;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.1);border-radius:.6rem;color:var(--white);font-size:.88rem;outline:none;transition:border-color .2s,box-shadow .2s;}
        .f-input::placeholder{color:rgba(255,255,255,0.18);}
        .f-input:focus{border-color:rgba(201,168,76,0.5);box-shadow:0 0 0 3px rgba(201,168,76,0.08),0 0 12px rgba(201,168,76,0.1);background:rgba(201,168,76,0.04);}
        .btn-sub{width:100%;height:48px;margin-top:.5rem;background:linear-gradient(135deg,var(--gold-light),var(--gold),var(--gold-dim));color:var(--black);font-size:.92rem;font-weight:800;border:none;border-radius:.6rem;cursor:pointer;letter-spacing:.06em;box-shadow:0 4px 0 var(--gold-dim),0 8px 24px rgba(201,168,76,0.3);display:flex;align-items:center;justify-content:center;gap:.5rem;transition:all .2s;position:relative;overflow:hidden;}
        .btn-sub::after{content:'';position:absolute;inset:0;background:linear-gradient(135deg,rgba(255,255,255,0.15) 0%,transparent 60%);border-radius:.6rem;pointer-events:none;}
        .btn-sub:hover:not(:disabled){transform:translateY(-2px);box-shadow:0 6px 0 var(--gold-dim),0 12px 32px rgba(201,168,76,0.45);}
        .btn-sub:active:not(:disabled){transform:translateY(2px);box-shadow:0 1px 0 var(--gold-dim);}
        .btn-sub:disabled{opacity:.3;cursor:not-allowed;}
        @keyframes pwaShine{0%{left:-100%}100%{left:200%}}
        @keyframes pwaPulse{0%,100%{box-shadow:0 0 0 0 rgba(56,189,248,0.5),0 4px 0 #0369a1,0 8px 28px rgba(14,165,233,0.3)}50%{box-shadow:0 0 0 6px rgba(56,189,248,0),0 4px 0 #0369a1,0 8px 28px rgba(14,165,233,0.5)}}
        @keyframes pwaIconBounce{0%,100%{transform:translateY(0)}40%{transform:translateY(-4px)}70%{transform:translateY(-2px)}}
        @keyframes pwaDone{0%{transform:scale(0.5);opacity:0}60%{transform:scale(1.2)}100%{transform:scale(1);opacity:1}}
        .btn-pwa{display:inline-flex;align-items:center;gap:.6rem;padding:.85rem 2rem;background:linear-gradient(135deg,#0ea5e9 0%,#0284c7 50%,#0369a1 100%);color:#fff;font-size:.88rem;font-weight:800;border:none;border-radius:.6rem;cursor:pointer;letter-spacing:.04em;box-shadow:0 4px 0 #0369a1,0 8px 28px rgba(14,165,233,0.35);transition:all .2s ease;position:relative;overflow:hidden;text-decoration:none;}
        .btn-pwa::before{content:'';position:absolute;top:0;left:-100%;width:60%;height:100%;background:linear-gradient(90deg,transparent,rgba(255,255,255,0.25),transparent);animation:pwaShine 2.5s ease-in-out infinite;}
        .btn-pwa::after{content:'';position:absolute;inset:0;background:linear-gradient(135deg,rgba(255,255,255,0.15) 0%,transparent 60%);border-radius:.6rem;pointer-events:none;}
        .btn-pwa:hover{transform:translateY(-2px);box-shadow:0 6px 0 #0369a1,0 12px 36px rgba(14,165,233,0.5);}
        .btn-pwa:active{transform:translateY(2px);box-shadow:0 2px 0 #0369a1;}
        .btn-pwa.installing{animation:pwaPulse 1.2s ease-in-out infinite;cursor:wait;}
        .btn-pwa .pwa-icon{animation:pwaIconBounce 1.8s ease-in-out infinite;}
        .btn-pwa.done{background:linear-gradient(135deg,#22c55e,#16a34a);box-shadow:0 4px 0 #15803d,0 8px 28px rgba(34,197,94,0.35);}
        .btn-pwa.done .pwa-icon{animation:pwaDone .4s cubic-bezier(.22,1,.36,1);}
        @media(max-width:1024px){.lp{padding:0 5vw;}.hc{max-width:460px;}}
        @media(max-width:768px){.lp{justify-content:center;padding:1.5rem 1.2rem;align-items:center;}.hc{align-items:center;text-align:center;padding:2rem 1.8rem;max-width:100%;}.h-title{font-size:2rem;text-align:center;}.h-desc{text-align:center;font-size:.92rem;}.btn-row{justify-content:center;width:100%;}.copy-bar{justify-content:center;}.gold-divider{display:none;}.logo-wrap{margin-bottom:1.6rem;}.tagline{margin-bottom:1.6rem;}}
        @media(max-width:480px){.lp{padding:1rem .9rem;align-items:flex-start;padding-top:2rem;}.hc{padding:1.6rem 1.3rem;}.h-title{font-size:1.65rem;}.h-desc{font-size:.85rem;}.btn-primary,.btn-ghost,.btn-pwa{width:100%;justify-content:center;padding:.8rem 1.2rem;}.btn-row{flex-direction:column;gap:.65rem;width:100%;}.logo-ring{width:68px;height:68px;}.logo-ring img{width:50px;height:50px;}.logo-brand{font-size:1.4rem;}.logo-wrap{gap:.8rem;margin-bottom:1.4rem;}.tagline{font-size:.7rem;margin-bottom:1.4rem;}.copy-bar{gap:.5rem;}.copy-text{font-size:.65rem;letter-spacing:.1em;}}
        @media(max-width:360px){.hc{padding:1.3rem 1rem;}.h-title{font-size:1.45rem;}.logo-ring{width:60px;height:60px;}.logo-ring img{width:44px;height:44px;}.logo-brand{font-size:1.25rem;}}
        @media(min-width:1400px){.lp{padding:0 10vw;}.hc{max-width:560px;}.h-title{font-size:3.5rem;}.h-desc{font-size:1.1rem;}}
        @media(max-width:480px){.ov{padding:.8rem;}.card{padding:1.8rem 1.4rem;border-radius:1rem;}.card-title{font-size:1rem;}.f-input{height:44px;font-size:.85rem;}.btn-sub{height:46px;font-size:.88rem;}}
        .pricing-ov{position:fixed;inset:0;z-index:50;display:flex;align-items:flex-start;justify-content:center;padding:1rem;background:rgba(6,5,4,0.92);backdrop-filter:blur(20px);animation:fadeIn .2s ease;overflow-y:auto;-webkit-overflow-scrolling:touch;min-height:100dvh;}
        .pricing-wrap{width:100%;max-width:1000px;direction:rtl;position:relative;margin:0 auto;padding-bottom:2rem;padding-top:.25rem;}
        .pricing-head{text-align:center;margin-bottom:1.5rem;}
        .pricing-title{font-size:clamp(1.3rem,4vw,1.9rem);font-weight:900;color:var(--white);margin-bottom:.4rem;line-height:1.2;}
        .pricing-title .g{background:linear-gradient(135deg,var(--gold-pale),var(--gold),var(--gold-dim));background-size:200% auto;-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;animation:shimmer 3s linear infinite;}
        .pricing-sub{font-size:clamp(.78rem,.9rem + .2vw,.92rem);color:rgba(255,255,255,0.55);padding:0 1rem;}
        .pricing-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:.85rem;margin-bottom:1.2rem;}
        @media(max-width:900px){.pricing-grid{grid-template-columns:repeat(2,1fr);}}
        @media(max-width:500px){.pricing-grid{grid-template-columns:1fr;gap:.7rem;}}
        .plan-card{background:rgba(18,14,5,0.85);border:1px solid rgba(201,168,76,0.18);border-radius:1rem;padding:1.4rem 1.2rem;display:flex;flex-direction:column;gap:.7rem;position:relative;overflow:hidden;transition:border-color .2s,transform .2s;min-width:0;}
        .plan-card:hover{border-color:rgba(201,168,76,0.5);transform:translateY(-3px);}
        .plan-card.hot{border:1.5px solid var(--gold);background:rgba(201,168,76,0.07);}
        .plan-card.hot::before{content:'';position:absolute;top:0;left:15%;right:15%;height:1px;background:linear-gradient(90deg,transparent,var(--gold),transparent);}
        @media(max-width:500px){.plan-card.hot{order:-1;}}
        .plan-badge{position:absolute;top:-.5px;left:50%;transform:translateX(-50%);background:var(--gold);color:#090807;font-size:.62rem;font-weight:900;letter-spacing:.08em;padding:.22rem .8rem;border-radius:0 0 .5rem .5rem;white-space:nowrap;}
        .plan-icon{width:38px;height:38px;border-radius:.65rem;background:rgba(201,168,76,0.1);border:1px solid rgba(201,168,76,0.25);display:flex;align-items:center;justify-content:center;color:var(--gold);flex-shrink:0;}
        .plan-name{font-size:1rem;font-weight:900;color:var(--white);}
        .plan-price{display:flex;align-items:baseline;gap:.3rem;flex-wrap:wrap;}
        .plan-amount{font-size:clamp(1.5rem,2.5vw,1.9rem);font-weight:900;color:var(--gold);line-height:1;}
        .plan-period{font-size:.72rem;color:rgba(255,255,255,0.4);}
        .plan-divider{height:1px;background:rgba(201,168,76,0.12);}
        .plan-features{display:flex;flex-direction:column;gap:.45rem;flex:1;}
        .plan-feat{display:flex;align-items:center;gap:.45rem;font-size:.78rem;color:rgba(255,255,255,0.75);}
        .plan-feat svg{color:var(--gold);flex-shrink:0;}
        .plan-cta{margin-top:auto;width:100%;padding:.65rem;border-radius:.6rem;font-size:.8rem;font-weight:800;cursor:pointer;border:1.5px solid rgba(201,168,76,0.4);background:transparent;color:var(--gold-light);transition:all .2s;letter-spacing:.04em;display:flex;align-items:center;justify-content:center;gap:.45rem;text-decoration:none;}
        .plan-cta:hover{background:rgba(201,168,76,0.12);border-color:var(--gold);}
        .plan-cta.hot{background:linear-gradient(135deg,var(--gold-light),var(--gold),var(--gold-dim));color:#090807;border:none;box-shadow:0 4px 0 var(--gold-dim);}
        .plan-cta.hot:hover{transform:translateY(-2px);box-shadow:0 6px 0 var(--gold-dim);}
        .pricing-note{text-align:center;font-size:.73rem;color:rgba(255,255,255,0.3);padding:.8rem 1rem 0;line-height:1.7;}
        .pricing-contact{display:flex;align-items:center;justify-content:center;gap:1rem;flex-wrap:wrap;margin-bottom:1rem;}
        .contact-btn{display:flex;align-items:center;gap:.5rem;padding:.55rem 1.2rem;border-radius:.6rem;font-size:.8rem;font-weight:700;cursor:pointer;transition:all .2s;text-decoration:none;white-space:nowrap;}
        .contact-wa{background:#25D366;color:#fff;border:none;}
        .contact-wa:hover{background:#128C7E;}
        .contact-mail{background:transparent;color:var(--gold-light);border:1.5px solid rgba(201,168,76,0.35);}
        .contact-mail:hover{background:rgba(201,168,76,0.1);border-color:var(--gold);}
        .pricing-close-row{display:flex;justify-content:flex-end;margin-bottom:.75rem;padding:.5rem 0;position:sticky;top:0;z-index:10;background:linear-gradient(to bottom,rgba(6,5,4,0.95) 80%,transparent);}
        .billing-toggle{display:flex;align-items:center;justify-content:center;gap:.7rem;margin-bottom:1.3rem;flex-wrap:wrap;}
        .billing-label{font-size:.82rem;font-weight:700;color:rgba(255,255,255,0.45);transition:color .2s;}
        .billing-label.active{color:var(--gold-light);}
        .toggle-track{width:46px;height:25px;border-radius:13px;background:rgba(201,168,76,0.15);border:1px solid rgba(201,168,76,0.35);position:relative;cursor:pointer;transition:background .2s;flex-shrink:0;}
        .toggle-track.on{background:rgba(201,168,76,0.3);}
        .toggle-thumb{width:19px;height:19px;border-radius:50%;background:var(--gold);position:absolute;top:2px;right:2px;transition:transform .25s;box-shadow:0 2px 6px rgba(0,0,0,0.5);}
        .toggle-track.on .toggle-thumb{transform:translateX(-21px);}
        .saving-badge{background:rgba(201,168,76,0.15);border:1px solid rgba(201,168,76,0.3);color:var(--gold-light);font-size:.66rem;font-weight:800;padding:.2rem .6rem;border-radius:.4rem;letter-spacing:.04em;}
        .plan-yearly-info{font-size:.7rem;color:rgba(255,255,255,0.38);margin-top:.1rem;line-height:1.5;}
        .plan-saving{display:inline-block;background:rgba(201,168,76,0.15);border:1px solid rgba(201,168,76,0.25);color:var(--gold);font-size:.66rem;font-weight:800;padding:.15rem .5rem;border-radius:.35rem;margin-top:.2rem;}
        @media(min-width:1400px){.pricing-wrap{max-width:1100px;}.plan-card{padding:1.7rem 1.5rem;}.plan-amount{font-size:2.1rem;}}
        @media(max-width:900px){.pricing-ov{padding:.8rem;}.pricing-title{font-size:1.4rem;}}
        @media(max-width:500px){.pricing-ov{padding:.6rem;}.pricing-wrap{padding-bottom:1.5rem;}.pricing-title{font-size:1.25rem;}.pricing-sub{font-size:.78rem;}.billing-toggle{gap:.5rem;}.billing-label{font-size:.78rem;}.plan-card{padding:1.2rem 1rem;}.plan-amount{font-size:1.6rem;}.contact-btn{font-size:.76rem;padding:.5rem 1rem;}.pricing-note{font-size:.7rem;}}
        @media(max-width:360px){.pricing-ov{padding:.4rem;}.plan-amount{font-size:1.4rem;}.plan-feat{font-size:.74rem;}}
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
            <h1 className="h-title">مرحباً بك في<br /><span className="g">مركز العمليات</span></h1>
          </div>
          <div className="fu3">
            <p className="h-desc">نظام متكامل لإدارة الطلبيات والعمليات وتنفيذها على نطاق واسع</p>
          </div>
          <div className="fu3"><span className="tagline">WIN OR DIE</span></div>
          <div className="fu4 btn-row">
            <button className="btn-primary" onClick={() => setShowForm(true)}>
              <LogIn size={18} /> تسجيل الدخول
            </button>
            <button className="btn-ghost" onClick={() => setShowPricing(true)}>
              <Crown size={18} /> الباقات والأسعار
            </button>
            <a href="https://caprinaeg.com" target="_blank" rel="noopener noreferrer" className="btn-ghost">
              <ExternalLink size={18} /> الموقع الرئيسي
            </a>
            {(deferredPrompt || pwaInstalled) && (
              <button
                className={`btn-pwa${pwaInstalling ? " installing" : ""}${pwaInstalled ? " done" : ""}`}
                onClick={handleInstallPwa}
                disabled={pwaInstalled || pwaInstalling}
              >
                <span className="pwa-icon">
                  {pwaInstalled ? <Check size={18} /> : pwaInstalling ? <Smartphone size={18} /> : <Download size={18} />}
                </span>
                {pwaInstalled ? "تم التثبيت ✓" : pwaInstalling ? "جاري التثبيت..." : "تثبيت التطبيق"}
              </button>
            )}
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

      {showPricing && (
        <div className="pricing-ov" onClick={() => setShowPricing(false)}>
          <div className="pricing-wrap" onClick={e => e.stopPropagation()}>
            <div className="pricing-close-row">
              <button className="btn-x" onClick={() => setShowPricing(false)} style={{ width:36,height:36,flexShrink:0 }}>
                <X size={15} />
              </button>
            </div>
            <div className="pricing-head">
              <h2 className="pricing-title">اختر <span className="g">الباقة المناسبة</span></h2>
              <p className="pricing-sub">جميع الباقات تشمل وصولاً كاملاً للنظام — فقط الحدود تختلف</p>
            </div>
            <div className="billing-toggle">
              <span className={`billing-label${!billingYearly ? " active" : ""}`}>شهري</span>
              <div className={`toggle-track${billingYearly ? " on" : ""}`} onClick={() => setBillingYearly(v => !v)}>
                <div className="toggle-thumb" />
              </div>
              <span className={`billing-label${billingYearly ? " active" : ""}`}>سنوي</span>
              {billingYearly && <span className="saving-badge">🎁 شهرين مجاناً</span>}
            </div>
            <div className="pricing-grid">
              {PLANS.map(plan => {
                const Icon = plan.icon;
                const isYearly = billingYearly && plan.yearlyPrice;
                const displayPrice = isYearly ? plan.yearlyPrice!.toLocaleString("ar-EG") : plan.priceDisplay;
                // free_trial مع سعر → period يكون شهرياً بدل "14 يوم"
                const rawPeriod = (plan.key === "free_trial" && plan.monthlyPrice) ? "شهرياً" : plan.period;
                const displayPeriod = isYearly ? "سنوياً" : rawPeriod;
                // free_trial بدون سعر → ما نعرضش "ج.م" قبل البيريود
                const showCurrency = !(plan.key === "free_trial" && !plan.monthlyPrice);
                const waMsg = encodeURIComponent(`مرحباً، أريد الاشتراك في باقة ${plan.label} ${isYearly ? "السنوية" : "الشهرية"} من نظام Caprina`);
                return (
                  <div key={plan.key} className={`plan-card${plan.highlight ? " hot" : ""}`}>
                    {plan.highlight && <div className="plan-badge">★ {(plan as any).badge}</div>}
                    <div className="plan-icon"><Icon size={18} /></div>
                    <div className="plan-name">{plan.label}</div>
                    <div className="plan-price">
                      <span className="plan-amount">{displayPrice}</span>
                      {displayPeriod && <span className="plan-period">{showCurrency ? "ج.م / " : ""}{displayPeriod}</span>}
                    </div>
                    {isYearly && plan.yearlySaving && (
                      <div>
                        <div className="plan-yearly-info">بدلاً من {(plan.monthlyPrice! * 12).toLocaleString("ar-EG")} ج.م</div>
                        <span className="plan-saving">وفّر {plan.yearlySaving.toLocaleString("ar-EG")} ج.م</span>
                      </div>
                    )}
                    {!isYearly && plan.yearlyPrice && (
                      <div className="plan-yearly-info">السنوي: {plan.yearlyPrice.toLocaleString("ar-EG")} ج.م — وفّر {plan.yearlySaving} ج.م</div>
                    )}
                    <div className="plan-divider" />
                    <div className="plan-features">
                      {plan.features.map(f => (
                        <div key={f} className="plan-feat"><Check size={12} /> {f}</div>
                      ))}
                    </div>
                    <a href={`https://wa.me/201XXXXXXXXX?text=${waMsg}`} target="_blank" rel="noopener noreferrer"
                      className={`plan-cta${plan.highlight ? " hot" : ""}`}>
                      <MessageCircle size={14} />
                      {plan.key === "enterprise" ? "تواصل معنا" : "ابدأ الآن"}
                    </a>
                  </div>
                );
              })}
            </div>
            <div className="pricing-contact">
              <a href="https://wa.me/201XXXXXXXXX" target="_blank" rel="noopener noreferrer" className="contact-btn contact-wa">
                <MessageCircle size={15} /> واتساب
              </a>
              <a href="mailto:info@caprinaeg.com" className="contact-btn contact-mail">
                <Mail size={15} /> info@caprinaeg.com
              </a>
            </div>
            <p className="pricing-note">
              الأسعار بالجنيه المصري · التفعيل خلال 24 ساعة · لا توجد رسوم خفية<br/>
              البيانات محفوظة حتى بعد انتهاء الاشتراك
            </p>
          </div>
        </div>
      )}
    </>
  );
}
