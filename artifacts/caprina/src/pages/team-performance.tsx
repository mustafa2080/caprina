import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  UserCheck, TrendingUp, TrendingDown, Package, RotateCcw,
  Clock, Trophy, Zap, Star, Activity, ChevronDown, ChevronUp,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { teamAnalyticsApi, type TeamMemberExtStats } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";

const fmt = (n: number) =>
  new Intl.NumberFormat("ar-EG", { style: "currency", currency: "EGP", maximumFractionDigits: 0 }).format(n);
const fmtNum = (n: number) => new Intl.NumberFormat("ar-EG").format(n);

const SOURCE_LABELS: Record<string, string> = {
  facebook: "فيسبوك", tiktok: "تيك توك", instagram: "إنستجرام",
  organic: "عضوي", whatsapp: "واتساب", other: "أخرى",
};
const SOURCE_COLORS: Record<string, string> = {
  facebook: "bg-blue-500", tiktok: "bg-pink-500", instagram: "bg-purple-500",
  organic: "bg-green-500", whatsapp: "bg-emerald-500", other: "bg-gray-400",
};

function StatBar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className="w-full bg-muted/30 rounded-full h-1.5 overflow-hidden">
      <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

function SpeedBadge({ hours }: { hours: number | null }) {
  if (hours === null) return null;
  const label = hours <= 12 ? "سريع جداً" : hours <= 24 ? "سريع" : hours <= 48 ? "متوسط" : "بطيء";
  const cls = hours <= 12
    ? "border-emerald-500 text-emerald-700 dark:text-emerald-400"
    : hours <= 24 ? "border-blue-500 text-blue-700 dark:text-blue-400"
    : hours <= 48 ? "border-amber-500 text-amber-700 dark:text-amber-400"
    : "border-red-500 text-red-600 dark:text-red-400";
  return (
    <Badge variant="outline" className={`text-[9px] ${cls}`}>
      <Zap className="w-2.5 h-2.5 mr-0.5" />
      {label} ({hours}س)
    </Badge>
  );
}

function MemberCard({
  member, rank, maxProfit, maxScore, showProfit, expanded, onToggle,
}: {
  member: TeamMemberExtStats; rank: number; maxProfit: number;
  maxScore: number; showProfit: boolean; expanded: boolean; onToggle: () => void;
}) {
  const isTop = rank === 1 && member.userId !== 0;
  const topSrcCount = member.topSource ? (member.sourceCounts[member.topSource] ?? 0) : 0;
  return (
    <Card className={`border-border bg-card transition-all ${isTop ? "border-yellow-700/60" : ""}`}>
      <CardHeader className="pb-2 pt-4 px-4">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0
              ${rank === 1 ? "bg-yellow-500/20 text-yellow-600 dark:text-yellow-400"
              : rank === 2 ? "bg-muted/40 text-muted-foreground"
              : rank === 3 ? "bg-orange-500/20 text-orange-700 dark:text-orange-500"
              : "bg-muted/20 text-muted-foreground"}`}>
              {rank === 1 ? <Trophy className="w-3.5 h-3.5" /> : `#${rank}`}
            </div>
            <div>
              <p className="text-sm font-bold">{member.displayName}</p>
              {member.userName !== member.displayName && (
                <p className="text-[10px] text-muted-foreground">@{member.userName}</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            {showProfit && (
              <Badge variant="outline"
                className={`text-[9px] font-bold ${member.profit >= 0
                  ? "border-emerald-500 text-emerald-700 dark:border-emerald-800 dark:text-emerald-400"
                  : "border-red-500 text-red-700 dark:border-red-800 dark:text-red-400"}`}>
                {fmt(member.profit)}
              </Badge>
            )}
            <Badge variant="secondary" className="text-[9px] gap-0.5">
              <Star className="w-2.5 h-2.5" />{fmtNum(member.score)} نقطة
            </Badge>
          </div>
        </div>
      </CardHeader>

      <CardContent className="px-4 pb-4 space-y-3">
        {/* Score bar */}
        <StatBar value={member.score} max={Math.max(maxScore, 1)} color="bg-primary/70" />

        {/* Main stats grid */}
        <div className="grid grid-cols-4 gap-1 text-center">
          <div className="bg-muted/20 rounded p-2">
            <p className="text-sm font-bold">{fmtNum(member.total)}</p>
            <p className="text-[9px] text-muted-foreground">إجمالي</p>
          </div>
          <div className="bg-emerald-100 dark:bg-emerald-900/20 rounded p-2">
            <p className="text-sm font-bold text-emerald-600 dark:text-emerald-400">{fmtNum(member.delivered)}</p>
            <p className="text-[9px] text-muted-foreground">مُسلَّم</p>
          </div>
          <div className="bg-red-100 dark:bg-red-900/20 rounded p-2">
            <p className="text-sm font-bold text-red-600 dark:text-red-400">{fmtNum(member.returned)}</p>
            <p className="text-[9px] text-muted-foreground">مُرتجَع</p>
          </div>
          <div className="bg-muted/20 rounded p-2">
            <p className="text-sm font-bold text-amber-700 dark:text-amber-400">{fmtNum(member.pending)}</p>
            <p className="text-[9px] text-muted-foreground">معلّق</p>
          </div>
        </div>

        {/* Rates */}
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
            <TrendingUp className="w-3 h-3" />
            <span>تسليم: <strong>{member.deliveryRate}%</strong></span>
          </div>
          <div className="flex items-center gap-1 text-red-600 dark:text-red-400">
            <RotateCcw className="w-3 h-3" />
            <span>رجوع: <strong>{member.returnRate}%</strong></span>
          </div>
          <SpeedBadge hours={member.avgProcessingHours} />
        </div>

        {/* Expand toggle */}
        <button onClick={onToggle}
          className="w-full flex items-center justify-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors py-0.5">
          {expanded ? <><ChevronUp className="w-3 h-3" /> إخفاء التفاصيل</> : <><ChevronDown className="w-3 h-3" /> عرض التفاصيل</>}
        </button>

        {expanded && (
          <div className="space-y-2 pt-1 border-t border-border/40">
            {/* Orders per day */}
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground flex items-center gap-1"><Activity className="w-3 h-3" />متوسط الطلبات/يوم</span>
              <strong>{member.ordersPerDay}</strong>
            </div>
            {/* Processing time */}
            {member.avgProcessingHours !== null && (
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground flex items-center gap-1"><Clock className="w-3 h-3" />متوسط وقت المعالجة</span>
                <strong>{member.avgProcessingHours} ساعة</strong>
              </div>
            )}
            {/* Sources breakdown */}
            {Object.keys(member.sourceCounts).length > 0 && (
              <div className="space-y-1">
                <p className="text-[10px] text-muted-foreground">توزيع المصادر:</p>
                {Object.entries(member.sourceCounts)
                  .sort((a, b) => b[1] - a[1])
                  .map(([src, cnt]) => (
                    <div key={src} className="flex items-center gap-2">
                      <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${SOURCE_COLORS[src] ?? "bg-gray-400"}`} />
                      <span className="text-[10px] text-muted-foreground flex-1">{SOURCE_LABELS[src] ?? src}</span>
                      <span className="text-[10px] font-bold">{cnt}</span>
                      <div className="w-16 bg-muted/30 rounded-full h-1 overflow-hidden">
                        <div className={`h-full rounded-full ${SOURCE_COLORS[src] ?? "bg-gray-400"}`}
                          style={{ width: `${Math.round((cnt / member.total) * 100)}%` }} />
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function TeamPerformancePage() {
  const { canViewFinancials } = useAuth();
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const { data: members = [], isLoading } = useQuery({
    queryKey: ["team-performance-ext", dateFrom, dateTo],
    queryFn: () => teamAnalyticsApi.teamPerformanceExtended(dateFrom || undefined, dateTo || undefined),
  });

  const assignedMembers = members.filter(m => m.userId !== 0);
  const unassigned = members.find(m => m.userId === 0);
  const maxProfit = Math.max(...assignedMembers.map(m => m.profit), 0);
  const maxScore = Math.max(...assignedMembers.map(m => m.score), 0);

  const totalOrders = members.reduce((s, m) => s + m.total, 0);
  const totalDelivered = members.reduce((s, m) => s + m.delivered, 0);
  const totalReturned = members.reduce((s, m) => s + m.returned, 0);
  const totalProfit = members.reduce((s, m) => s + m.profit, 0);
  const avgDeliveryRate = assignedMembers.length > 0
    ? Math.round(assignedMembers.reduce((s, m) => s + m.deliveryRate, 0) / assignedMembers.length) : 0;

  return (
    <div className="space-y-5 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <UserCheck className="w-5 h-5 text-primary" />
            أداء الفريق
          </h1>
          <p className="text-muted-foreground text-xs mt-0.5">تتبع أداء كل موظف وأثره على الإيرادات</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="space-y-0.5">
            <Label className="text-[10px] text-muted-foreground">من</Label>
            <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="h-7 text-xs w-32" />
          </div>
          <div className="space-y-0.5">
            <Label className="text-[10px] text-muted-foreground">إلى</Label>
            <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="h-7 text-xs w-32" />
          </div>
          {(dateFrom || dateTo) && (
            <Button variant="ghost" size="sm" className="h-7 text-xs mt-4"
              onClick={() => { setDateFrom(""); setDateTo(""); }}>
              مسح
            </Button>
          )}
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { label: "إجمالي الطلبات", value: fmtNum(totalOrders), icon: Package, color: "text-primary", show: true },
          { label: "مُسلَّم", value: fmtNum(totalDelivered), icon: TrendingUp, color: "text-emerald-600 dark:text-emerald-400", show: true },
          { label: "مُرتجَع", value: fmtNum(totalReturned), icon: TrendingDown, color: "text-red-600 dark:text-red-400", show: true },
          { label: "متوسط التسليم", value: `${avgDeliveryRate}%`, icon: Activity, color: "text-blue-600 dark:text-blue-400", show: true },
          { label: "إجمالي الربح", value: fmt(totalProfit), icon: Trophy, color: "text-yellow-600 dark:text-yellow-400", show: canViewFinancials },
        ].filter(c => c.show).map(card => (
          <Card key={card.label} className="border-border bg-card">
            <CardContent className="px-4 py-3 flex items-center gap-3">
              <card.icon className={`w-4 h-4 shrink-0 ${card.color}`} />
              <div>
                <p className="text-base font-bold">{card.value}</p>
                <p className="text-[10px] text-muted-foreground">{card.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Score legend */}
      <Card className="border-border/50 bg-muted/10">
        <CardContent className="px-4 py-2.5">
          <p className="text-[10px] text-muted-foreground flex items-center gap-1.5 flex-wrap">
            <Star className="w-3 h-3 text-yellow-500" />
            <strong>نظام النقاط:</strong>
            <span>تسليم = 3 نقطة</span>
            <span className="text-muted-foreground/50">•</span>
            <span>تسليم خلال 24س = نقطتان إضافيتان</span>
            <span className="text-muted-foreground/50">•</span>
            <span>كل 100 جنيه ربح = نقطة</span>
            <span className="text-muted-foreground/50">•</span>
            <span className="text-red-500">مرتجع = ناقص نقطة</span>
          </p>
        </CardContent>
      </Card>

      {isLoading && <p className="text-center text-muted-foreground text-sm py-12">جاري التحميل...</p>}

      {!isLoading && assignedMembers.length === 0 && (
        <div className="text-center py-16 text-muted-foreground">
          <UserCheck className="w-10 h-10 mx-auto mb-3 opacity-20" />
          <p className="text-sm">لم يتم إسناد طلبات لأعضاء الفريق بعد.</p>
          <p className="text-xs mt-1">قم بإسناد الطلبات للموظفين من صفحة تفاصيل الطلب.</p>
        </div>
      )}

      {assignedMembers.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {assignedMembers.map((m, i) => (
            <MemberCard
              key={m.userId}
              member={m}
              rank={i + 1}
              maxProfit={maxProfit}
              maxScore={maxScore}
              showProfit={canViewFinancials}
              expanded={expandedId === m.userId}
              onToggle={() => setExpandedId(expandedId === m.userId ? null : m.userId)}
            />
          ))}
        </div>
      )}

      {unassigned && unassigned.total > 0 && (
        <Card className="border-dashed border-border/50 bg-muted/10">
          <CardContent className="px-4 py-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-muted-foreground" />
                <div>
                  <p className="text-xs font-bold text-muted-foreground">طلبات غير مُسنَدة</p>
                  <p className="text-[10px] text-muted-foreground">{fmtNum(unassigned.total)} طلب لم يُسند لأي موظف</p>
                </div>
              </div>
              <div className="flex items-center gap-3 text-xs">
                <span className="text-emerald-600 dark:text-emerald-400">{fmtNum(unassigned.delivered)} مسلَّم</span>
                <span className="text-red-600 dark:text-red-400">{fmtNum(unassigned.returned)} مرتجع</span>
                {canViewFinancials && (
                  <Badge variant="outline"
                    className={`text-[10px] ${unassigned.profit >= 0
                      ? "text-emerald-700 dark:text-emerald-400 border-emerald-500 dark:border-emerald-800"
                      : "text-red-700 dark:text-red-400 border-red-500 dark:border-red-800"}`}>
                    {fmt(unassigned.profit)}
                  </Badge>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
