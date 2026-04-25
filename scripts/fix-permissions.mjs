#!/usr/bin/env node
/**
 * fix-permissions.mjs
 * Script يشتغل مرة واحدة على السيرفر
 * يملي الـ permissions الناقصة لكل المستخدمين القدامى
 */

import mysql from "mysql2/promise";
import * as dotenv from "dotenv";
import { resolve } from "path";

// حمّل الـ .env من مجلد المشروع
dotenv.config({ path: resolve(process.cwd(), ".env") });

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("❌ DATABASE_URL مش موجودة في الـ .env");
  process.exit(1);
}

// ─── الصلاحيات الافتراضية لكل دور ───────────────────────────────────────────
const ROLE_DEFAULTS = {
  admin: [
    "dashboard", "orders", "inventory", "movements", "shipping", "invoices",
    "import", "analytics", "users", "audit", "whatsapp",
    "view_financials", "edit_inventory", "edit_delete_inventory",
    "view_product_performance", "add_team_member", "edit_brand",
    "section_dashboard", "section_product_performance", "section_team_performance",
    "section_team_management", "section_smart_analytics", "section_ads_analytics",
    "section_orders", "section_new_order", "section_archive", "section_shipping_followup",
    "section_whatsapp", "section_inventory", "section_warehouses", "section_movements",
    "section_shipping", "section_invoices", "section_import", "section_export_data",
    "section_users", "section_sessions_report", "section_audit",
  ],
  employee: [
    "dashboard", "orders",
    "section_dashboard", "section_orders", "section_new_order",
    "section_archive", "section_shipping_followup",
  ],
  warehouse: [
    "dashboard", "inventory", "movements",
    "edit_inventory", "edit_delete_inventory",
    "section_dashboard", "section_inventory", "section_warehouses", "section_movements",
  ],
};

function parsePermissions(raw) {
  if (!raw) return [];
  try {
    const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
    if (!Array.isArray(parsed)) return [];
    const flat = [];
    for (const item of parsed) {
      if (typeof item === "string") flat.push(item);
      else if (Array.isArray(item)) {
        for (const sub of item) { if (typeof sub === "string") flat.push(sub); }
      }
    }
    return [...new Set(flat)];
  } catch { return []; }
}

async function main() {
  const conn = await mysql.createConnection(DATABASE_URL);
  console.log("✅ اتصلنا بقاعدة البيانات\n");

  const [users] = await conn.execute("SELECT id, username, role, permissions FROM users");

  let updated = 0;
  let skipped = 0;

  for (const user of users) {
    const currentPerms = parsePermissions(user.permissions);
    const defaults = ROLE_DEFAULTS[user.role] ?? [];

    // لو عنده permissions مش فاضية ومش "*" — اسيبه (له صلاحيات متخصصة)
    if (currentPerms.length > 0 && !currentPerms.includes("*")) {
      console.log(`⏭  ${user.username} (${user.role}) — عنده ${currentPerms.length} صلاحية، مش هنعدله`);
      skipped++;
      continue;
    }

    // لو فاضية أو "*" — نحطله الـ defaults
    const newPerms = JSON.stringify(defaults);
    await conn.execute(
      "UPDATE users SET permissions = ? WHERE id = ?",
      [newPerms, user.id]
    );
    console.log(`✅ ${user.username} (${user.role}) — اتحدث: ${defaults.length} صلاحية`);
    updated++;
  }

  await conn.end();

  console.log(`\n──────────────────────────────`);
  console.log(`✅ اتحدث: ${updated} مستخدم`);
  console.log(`⏭  اتسكب: ${skipped} مستخدم (عندهم صلاحيات مخصصة)`);
  console.log(`──────────────────────────────`);
  console.log("🎉 خلص! كل الموظفين القدامى عندهم permissions دلوقتي.");
}

main().catch(err => {
  console.error("❌ خطأ:", err.message);
  process.exit(1);
});
