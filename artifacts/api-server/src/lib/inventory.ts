import { eq, ilike, and } from "drizzle-orm";
import { db, productsTable, productVariantsTable } from "@workspace/db";

// Statuses that keep items "reserved" (in-flight, not yet delivered)
export const RESERVED_STATUSES = ["pending", "in_shipping", "delayed"];

/**
 * Compute reservedQty / soldQty deltas for a status transition.
 *
 * Strategy: REVERSE old effect → APPLY new effect.
 * Idempotent: safe to call multiple times with the same transition.
 *
 * Status effects:
 *   pending / in_shipping / delayed  →  reserved += qty
 *   received                         →  sold += qty
 *   partial_received                 →  sold += partialQty  (rest freed)
 *   returned / deleted / none        →  no effect (old effect is reversed above)
 */
export function computeInventoryDeltas(
  oldStatus: string,
  newStatus: string,
  orderQty: number,
  oldPartialQty: number | null,
  newPartialQty: number | null,
): { reservedDelta: number; soldDelta: number } {
  let reservedDelta = 0;
  let soldDelta = 0;

  // Reverse old status effect
  if (RESERVED_STATUSES.includes(oldStatus)) {
    reservedDelta -= orderQty;
  } else if (oldStatus === "received") {
    soldDelta -= orderQty;
  } else if (oldStatus === "partial_received") {
    soldDelta -= (oldPartialQty ?? 0);
  }

  // Apply new status effect
  if (RESERVED_STATUSES.includes(newStatus)) {
    reservedDelta += orderQty;
  } else if (newStatus === "received") {
    soldDelta += orderQty;
  } else if (newStatus === "partial_received") {
    soldDelta += (newPartialQty ?? 0);
  }

  return { reservedDelta, soldDelta };
}

async function applyVariantInventory(variantId: number, reservedDelta: number, soldDelta: number): Promise<void> {
  const [v] = await db.select().from(productVariantsTable).where(eq(productVariantsTable.id, variantId));
  if (!v) return;
  await db.update(productVariantsTable).set({
    reservedQuantity: Math.max(0, v.reservedQuantity + reservedDelta),
    soldQuantity: Math.max(0, v.soldQuantity + soldDelta),
    updatedAt: new Date(),
  }).where(eq(productVariantsTable.id, variantId));
}

async function applyProductInventory(productId: number, reservedDelta: number, soldDelta: number): Promise<void> {
  const [p] = await db.select().from(productsTable).where(eq(productsTable.id, productId));
  if (!p) return;
  await db.update(productsTable).set({
    reservedQuantity: Math.max(0, p.reservedQuantity + reservedDelta),
    soldQuantity: Math.max(0, p.soldQuantity + soldDelta),
    updatedAt: new Date(),
  }).where(eq(productsTable.id, productId));
}

/**
 * Resolve the inventory record for an order.
 * Priority: variantId → productId → SKU lookup (name + color + size) → name-only
 */
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

/**
 * Adjust inventory when an order's status changes (or when it is first created / deleted).
 *
 * @param order        - order data (needs variantId/productId/product/color/size/quantity)
 * @param oldStatus    - previous status ("none" for new orders)
 * @param newStatus    - incoming status ("deleted" when removing an order)
 * @param newPartialQty - partialQuantity being saved with this update
 * @param oldPartialQty - partialQuantity stored before this update
 */
export async function adjustOrderInventory(
  order: {
    variantId?: number | null;
    productId?: number | null;
    product?: string | null;
    color?: string | null;
    size?: string | null;
    quantity: number;
    partialQuantity?: number | null;
  },
  oldStatus: string,
  newStatus: string,
  newPartialQty?: number | null,
  oldPartialQty?: number | null,
): Promise<void> {
  if (oldStatus === newStatus && newStatus !== "partial_received") return;

  const { variantId, productId } = await resolveInventoryTarget(order);
  if (!variantId && !productId) return;

  const { reservedDelta, soldDelta } = computeInventoryDeltas(
    oldStatus,
    newStatus,
    order.quantity,
    oldPartialQty ?? order.partialQuantity ?? null,
    newPartialQty ?? null,
  );

  if (reservedDelta === 0 && soldDelta === 0) return;

  if (variantId) {
    await applyVariantInventory(variantId, reservedDelta, soldDelta);
  } else if (productId) {
    await applyProductInventory(productId, reservedDelta, soldDelta);
  }
}
