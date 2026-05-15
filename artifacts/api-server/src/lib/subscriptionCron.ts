import { db, tenantsTable } from "@workspace/db";
import { and, eq, lte, sql } from "drizzle-orm";

/**
 * subscriptionCron — يشتغل كل يوم الساعة 2 صبح
 * 1. يحول active → grace لو expiresAt فات
 * 2. يحول grace → expired لو graceUntil فات
 */
export async function runSubscriptionCron(): Promise<void> {
  const now = new Date();
  console.log(`[SubscriptionCron] 🕐 بدأ الفحص — ${now.toISOString()}`);

  try {
    // ── 1. active → grace (انتهى الاشتراك، لسه في فترة السماح) ─────────────
    const grace = await db
      .update(tenantsTable)
      .set({
        planStatus: "grace",
        graceUntil: sql`DATE_ADD(NOW(), INTERVAL 3 DAY)`,
        updatedAt:  sql`NOW()`,
      })
      .where(
        and(
          eq(tenantsTable.planStatus, "active"),
          lte(tenantsTable.expiresAt, now),
        )
      );
    console.log(`[SubscriptionCron] ⏳ ${grace[0].affectedRows} tenant دخل فترة السماح`);

    // ── 2. grace → expired (انتهت فترة السماح) ───────────────────────────────
    const expired = await db
      .update(tenantsTable)
      .set({
        planStatus: "expired",
        updatedAt:  sql`NOW()`,
      })
      .where(
        and(
          eq(tenantsTable.planStatus, "grace"),
          lte(tenantsTable.graceUntil as any, now),
        )
      );
    console.log(`[SubscriptionCron] 🔴 ${expired[0].affectedRows} tenant انتهى اشتراكه`);

  } catch (err) {
    console.error("[SubscriptionCron] ❌ فشل:", err);
  }
}

/**
 * startSubscriptionCron — بيشغل الـ cron loop
 * يستدعيها مرة واحدة في app.ts
 */
export function startSubscriptionCron(): void {
  const MS_PER_HOUR = 60 * 60 * 1000;
  const MS_PER_DAY  = 24 * MS_PER_HOUR;

  // شغّل مرة فوراً عند البدء
  runSubscriptionCron();

  // بعدين كل 24 ساعة
  setInterval(runSubscriptionCron, MS_PER_DAY);

  console.log("[SubscriptionCron] ✅ تم تشغيل الـ cron — يفحص كل 24 ساعة");
}
