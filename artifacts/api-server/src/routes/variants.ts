import { Router, type IRouter } from "express";
import { eq, desc, and } from "drizzle-orm";
import { db, productVariantsTable, productsTable, warehousesTable, warehouseStockTable } from "@workspace/db";
import { z } from "zod";
import { addStock } from "../lib/inventory.js";
import { logAudit } from "../lib/audit.js";
import { requireRole } from "../middlewares/requireRole.js";

const router: IRouter = Router();

const CreateVariantSchema = z.object({
  color: z.string().min(1),
  size: z.string().min(1),
  sku: z.string().nullish(),
  totalQuantity: z.number().int().min(0).default(0),
  lowStockThreshold: z.number().int().min(0).default(5),
  unitPrice: z.number().min(0),
  costPrice: z.number().min(0).nullish(),
});

// Update schema: totalQuantity excluded — use /add-stock instead
const UpdateVariantSchema = z.object({
  color: z.string().min(1).optional(),
  size: z.string().min(1).optional(),
  sku: z.string().nullish().optional(),
  lowStockThreshold: z.number().int().min(0).optional(),
  unitPrice: z.number().min(0).optional(),
  costPrice: z.number().min(0).nullish().optional(),
});

const AddStockSchema = z.object({
  quantity: z.number().int().min(1),
  notes: z.string().nullish(),
});

// List all variants (with product info) — used by order form
router.get("/variants", async (_req, res): Promise<void> => {
  const variants = await db
    .select({
      id: productVariantsTable.id,
      productId: productVariantsTable.productId,
      productName: productsTable.name,
      color: productVariantsTable.color,
      size: productVariantsTable.size,
      sku: productVariantsTable.sku,
      totalQuantity: productVariantsTable.totalQuantity,
      reservedQuantity: productVariantsTable.reservedQuantity,
      soldQuantity: productVariantsTable.soldQuantity,
      lowStockThreshold: productVariantsTable.lowStockThreshold,
      unitPrice: productVariantsTable.unitPrice,
      costPrice: productVariantsTable.costPrice,
      createdAt: productVariantsTable.createdAt,
      updatedAt: productVariantsTable.updatedAt,
    })
    .from(productVariantsTable)
    .innerJoin(productsTable, eq(productVariantsTable.productId, productsTable.id))
    .orderBy(desc(productVariantsTable.createdAt));
  res.json(variants);
});

// List variants for a specific product
router.get("/products/:productId/variants", async (req, res): Promise<void> => {
  const productId = parseInt(req.params.productId);
  if (isNaN(productId)) { res.status(400).json({ error: "Invalid product ID" }); return; }

  const variants = await db
    .select()
    .from(productVariantsTable)
    .where(eq(productVariantsTable.productId, productId))
    .orderBy(productVariantsTable.color, productVariantsTable.size);
  res.json(variants);
});

// Create variant
router.post("/products/:productId/variants", requireRole("admin", "warehouse"), async (req, res): Promise<void> => {
  const productId = parseInt(req.params.productId);
  if (isNaN(productId)) { res.status(400).json({ error: "Invalid product ID" }); return; }

  const parsed = CreateVariantSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const [product] = await db.select().from(productsTable).where(eq(productsTable.id, productId));
  if (!product) { res.status(404).json({ error: "Product not found" }); return; }

  const sku = parsed.data.sku || `${product.name.substring(0, 3).toUpperCase()}-${parsed.data.color.substring(0, 3).toUpperCase()}-${parsed.data.size.toUpperCase()}`;

  const insertResult = await db.insert(productVariantsTable).values({
    productId, ...parsed.data, sku, reservedQuantity: 0, soldQuantity: 0,
  });
  const insertId = (insertResult as any)[0]?.insertId ?? (insertResult as any).insertId;
  const [variant] = await db.select().from(productVariantsTable).where(eq(productVariantsTable.id, insertId));

  await logAudit({ action: "create", entityType: "variant", entityId: variant.id, entityName: `${product.name} — ${variant.color} ${variant.size}`, after: { color: variant.color, size: variant.size, totalQuantity: variant.totalQuantity }, userId: req.user?.id, userName: req.user?.displayName });

  res.status(201).json(variant);
});

// Update variant
router.patch("/products/:productId/variants/:variantId", requireRole("admin", "warehouse"), async (req, res): Promise<void> => {
  const variantId = parseInt(req.params.variantId);
  if (isNaN(variantId)) { res.status(400).json({ error: "Invalid variant ID" }); return; }

  const parsed = UpdateVariantSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const [before] = await db.select().from(productVariantsTable).where(eq(productVariantsTable.id, variantId));
  await db.update(productVariantsTable)
    .set({ ...parsed.data, updatedAt: new Date() })
    .where(eq(productVariantsTable.id, variantId));
  const [variant] = await db.select().from(productVariantsTable).where(eq(productVariantsTable.id, variantId));
  if (!variant) { res.status(404).json({ error: "Variant not found" }); return; }

  if (before) await logAudit({ action: "update", entityType: "variant", entityId: variantId, entityName: `${variant.color} ${variant.size}`, before: { unitPrice: before.unitPrice, lowStockThreshold: before.lowStockThreshold }, after: { unitPrice: variant.unitPrice, lowStockThreshold: variant.lowStockThreshold }, userId: req.user?.id, userName: req.user?.displayName });

  res.json(variant);
});

// Delete variant
router.delete("/products/:productId/variants/:variantId", requireRole("admin"), async (req, res): Promise<void> => {
  const variantId = parseInt(req.params.variantId);
  if (isNaN(variantId)) { res.status(400).json({ error: "Invalid variant ID" }); return; }

  const [toDelete] = await db.select().from(productVariantsTable)
    .where(and(eq(productVariantsTable.id, variantId), eq(productVariantsTable.productId, parseInt(req.params.productId))));
  if (!toDelete) { res.status(404).json({ error: "Variant not found" }); return; }
  await db.delete(productVariantsTable)
    .where(and(eq(productVariantsTable.id, variantId), eq(productVariantsTable.productId, parseInt(req.params.productId))));

  await logAudit({ action: "delete", entityType: "variant", entityId: variantId, entityName: `${toDelete.color} ${toDelete.size}`, userId: req.user?.id, userName: req.user?.displayName });

  res.status(204).send();
});

// ─── Add Stock ────────────────────────────────────────────────────────────────

router.post("/products/:productId/variants/:variantId/add-stock", async (req, res): Promise<void> => {
  const productId = parseInt(req.params.productId);
  const variantId = parseInt(req.params.variantId);
  if (isNaN(productId) || isNaN(variantId)) { res.status(400).json({ error: "Invalid ID" }); return; }

  const parsed = AddStockSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const [product] = await db.select().from(productsTable).where(eq(productsTable.id, productId));
  if (!product) { res.status(404).json({ error: "Product not found" }); return; }

  const [variantRow] = await db.select().from(productVariantsTable).where(eq(productVariantsTable.id, variantId));
  if (!variantRow) { res.status(404).json({ error: "Variant not found" }); return; }

  await addStock(
    {
      variantId,
      productId,
      product: product.name,
      color: variantRow.color,
      size: variantRow.size,
    },
    parsed.data.quantity,
    parsed.data.notes ?? null,
  );

  // ── مزامنة تلقائية: وزّع الكمية على المخزن الافتراضي ──────────────────────
  const [defaultWarehouse] = await db
    .select()
    .from(warehousesTable)
    .where(eq(warehousesTable.isDefault, true));
  if (defaultWarehouse) {
    const allStock = await db
      .select()
      .from(warehouseStockTable)
      .where(eq(warehouseStockTable.warehouseId, defaultWarehouse.id));
    const existing = allStock.find(r => r.variantId === variantId);

    if (existing) {
      await db
        .update(warehouseStockTable)
        .set({ quantity: existing.quantity + parsed.data.quantity, updatedAt: new Date() })
        .where(eq(warehouseStockTable.id, existing.id));
    } else {
      await db
        .insert(warehouseStockTable)
        .values({
          warehouseId: defaultWarehouse.id,
          productId,
          variantId,
          quantity: parsed.data.quantity,
          updatedAt: new Date(),
        });
    }
  }
  // ──────────────────────────────────────────────────────────────────────────

  const [updated] = await db.select().from(productVariantsTable).where(eq(productVariantsTable.id, variantId));
  res.json(updated);
});

export default router;
