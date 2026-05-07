import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import {
  db,
  employeeProfilesTable,
  attendanceTable,
  payrollAdjustmentsTable,
} from "@workspace/db";
import { z } from "zod";
import { requireAuth } from "../middlewares/requireAuth";
import { requireAdmin } from "../middlewares/requireRole";

const router: IRouter = Router();
router.use(requireAuth);

// ─── GET attendance for a profile in a month ─────────────────────────────────
// GET /attendance/:profileId?month=YYYY-MM
router.get("/attendance/:profileId", async (req, res): Promise<void> => {
  const profileId = parseInt(req.params.profileId);
  if (isNaN(profileId)) { res.status(400).json({ error: "Invalid profileId" }); return; }

  const month = (req.query.month as string) || new Date().toISOString().slice(0, 7);
  const [year, mon] = month.split("-");
  const prefix = `${year}-${mon}`;

  const records = await db
    .select()
    .from(attendanceTable)
    .where(
      and(
        eq(attendanceTable.profileId, profileId),
      )
    );

  // filter by month prefix in JS (varchar date field YYYY-MM-DD)
  const filtered = records.filter((r) => r.date.startsWith(prefix));

  res.json(filtered);
});

// ─── POST create/upsert attendance record ────────────────────────────────────
const AttendanceSchema = z.object({
  profileId: z.number().int().positive(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  status: z.enum(["present", "absent", "late", "half_day", "holiday", "excused"]).default("present"),
  checkIn: z.string().optional().nullable(),
  checkOut: z.string().optional().nullable(),
  lateMinutes: z.number().int().min(0).default(0),
  deduction: z.number().min(0).default(0),
  notes: z.string().optional().nullable(),
});

router.post("/attendance", async (req, res): Promise<void> => {
  const parsed = AttendanceSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const data = parsed.data;

  // Check if record for this date already exists (upsert)
  const [existing] = await db
    .select()
    .from(attendanceTable)
    .where(
      and(
        eq(attendanceTable.profileId, data.profileId),
        eq(attendanceTable.date, data.date)
      )
    );

  if (existing) {
    await db
      .update(attendanceTable)
      .set({
        status: data.status,
        checkIn: data.checkIn ?? null,
        checkOut: data.checkOut ?? null,
        lateMinutes: data.lateMinutes,
        deduction: data.deduction,
        notes: data.notes ?? null,
      })
      .where(eq(attendanceTable.id, existing.id));
    const [updated] = await db.select().from(attendanceTable).where(eq(attendanceTable.id, existing.id));
    res.json(updated);
    return;
  }

  const insertResult = await db.insert(attendanceTable).values({
    profileId: data.profileId,
    date: data.date,
    status: data.status,
    checkIn: data.checkIn ?? null,
    checkOut: data.checkOut ?? null,
    lateMinutes: data.lateMinutes,
    deduction: data.deduction,
    notes: data.notes ?? null,
  });
  const insertId = (insertResult as any)[0]?.insertId ?? (insertResult as any).insertId;
  const [created] = await db.select().from(attendanceTable).where(eq(attendanceTable.id, insertId));
  res.status(201).json(created);
});

// ─── DELETE attendance record ─────────────────────────────────────────────────
router.delete("/attendance/:id", requireAdmin, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  await db.delete(attendanceTable).where(eq(attendanceTable.id, id));
  res.status(204).send();
});

// ─── GET salary report (attendance + adjustments summary) ────────────────────
// GET /attendance/:profileId/salary-report?month=YYYY-MM
router.get("/attendance/:profileId/salary-report", async (req, res): Promise<void> => {
  const profileId = parseInt(req.params.profileId);
  if (isNaN(profileId)) { res.status(400).json({ error: "Invalid profileId" }); return; }

  const month = (req.query.month as string) || new Date().toISOString().slice(0, 7);
  const [year, mon] = month.split("-").map(Number);
  const prefix = `${year}-${String(mon).padStart(2, "0")}`;
  const daysInMonth = new Date(year, mon, 0).getDate();

  const [profile] = await db
    .select()
    .from(employeeProfilesTable)
    .where(eq(employeeProfilesTable.id, profileId));

  if (!profile) { res.status(404).json({ error: "Profile not found" }); return; }

  const allRecords = await db.select().from(attendanceTable).where(eq(attendanceTable.profileId, profileId));
  const records = allRecords.filter((r) => r.date.startsWith(prefix));

  const adjustments = await db
    .select()
    .from(payrollAdjustmentsTable)
    .where(and(eq(payrollAdjustmentsTable.profileId, profileId), eq(payrollAdjustmentsTable.month, month)));

  let workedDays = 0, absentDays = 0, lateDays = 0, halfDays = 0, totalDeduction = 0;
  for (const r of records) {
    if (r.status === "present") workedDays++;
    else if (r.status === "late") { workedDays++; lateDays++; }
    else if (r.status === "absent") absentDays++;
    else if (r.status === "half_day") halfDays++;
    totalDeduction += Number(r.deduction) || 0;
  }

  const bonuses = adjustments.filter(a => a.type === "bonus").reduce((s, a) => s + Number(a.amount), 0);
  const extraDeductions = adjustments.filter(a => a.type === "deduction").reduce((s, a) => s + Number(a.amount), 0);
  const baseSalary = Number(profile.monthlySalary) || 0;
  const netSalary = baseSalary - totalDeduction + bonuses - extraDeductions;

  res.json({
    profileId,
    displayName: profile.displayName,
    month,
    baseSalary,
    workedDays,
    absentDays,
    lateDays,
    halfDays,
    totalWorkingDays: daysInMonth,
    attendanceDeduction: totalDeduction,
    bonuses,
    extraDeductions,
    netSalary,
    attendance: records,
    adjustments,
  });
});

// ─── GET payroll adjustments for a profile in a month ────────────────────────
// GET /attendance/adjustments/:profileId?month=YYYY-MM
router.get("/attendance/adjustments/:profileId", async (req, res): Promise<void> => {
  const profileId = parseInt(req.params.profileId);
  if (isNaN(profileId)) { res.status(400).json({ error: "Invalid profileId" }); return; }

  const month = (req.query.month as string) || new Date().toISOString().slice(0, 7);

  const adjustments = await db
    .select()
    .from(payrollAdjustmentsTable)
    .where(
      and(
        eq(payrollAdjustmentsTable.profileId, profileId),
        eq(payrollAdjustmentsTable.month, month)
      )
    );

  res.json(adjustments);
});

// ─── POST payroll adjustment (bonus or deduction) ─────────────────────────────
const AdjustmentSchema = z.object({
  profileId: z.number().int().positive(),
  month: z.string().regex(/^\d{4}-\d{2}$/),
  type: z.enum(["bonus", "deduction"]),
  amount: z.number().positive(),
  reason: z.string().min(1).max(500),
});

router.post("/attendance/adjustments", async (req, res): Promise<void> => {
  const parsed = AdjustmentSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const data = parsed.data;
  const insertResult = await db.insert(payrollAdjustmentsTable).values({
    profileId: data.profileId,
    month: data.month,
    type: data.type,
    amount: data.amount,
    reason: data.reason,
  });
  const insertId = (insertResult as any)[0]?.insertId ?? (insertResult as any).insertId;
  const [created] = await db.select().from(payrollAdjustmentsTable).where(eq(payrollAdjustmentsTable.id, insertId));
  res.status(201).json(created);
});

// ─── DELETE payroll adjustment ────────────────────────────────────────────────
router.delete("/attendance/adjustments/:id", requireAdmin, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  await db.delete(payrollAdjustmentsTable).where(eq(payrollAdjustmentsTable.id, id));
  res.status(204).send();
});

export default router;
