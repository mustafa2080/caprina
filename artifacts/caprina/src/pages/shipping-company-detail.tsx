import { useState } from "react";
import { useParams, Link, useLocation } from "wouter";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { shippingApi, manifestsApi, type ShippingManifestListItem } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CreateManifestDialog } from "./shipping-companies";
import {
  ArrowRight, Truck, PackagePlus, FileText, Lock,
  CheckCircle2, RotateCcw, Clock, TrendingUp, TrendingDown,
  ChevronRight, Calendar, Package, Phone, Globe,
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { ar } from "date-fns/locale";

const formatCurrency = (n: number) =>
  new Intl.NumberFormat("ar-EG", {
    style: "currency", currency: "EGP", maximumFractionDigits: 0,
  }).format(n);

function DeliveryBar({ delivered, returned, pending, total }: {
  delivered: number; returned: number; pending: number; total: number;
}) {
  if (total === 0) return null;
  const d = (delivered / total) * 100;
  const r = (returned / total) * 100;
  const p = (pending / total) * 100;
  return (
    <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden flex mt-2">
      <div className="h-1.5 bg-emerald-500" style={{ width: `${d}%` }} />
      <div className="h-1.5 bg-red-500" style={{ width: `${r}%` }} />
      <div className="h-1.5 bg-amber-500" style={{ width: `${p}%` }} />
    </div>
  );
}

function ManifestCard({ m, isLatest }: { m: ShippingManifestListItem & { delivered?: number; returned?: number; pending?: number }; isLatest: boolean }) {
  return (
    <Link href={`/shipping/manifests/${m.id}`}>
      <div className={`group flex items-stretch gap-0 hover:bg-muted/10 transition-colors cursor-pointer rounded-lg border ${m.status === "closed" ? "border-border bg-card/50" : "border-primary/30 bg-primary/5"}`}>
        <div className={`w-1 rounded-r-lg shrink-0 ${m.status === "closed" ? "bg-emerald-500" : "bg-blue-500"}`} />
        <div className="flex-1 px-4 py-3.5">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-black text-sm">{m.manifestNumber}</span>
                {isLatest && m.status === "open" && (
                  <Badge variant="outline" className="text-[9px] border-primary/50 bg-primary/10 text-primary">الأحدث</Badge>
                )}
                {m.notes?.includes("مرحَّل") && (
                  <Badge variant="outline" className="text-[9px] border-amber-700 bg-amber-900/20 text-amber-400">مرحَّل</Badge>
                )}
              </div>
              <div className="flex items-center gap-2 mt-0.5 text-[10px] text-muted-foreground flex-wrap">
                <span className="flex items-center gap-1">
                  <Calendar className="w-2.5 h-2.5" />
                  {format(new Date(m.createdAt), "yyyy/MM/dd")}
                </span>
                {m.closedAt ? (
                  <span className="flex items-center gap-1 text-emerald-600">
                    <Lock className="w-2.5 h-2.5" />
                    أُغلق {format(new Date(m.closedAt), "yyyy/MM/dd")}
                  </span>
                ) : (
                  <span className="text-blue-500">
                    منذ {formatDistanceToNow(new Date(m.createdAt), { locale: ar, addSuffix: false })}
                  </span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Badge
                variant="outline"
                className={`text-[9px] font-bold border ${m.status === "closed"
                  ? "border-emerald-700 bg-emerald-900/20 text-emerald-400"
                  : "border-blue-700 bg-blue-900/20 text-blue-400"}`}
              >
                {m.status === "closed"
                  ? <><Lock className="w-2.5 h-2.5 inline ml-0.5" />مغلق</>
                  : <><Clock className="w-2.5 h-2.5 inline ml-0.5" />مفتوح</>}
              </Badge>
              <ChevronRight className="w-3.5 h-3.5 text-muted-foreground group-hover:text-foreground transition-colors" />
            </div>
          </div>

          <div className="flex items-center gap-3 mt-2 text-[11px] flex-wrap">
            <span className="flex items-center gap-1">
              <Package className="w-3 h-3 text-muted-foreground" />
              <span className="font-bold">{m.orderCount}</span>
              <span className="text-muted-foreground">طلبية</span>
            </span>
            {m.delivered !== undefined && (
              <>
                <span className="flex items-center gap-1 text-emerald-400">
                  <CheckCircle2 className="w-3 h-3" />
                  <span className="font-bold">{m.delivered}</span> مسلَّم
                </span>
                <span className="flex items-center gap-1 text-red-400">
                  <RotateCcw className="w-3 h-3" />
                  <span className="font-bold">{m.returned}</span> مرتجع
                </span>
                {(m.pending ?? 0) > 0 && (
                  <span className="flex items-center gap-1 text-amber-400">
                    <Clock className="w-3 h-3" />
                    <span className="font-bold">{m.pending}</span> معلَّق
                  </span>
                )}
              </>
            )}
            {m.invoicePrice != null && (
              <span className="flex items-center gap-1 text-primary font-bold mr-auto">
                {formatCurrency(m.invoicePrice)}
              </span>
            )}
          </div>

          {m.delivered !== undefined && m.orderCount > 0 && (
            <DeliveryBar
              delivered={m.delivered}
              returned={m.returned ?? 0}
              pending={m.pending ?? 0}
              total={m.orderCount}
            />
          )}
        </div>
      </div>
    </Link>
  );
}

export default function ShippingCompanyDetailPage() {
  const params = useParams();
  const companyId = Number(params.id);
  const qc = useQueryClient();
  const [, navigate] = useLocation();
  const [showNewManifest, setShowNewManifest] = useState(false);

  const { data: companies } = useQuery({ queryKey: ["shipping"], queryFn: shippingApi.list });
  const company = companies?.find((c) => c.id === companyId);

  const { data: manifests, isLoading } = useQuery({
    queryKey: ["shipping-manifests", companyId],
    queryFn: () => manifestsApi.list(companyId),
    enabled: !isNaN(companyId),
  });

  const { data: stats } = useQuery({
    queryKey: ["company-stats", companyId],
    queryFn: () => manifestsApi.companyStats(companyId),
    enabled: !isNaN(companyId),
  });

  if (isNaN(companyId)) return <div className="p-8 text-center text-muted-foreground">معرّف غير صحيح</div>;

  const openManifests = manifests?.filter((m) => m.status === "open") ?? [];
  const closedManifests = manifests?.filter((m) => m.status === "closed") ?? [];
  const latestOpenId = openManifests[0]?.id;

  return (
    <div className="max-w-3xl mx-auto space-y-5 animate-in fade-in duration-500" dir="rtl">

      {/* ─── Header ─── */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link href="/shipping">
            <Button variant="outline" size="icon" className="h-8 w-8 rounded-full border-border">
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
          <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center shrink-0">
            <Truck className="w-5 h-5 text-muted-foreground" />
          </div>
          <div>
            <h1 className="text-xl font-bold">{company?.name ?? "…"}</h1>
            <div className="flex items-center gap-3 mt-0.5 text-xs text-muted-foreground flex-wrap">
              {company?.phone && (
                <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{company.phone}</span>
              )}
              {company?.website && (
                <span className="flex items-center gap-1"><Globe className="w-3 h-3" />{company.website}</span>
              )}
              <Badge
                variant="outline"
                className={`text-[9px] font-bold border ${company?.isActive ? "border-emerald-800 bg-emerald-900/30 text-emerald-400" : "border-border text-muted-foreground"}`}
              >
                {company?.isActive ? "نشط" : "موقف"}
              </Badge>
            </div>
          </div>
        </div>
        <Button
          size="sm"
          className="h-8 text-xs gap-1 bg-primary text-primary-foreground hover:bg-primary/90 font-bold shrink-0"
          onClick={() => setShowNewManifest(true)}
        >
          <PackagePlus className="w-3.5 h-3.5" />بيان جديد
        </Button>
      </div>

      {/* ─── Stats Cards ─── */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Card className="border-border bg-card p-3 text-center">
            <p className="text-[10px] text-muted-foreground mb-0.5">إجمالي الطلبيات</p>
            <p className="text-2xl font-black">{stats.total}</p>
            <p className="text-[10px] text-muted-foreground">{stats.manifestCount} بيان</p>
          </Card>
          <Card className="border-emerald-900/40 bg-emerald-900/10 p-3 text-center">
            <p className="text-[10px] text-emerald-400 mb-0.5">مُسلَّم</p>
            <p className="text-2xl font-black text-emerald-400">{stats.delivered}</p>
            <p className="text-[10px] text-emerald-600">{stats.deliveryRate}% تسليم</p>
          </Card>
          <Card className="border-red-900/40 bg-red-900/10 p-3 text-center">
            <p className="text-[10px] text-red-400 mb-0.5">مُرتجَع / معلَّق</p>
            <p className="text-2xl font-black text-red-400">{stats.returned}</p>
            <p className="text-[10px] text-amber-600">{stats.pending} معلَّق</p>
          </Card>
          <Card className={`p-3 text-center border ${stats.netProfit >= 0 ? "border-primary/30 bg-primary/5" : "border-red-900/40 bg-red-900/10"}`}>
            <p className="text-[10px] text-muted-foreground mb-0.5">صافي الربح</p>
            <p className={`text-xl font-black ${stats.netProfit >= 0 ? "text-primary" : "text-red-400"}`}>
              {formatCurrency(Math.abs(stats.netProfit))}
            </p>
            <p className="text-[10px] flex items-center justify-center gap-0.5 text-muted-foreground">
              {stats.netProfit >= 0
                ? <TrendingUp className="w-3 h-3 text-emerald-400" />
                : <TrendingDown className="w-3 h-3 text-red-400" />}
              {stats.netProfit >= 0 ? "ربح" : "خسارة"}
            </p>
          </Card>
        </div>
      )}

      {/* ─── Manifests Timeline ─── */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-bold text-sm flex items-center gap-2">
            <FileText className="w-4 h-4 text-muted-foreground" />
            البيانات
            {manifests && <Badge variant="outline" className="text-[9px]">{manifests.length}</Badge>}
          </h2>
          <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-blue-500 inline-block" />مفتوح: {openManifests.length}
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />مغلق: {closedManifests.length}
            </span>
          </div>
        </div>

        {isLoading ? (
          <div className="py-12 text-center text-muted-foreground text-sm animate-pulse">جاري التحميل...</div>
        ) : !manifests || manifests.length === 0 ? (
          <div className="py-16 text-center">
            <Truck className="w-12 h-12 mx-auto mb-3 text-muted-foreground opacity-20" />
            <p className="text-muted-foreground text-sm">لا توجد بيانات شحن بعد</p>
            <Button size="sm" className="mt-4 gap-1" onClick={() => setShowNewManifest(true)}>
              <PackagePlus className="w-3.5 h-3.5" />إنشاء أول بيان
            </Button>
          </div>
        ) : (
          <div className="space-y-2">
            {openManifests.length > 0 && (
              <>
                <p className="text-[10px] font-semibold text-blue-400 uppercase tracking-wider px-1">
                  مفتوح — يحتاج متابعة
                </p>
                {openManifests.map((m) => (
                  <ManifestCard key={m.id} m={m} isLatest={m.id === latestOpenId} />
                ))}
                {closedManifests.length > 0 && <div className="border-t border-border my-3" />}
              </>
            )}
            {closedManifests.length > 0 && (
              <>
                {openManifests.length > 0 && (
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-1">
                    مُغلق — مكتمل
                  </p>
                )}
                {closedManifests.map((m) => (
                  <ManifestCard key={m.id} m={m} isLatest={false} />
                ))}
              </>
            )}
          </div>
        )}
      </div>

      {/* New manifest dialog */}
      {showNewManifest && company && companies && (
        <CreateManifestDialog
          company={company}
          allCompanies={companies}
          onClose={() => setShowNewManifest(false)}
          onCreated={(m) => {
            qc.invalidateQueries({ queryKey: ["shipping-manifests", companyId] });
            qc.invalidateQueries({ queryKey: ["company-stats", companyId] });
            setShowNewManifest(false);
            navigate(`/shipping/manifests/${m.id}`);
          }}
        />
      )}
    </div>
  );
}
