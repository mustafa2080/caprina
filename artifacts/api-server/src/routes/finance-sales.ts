import { Router } from "express";
import { db, saleOrdersTable, saleOrderItemsTable, warehousesTable, warehouseStockTable, productVariantsTable } from "@workspace/db";
import { eq, desc, gte, lte, and, sql, inArray } from "drizzle-orm";
import { getTenantId } from "../middlewares/requireTenant.js";

const router = Router();

// ── مساعد توليد رقم SO ──────────────────────────────────────────────────────
async function generateSONumber(tenantId: number | null): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `SO-${year}-`;
  const [last] = await db
    .select({ soNumber: saleOrdersTable.soNumber })
    .from(saleOrdersTable)
    .where(
      and(
        tenantId !== null ? eq(saleOrdersTable.tenantId, tenantId) : sql`1=1`,
        sql`so_number LIKE ${prefix + "%"}`
      )
    )
    .orderBy(desc(saleOrdersTable.id))
    .limit(1);

  let seq = 1;
  if (last?.soNumber) {
    const parts = last.soNumber.split("-");
    seq = (parseInt(parts[parts.length - 1]) || 0) + 1;
  }
  return `${prefix}${String(seq).padStart(4, "0")}`;
}

// ── GET /finance/sale-orders ─────────────────────────────────────────────────
router.get("/finance/sale-orders", async (req, res): Promise<void> => {
  try {
    const tenantId = getTenantId(req);
    const { status, paymentStatus, from, to, search } = req.query;

    const conds: any[] = [];
    if (tenantId !== null) conds.push(eq(saleOrdersTable.tenantId, tenantId));
    if (status && status !== "all") conds.push(eq(saleOrdersTable.status, status as string));
    if (paymentStatus && paymentStatus !== "all") conds.push(eq(saleOrdersTable.paymentStatus, paymentStatus as string));
    if (from) conds.push(gte(saleOrdersTable.createdAt, new Date(from as string)));
    if (to) { const d = new Date(to as string); d.setHours(23,59,59,999); conds.push(lte(saleOrdersTable.createdAt, d)); }
    if (search) {
      const q = `%${search}%`;
      conds.push(sql`(so_number LIKE ${q} OR client_name LIKE ${q} OR client_phone LIKE ${q})`);
    }

    const orders = await db
      .select()
      .from(saleOrdersTable)
      .where(conds.length ? and(...conds) : undefined)
      .orderBy(desc(saleOrdersTable.createdAt));

    res.json(orders);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /finance/sale-orders/:id ─────────────────────────────────────────────
router.get("/finance/sale-orders/:id", async (req, res): Promise<void> => {
  try {
    const tenantId = getTenantId(req);
    const id = parseInt(req.params.id);

    const [order] = await db.select().from(saleOrdersTable)
      .where(and(
        eq(saleOrdersTable.id, id),
        tenantId !== null ? eq(saleOrdersTable.tenantId, tenantId) : sql`1=1`
      ));

    if (!order) { res.status(404).json({ error: "غير موجود" }); return; }

    const items = await db.select().from(saleOrderItemsTable)
      .where(eq(saleOrderItemsTable.saleOrderId, id));

    res.json({ ...order, items });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /finance/sale-orders ─────────────────────────────────────────────────
router.post("/finance/sale-orders", async (req, res): Promise<void> => {
  try {
    const tenantId = getTenantId(req);
    const {
      clientName, clientPhone, clientAddress,
      warehouseId, status = "draft", paymentStatus = "unpaid",
      paidAmount = 0, discountAmount = 0, shippingCost = 0, taxAmount = 0,
      notes, expectedDate, items = [],
    } = req.body;

    if (!clientName) { res.status(400).json({ error: "اسم العميل مطلوب" }); return; }

    const soNumber = await generateSONumber(tenantId);
    const now = new Date();

    // حساب الإجمالي
    const subTotal = (items as any[]).reduce((s: number, i: any) => s + (i.quantity * i.unitPrice), 0);
    const totalAmount = subTotal + Number(shippingCost) + Number(taxAmount) - Number(discountAmount);

    const [result] = await db.insert(saleOrdersTable).values({
      tenantId, soNumber, clientName,
      clientPhone: clientPhone || null,
      clientAddress: clientAddress || null,
      warehouseId: warehouseId ? parseInt(warehouseId) : null,
      status, paymentStatus,
      totalAmount: String(totalAmount),
      paidAmount:  String(paidAmount),
      discountAmount: String(discountAmount),
      shippingCost: String(shippingCost),
      taxAmount: String(taxAmount),
      notes: notes || null,
      expectedDate: expectedDate ? new Date(expectedDate) : null,
      createdByUserId: (req as any).user?.id ?? null,
      createdByName:   (req as any).user?.name ?? null,
      createdAt: now, updatedAt: now,
    });

    const orderId = (result as any).insertId;

    // إدراج البنود
    if (items.length > 0) {
      await db.insert(saleOrderItemsTable).values(
        (items as any[]).map((item: any) => ({
          saleOrderId:  orderId,
          productId:    item.productId   ? parseInt(item.productId)  : null,
          variantId:    item.variantId   ? parseInt(item.variantId)  : null,
          productName:  item.productName,
          color:        item.color  || null,
          size:         item.size   || null,
          sku:          item.sku    || null,
          quantity:     item.quantity,
          deliveredQty: 0,
          unitPrice:    String(item.unitPrice),
          totalPrice:   String(item.quantity * item.unitPrice),
          notes:        item.notes || null,
        }))
      );
    }

    // لو الحالة confirmed → احجز من المخزن
    if (status === "confirmed" && warehouseId && items.length > 0) {
      for (const item of items as any[]) {
        if (!item.variantId) continue;
        await db.update(warehouseStockTable)
          .set({ reservedQuantity: sql`reserved_quantity + ${item.quantity}` })
          .where(and(
            eq(warehouseStockTable.warehouseId, parseInt(warehouseId)),
            eq(warehouseStockTable.variantId, parseInt(item.variantId)),
          ));
      }
    }

    res.json({ id: orderId, soNumber });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── PATCH /finance/sale-orders/:id ───────────────────────────────────────────
router.patch("/finance/sale-orders/:id", async (req, res): Promise<void> => {
  try {
    const tenantId = getTenantId(req);
    const id = parseInt(req.params.id);
    const {
      status, paymentStatus, paidAmount,
      notes, expectedDate, clientName, clientPhone, clientAddress,
      warehouseId, invoiceRef,
    } = req.body;

    // اجلب الأمر الحالي
    const [current] = await db.select().from(saleOrdersTable)
      .where(and(eq(saleOrdersTable.id, id), tenantId !== null ? eq(saleOrdersTable.tenantId, tenantId) : sql`1=1`));
    if (!current) { res.status(404).json({ error: "غير موجود" }); return; }

    const updates: Record<string, any> = { updatedAt: new Date() };
    if (status        !== undefined) updates.status        = status;
    if (paymentStatus !== undefined) updates.paymentStatus = paymentStatus;
    if (paidAmount    !== undefined) updates.paidAmount    = String(paidAmount);
    if (notes         !== undefined) updates.notes         = notes;
    if (expectedDate  !== undefined) updates.expectedDate  = expectedDate ? new Date(expectedDate) : null;
    if (clientName    !== undefined) updates.clientName    = clientName;
    if (clientPhone   !== undefined) updates.clientPhone   = clientPhone;
    if (clientAddress !== undefined) updates.clientAddress = clientAddress;
    if (invoiceRef    !== undefined) updates.invoiceRef    = invoiceRef;

    // تسجيل وقت التسليم
    if (status === "delivered" && current.status !== "delivered") {
      updates.deliveredAt = new Date();
    }

    // لو الحالة تغيرت إلى confirmed → احجز المخزن
    if (status === "confirmed" && current.status !== "confirmed") {
      const items = await db.select().from(saleOrderItemsTable)
        .where(eq(saleOrderItemsTable.saleOrderId, id));
      const wid = warehouseId ? parseInt(warehouseId) : current.warehouseId;
      if (wid) {
        for (const item of items) {
          if (!item.variantId) continue;
          await db.update(warehouseStockTable)
            .set({ reservedQuantity: sql`reserved_quantity + ${item.quantity}` })
            .where(and(
              eq(warehouseStockTable.warehouseId, wid),
              eq(warehouseStockTable.variantId, item.variantId),
            ));
        }
      }
    }

    // لو الحالة تغيرت إلى delivered → خصم فعلي من المخزن
    if (status === "delivered" && current.status !== "delivered") {
      const items = await db.select().from(saleOrderItemsTable)
        .where(eq(saleOrderItemsTable.saleOrderId, id));
      const wid = warehouseId ? parseInt(warehouseId) : current.warehouseId;
      if (wid) {
        for (const item of items) {
          if (!item.variantId) continue;
          await db.update(warehouseStockTable)
            .set({
              quantity:         sql`quantity - ${item.quantity}`,
              reservedQuantity: sql`GREATEST(0, reserved_quantity - ${item.quantity})`,
            })
            .where(and(
              eq(warehouseStockTable.warehouseId, wid),
              eq(warehouseStockTable.variantId, item.variantId),
            ));
          await db.update(saleOrderItemsTable)
            .set({ deliveredQty: item.quantity })
            .where(eq(saleOrderItemsTable.id, item.id));
        }
      }
    }

    await db.update(saleOrdersTable).set(updates).where(eq(saleOrdersTable.id, id));
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── DELETE /finance/sale-orders/:id ──────────────────────────────────────────
router.delete("/finance/sale-orders/:id", async (req, res): Promise<void> => {
  try {
    const tenantId = getTenantId(req);
    const id = parseInt(req.params.id);

    const [order] = await db.select({ status: saleOrdersTable.status })
      .from(saleOrdersTable)
      .where(and(eq(saleOrdersTable.id, id), tenantId !== null ? eq(saleOrdersTable.tenantId, tenantId) : sql`1=1`));

    if (!order) { res.status(404).json({ error: "غير موجود" }); return; }
    if (["delivered", "closed"].includes(order.status)) {
      res.status(400).json({ error: "لا يمكن حذف أمر مُسلَّم أو مُغلَق" }); return;
    }

    await db.delete(saleOrdersTable).where(eq(saleOrdersTable.id, id));
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
