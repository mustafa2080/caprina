import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { auditApi, type AuditLogEntry } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Shield, Search, ChevronDown, ChevronUp, RefreshCw, Filter } from "lucide-react";

const ACTION_LABELS: Record<string, string> = {
  create: "إنشاء",
  update: "تعديل",
  delete: "حذف",
  status_change: "تغيير حالة",
  add_stock: "إضافة مخزون",
  login: "تسجيل دخول",
};

const ACTION_COLORS: Record<string, string> = {
  create:        "border-emerald-300 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400",
  update:        "border-blue-300    dark:border-blue-700    bg-blue-50    dark:bg-blue-900/20    text-blue-700    dark:text-blue-400",
  delete:        "border-red-300     dark:border-red-700     bg-red-50     dark:bg-red-900/20     text-red-700     dark:text-red-400",
  status_change: "border-amber-300   dark:border-amber-700   bg-amber-50   dark:bg-amber-900/20   text-amber-700   dark:text-amber-400",
  add_stock:     "border-purple-300  dark:border-purple-700  bg-purple-50  dark:bg-purple-900/20  text-purple-700  dark:text-purple-400",
  login:         "border-gray-300    dark:border-gray-700    bg-gray-50    dark:bg-gray-900/20    text-gray-600    dark:text-gray-400",
};

const ENTITY_LABELS: Record<string, string> = {
  order: "طلب",
  product: "منتج",
  variant: "متغير",
  user: "مستخدم",
};

function formatDate(d: string) {
  return new Intl.DateTimeFormat("ar-EG", {
    year: "numeric", month: "short", day: "numeric",
    hour: "2-digit", minute: "2-digit",
  }).format(new Date(d));
}

function ChangeDetails({ before, after }: { before: Record<string, unknown> | null; after: Record<string, unknown> | null }) {
  const FIELD_LABELS: Record<string, string> = {
    status: "الحالة", unitPrice: "سعر الوحدة", quantity: "الكمية",
    totalPrice: "الإجمالي", notes: "ملاحظات", returnReason: "سبب الإرجاع",
    partialQuantity: "الكمية الجزئية", role: "الدور", isActive: "الحالة",
    displayName: "الاسم", username: "المستخدم", color: "اللون",
    size: "المقاس", totalQuantity: "الكمية",
  };
  const STATUS_LABELS: Record<string, string> = {
    pending: "قيد الانتظار", in_shipping: "في الشحن", received: "تم التسليم",
    delayed: "متأخر", returned: "مرتجع", partial_received: "تسليم جزئي",
  };

  const translate = (key: string, val: unknown): string => {
    if (val === null || val === undefined) return "—";
    if (key === "status") return STATUS_LABELS[String(val)] || String(val);
    if (key === "isActive") return val ? "مفعل" : "معطل";
    if (typeof val === "number") return String(val);
    return String(val);
  };

  if (!before && !after) return null;
  const keys = Object.keys({ ...before, ...after });
  if (!keys.length) return null;

  return (
    <div className="mt-2 grid grid-cols-1 gap-1">
      {keys.map(key => (
        <div key={key} className="flex items-center gap-2 text-[10px]">
          <span className="text-muted-foreground">{FIELD_LABELS[key] ?? key}:</span>
          {before && before[key] !== undefined && (
            <span className="px-1.5 py-0.5 bg-red-900/20 text-red-400 rounded line-through">{translate(key, before[key])}</span>
          )}
          {after && after[key] !== undefined && (
            <span className="px-1.5 py-0.5 bg-emerald-900/20 text-emerald-400 rounded">{translate(key, after[key])}</span>
          )}
        </div>
      ))}
    </div>
  );
}

export default function AuditLogsPage() {
  const [search, setSearch] = useState("");
  const [entityType, setEntityType] = useState("");
  const [action, setAction] = useState("");
  const [expanded, setExpanded] = useState<Set<number>>(new Set());

  const { data: logs = [], isLoading, refetch, isFetching } = useQuery({
    queryKey: ["audit-logs", search, entityType, action],
    queryFn: () => auditApi.list({ search: search || undefined, entityType: entityType || undefined, action: action || undefined, limit: 200 }),
    staleTime: 30_000,
  });

  const toggleExpand = (id: number) => {
    setExpanded(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  return (
    <div className="p-6 max-w-5xl mx-auto" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-black flex items-center gap-2">
            <Shield className="w-6 h-6 text-primary" /> سجل التعديلات
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">كل عملية تغيير في النظام مسجلة هنا</p>
        </div>
        <Button variant="outline" className="gap-2 h-9 text-sm border-border" onClick={() => refetch()} disabled={isFetching}>
          <RefreshCw className={`w-4 h-4 ${isFetching ? "animate-spin" : ""}`} />
          تحديث
        </Button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            className="pr-9 h-9 text-sm bg-background border-border"
            placeholder="بحث باسم الكيان أو المستخدم..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="w-3.5 h-3.5 text-muted-foreground" />
          <select
            className="h-9 px-3 text-sm bg-background border border-border rounded-md"
            value={entityType}
            onChange={e => setEntityType(e.target.value)}
          >
            <option value="">كل الأنواع</option>
            <option value="order">طلبات</option>
            <option value="product">منتجات</option>
            <option value="variant">متغيرات</option>
            <option value="user">مستخدمون</option>
          </select>
          <select
            className="h-9 px-3 text-sm bg-background border border-border rounded-md"
            value={action}
            onChange={e => setAction(e.target.value)}
          >
            <option value="">كل الأحداث</option>
            {Object.entries(ACTION_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Logs */}
      {isLoading ? (
        <p className="text-muted-foreground text-sm py-8 text-center">جاري التحميل...</p>
      ) : logs.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Shield className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">لا توجد سجلات</p>
        </div>
      ) : (
        <div className="space-y-1.5">
          {logs.map(log => {
            const isExpanded = expanded.has(log.id);
            const hasDetails = log.changesBefore !== null || log.changesAfter !== null;
            return (
              <div key={log.id} className="border border-border rounded-lg overflow-hidden bg-card">
                <button
                  type="button"
                  className="w-full flex items-center gap-3 p-3 text-right hover:bg-muted/10 transition-colors"
                  onClick={() => hasDetails && toggleExpand(log.id)}
                >
                  <Badge variant="outline" className={`text-[10px] font-bold shrink-0 ${ACTION_COLORS[log.action] ?? ""}`}>
                    {ACTION_LABELS[log.action] ?? log.action}
                  </Badge>
                  <span className="text-[10px] text-muted-foreground shrink-0">
                    {ENTITY_LABELS[log.entityType] ?? log.entityType}
                    {log.entityId ? ` #${log.entityId}` : ""}
                  </span>
                  <span className="text-xs text-foreground truncate flex-1 text-right">{log.entityName ?? "—"}</span>
                  <span className="text-[10px] text-muted-foreground shrink-0">{log.userName ?? "—"}</span>
                  <span className="text-[10px] text-muted-foreground shrink-0">{formatDate(log.createdAt)}</span>
                  {hasDetails && (
                    <span className="text-muted-foreground shrink-0">
                      {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                    </span>
                  )}
                </button>
                {isExpanded && hasDetails && (
                  <div className="px-4 pb-3 border-t border-border/50">
                    <ChangeDetails before={log.changesBefore} after={log.changesAfter} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
