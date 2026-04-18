import { Router, type IRouter } from "express";
import { eq, desc, and } from "drizzle-orm";
import { db, productVariantsTable, productsTable } from "@workspace/db";
import { z } from "zod";

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

const UpdateVariantSchema = CreateVariantSchema.partial();

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
router.post("/products/:productId/variants", async (req, res): Promise<void> => {
  const productId = parseInt(req.params.productId);
  if (isNaN(productId)) { res.status(400).json({ error: "Invalid product ID" }); return; }

  const parsed = CreateVariantSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  // Check product exists
  const [product] = await db.select().from(productsTable).where(eq(productsTable.id, productId));
  if (!product) { res.status(404).json({ error: "Product not found" }); return; }

  // Auto-generate SKU if not provided
  const sku = parsed.data.sku || `${product.name.substring(0, 3).toUpperCase()}-${parsed.data.color.substring(0, 3).toUpperCase()}-${parsed.data.size.toUpperCase()}`;

  const [variant] = await db.insert(productVariantsTable).values({
    productId,
    ...parsed.data,
    sku,
    reservedQuantity: 0,
    soldQuantity: 0,
  }).returning();
  res.status(201).json(variant);
});

// Update variant
router.patch("/products/:productId/variants/:variantId", async (req, res): Promise<void> => {
  const variantId = parseInt(req.params.variantId);
  if (isNaN(variantId)) { res.status(400).json({ error: "Invalid variant ID" }); return; }

  const parsed = UpdateVariantSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const [variant] = await db.update(productVariantsTable)
    .set({ ...parsed.data, updatedAt: new Date() })
    .where(eq(productVariantsTable.id, variantId))
    .returning();
  if (!variant) { res.status(404).json({ error: "Variant not found" }); return; }
  res.json(variant);
});

// Delete variant
router.delete("/products/:productId/variants/:variantId", async (req, res): Promise<void> => {
  const variantId = parseInt(req.params.variantId);
  if (isNaN(variantId)) { res.status(400).json({ error: "Invalid variant ID" }); return; }

  const [deleted] = await db.delete(productVariantsTable)
    .where(and(eq(productVariantsTable.id, variantId), eq(productVariantsTable.productId, parseInt(req.params.productId))))
    .returning();
  if (!deleted) { res.status(404).json({ error: "Variant not found" }); return; }
  res.status(204).send();
});

export default router;
