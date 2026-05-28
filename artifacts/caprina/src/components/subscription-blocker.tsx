import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import {
  ShieldAlert, RefreshCw, Phone, CreditCard,
  Building2, MessageCircle, LogOut, Lock,
} from "lucide-react";

/* ─── طرق الدفع — عدّل البيانات حسب حاجتك ─────────────────────────── */
const RENEWAL_METHODS = [
  {
    icon: Phone,
    label: "فودافون كاش",
    detail: "01xxxxxxxxx",
    color: "#ef4444",
    glow: "hsl(0 70% 50% / 0.4)",
    from: "hsl(0 70% 25% / 0.25)",
    to: "hsl(0 70% 15% / 0.06)",
    border: "hsl(0 70% 50% / 0.35)",
  },
  {
    icon: CreditCard,
    label: "إنستا باي",
    detail: "01xxxxxxxxx",
    color: "#3b82f6",
    glow: "hsl(217 91% 60% / 0.4)",
    from: "hsl(217 91% 25% / 0.25)",
    to: "hsl(217 91% 15% / 0.06)",
    border: "hsl(217 91% 60% / 0.35)",
  },
  {
    icon: Building2,
    label: "تحويل بنكي",
    detail: "بنك مصر — xxxx",
    color: "#10b981",
    glow: "hsl(160 84% 39% / 0.4)",
    from: "hsl(160 84% 20% / 0.25)",
    to: "hsl(160 84% 12% / 0.06)",
    border: "hsl(160 84% 39% / 0.35)",
  },
  {
    icon: MessageCircle,
    label: "واتساب",
    detail: "تواصل معنا مباشرة",
    color: "#22c55e",
    glow: "hsl(142 71% 45% / 0.4)",
    from: "hsl(142 71% 20% / 0.25)",
    to: "hsl(142 71% 12% / 0.06)",
    border: "hsl(142 71% 45% / 0.35)",
  },
];

/* ─── أيقونة النبض ────────────────────────────────────────────────── */
function PulseIcon() {
  return (
    <div className="relative flex items-center justify-center w-24 h-24 mx-auto mb-6">
      {/* حلقات النبض */}
      {[1, 2, 3].map((i) => (
        <span
          key={i}
          className="absolute inset-0 rounded-full border-2 border-rose-500/40"
          style={{
            animation: `ping 2s cubic-bezier(0,0,0.2,1) ${i * 0.4}s infinite`,
            opacity: 0,
          }}
        />
      ))}
      {/* الأيقونة */}
      <div
        className="w-20 h-20 rounded-full flex items-center justify-center z-10"
        style={{
          background: "linear-gradient(135deg, hsl(0 70% 20% / 0.6), hsl(0 70% 10% / 0.3))",
          border: "2px solid hsl(0 70% 50% / 0.5)",
          boxShadow: "0 0 30px hsl(0 70% 50% / 0.4), 0 0 60px hsl(0 70% 50% / 0.15), inset 0 1px 0 hsl(255 255% 255% / 0.08)",
        }}
      >
        <ShieldAlert className="w-9 h-9 text-rose-500" />
      </div>
    </div>
  );
}

/* ─── الـ Overlay الرئيسي ──────────────────────────────────────────── */
export function SubscriptionBlocker() {
  const { user, logout } = useAuth();
  const [checking, setChecking] = useState(false);
  const [visible, setVisible] = useState(false);

  const isSuspended = user?.planStatus === "suspended";
  const isExpired   = user?.planStatus === "expired";
  const shouldBlock = !!user && user.role !== "super_admin" && (isSuspended || isExpired);

  /* fade-in عند الظهور */
  useEffect(() => {
    if (shouldBlock) {
      const t = setTimeout(() => setVisible(true), 50);
      return () => clearTimeout(t);
    } else {
      setVisible(false);
    }
  }, [shouldBlock]);

  if (!shouldBlock) return null;

  const handleCheck = async () => {
    setChecking(true);
    await new Promise((r) => setTimeout(r, 1200));
    window.location.reload();
  };

  return (
    <div
      dir="rtl"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "1rem",
        /* الخلفية الضبابية */
        backdropFilter: "blur(20px) saturate(180%)",
        WebkitBackdropFilter: "blur(20px) saturate(180%)",
        background: "hsl(222 47% 5% / 0.92)",
        opacity: visible ? 1 : 0,
        transition: "opacity 0.4s ease",
      }}
    >
      {/* توهج خلفي ديكوراتيف */}
      <div style={{
        position: "absolute", top: "20%", left: "50%", transform: "translateX(-50%)",
        width: "600px", height: "300px", borderRadius: "50%",
        background: "radial-gradient(ellipse, hsl(0 70% 50% / 0.08) 0%, transparent 70%)",
        pointerEvents: "none",
      }} />

      {/* البطاقة الرئيسية */}
      <div
        style={{
          width: "100%",
          maxWidth: "460px",
          borderRadius: "1.5rem",
          background: "linear-gradient(160deg, hsl(222 47% 9% / 0.95) 0%, hsl(222 47% 6% / 0.98) 100%)",
          border: "1px solid hsl(0 70% 50% / 0.2)",
          boxShadow: [
            "0 0 0 1px hsl(0 70% 50% / 0.08)",
            "0 8px 40px hsl(0 0% 0% / 0.5)",
            "0 0 80px hsl(0 70% 50% / 0.08)",
            "inset 0 1px 0 hsl(255 255% 255% / 0.05)",
          ].join(", "),
          padding: "2rem",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* خط ديكوراتيف علوي */}
        <div style={{
          position: "absolute", top: 0, left: "20%", right: "20%", height: "1px",
          background: "linear-gradient(90deg, transparent, hsl(0 70% 50% / 0.5), transparent)",
        }} />

        {/* الأيقونة */}
        <PulseIcon />

        {/* العنوان */}
        <div className="text-center mb-6">
          <h1 style={{
            fontSize: "1.5rem", fontWeight: 900,
            background: "linear-gradient(135deg, #f87171, #ef4444)",
            WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
            marginBottom: "0.5rem",
          }}>
            {isSuspended ? "🔒 تم إيقاف الاشتراك" : "⏳ انتهى اشتراكك"}
          </h1>
          <p style={{ fontSize: "0.8rem", color: "hsl(var(--muted-foreground))", lineHeight: 1.6 }}>
            {user?.displayName ? `مرحباً ${user.displayName}، ` : ""}
            {isSuspended
              ? "تم إيقاف حسابك من قِبل المدير. للاستفسار تواصل معنا."
              : "لتفعيل الاشتراك مجدداً والمتابعة في العمل، اختر طريقة الدفع المناسبة."}
          </p>
        </div>

        {/* طرق الدفع — تظهر فقط لو منتهي مش موقوف */}
        {isExpired && (
          <div style={{ marginBottom: "1.25rem", display: "flex", flexDirection: "column", gap: "0.625rem" }}>
            {RENEWAL_METHODS.map((m) => (
              <div
                key={m.label}
                style={{
                  display: "flex", alignItems: "center", gap: "0.75rem",
                  padding: "0.75rem",
                  borderRadius: "0.875rem",
                  background: `linear-gradient(135deg, ${m.from}, ${m.to})`,
                  border: `1px solid ${m.border}`,
                  boxShadow: `0 0 12px ${m.glow}`,
                  cursor: "pointer",
                  transition: "opacity 0.2s",
                }}
                onMouseEnter={e => (e.currentTarget.style.opacity = "0.85")}
                onMouseLeave={e => (e.currentTarget.style.opacity = "1")}
              >
                <div style={{
                  width: "2.25rem", height: "2.25rem", borderRadius: "0.625rem", flexShrink: 0,
                  background: `linear-gradient(135deg, ${m.from}, ${m.to})`,
                  border: `1px solid ${m.border}`,
                  boxShadow: `0 0 10px ${m.glow}`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  <m.icon style={{ width: "1rem", height: "1rem", color: m.color }} />
                </div>
                <div>
                  <p style={{ fontSize: "0.8rem", fontWeight: 700, color: m.color }}>{m.label}</p>
                  <p style={{ fontSize: "0.7rem", color: "hsl(var(--muted-foreground))" }}>{m.detail}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* أزرار الإجراء */}
        <div style={{ display: "flex", gap: "0.625rem" }}>
          <button
            onClick={logout}
            style={{
              flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: "0.4rem",
              padding: "0.625rem",
              borderRadius: "0.75rem",
              background: "hsl(var(--muted) / 0.3)",
              border: "1px solid hsl(var(--border))",
              color: "hsl(var(--muted-foreground))",
              fontSize: "0.8rem", fontWeight: 600, cursor: "pointer",
              transition: "background 0.2s",
            }}
            onMouseEnter={e => (e.currentTarget.style.background = "hsl(var(--muted) / 0.5)")}
            onMouseLeave={e => (e.currentTarget.style.background = "hsl(var(--muted) / 0.3)")}
          >
            <LogOut style={{ width: "0.875rem", height: "0.875rem" }} />
            تسجيل خروج
          </button>

          {isExpired && (
            <button
              onClick={handleCheck}
              disabled={checking}
              style={{
                flex: 2, display: "flex", alignItems: "center", justifyContent: "center", gap: "0.4rem",
                padding: "0.625rem",
                borderRadius: "0.75rem",
                background: checking
                  ? "hsl(var(--primary) / 0.5)"
                  : "linear-gradient(135deg, hsl(var(--primary)), hsl(var(--primary) / 0.8))",
                border: "1px solid hsl(var(--primary) / 0.4)",
                boxShadow: "0 0 16px hsl(var(--primary) / 0.3)",
                color: "hsl(var(--primary-foreground))",
                fontSize: "0.8rem", fontWeight: 700, cursor: checking ? "not-allowed" : "pointer",
                transition: "opacity 0.2s",
              }}
            >
              <RefreshCw style={{
                width: "0.875rem", height: "0.875rem",
                animation: checking ? "spin 1s linear infinite" : "none",
              }} />
              {checking ? "جاري التحقق..." : "تحقق من التفعيل"}
            </button>
          )}
        </div>

        {/* خط ديكوراتيف سفلي */}
        <div style={{
          position: "absolute", bottom: 0, left: "30%", right: "30%", height: "1px",
          background: "linear-gradient(90deg, transparent, hsl(var(--border)), transparent)",
        }} />
      </div>
    </div>
  );
}
