import type { Request } from "express";

/**
 * استخرج tenantId من الـ JWT للـ request الحالي.
 * - super_admin → null (بيشوف كل الـ tenants)
 * - admin/employee/warehouse → رقم الـ tenant
 */
export function getTenantId(req: Request): number | null {
  const user = (req as any).user;
  if (!user) return null;
  if (user.role === "super_admin") return null; // super_admin يشوف الكل
  return user.tenantId ?? null;
}

/**
 * بيبني conditions مصفوفة آمنة للـ tenant isolation.
 * لو tenantId موجود → فلتر بيه
 * لو super_admin → مفيش فلتر إضافي
 */
export function buildTenantCondition(
  tenantId: number | null,
  tenantIdColumn: any,
  eq: (col: any, val: any) => any,
): any | null {
  if (tenantId === null) return null; // super_admin → لا فلتر
  return eq(tenantIdColumn, tenantId);
}
