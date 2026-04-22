import { Router, type IRouter } from "express";
import { eq, sql } from "drizzle-orm";
import { db, appSettingsTable } from "@workspace/db";
import { requireAuth } from "../middlewares/requireAuth";
import { requireAdmin } from "../middlewares/requireRole";

const router: IRouter = Router();

const DEFAULTS = {
  brand_name: "CAPRINA",
  brand_tagline: "WIN OR DIE",
  brand_logo_data: null as string | null,
};

async function getSetting(key: string): Promise<string | null> {
  const [row] = await db
    .select()
    .from(appSettingsTable)
    .where(eq(appSettingsTable.key, key));
  return row?.value ?? null;
}

async function setSetting(key: string, value: string | null): Promise<void> {
  // MySQL doesn't support onConflictDoUpdate — use INSERT ... ON DUPLICATE KEY UPDATE
  await db.execute(
    sql`INSERT INTO app_settings (\`key\`, \`value\`, \`updated_at\`)
        VALUES (${key}, ${value ?? ""}, NOW())
        ON DUPLICATE KEY UPDATE \`value\` = ${value ?? ""}, \`updated_at\` = NOW()`
  );
}

// GET /api/brand — public, no auth needed
router.get("/brand", async (req, res): Promise<void> => {
  const [name, tagline, logoData] = await Promise.all([
    getSetting("brand_name"),
    getSetting("brand_tagline"),
    getSetting("brand_logo_data"),
  ]);

  res.json({
    name: name ?? DEFAULTS.brand_name,
    tagline: tagline ?? DEFAULTS.brand_tagline,
    hasLogo: !!logoData,
  });
});

// GET /api/brand/logo — returns image binary, public
router.get("/brand/logo", async (req, res): Promise<void> => {
  const logoData = await getSetting("brand_logo_data");

  if (!logoData) {
    res.status(404).json({ error: "No logo set" });
    return;
  }

  // logoData is stored as "data:<mime>;base64,<data>"
  const match = logoData.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) {
    res.status(400).json({ error: "Invalid logo data" });
    return;
  }

  const [, mimeType, base64] = match;
  const buffer = Buffer.from(base64, "base64");

  res.set("Content-Type", mimeType);
  res.set("Cache-Control", "public, max-age=3600");
  res.send(buffer);
});

// PATCH /api/brand — update name/tagline (admin only)
router.patch("/brand", requireAuth, requireAdmin, async (req, res): Promise<void> => {
  const { name, tagline } = req.body as { name?: string; tagline?: string };

  if (name !== undefined) await setSetting("brand_name", name || DEFAULTS.brand_name);
  if (tagline !== undefined) await setSetting("brand_tagline", tagline);

  const [nameVal, taglineVal, logoData] = await Promise.all([
    getSetting("brand_name"),
    getSetting("brand_tagline"),
    getSetting("brand_logo_data"),
  ]);

  res.json({
    name: nameVal ?? DEFAULTS.brand_name,
    tagline: taglineVal ?? DEFAULTS.brand_tagline,
    hasLogo: !!logoData,
  });
});

// POST /api/brand/logo — upload logo (admin only)
// Accepts { dataUrl: "data:image/..;base64,.." }
router.post("/brand/logo", requireAuth, requireAdmin, async (req, res): Promise<void> => {
  const { dataUrl } = req.body as { dataUrl?: string };

  if (!dataUrl) {
    res.status(400).json({ error: "dataUrl is required" });
    return;
  }

  if (!dataUrl.startsWith("data:image/")) {
    res.status(400).json({ error: "يجب أن تكون الصورة بتنسيق صحيح" });
    return;
  }

  // Limit to 5MB
  const base64Part = dataUrl.split(",")[1] ?? "";
  const sizeBytes = Math.ceil(base64Part.length * 0.75);
  if (sizeBytes > 5 * 1024 * 1024) {
    res.status(400).json({ error: "حجم الصورة يجب أن يكون أقل من 5MB" });
    return;
  }

  await setSetting("brand_logo_data", dataUrl);
  res.json({ success: true, logoUrl: "/api/brand/logo" });
});

// DELETE /api/brand/logo — reset to fallback (admin only)
router.delete("/brand/logo", requireAuth, requireAdmin, async (req, res): Promise<void> => {
  await setSetting("brand_logo_data", null);
  res.json({ success: true });
});

// GET /api/settings — get app feature flags (auth required)
router.get("/settings", requireAuth, async (_req, res): Promise<void> => {
  try {
    const showAddTeamMember = await getSetting("show_add_team_member");
    res.json({
      showAddTeamMember: showAddTeamMember !== "false", // default: true
    });
  } catch (err: any) {
    console.error("[settings GET] error:", err);
    res.status(500).json({ error: "فشل تحميل الإعدادات", detail: err?.message });
  }
});

// PATCH /api/settings — update app feature flags (admin only)
router.patch("/settings", requireAuth, requireAdmin, async (req, res): Promise<void> => {
  try {
    const { showAddTeamMember } = req.body as { showAddTeamMember?: boolean };
    if (showAddTeamMember !== undefined) {
      await setSetting("show_add_team_member", showAddTeamMember ? "true" : "false");
    }
    const val = await getSetting("show_add_team_member");
    res.json({ showAddTeamMember: val !== "false" });
  } catch (err: any) {
    console.error("[settings PATCH] error:", err);
    res.status(500).json({ error: "فشل حفظ الإعدادات", detail: err?.message });
  }
});

export default router;
