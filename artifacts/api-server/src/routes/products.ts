import { Router, type IRouter } from "express";
import { eq, desc } from "drizzle-orm";
import { db, productsTable } from "@workspace/db";
import { z } from "zod";
import { addStock } from "../lib/inventory.js";

const router: IRouter = Router();

const CreateProductSchema = z.object({
  name: z.string().min(1),
  sku: z.string().nullish(),
  totalQuantity: z.number().int().min(0).default(0),
  lowStockThreshold: z.number().int().min(0).default(5),
  unitPrice: z.number().min(0),
  costPrice: z.number().min(0).nullish(),
});

// Update schema: totalQuantity excluded — use /add-stock instead
const UpdateProductSchema = z.object({
  name: z.string().min(1).optional(),
  sku: z.string().nullish().optional(),
  lowStockThreshold: z.number().int().min(0).optional(),
  unitPrice: z.number().min(0).optional(),
  costPrice: z.number().min(0).nullish().optional(),
});

const AddStockSchema = z.object({
  quantity: z.number().int().min(1),
  notes: z.string().nullish(),
});

router.get("/products", async (_req, res): Promise<void> => {
  const products = await db.select().from(productsTable).orderBy(desc(productsTable.createdAt));
  res.json(products);
});

router.post("/products", async (req, res): Promise<void> => {
  const parsed = CreateProductSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const [product] = await db.insert(productsTable).values(parsed.data).returning();
  res.status(201).json(product);
});

router.get("/products/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }

  const [product] = await db.select().from(productsTable).where(eq(productsTable.id, id));
  if (!product) { res.status(404).json({ error: "Product not found" }); return; }
  res.json(product);
});

router.patch("/products/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }

  const parsed = UpdateProductSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const [product] = await db.update(productsTable).set({ ...parsed.data, updatedAt: new Date() }).where(eq(productsTable.id, id)).returning();
  if (!product) { res.status(404).json({ error: "Product not found" }); return; }
  res.json(product);
});

router.delete("/products/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }

  const [deleted] = await db.delete(productsTable).where(eq(productsTable.id, id)).returning();
  if (!deleted) { res.status(404).json({ error: "Product not found" }); return; }
  res.status(204).send();
});

// ─── Add Stock ────────────────────────────────────────────────────────────────

router.post("/products/:id/add-stock", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }

  const parsed = AddStockSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const [product] = await db.select().from(productsTable).where(eq(productsTable.id, id));
  if (!product) { res.status(404).json({ error: "Product not found" }); return; }

  await addStock(
    { productId: id, product: product.name },
    parsed.data.quantity,
    parsed.data.notes ?? null,
  );

  const [updated] = await db.select().from(productsTable).where(eq(productsTable.id, id));
  res.json(updated);
});

export default router;
