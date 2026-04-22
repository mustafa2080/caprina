import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { appSettingsTable } from "@workspace/db/schema/app_settings";
import { eq } from "drizzle-orm";
import { requireAuth } from "../middlewares/requireAuth.js";
import { requireAdmin } from "../middlewares/requireRole.js";

const router: IRouter = Router();

const SETTINGS_KEY = "global";

// Parse stored JSON value
function parseValue(val: string | null | undefined): Record<string, any> {
  if (!val) return {};
  try { return JSON.parse(val); } catch { return {}; }
}

// GET /settings — returns app settings (requires auth only)
router.get("/settings", requireAuth, async (_req, res): Promise<void> => {
  try {
    const rows = await db
      .select()
      .from(appSettingsTable)
      .where(eq(appSettingsTable.key, SETTINGS_KEY));

    const data = rows[0] ? parseValue(rows[0].value) : {};
    res.json({
      showAddTeamMember: data.showAddTeamMember ?? true,
    });
  } catch (err: any) {
    console.error("[settings GET] error:", err);
    res.status(500).json({ error: "فشل تحميل الإعدادات", detail: err?.message });
  }
});

// PATCH /settings — update app settings (admin only)
router.patch("/settings", requireAuth, requireAdmin, async (req, res): Promise<void> => {
  try {
    const incoming = req.body as Record<string, any>;

    const rows = await db
      .select()
      .from(appSettingsTable)
      .where(eq(appSettingsTable.key, SETTINGS_KEY));

    const existing = rows[0] ? parseValue(rows[0].value) : {};
    const merged = { ...existing, ...incoming };

    if (rows[0]) {
      await db
        .update(appSettingsTable)
        .set({ value: JSON.stringify(merged), updatedAt: new Date() })
        .where(eq(appSettingsTable.key, SETTINGS_KEY));
    } else {
      await db.insert(appSettingsTable).values({
        key: SETTINGS_KEY,
        value: JSON.stringify(merged),
        updatedAt: new Date(),
      });
    }

    res.json({
      showAddTeamMember: merged.showAddTeamMember ?? true,
    });
  } catch (err: any) {
    console.error("[settings PATCH] error:", err);
    res.status(500).json({ error: "فشل حفظ الإعدادات", detail: err?.message });
  }
});

export default router;
