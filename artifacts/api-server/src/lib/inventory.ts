import { eq, like, and, sum } from "drizzle-orm";
import { db, productsTable, productVariantsTable, inventoryMovementsTable, warehouseStockTable } from "@workspace/db";
import type { MovementReason } from "@workspace/db";

/**
 * Movement-based inventory model:
 *
 *  availableQty = totalQuantity  (direct running balance — no reservation concept)
 *
 *  Add Stock          → totalQuantity += qty   (IN / manual_in)
 *  Order received     → totalQuantity -= qty   (OUT / sale)
 *  Order returned OK  → totalQuantity += qty   (IN / return)
 *  Order returned DMG → NO stock change         (IN / damaged — audit trail only)
 *  Delivery reversed  → totalQuantity += qty   (IN / adjustment)
 *  soldQuantity updated on delivery/reversal for analytics only.
 */

// ─── Sync: مزامنة totalQuantity من مجموع المخازن ──────────────────────────────
/**
 * تحسب مجموع كميات المنتج/variant في كل المخازن،
 * وتكتبها في products.totalQuantity أو product_variants.totalQuantity.
 * تُستدعى تلقائياً بعد أي تعديل على warehouse_stock.
 */
export async function syncProductQuantityFromWarehouses(
  variantId: number | null,
  productId: number | null,
): Promise<void> {
  if (variantId) {
    // مجموع كل المخازن للـ variant ده
    const [row] = await db
      .select({ total: sum(warehouseStockTable.quantity) })
      .from(warehouseStockTable)
      .where(eq(warehouseStockTable.variantId, variantId));
    const total = Number(row?.total ?? 0);
    await db
      .update(productVariantsTable)
      .set({ totalQuantity: total, updatedAt: new Date() })
      .where(eq(productVariantsTable.id, variantId));

    // بعدين حدّث المنتج الأب = مجموع كل variants بتاعته
    const [variant] = await db
      .select({ productId: productVariantsTable.productId })
      .from(productVariantsTable)
      .where(eq(productVariantsTable.id, variantId));
    if (variant) {
      await syncParentProductFromVariants(variant.productId);
    }
  } else if (productId) {
    // منتج بدون variants — مجموع المخازن بتاعته
    const [row] = await db
      .select({ total: sum(warehouseStockTable.quantity) })
      .from(warehouseStockTable)
      .where(eq(warehouseStockTable.productId, productId));
    const total = Number(row?.total ?? 0);
    await db
      .update(productsTable)
      .set({ totalQuantity: total, updatedAt: new Date() })
      .where(eq(productsTable.id, productId));
  }
}

/**
 * يحدّث totalQuantity للمنتج الأب
 * = مجموع totalQuantity لكل variants بتاعته.
 */
async function syncParentProductFromVariants(productId: number): Promise<void> {
  const variants = await db
    .select({ qty: productVariantsTable.totalQuantity })
    .from(productVariantsTable)
    .where(eq(productVariantsTable.productId, productId));
  const total = variants.reduce((s, v) => s + (v.qty ?? 0), 0);
  await db
    .update(productsTable)
    .set({ totalQuantity: total, updatedAt: new Date() })
    .where(eq(productsTable.id, productId));
}

// ─── Resolve inventory target ─────────────────────────────────────────────────

export async function resolveInventoryTarget(order: {
  variantId?: number | null;
  productId?: number | null;
  product?: string | null;
  color?: string | null;
  size?: string | null;
}): Promise<{ variantId: number | null; productId: number | null }> {
  if (order.variantId) return { variantId: order.variantId, productId: null };
  if (order.productId) return { variantId: null, productId: order.productId };

  if (order.product && order.color && order.size) {
    const variants = await db
      .select({ id: productVariantsTable.id })
      .from(productVariantsTable)
      .innerJoin(productsTable, eq(productVariantsTable.productId, productsTable.id))
      .where(and(
        like(productsTable.name, order.product),
        like(productVariantsTable.color, order.color),
        like(productVariantsTable.size, order.size),
      ));
    if (variants.length > 0) return { variantId: variants[0].id, productId: null };
  }

  if (order.product) {
    const products = await db
      .select({ id: productsTable.id })
      .from(productsTable)
      .where(like(productsTable.name, order.product));
    if (products.length > 0) return { variantId: null, productId: products[0].id };
  }

  return { variantId: null, productId: null };
}

// ─── Warehouse stock helper ───────────────────────────────────────────────────

/**
 * لو warehouseId محدد → خصم/إرجاع من المخزن ده بالظبط
 * لو مفيش warehouseId → خصم من المخازن اللي فيها رصيد بالترتيب (الأكبر أولاً)
 */
async function adjustWarehouseStock(
  warehouseId: number | null | undefined,
  variantId: number | null,
  productId: number | null,
  delta: number, // سالب = خصم، موجب = إرجاع
): Promise<void> {
  if (!variantId && !productId) return;

  if (warehouseId) {
    // مخزن محدد
    const condition = and(
      eq(warehouseStockTable.warehouseId, warehouseId),
      variantId
        ? eq(warehouseStockTable.variantId, variantId)
        : eq(warehouseStockTable.productId, productId!),
    );
    const [row] = await db.select().from(warehouseStockTable).where(condition);
    if (!row) {
      // لو مفيش row وده إرجاع (delta > 0) → insert جديد
      if (delta > 0) {
        await db.insert(warehouseStockTable).values({
          warehouseId,
          variantId: variantId ?? null,
          productId: productId ?? null,
          quantity: delta,
          updatedAt: new Date(),
        });
      }
      return;
    }
    const newQty = Math.max(0, row.quantity + delta);
    await db.update(warehouseStockTable).set({ quantity: newQty, updatedAt: new Date() }).where(condition);
  } else {
    // بدون مخزن محدد — وزّع الخصم على المخازن اللي فيها رصيد
    const rows = await db
      .select()
      .from(warehouseStockTable)
      .where(
        variantId
          ? eq(warehouseStockTable.variantId, variantId)
          : eq(warehouseStockTable.productId, productId!),
      );

    if (delta > 0 && rows.length === 0) return; // مفيش مخزن أصلاً، مش هينفع نرجع
    if (rows.length === 0) return;

    if (delta > 0) {
      // إرجاع → ضيف للمخزن الأول
      const first = rows[0];
      await db.update(warehouseStockTable)
        .set({ quantity: first.quantity + delta, updatedAt: new Date() })
        .where(eq(warehouseStockTable.id, first.id));
    } else {
      // خصم → خصم من المخازن اللي فيها رصيد بالترتيب
      let remaining = Math.abs(delta);
      const sorted = rows.filter(r => r.quantity > 0).sort((a, b) => b.quantity - a.quantity);
      for (const row of sorted) {
        if (remaining <= 0) break;
        const deduct = Math.min(row.quantity, remaining);
        await db.update(warehouseStockTable)
          .set({ quantity: row.quantity - deduct, updatedAt: new Date() })
          .where(eq(warehouseStockTable.id, row.id));
        remaining -= deduct;
      }
    }
  }
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

async function adjustQty(
  variantId: number | null,
  productId: number | null,
  totalDelta: number,
  soldDelta: number = 0,
): Promise<void> {
  if (variantId) {
    const [v] = await db.select().from(productVariantsTable).where(eq(productVariantsTable.id, variantId));
    if (!v) return;
    await db.update(productVariantsTable).set({
      totalQuantity: Math.max(0, v.totalQuantity + totalDelta),
      soldQuantity: Math.max(0, v.soldQuantity + soldDelta),
      updatedAt: new Date(),
    }).where(eq(productVariantsTable.id, variantId));
  } else if (productId) {
    const [p] = await db.select().from(productsTable).where(eq(productsTable.id, productId));
    if (!p) return;
    await db.update(productsTable).set({
      totalQuantity: Math.max(0, p.totalQuantity + totalDelta),
      soldQuantity: Math.max(0, p.soldQuantity + soldDelta),
      updatedAt: new Date(),
    }).where(eq(productsTable.id, productId));
  }
}

async function recordMovement(data: {
  product: string;
  color?: string | null;
  size?: string | null;
  quantity: number;
  type: "IN" | "OUT";
  reason: MovementReason;
  productId?: number | null;
  variantId?: number | null;
  orderId?: number | null;
  notes?: string | null;
}): Promise<void> {
  await db.insert(inventoryMovementsTable).values({
    product: data.product,
    color: data.color ?? null,
    size: data.size ?? null,
    quantity: data.quantity,
    type: data.type,
    reason: data.reason,
    productId: data.productId ?? null,
    variantId: data.variantId ?? null,
    orderId: data.orderId ?? null,
    notes: data.notes ?? null,
  });
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Process delivery: deduct qty from totalQuantity, record OUT movement.
 * Called when order status → "received" or "partial_received".
 */
export async function processDelivery(
  order: {
    variantId?: number | null;
    productId?: number | null;
    product?: string | null;
    color?: string | null;
    size?: string | null;
    warehouseId?: number | null;
  },
  deliveredQty: number,
  reason: "sale" | "partial_sale",
  orderId?: number | null,
  skipWarehouseStock = false, // true لما البضاعة كانت اتخصمت من المخزن مسبقاً (بـ processToShipping)
): Promise<void> {
  if (deliveredQty <= 0) return;
  const { variantId, productId } = await resolveInventoryTarget(order);
  if (!variantId && !productId) return;

  await adjustQty(variantId, productId, -deliveredQty, deliveredQty);
  if (!skipWarehouseStock) {
    await adjustWarehouseStock(order.warehouseId, variantId, productId, -deliveredQty);
  }

  if (order.product) {
    await recordMovement({
      product: order.product,
      color: order.color,
      size: order.size,
      quantity: deliveredQty,
      type: "OUT",
      reason,
      productId,
      variantId,
      orderId,
    });
  }
}

/**
 * Reverse a delivery: add qty back, record IN/adjustment.
 * Called on status corrections or order deletion.
 */
export async function reverseDelivery(
  order: {
    variantId?: number | null;
    productId?: number | null;
    product?: string | null;
    color?: string | null;
    size?: string | null;
    warehouseId?: number | null;
  },
  deliveredQty: number,
  orderId?: number | null,
): Promise<void> {
  if (deliveredQty <= 0) return;
  const { variantId, productId } = await resolveInventoryTarget(order);
  if (!variantId && !productId) return;

  await adjustQty(variantId, productId, deliveredQty, -deliveredQty);
  await adjustWarehouseStock(order.warehouseId, variantId, productId, deliveredQty);

  if (order.product) {
    await recordMovement({
      product: order.product,
      color: order.color,
      size: order.size,
      quantity: deliveredQty,
      type: "IN",
      reason: "adjustment",
      productId,
      variantId,
      orderId,
      notes: "إلغاء تسليم",
    });
  }
}

/**
 * Process return.
 * isDamaged = false → add qty back (IN / return).
 * isDamaged = true  → audit record only, NO stock increment (IN / damaged).
 * Only acts when wasReceived = true.
 */
export async function processReturn(
  order: {
    variantId?: number | null;
    productId?: number | null;
    product?: string | null;
    color?: string | null;
    size?: string | null;
    quantity: number;
    warehouseId?: number | null;
  },
  wasReceived: boolean,
  isDamaged: boolean,
  orderId?: number | null,
): Promise<void> {
  if (!wasReceived) return;
  const { variantId, productId } = await resolveInventoryTarget(order);
  if (!variantId && !productId) return;

  if (!isDamaged) {
    await adjustQty(variantId, productId, order.quantity, -order.quantity);
    // رجّع للـ warehouseStock كمان
    await adjustWarehouseStock(order.warehouseId, variantId, productId, order.quantity);
  }

  if (order.product) {
    await recordMovement({
      product: order.product,
      color: order.color,
      size: order.size,
      quantity: order.quantity,
      type: "IN",
      reason: isDamaged ? ("damaged" as MovementReason) : "return",
      productId,
      variantId,
      orderId,
      notes: isDamaged ? "مرتجع تالف — لا يُضاف للمخزون" : null,
    });
  }
}

/**
 * Add stock (manual restock / initial stock entry).
 * Increments totalQuantity and records IN / manual_in.
 */
export async function addStock(
  target: {
    variantId?: number | null;
    productId?: number | null;
    product?: string | null;
    color?: string | null;
    size?: string | null;
  },
  quantity: number,
  notes?: string | null,
): Promise<void> {
  if (quantity <= 0) return;
  const { variantId, productId } = await resolveInventoryTarget(target);

  if (variantId) {
    const [v] = await db.select().from(productVariantsTable).where(eq(productVariantsTable.id, variantId));
    if (!v) return;
    await db.update(productVariantsTable).set({
      totalQuantity: v.totalQuantity + quantity,
      updatedAt: new Date(),
    }).where(eq(productVariantsTable.id, variantId));
  } else if (productId) {
    const [p] = await db.select().from(productsTable).where(eq(productsTable.id, productId));
    if (!p) return;
    await db.update(productsTable).set({
      totalQuantity: p.totalQuantity + quantity,
      updatedAt: new Date(),
    }).where(eq(productsTable.id, productId));
  }

  if (target.product) {
    await recordMovement({
      product: target.product,
      color: target.color ?? null,
      size: target.size ?? null,
      quantity,
      type: "IN",
      reason: "manual_in",
      productId: productId ?? null,
      variantId: variantId ?? null,
      notes: notes ?? null,
    });
  }
}

/**
 * Create a manual movement record (movements management page).
 * Does NOT automatically adjust totalQuantity.
 */
export async function createManualMovement(data: {
  product: string;
  color?: string | null;
  size?: string | null;
  quantity: number;
  type: "IN" | "OUT";
  reason: MovementReason;
  productId?: number | null;
  variantId?: number | null;
  notes?: string | null;
}): Promise<void> {
  await db.insert(inventoryMovementsTable).values({
    product: data.product,
    color: data.color ?? null,
    size: data.size ?? null,
    quantity: data.quantity,
    type: data.type,
    reason: data.reason,
    productId: data.productId ?? null,
    variantId: data.variantId ?? null,
    orderId: null,
    notes: data.notes ?? null,
  });
}

/**
 * Transfer stock to shipping company:
 * Deducts qty from warehouse (OUT / to_shipping).
 * Called when order is added to a shipping manifest.
 */
export async function processToShipping(
  order: {
    variantId?: number | null;
    productId?: number | null;
    product?: string | null;
    color?: string | null;
    size?: string | null;
    warehouseId?: number | null;
  },
  qty: number,
  orderId?: number | null,
): Promise<void> {
  if (qty <= 0) return;
  const { variantId, productId } = await resolveInventoryTarget(order);
  if (!variantId && !productId) return;

  // خصم من totalQuantity الكلي
  await adjustQty(variantId, productId, -qty, 0);

  // خصم من المخزن — لو محدد من المخزن ده، لو لأ من المخازن بالترتيب
  await adjustWarehouseStock(order.warehouseId, variantId, productId, -qty);

  if (order.product) {
    await recordMovement({
      product: order.product,
      color: order.color,
      size: order.size,
      quantity: qty,
      type: "OUT",
      reason: "to_shipping",
      productId,
      variantId,
      orderId,
      notes: "تحويل لشركة الشحن",
    });
  }
}

/**
 * Reverse shipping transfer (order removed from manifest or manifest deleted):
 * Add qty back to warehouse (IN / from_shipping).
 */
export async function reverseShipping(
  order: {
    variantId?: number | null;
    productId?: number | null;
    product?: string | null;
    color?: string | null;
    size?: string | null;
    warehouseId?: number | null;
  },
  qty: number,
  orderId?: number | null,
): Promise<void> {
  if (qty <= 0) return;
  const { variantId, productId } = await resolveInventoryTarget(order);
  if (!variantId && !productId) return;

  // إرجاع للـ totalQuantity الكلي
  await adjustQty(variantId, productId, qty, 0);

  // إرجاع للمخزن — لو محدد للمخزن ده، لو لأ للمخزن الأول
  await adjustWarehouseStock(order.warehouseId, variantId, productId, qty);

  if (order.product) {
    await recordMovement({
      product: order.product,
      color: order.color,
      size: order.size,
      quantity: qty,
      type: "IN",
      reason: "from_shipping",
      productId,
      variantId,
      orderId,
      notes: "إرجاع من شركة الشحن للمخزن",
    });
  }
}

// Legacy
export const RESERVED_STATUSES: string[] = [];
