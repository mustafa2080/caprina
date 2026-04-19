import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { UserCheck, TrendingUp, TrendingDown, Package, RotateCcw, Clock, Trophy } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { teamAnalyticsApi, type TeamMemberStats } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";

const fmt = (n: number) =>
  new Intl.NumberFormat("ar-EG", { style: "currency", currency: "EGP", maximumFractionDigits: 0 }).format(n);
const fmtNum = (n: number) => new Intl.NumberFormat("ar-EG").format(n);

const SOURCE_LABELS: Record<string, string> = {
  facebook: "فيسبوك", tiktok: "تيك توك", instagram: "إنستجرام",
  organic: "عضوي", whatsapp: "واتساب", other: "أخرى",
};

function StatBar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className="w-full bg-muted/30 rounded-full h-1.5 overflow-hidden">
      <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

function MemberCard({ member, rank, maxProfit, showProfit }: { member: TeamMemberStats; rank: number; maxProfit: number; showProfit: boolean }) {
  const isTopPerformer = rank === 1 && member.userId !== 0;
  return (
    <Card className={`border-border bg-card ${isTopPerformer ? "border-yellow-700/60" : ""}`}>
      <CardHeader className="pb-2 pt-4 px-4">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0
              ${rank === 1 ? "bg-yellow-500/20 text-yellow-600 dark:text-yellow-400" : rank === 2 ? "bg-muted/40 text-muted-foreground" : rank === 3 ? "bg-orange-500/20 text-orange-700 dark:text-orange-500" : "bg-muted/20 text-muted-foreground"}`}>
              {rank === 1 ? <Trophy className="w-3.5 h-3.5" /> : `#${rank}`}
            </div>
            <div>
              <p className="text-sm font-bold">{member.displayName}</p>
              {member.userName !== member.displayName && (
                <p className="text-[10px] text-muted-foreground">@{member.userName}</p>
              )}
            </div>
          </div>
          {showProfit && (
            <Badge
              variant="outline"
              className={`text-[9px] font-bold ${member.profit >= 0 ? "border-emerald-500 text-emerald-700 dark:border-emerald-800 dark:text-emerald-400" : "border-red-500 text-red-700 dark:border-red-800 dark:text-red-400"}`}
            >
              {fmt(member.profit)}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="px-4 pb-4 space-y-3">
        {showProfit && <StatBar value={member.profit >= 0 ? member.profit : 0} max={Math.max(maxProfit, 1)} color="bg-emerald-500" />}

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

        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
            <TrendingUp className="w-3 h-3" />
            <span>نسبة التسليم: <strong>{member.deliveryRate}%</strong></span>
          </div>
          <div className="flex items-center gap-1 text-red-600 dark:text-red-400">
            <RotateCcw className="w-3 h-3" />
            <span>نسبة الرجوع: <strong>{member.returnRate}%</strong></span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function TeamPerformancePage() {
  const { isAdmin, canViewFinancials } = useAuth();
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const { data: members = [], isLoading } = useQuery({
    queryKey: ["team-performance", dateFrom, dateTo],
    queryFn: () => teamAnalyticsApi.teamPerformance(dateFrom || undefined, dateTo || undefined),
  });

  const totalRevenue = members.reduce((s, m) => s + Math.max(m.profit, 0), 0);
  const totalOrders = members.reduce((s, m) => s + m.total, 0);
  const totalDelivered = members.reduce((s, m) => s + m.delivered, 0);
  const totalReturned = members.reduce((s, m) => s + m.returned, 0);

  const assignedMembers = members.filter(m => m.userId !== 0);
  const unassigned = members.find(m => m.userId === 0);
  const maxProfit = Math.max(...assignedMembers.map(m => m.profit), 0);

  return (
    <div className="space-y-5 animate-in fade-in duration-500">
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
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "إجمالي الطلبات", value: fmtNum(totalOrders), icon: Package, color: "text-primary", adminOnly: false },
          { label: "مُسلَّم", value: fmtNum(totalDelivered), icon: TrendingUp, color: "text-emerald-600 dark:text-emerald-400", adminOnly: false },
          { label: "مُرتجَع", value: fmtNum(totalReturned), icon: TrendingDown, color: "text-red-600 dark:text-red-400", adminOnly: false },
          { label: "إجمالي الربح", value: fmt(members.reduce((s, m) => s + m.profit, 0)), icon: Trophy, color: "text-yellow-600 dark:text-yellow-400", adminOnly: true },
        ].filter(c => !c.adminOnly || canViewFinancials).map(card => (
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

      {isLoading && <p className="text-center text-muted-foreground text-sm py-12">جاري التحميل...</p>}

      {!isLoading && assignedMembers.length === 0 && (
        <div className="text-center py-16 text-muted-foreground">
          <UserCheck className="w-10 h-10 mx-auto mb-3 opacity-20" />
          <p className="text-sm">لم يتم تسند طلبات لأعضاء الفريق بعد.</p>
          <p className="text-xs mt-1">قم بإسناد الطلبات للموظفين من صفحة تفاصيل الطلب.</p>
        </div>
      )}

      {assignedMembers.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {assignedMembers.map((m, i) => (
            <MemberCard key={m.userId} member={m} rank={i + 1} maxProfit={maxProfit} showProfit={canViewFinancials} />
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
                  <Badge variant="outline" className={`text-[10px] ${unassigned.profit >= 0 ? "text-emerald-700 dark:text-emerald-400 border-emerald-500 dark:border-emerald-800" : "text-red-700 dark:text-red-400 border-red-500 dark:border-red-800"}`}>
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
