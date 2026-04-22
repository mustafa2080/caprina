import { Router, type IRouter } from "express";
import { db, appSettingsTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { requireAdmin } from "../middlewares/requireRole";

const router: IRouter = Router();

const KEY_PHONE = "whatsapp_business_phone";
const KEY_TEMPLATES = "whatsapp_templates";

async function getSetting(key: string): Promise<string | null> {
  const [row] = await db.select().from(appSettingsTable).where(eq(appSettingsTable.key, key));
  return row?.value ?? null;
}

async function setSetting(key: string, value: string): Promise<void> {
  // MySQL doesn't support onConflictDoUpdate — use INSERT ... ON DUPLICATE KEY UPDATE
  await db.execute(
    sql`INSERT INTO app_settings (\`key\`, \`value\`, \`updated_at\`)
        VALUES (${key}, ${value}, NOW())
        ON DUPLICATE KEY UPDATE \`value\` = ${value}, \`updated_at\` = NOW()`
  );
}

interface WaTemplate {
  id: string;
  name: string;
  body: string;
  isDefault: boolean;
}

const DEFAULT_TEMPLATES: WaTemplate[] = [
  {
    id: "default_confirm",
    name: "تأكيد الأوردر",
    body: "أهلاً يا {customerName} 👋\n\nبنأكد عليك أوردرك رقم *#{orderNumber}* من *CAPRINA* 🛍️\n\n📌 المنتج: *{product}* × {quantity}\n💰 الإجمالي: *{amount}*\n\nأوردرك دلوقتي قيد التأكيد وهيتشحن قريباً! 🚀\n\nشكراً لثقتك في CAPRINA ❤️\n_WIN OR DIE_",
    isDefault: true,
  },
  {
    id: "default_shipping",
    name: "إشعار الشحن",
    body: "أهلاً يا {customerName} 👋\n\nأوردرك رقم *#{orderNumber}* من *CAPRINA* خرج للشحن! 📦\n\n📌 المنتج: *{product}* × {quantity}\n💰 المبلغ: *{amount}*\n\nالمندوب في طريقه إليك — يرجى الاستعداد للاستلام والدفع ✅\n\nشكراً لثقتك في CAPRINA ❤️",
    isDefault: false,
  },
  {
    id: "default_followup",
    name: "متابعة بعد التأجيل",
    body: "أهلاً يا {customerName} 👋\n\nبنتابع معاك بخصوص أوردرك رقم *#{orderNumber}* من CAPRINA.\n\n📌 المنتج: *{product}*\n💰 المبلغ: *{amount}*\n\nإيه الوقت المناسب ليك نعيد التوصيل؟ 🙏",
    isDefault: false,
  },
];

async function getTemplates(): Promise<WaTemplate[]> {
  const raw = await getSetting(KEY_TEMPLATES);
  if (!raw) return DEFAULT_TEMPLATES;
  try { return JSON.parse(raw); }
  catch { return DEFAULT_TEMPLATES; }
}

// GET /api/whatsapp/settings
router.get("/whatsapp/settings", async (_req, res): Promise<void> => {
  const [phone, templates] = await Promise.all([getSetting(KEY_PHONE), getTemplates()]);
  res.json({ businessPhone: phone ?? "", templates });
});

// PATCH /api/whatsapp/settings — admin only
router.patch("/whatsapp/settings", requireAdmin, async (req, res): Promise<void> => {
  const { businessPhone } = req.body as { businessPhone?: string };
  if (businessPhone !== undefined) await setSetting(KEY_PHONE, businessPhone);
  const [phone, templates] = await Promise.all([getSetting(KEY_PHONE), getTemplates()]);
  res.json({ businessPhone: phone ?? "", templates });
});

// POST /api/whatsapp/templates — admin only
router.post("/whatsapp/templates", requireAdmin, async (req, res): Promise<void> => {
  const { name, body } = req.body as { name?: string; body?: string };
  if (!name?.trim() || !body?.trim()) {
    res.status(400).json({ error: "name and body are required" });
    return;
  }
  const templates = await getTemplates();
  const newTemplate: WaTemplate = {
    id: `tpl_${Date.now()}`,
    name: name.trim(),
    body: body.trim(),
    isDefault: false,
  };
  templates.push(newTemplate);
  await setSetting(KEY_TEMPLATES, JSON.stringify(templates));
  res.json(newTemplate);
});

// PATCH /api/whatsapp/templates/:id — admin only
router.patch("/whatsapp/templates/:id", requireAdmin, async (req, res): Promise<void> => {
  const { id } = req.params;
  const { name, body, isDefault } = req.body as { name?: string; body?: string; isDefault?: boolean };
  const templates = await getTemplates();
  const idx = templates.findIndex(t => t.id === id);
  if (idx === -1) { res.status(404).json({ error: "Template not found" }); return; }
  if (name !== undefined) templates[idx].name = name.trim();
  if (body !== undefined) templates[idx].body = body.trim();
  if (isDefault !== undefined) {
    if (isDefault) templates.forEach((t, i) => { t.isDefault = i === idx; });
    else templates[idx].isDefault = false;
  }
  await setSetting(KEY_TEMPLATES, JSON.stringify(templates));
  res.json(templates[idx]);
});

// DELETE /api/whatsapp/templates/:id — admin only
router.delete("/whatsapp/templates/:id", requireAdmin, async (req, res): Promise<void> => {
  const { id } = req.params;
  const templates = await getTemplates();
  const filtered = templates.filter(t => t.id !== id);
  await setSetting(KEY_TEMPLATES, JSON.stringify(filtered));
  res.json({ success: true });
});

export default router;
