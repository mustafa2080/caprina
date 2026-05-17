import { Router, type IRouter } from "express";
import { db, appSettingsTable, ordersTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { requireAuth } from "../middlewares/requireAuth.js";
import { requireAdmin, requireSuperAdmin } from "../middlewares/requireRole.js";

const router: IRouter = Router();

const SETTINGS_KEY = "global";

// Parse stored JSON value
function parseValue(val: string | null | undefined): Record<string, any> {
  if (!val) return {};
  try { return JSON.parse(val); } catch { return {}; }
}

// GET /settings — returns app settings (super_admin only)
router.get("/settings", requireAuth, requireSuperAdmin, async (_req, res): Promise<void> => {
  try {
    const rows = await db
      .select()
      .from(appSettingsTable)
      .where(eq(appSettingsTable.key, SETTINGS_KEY));

    const data = rows[0] ? parseValue(rows[0].value) : {};
    res.json({
      showAddTeamMember: data.showAddTeamMember ?? true,
      allowBrandEdit: data.allowBrandEdit ?? true,
      showTeamPerformance: data.showTeamPerformance ?? true,
      showTeamManagement: data.showTeamManagement ?? true,
      showSmartAnalytics: data.showSmartAnalytics ?? true,
      showAdsAnalytics: data.showAdsAnalytics ?? true,
      showExportData: data.showExportData ?? true,
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
      allowBrandEdit: merged.allowBrandEdit ?? true,
      showTeamPerformance: merged.showTeamPerformance ?? true,
      showTeamManagement: merged.showTeamManagement ?? true,
      showSmartAnalytics: merged.showSmartAnalytics ?? true,
      showAdsAnalytics: merged.showAdsAnalytics ?? true,
      showExportData: merged.showExportData ?? true,
    });
  } catch (err: any) {
    console.error("[settings PATCH] error:", err);
    res.status(500).json({ error: "فشل حفظ الإعدادات", detail: err?.message });
  }
});

// ── FIX: تصحيح قيم الشحن السالبة (مؤقت) ─────────────────────────────────────
router.post("/settings/fix-shipping-cost", requireAuth, requireSuperAdmin, async (_req, res): Promise<void> => {
  try {
    const [fix] = await db.execute(sql`UPDATE orders SET shipping_cost = ABS(shipping_cost) WHERE shipping_cost < 0`);
    const [row] = await db.execute(sql`SELECT id, status, shipping_cost, cost_price, return_received, is_damaged FROM orders WHERE id = 1048`);
    res.json({ affectedRows: (fix as any).affectedRows, order1048: row });
  } catch (err: any) {
    res.status(500).json({ error: err?.message });
  }
});

export default router;
