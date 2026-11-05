import { db, tenantsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

type Tenant = typeof tenantsTable.$inferSelect;

// كاش في الذاكرة لبيانات الـ tenant (الاشتراك).
// قبل كده checkSubscription و /auth/me كانوا بيعملوا query على الداتابيز في كل request.
// 15 ثانية كفاية: تغيير حالة الاشتراك بيوصل خلال 15 ثانية بالكتير.
const TTL_MS = 15_000;

const cache = new Map<number, { tenant: Tenant | undefined; expiresAt: number }>();
const inflight = new Map<number, Promise<Tenant | undefined>>();

export async function getTenantCached(id: number): Promise<Tenant | undefined> {
  const hit = cache.get(id);
  if (hit && hit.expiresAt > Date.now()) return hit.tenant;

  // لو في request تاني بيجيب نفس الـ tenant دلوقتي، استنى نفس الـ promise
  let p = inflight.get(id);
  if (!p) {
    p = db
      .select()
      .from(tenantsTable)
      .where(eq(tenantsTable.id, id))
      .limit(1)
      .then(([t]) => {
        cache.set(id, { tenant: t, expiresAt: Date.now() + TTL_MS });
        return t;
      })
      .finally(() => {
        inflight.delete(id);
      });
    inflight.set(id, p);
  }
  return p;
}

export function invalidateTenantCache(id?: number): void {
  if (id === undefined) cache.clear();
  else cache.delete(id);
}
