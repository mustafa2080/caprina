import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Download, FileSpreadsheet, Package, Truck, Users,
  DatabaseBackup, Loader2, CheckCircle2, ShoppingCart,
} from "lucide-react";

interface ExportItem {
  key: string;
  label: string;
  desc: string;
  icon: any;
  color: string;
  endpoint: string;
  adminOnly?: boolean;
}

const EXPORTS: ExportItem[] = [
  {
    key: "orders",
    label: "الطلبات",
    desc: "كل الطلبات النشطة مع بيانات الشحن والأسعار",
    icon: ShoppingCart,
    color: "border-primary/40 bg-primary/5 text-primary",
    endpoint: "/api/export/orders",
  },
  {
    key: "products",
    label: "المنتجات والمخزون",
    desc: "المنتجات والـ SKUs مع الأسعار والكميات",
    icon: Package,
    color: "border-amber-700/40 bg-amber-900/5 text-amber-400",
    endpoint: "/api/export/products",
  },
  {
    key: "shipping",
    label: "شركات الشحن",
    desc: "بيانات شركات الشحن المسجلة",
    icon: Truck,
    color: "border-blue-700/40 bg-blue-900/5 text-blue-400",
    endpoint: "/api/export/shipping",
  },
  {
    key: "users",
    label: "المستخدمين",
    desc: "قائمة المستخدمين والأدوار (بدون كلمات مرور)",
    icon: Users,
    color: "border-purple-700/40 bg-purple-900/5 text-purple-400",
    endpoint: "/api/export/users",
    adminOnly: true,
  },
];

const BACKUP: ExportItem = {
  key: "backup",
  label: "نسخة احتياطية كاملة",
  desc: "كل البيانات في ملف Excel واحد — طلبات، منتجات، SKUs، شحن، مستخدمين",
  icon: DatabaseBackup,
  color: "border-emerald-600/50 bg-emerald-900/10 text-emerald-400",
  endpoint: "/api/export/backup",
  adminOnly: true,
};

export default function ExportPage() {
  const { isAdmin } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState<Record<string, boolean>>({});
  const [done, setDone] = useState<Record<string, boolean>>({});

  const handleExport = async (item: ExportItem) => {
    if (loading[item.key]) return;
    setLoading(l => ({ ...l, [item.key]: true }));
    setDone(d => ({ ...d, [item.key]: false }));

    try {
      const token = localStorage.getItem("caprina_token");
      const res = await fetch(item.endpoint, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "فشل التصدير" }));
        throw new Error(err.error || "فشل التصدير");
      }

      // Extract filename from Content-Disposition header
      const disposition = res.headers.get("Content-Disposition") ?? "";
      const match = disposition.match(/filename\*?=(?:UTF-8'')?([^;]+)/i);
      const rawName = match?.[1] ?? item.label;
      const filename = decodeURIComponent(rawName.replace(/"/g, "")) + ".xlsx";

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);

      setDone(d => ({ ...d, [item.key]: true }));
      toast({ title: `✅ تم تصدير ${item.label}` });
      setTimeout(() => setDone(d => ({ ...d, [item.key]: false })), 3000);
    } catch (e: any) {
      toast({ title: "خطأ", description: e.message, variant: "destructive" });
    } finally {
      setLoading(l => ({ ...l, [item.key]: false }));
    }
  };

  const visibleExports = EXPORTS.filter(e => !e.adminOnly || isAdmin);

  return (
    <div className="max-w-2xl mx-auto space-y-6 animate-in fade-in duration-500" dir="rtl">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-black flex items-center gap-2">
          <Download className="w-6 h-6 text-primary" />
          تصدير البيانات
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          صدّر بياناتك إلى ملفات Excel جاهزة للاستخدام
        </p>
      </div>

      {/* Individual exports */}
      <div className="space-y-2">
        <p className="text-xs text-muted-foreground font-bold uppercase tracking-wider mb-3">تصدير حسب القسم</p>
        {visibleExports.map(item => {
          const Icon = item.icon;
          const isLoading = loading[item.key];
          const isDone = done[item.key];
          return (
            <Card key={item.key} className={`border-2 transition-all ${item.color}`}>
              <CardContent className="p-4">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-lg bg-background/30 flex items-center justify-center shrink-0">
                    <Icon className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-sm text-foreground">{item.label}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{item.desc}</p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="shrink-0 gap-1.5 border-current text-current hover:bg-background/30 min-w-[90px]"
                    onClick={() => handleExport(item)}
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <><Loader2 className="w-3.5 h-3.5 animate-spin" />جاري...</>
                    ) : isDone ? (
                      <><CheckCircle2 className="w-3.5 h-3.5" />تم</>
                    ) : (
                      <><FileSpreadsheet className="w-3.5 h-3.5" />تصدير</>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Full Backup — admin only */}
      {isAdmin && (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground font-bold uppercase tracking-wider mb-3">نسخة احتياطية</p>
          <Card className={`border-2 transition-all ${BACKUP.color}`}>
            <CardContent className="p-5">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-xl bg-background/30 flex items-center justify-center shrink-0">
                  <DatabaseBackup className="w-6 h-6 text-emerald-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-black text-base text-foreground">{BACKUP.label}</p>
                  <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{BACKUP.desc}</p>
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {["الطلبات","المنتجات","SKUs","الشحن","المستخدمين","إحصائيات"].map(tag => (
                      <span key={tag} className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-800/40">{tag}</span>
                    ))}
                  </div>
                </div>
              </div>
              <Button
                className="w-full mt-4 gap-2 font-bold bg-emerald-600 hover:bg-emerald-500 text-white"
                onClick={() => handleExport(BACKUP)}
                disabled={loading[BACKUP.key]}
              >
                {loading[BACKUP.key] ? (
                  <><Loader2 className="w-4 h-4 animate-spin" />جاري إنشاء النسخة...</>
                ) : done[BACKUP.key] ? (
                  <><CheckCircle2 className="w-4 h-4" />تم التنزيل</>
                ) : (
                  <><Download className="w-4 h-4" />تنزيل النسخة الاحتياطية الكاملة</>
                )}
              </Button>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
