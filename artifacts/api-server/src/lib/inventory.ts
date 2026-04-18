import { eq, ilike, and } from "drizzle-orm";
import { db, productsTable, productVariantsTable, inventoryMovementsTable } from "@workspace/db";
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
        ilike(productsTable.name, order.product),
        ilike(productVariantsTable.color, order.color),
        ilike(productVariantsTable.size, order.size),
      ));
    if (variants.length > 0) return { variantId: variants[0].id, productId: null };
  }

  if (order.product) {
    const products = await db
      .select({ id: productsTable.id })
      .from(productsTable)
      .where(ilike(productsTable.name, order.product));
    if (products.length > 0) return { variantId: null, productId: products[0].id };
  }

  return { variantId: null, productId: null };
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
  },
  deliveredQty: number,
  reason: "sale" | "partial_sale",
  orderId?: number | null,
): Promise<void> {
  if (deliveredQty <= 0) return;
  const { variantId, productId } = await resolveInventoryTarget(order);
  if (!variantId && !productId) return;

  await adjustQty(variantId, productId, -deliveredQty, deliveredQty);

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
  },
  deliveredQty: number,
  orderId?: number | null,
): Promise<void> {
  if (deliveredQty <= 0) return;
  const { variantId, productId } = await resolveInventoryTarget(order);
  if (!variantId && !productId) return;

  await adjustQty(variantId, productId, deliveredQty, -deliveredQty);

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

// Legacy
export const RESERVED_STATUSES: string[] = [];
