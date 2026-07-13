import { Router, type IRouter } from "express";
import { eq, and, desc } from "drizzle-orm";
import { db, zonesTable } from "@workspace/db";
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
