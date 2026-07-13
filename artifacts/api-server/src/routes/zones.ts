import { Router, type IRouter } from "express";
import { eq, and, desc, isNull } from "drizzle-orm";
import { db, zonesTable, ordersTable } from "@workspace/db";
import { getTenantId } from "../middlewares/requireTenant.js";
import { z } from "zod";
import { requireAuth } from "../middlewares/requireAuth";

const router: IRouter = Router();
router.use(requireAuth);

const ZoneSchema = z.object({
  name: z.string().min(1),
  notes: z.string().nullish(),
});

// ─── List ──────────────────────────────────────────────────────────────────
router.get("/zones", async (req, res): Promise<void> => {
  const tenantId = getTenantId(req);
  const conditions: any[] = [];
  if (tenantId !== null) conditions.push(eq(zonesTable.tenantId, tenantId));

  const zones = await db
    .select()
    .from(zonesTable)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(zonesTable.createdAt));

  res.json(zones);
});

// ─── أسباب المرتجعات الثابتة (تطابق order-constants.ts في الفرونت إند) ──────
const REASON_LABELS: Record<string, string> = {
  no_answer: "العميل لا يرد",
  unavailable: "العميل مغلق أو غير متاح",
  postponed: "العميل طلب التأجيل",
  no_knowledge: "العميل ليس لديه علم بالشحنة",
  cancel_request: "العميل طلب إلغاء الشحنة",
  refused_paid: "العميل رفض الاستلام بعد المعاينة ودفع مصاريف الشحن",
  refused_unpaid: "العميل رفض الاستلام بعد المعاينة ولم يدفع مصاريف الشحن",
  damaged: "الشحنة تالفة",
  unclear_address: "العنوان غير واضح",
  out_of_coverage: "العنوان خارج نطاق التغطية",
  time_mismatch: "وقت العميل غير مناسب مع وقت المندوب",
  other: "سبب آخر",
  // أسباب قديمة/legacy لسه موجودة في الداتابيز من طلبات سابقة
  size_mismatch: "مقاس غير مناسب",
  quality: "جودة المنتج",
  customer_refused: "عميل غير جاد",
  customer_requested_return: "طلب العميل مرتجع",
  delay: "التأخير على العميل",
};

// ─── Zone Insights: تحليل شامل للمناطق (إيراد، نسبة تسليم، أسباب المرتجعات) ──
// GET /zones/insights?from=&to=&compare=true
router.get("/zones/insights", async (req, res): Promise<void> => {
  const tenantId = getTenantId(req);
  const fromParam = req.query.from as string | undefined;
  const toParam = req.query.to as string | undefined;
  const compareParam = req.query.compare === "true" || req.query.compare === "1";

  const zoneConditions: any[] = [];
  if (tenantId !== null) zoneConditions.push(eq(zonesTable.tenantId, tenantId));

  const orderConditions: any[] = [isNull(ordersTable.deletedAt)];
  if (tenantId !== null) orderConditions.push(eq(ordersTable.tenantId, tenantId));

  const [zones, allOrdersRaw] = await Promise.all([
    db.select().from(zonesTable).where(zoneConditions.length > 0 ? and(...zoneConditions) : undefined),
    db.select().from(ordersTable).where(and(...orderConditions)),
  ]);

  const fromDate = fromParam ? new Date(fromParam) : null;
  const toDate = toParam ? new Date(new Date(toParam).setHours(23, 59, 59, 999)) : null;

  // فلترة بالتاريخ (createdAt) لو موجود from/to
  let orders = allOrdersRaw;
  if (fromDate || toDate) {
    orders = allOrdersRaw.filter(o => {
      const d = new Date(o.createdAt);
      if (fromDate && d < fromDate) return false;
      if (toDate && d > toDate) return false;
      return true;
    });
  }

  // فترة المقارنة: نفس طول الفترة الحالية، فورًا قبلها مباشرة (لو compare=true ومحددين from/to)
  let previousOrders: typeof allOrdersRaw = [];
  if (compareParam && fromDate && toDate) {
    const durationMs = toDate.getTime() - fromDate.getTime();
    const prevTo = new Date(fromDate.getTime() - 1); // آخر لحظة قبل بداية الفترة الحالية
    const prevFrom = new Date(prevTo.getTime() - durationMs);
    previousOrders = allOrdersRaw.filter(o => {
      const d = new Date(o.createdAt);
      return d >= prevFrom && d <= prevTo;
    });
  }

  // تجميع الطلبات: لو الطلب مربوط بمنطقة (zoneId) نستخدم اسم المنطقة،
  // ولو مش مربوط (zoneId فاضي) نرجع لعمود المحافظة (city) كـ fallback — (null/فارغ → "غير محدد")
  const zoneNameById = new Map<number, string>();
  for (const z of zones) zoneNameById.set(z.id, z.name);

  const grouped = new Map<string | null, typeof orders>();
  for (const o of orders) {
    const zoneId = (o as any).zoneId as number | null | undefined;
    let key: string | null = null;
    if (zoneId != null && zoneNameById.has(zoneId)) {
      key = zoneNameById.get(zoneId)!;
    } else {
      const rawCity = ((o as any).city as string | null | undefined)?.trim();
      key = rawCity && rawCity.length > 0 ? rawCity : null;
    }
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(o);
  }

  function buildZoneInsight(cityName: string | null, zoneOrders: typeof orders) {
    // إجمالي الإيراد: من الطلبات المستلمة (كاملة أو جزئية) فقط
    let revenue = 0;
    for (const o of zoneOrders) {
      if (o.status === "received") revenue += o.totalPrice ?? 0;
      else if (o.status === "partial_received") {
        const qty = (o as any).partialQuantity ?? o.quantity;
        revenue += qty * o.unitPrice;
      }
    }

    // نسبة التسليم: received / (كل الطلبات ما عدا pending و in_shipping)
    const eligibleForDelivery = zoneOrders.filter(o => o.status !== "pending" && o.status !== "in_shipping");
    const deliveredCount = zoneOrders.filter(o => o.status === "received").length;
    const deliveryRate = eligibleForDelivery.length > 0 ? Math.round((deliveredCount / eligibleForDelivery.length) * 100) : 0;

    // المرتجعات: حساب بالفاتورة (فاتورة واحدة = مرتجع واحد) زي smart-insights
    const returnedOrders = zoneOrders.filter(o => o.status === "returned");
    const seenInvoices = new Set<string>();
    const uniqueReturnedUnits: typeof returnedOrders = [];
    for (const o of returnedOrders) {
      const inv = (o as any).invoiceNumber as string | null;
      if (inv) {
        if (seenInvoices.has(inv)) continue;
        seenInvoices.add(inv);
      }
      uniqueReturnedUnits.push(o);
    }
    const totalReturns = uniqueReturnedUnits.length;

    // نسبة المرتجعات من الطلبات المغلقة فقط (received + partial_received + returned)
    const closedCount = zoneOrders.filter(o => ["received", "partial_received", "returned"].includes(o.status)).length;
    const returnRate = closedCount > 0 ? Math.round((totalReturns / closedCount) * 100) : 0;

    // أسباب المرتجعات
    const reasonCount: Record<string, number> = {};
    const otherNoteCount: Record<string, number> = {};
    let noReasonCount = 0;
    for (const o of uniqueReturnedUnits) {
      const reason = (o as any).returnReason ?? "__none__";
      if (reason === "__none__") { noReasonCount++; continue; }
      reasonCount[reason] = (reasonCount[reason] ?? 0) + 1;
      if (reason === "other") {
        const note = ((o as any).returnNote as string | null)?.trim();
        if (note) otherNoteCount[note] = (otherNoteCount[note] ?? 0) + 1;
      }
    }

    const otherTotal = reasonCount["other"] ?? 0;
    const otherNotesEntries = Object.entries(otherNoteCount).sort((a: any, b: any) => b[1] - a[1]);
    const otherWithoutNote = otherTotal - otherNotesEntries.reduce((s: number, [, c]: any) => s + c, 0);

    const expandedReasons: Array<{ reason: string; label: string; count: number; pct: number }> = [];
    for (const [reason, cnt] of Object.entries(reasonCount)) {
      if (reason === "other") {
        for (const [note, c] of otherNotesEntries as any) {
          expandedReasons.push({ reason: "other_note", label: note as string, count: c, pct: totalReturns > 0 ? Math.round((c / totalReturns) * 100) : 0 });
        }
        if (otherWithoutNote > 0) {
          expandedReasons.push({ reason: "other", label: "سبب آخر (غير مفصّل)", count: otherWithoutNote, pct: totalReturns > 0 ? Math.round((otherWithoutNote / totalReturns) * 100) : 0 });
        }
      } else {
        expandedReasons.push({ reason, label: REASON_LABELS[reason] ?? reason, count: cnt, pct: totalReturns > 0 ? Math.round((cnt / totalReturns) * 100) : 0 });
      }
    }

    const byReason = [
      ...expandedReasons,
      ...(noReasonCount > 0 ? [{ reason: "__none__", label: "غير محدد", count: noReasonCount, pct: totalReturns > 0 ? Math.round((noReasonCount / totalReturns) * 100) : 0 }] : []),
    ].sort((a, b) => b.count - a.count);

    // أهم سبب مرتجع (لبناء الرسالة التحليلية في الفرونت إند)
    const topReason = byReason.length > 0 ? byReason[0] : null;

    return {
      zoneId: cityName,
      zoneName: cityName ?? "غير محدد",
      ordersCount: zoneOrders.length,
      revenue: Math.round(revenue),
      deliveredCount,
      deliveryRate,
      returnedCount: totalReturns,
      returnRate,
      closedCount,
      byReason,
      topReason,
    };
  }

  let zoneInsights = Array.from(grouped.entries())
    .map(([zoneId, zoneOrders]) => buildZoneInsight(zoneId, zoneOrders))
    .sort((a, b) => b.returnRate - a.returnRate);

  // إجمالي عام لكل المناطق مع بعض (للدونات الشامل)
  const overall = buildZoneInsight(-1, orders);

  // ─── مؤشر الاتجاه (trend): مقارنة كل منطقة بالفترة السابقة مباشرة ─────────
  if (compareParam && fromDate && toDate) {
    const prevGrouped = new Map<string | null, typeof previousOrders>();
    for (const o of previousOrders) {
      const zoneId = (o as any).zoneId as number | null | undefined;
      let key: string | null = null;
      if (zoneId != null && zoneNameById.has(zoneId)) {
        key = zoneNameById.get(zoneId)!;
      } else {
        const rawCity = ((o as any).city as string | null | undefined)?.trim();
        key = rawCity && rawCity.length > 0 ? rawCity : null;
      }
      if (!prevGrouped.has(key)) prevGrouped.set(key, []);
      prevGrouped.get(key)!.push(o);
    }

    const prevInsightByKey = new Map<string | null, ReturnType<typeof buildZoneInsight>>();
    for (const [key, zoneOrders] of prevGrouped.entries()) {
      prevInsightByKey.set(key, buildZoneInsight(key, zoneOrders));
    }

    zoneInsights = zoneInsights.map(z => {
      const prev = prevInsightByKey.get(z.zoneId as any);
      const prevRevenue = prev?.revenue ?? 0;
      const prevOrdersCount = prev?.ordersCount ?? 0;

      const revenueTrendPct = prevRevenue > 0
        ? Math.round(((z.revenue - prevRevenue) / prevRevenue) * 100)
        : (z.revenue > 0 ? 100 : 0);
      const ordersTrendPct = prevOrdersCount > 0
        ? Math.round(((z.ordersCount - prevOrdersCount) / prevOrdersCount) * 100)
        : (z.ordersCount > 0 ? 100 : 0);

      return {
        ...z,
        trend: {
          direction: revenueTrendPct > 0 ? "up" : revenueTrendPct < 0 ? "down" : "flat",
          revenueTrendPct,
          ordersTrendPct,
          previousRevenue: prevRevenue,
          previousOrdersCount: prevOrdersCount,
        },
      };
    });
  }

  // ─── مؤشر تركّز المخاطر: هل المبيعات متركزة بشكل خطير في منطقة واحدة؟ ─────
  const totalRevenueAllZones = zoneInsights.reduce((s, z) => s + z.revenue, 0);
  const sortedByRevenue = [...zoneInsights].sort((a, b) => b.revenue - a.revenue);
  const topZoneShare = totalRevenueAllZones > 0 && sortedByRevenue.length > 0
    ? Math.round((sortedByRevenue[0].revenue / totalRevenueAllZones) * 100)
    : 0;
  const top3ZonesShare = totalRevenueAllZones > 0
    ? Math.round((sortedByRevenue.slice(0, 3).reduce((s, z) => s + z.revenue, 0) / totalRevenueAllZones) * 100)
    : 0;

  const riskConcentration = {
    topZoneName: sortedByRevenue[0]?.zoneName ?? null,
    topZoneSharePct: topZoneShare,
    top3ZonesSharePct: top3ZonesShare,
    // خطورة: لو منطقة واحدة بتاخد أكتر من 50% من المبيعات، أو 3 مناطق بياخدوا أكتر من 80%
    level: topZoneShare >= 50 ? "high" : topZoneShare >= 35 ? "medium" : "low",
  };

  res.json({ zones: zoneInsights, overall, riskConcentration });
});

// ─── Create ────────────────────────────────────────────────────────────────
router.post("/zones", async (req, res): Promise<void> => {
  const tenantId = getTenantId(req);
  const parsed = ZoneSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const insertResult = await db
    .insert(zonesTable)
    .values({
      tenantId: tenantId ?? null,
      name: parsed.data.name,
      notes: parsed.data.notes ?? null,
    });
  const insertId = (insertResult as any)[0]?.insertId ?? (insertResult as any).insertId;
  const [z] = await db.select().from(zonesTable).where(eq(zonesTable.id, insertId));

  res.status(201).json(z);
});

// ─── Update ────────────────────────────────────────────────────────────────
router.patch("/zones/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }

  const Schema = ZoneSchema.partial();
  const parsed = Schema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  await db
    .update(zonesTable)
    .set({ ...parsed.data, updatedAt: new Date() })
    .where(eq(zonesTable.id, id));

  const [updated] = await db.select().from(zonesTable).where(eq(zonesTable.id, id));
  if (!updated) { res.status(404).json({ error: "المنطقة غير موجودة" }); return; }
  res.json(updated);
});

// ─── Delete ────────────────────────────────────────────────────────────────
router.delete("/zones/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }

  const [toDelete] = await db.select().from(zonesTable).where(eq(zonesTable.id, id));
  if (!toDelete) { res.status(404).json({ error: "المنطقة غير موجودة" }); return; }

  await db.delete(zonesTable).where(eq(zonesTable.id, id));
  res.status(204).send();
});

export default router;
