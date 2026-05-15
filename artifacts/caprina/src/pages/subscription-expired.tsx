import { useAuth } from "@/contexts/AuthContext";
import { Link } from "wouter";
import { ShieldAlert, RefreshCw, Phone, CreditCard, Building2, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function SubscriptionExpired() {
  const { user, logout } = useAuth();

  const RENEWAL_METHODS = [
    { icon: Phone,        label: "فودافون كاش",   detail: "01xxxxxxxxx",         color: "text-red-500",    bg: "bg-red-500/10"    },
    { icon: CreditCard,   label: "إنستا باي",     detail: "01xxxxxxxxx",         color: "text-blue-500",   bg: "bg-blue-500/10"   },
    { icon: Building2,    label: "تحويل بنكي",    detail: "بنك مصر — xxxx",     color: "text-emerald-500",bg: "bg-emerald-500/10"},
    { icon: MessageCircle,label: "واتساب",         detail: "تواصل معنا مباشرة",  color: "text-green-500",  bg: "bg-green-500/10"  },
  ];

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background" dir="rtl">
      <div className="max-w-md w-full space-y-6">

        {/* الأيقونة الرئيسية */}
        <div className="text-center">
          <div className="w-20 h-20 rounded-full bg-rose-500/10 border-2 border-rose-500/30 flex items-center justify-center mx-auto mb-4 animate-pulse">
            <ShieldAlert className="w-10 h-10 text-rose-500" />
          </div>
          <h1 className="text-2xl font-black text-rose-500 mb-2">انتهى اشتراكك</h1>
          <p className="text-muted-foreground text-sm">
            {user?.displayName ? `مرحباً ${user.displayName}، ` : ""}
            لتفعيل الاشتراك مجدداً والمتابعة في العمل، اختر طريقة الدفع المناسبة لك
          </p>
        </div>

        {/* طرق التجديد */}
        <div className="rounded-2xl border border-border bg-card p-5 space-y-3">
          <h2 className="text-sm font-bold text-center mb-4">🔄 طرق تجديد الاشتراك</h2>
          {RENEWAL_METHODS.map((m) => (
            <div key={m.label}
              className={`flex items-center gap-3 p-3 rounded-xl border border-border ${m.bg} cursor-pointer hover:opacity-80 transition-opacity`}>
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${m.bg}`}>
                <m.icon className={`w-4 h-4 ${m.color}`} />
              </div>
              <div>
                <p className={`text-sm font-bold ${m.color}`}>{m.label}</p>
                <p className="text-xs text-muted-foreground">{m.detail}</p>
              </div>
            </div>
          ))}
        </div>

        {/* الخطوات */}
        <div className="rounded-2xl border border-border bg-card p-5">
          <h2 className="text-sm font-bold mb-3">📋 خطوات التجديد</h2>
          <ol className="space-y-2 text-sm text-muted-foreground">
            <li className="flex gap-2"><span className="font-bold text-primary">١.</span> اختر الخطة والمدة المناسبة</li>
            <li className="flex gap-2"><span className="font-bold text-primary">٢.</span> حوّل المبلغ بإحدى الطرق أعلاه</li>
            <li className="flex gap-2"><span className="font-bold text-primary">٣.</span> أرسل إيصال الدفع على واتساب</li>
            <li className="flex gap-2"><span className="font-bold text-primary">٤.</span> سيتم تفعيل اشتراكك خلال دقائق</li>
          </ol>
        </div>

        {/* أزرار */}
        <div className="flex gap-2">
          <Button variant="outline" className="flex-1" onClick={logout}>
            تسجيل خروج
          </Button>
          <Button className="flex-1 gap-2" onClick={() => window.location.reload()}>
            <RefreshCw className="w-4 h-4" />
            تحقق من التفعيل
          </Button>
        </div>

      </div>
    </div>
  );
}
