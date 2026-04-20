import { Router, type IRouter } from "express";
import { eq, desc } from "drizzle-orm";
import { db, shippingCompaniesTable } from "@workspace/db";
import { z } from "zod";

const router: IRouter = Router();

const CreateSchema = z.object({
  name: z.string().min(1),
  phone: z.string().nullish(),
  website: z.string().nullish(),
  notes: z.string().nullish(),
  isActive: z.boolean().default(true),
});

const UpdateSchema = CreateSchema.partial();

router.get("/shipping-companies", async (_req, res): Promise<void> => {
  const companies = await db.select().from(shippingCompaniesTable).orderBy(desc(shippingCompaniesTable.createdAt));
  res.json(companies);
});

router.post("/shipping-companies", async (req, res): Promise<void> => {
  const parsed = CreateSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const insertResult = await db.insert(shippingCompaniesTable).values(parsed.data);
  const insertId = (insertResult as any)[0]?.insertId ?? (insertResult as any).insertId;
  const [company] = await db.select().from(shippingCompaniesTable).where(eq(shippingCompaniesTable.id, insertId));
  res.status(201).json(company);
});

router.patch("/shipping-companies/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }

  const parsed = UpdateSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  await db.update(shippingCompaniesTable).set(parsed.data).where(eq(shippingCompaniesTable.id, id));
  const [company] = await db.select().from(shippingCompaniesTable).where(eq(shippingCompaniesTable.id, id));
  if (!company) { res.status(404).json({ error: "Company not found" }); return; }
  res.json(company);
});

router.delete("/shipping-companies/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }

  const [toDelete] = await db.select().from(shippingCompaniesTable).where(eq(shippingCompaniesTable.id, id));
  if (!toDelete) { res.status(404).json({ error: "Company not found" }); return; }
  await db.delete(shippingCompaniesTable).where(eq(shippingCompaniesTable.id, id));
  res.status(204).send();
});

export default router;
