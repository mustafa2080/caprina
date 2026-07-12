import { Router, type IRouter } from "express";
import { eq, and, sql } from "drizzle-orm";
import {
  db,
  employeeProfilesTable,
  attendanceTable,
  payrollAdjustmentsTable,
  appSettingsTable,
} from "@workspace/db";
import { z } from "zod";
import { requireAuth } from "../middlewares/requireAuth";
import { requireAdmin, requireSuperAdmin } from "../middlewares/requireRole";

const router: IRouter = Router();
router.use(requireAuth);

// ─── توقيت القاهرة (السيرفر شغال UTC، فلازم نحول صراحة لتوقيت مصر) ───────────
const CAIRO_TZ = "Africa/Cairo";

function cairoTimeString(): string {
  // HH:MM بتوقيت القاهرة (24 ساعة)
  return new Intl.DateTimeFormat("en-GB", { timeZone: CAIRO_TZ, hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date());
}

function cairoTodayString(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: CAIRO_TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

// ─── GET my attendance (current user from token) ──────────────────────────────
// GET /attendance/my?month=YYYY-MM

// ─── دورة الراتب: من 26 الشهر السابق لـ 25 الشهر الحالي ──────────────────────
function currentPayPeriodMonth(): string {
  const now = new Date();
  let y = now.getFullYear(), m = now.getMonth() + 1;
  if (now.getDate() >= 26) { m += 1; if (m > 12) { m = 1; y += 1; } }
  return `${y}-${String(m).padStart(2, "0")}`;
}
function getPayPeriodDates(month: string): { from: string; to: string } {
  const [y, m] = month.split("-").map(Number);
  const prevMon  = m === 1 ? 12 : m - 1;
  const prevYear = m === 1 ? y - 1 : y;
  const from = `${prevYear}-${String(prevMon).padStart(2,"0")}-26`;
  const to   = `${y}-${String(m).padStart(2,"0")}-25`;
  return { from, to };
}

// ─── إعداد سماحية التأخير العام (يتحكم فيه السوبر أدمن) ──────────────────────
const LATE_GRACE_SETTING_KEY = "attendance_late_grace_minutes";
const DEFAULT_LATE_GRACE_MINUTES = 15;

async function getLateGraceMinutes(): Promise<number> {
  const [row] = await db.select().from(appSettingsTable).where(eq(appSettingsTable.key, LATE_GRACE_SETTING_KEY));
  const parsed = row?.value ? parseInt(row.value) : NaN;
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : DEFAULT_LATE_GRACE_MINUTES;
}

async function setLateGraceMinutes(minutes: number): Promise<void> {
  await db.execute(
    sql`INSERT INTO app_settings (\`key\`, \`value\`, \`updated_at\`)
        VALUES (${LATE_GRACE_SETTING_KEY}, ${String(minutes)}, NOW())
        ON DUPLICATE KEY UPDATE \`value\` = ${String(minutes)}, \`updated_at\` = NOW()`
  );
}

// ─── مواعيد العمل الثابتة (نظام 12 ساعة) ─────────────────────────────────────
// الشيفت يبدأ 10:00 صباحًا لكل الموظفين، سماح نص ساعة (لحد 10:30)
// من 10:31 لحد 11:00 → تأخير (بدون خصم، فقط تسجيل حالة "late")
// من 11:01 لحد 1:00 ظهرًا → خصم نص يوم (status: half_day)
// من 1:01 ظهرًا لحد نهاية الشيفت (7 مساءً) → غياب تلقائي (يتم تسجيله بواسطة الـ cron)
const SHIFT_START_MINUTES = 10 * 60;        // 10:00 ص
const GRACE_MINUTES = 30;                    // لحد 10:30
const LATE_WINDOW_END_MINUTES = 11 * 60;     // 11:00 ص — نهاية نافذة التأخير
const HALF_DAY_WINDOW_END_MINUTES = 15 * 60; // ⚠️ TEMP للتجربة — الأصل 13*60 (1:00 ظهرًا)، دلوقتي 3:00 — رجّعها بعد الاختبار
const SHIFT_END_MINUTES = 19 * 60;           // 7:00 م — نهاية الشيفت (غياب تلقائي بعده)

// ─── حساب حالة الحضور + دقائق التأخير + الخصم بناءً على مواعيد العمل الثابتة ──
function computeLateness(_shiftStart: string | null, checkInTime: string, monthlySalary: number, _graceMinutes: number): { status: "present" | "late" | "half_day" | "absent"; lateMinutes: number; deduction: number } {
  const [ch, cm] = checkInTime.split(":").map(Number);
  const checkMins = ch * 60 + cm;
  const diff = checkMins - SHIFT_START_MINUTES;

  const dailyRate = (monthlySalary || 0) / 30;

  // حضر في الميعاد أو خلال فترة السماح (لحد 10:30)
  if (diff <= GRACE_MINUTES) {
    return { status: "present", lateMinutes: 0, deduction: 0 };
  }

  // من 10:31 لحد 11:00 → تأخير بدون خصم
  if (checkMins <= LATE_WINDOW_END_MINUTES) {
    return { status: "late", lateMinutes: diff, deduction: 0 };
  }

  // من 11:01 لحد 12:00 ظهرًا → خصم نص يوم
  if (checkMins <= HALF_DAY_WINDOW_END_MINUTES) {
    const deduction = Math.round((dailyRate / 2) * 100) / 100;
    return { status: "half_day", lateMinutes: diff, deduction };
  }

  // بعد 12:00 ظهرًا → يعتبر غياب كامل حتى لو حضر متأخر جدًا
  const deduction = Math.round(dailyRate * 100) / 100;
  return { status: "absent", lateMinutes: diff, deduction };
}

router.get("/attendance/my", async (req, res): Promise<void> => {
  const userId = (req as any).user?.id;
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const month = (req.query.month as string) || currentPayPeriodMonth();
  const { from: periodFrom, to: periodTo } = getPayPeriodDates(month);

  const [profile] = await db
    .select()
    .from(employeeProfilesTable)
    .where(eq(employeeProfilesTable.userId, userId));

  if (!profile) { res.json([]); return; }

  const records = await db
    .select()
    .from(attendanceTable)
    .where(eq(attendanceTable.profileId, profile.id));

  res.json(records.filter((r) => r.date >= periodFrom && r.date <= periodTo));
});

// ─── POST self check-in (current user from token) ─────────────────────────────
// POST /attendance/my/check-in
const CheckInBodySchema = z.object({
  photo: z.string().optional().nullable(),       // base64 data URL
  lat: z.number().optional().nullable(),
  lng: z.number().optional().nullable(),
  address: z.string().optional().nullable(),
});

router.post("/attendance/my/check-in", async (req, res): Promise<void> => {
  const userId = (req as any).user?.id;
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const parsedBody = CheckInBodySchema.safeParse(req.body ?? {});
  const { photo, lat, lng, address } = parsedBody.success ? parsedBody.data : {};

  const [profile] = await db
    .select()
    .from(employeeProfilesTable)
    .where(eq(employeeProfilesTable.userId, userId));

  if (!profile) { res.status(404).json({ error: "لا يوجد بروفايل موظف" }); return; }

  const today = cairoTodayString();
  const time = cairoTimeString(); // HH:MM بتوقيت القاهرة
  const graceMinutes = await getLateGraceMinutes();
  const { status: computedStatus, lateMinutes, deduction } = computeLateness((profile as any).shiftStart, time, profile.monthlySalary ?? 0, graceMinutes);

  // لو الموظف عائب أصلاً (اتعلّم عليه غياب كامل يوم سابق)، امنع تسجيل حضور جديد
  if ((profile as any).isFlagged) {
    res.status(403).json({ error: "أنت غائب اليوم، لا يمكنك تسجيل الحضور", flagged: true });
    return;
  }

  // بعد الساعة 1:01 ظهرًا → غياب يوم كامل، وممنوع تسجيل الحضور خالص (من غير ما نسجل أي حاجة في الداتابيز)
  if (computedStatus === "absent") {
    await db.update(employeeProfilesTable).set({ isFlagged: true } as any).where(eq(employeeProfilesTable.id, profile.id));
    res.status(403).json({ error: "انتهت فترة تسجيل الحضور اليوم، تم احتسابك غائبًا", flagged: true });
    return;
  }

  const [existing] = await db
    .select()
    .from(attendanceTable)
    .where(and(eq(attendanceTable.profileId, profile.id), eq(attendanceTable.date, today)));

  // الحالتين "late" (تأخير بدون خصم) و "half_day" (خصم نص يوم) بيتفتحلهم تسجيل حضور وانصراف عادي
  if (existing) {
    if (existing.checkIn) { res.status(409).json({ error: "تم تسجيل الحضور اليوم بالفعل" }); return; }
    await db
      .update(attendanceTable)
      .set({
        checkIn: time,
        status: computedStatus,
        lateMinutes,
        deduction,
        checkInPhoto: photo ?? null,
        checkInLat: lat ?? null,
        checkInLng: lng ?? null,
        checkInAddress: address ?? null,
      })
      .where(eq(attendanceTable.id, existing.id));
    const [updated] = await db.select().from(attendanceTable).where(eq(attendanceTable.id, existing.id));
    res.json(updated);
    return;
  }

  const insertResult = await db.insert(attendanceTable).values({
    profileId: profile.id,
    date: today,
    status: computedStatus,
    checkIn: time,
    lateMinutes,
    deduction,
    checkInPhoto: photo ?? null,
    checkInLat: lat ?? null,
    checkInLng: lng ?? null,
    checkInAddress: address ?? null,
  });
  const insertId = (insertResult as any)[0]?.insertId ?? (insertResult as any).insertId;
  const [created] = await db.select().from(attendanceTable).where(eq(attendanceTable.id, insertId));

  res.status(201).json(created);
});

// ─── POST self check-out (current user from token) ────────────────────────────
// POST /attendance/my/check-out
router.post("/attendance/my/check-out", async (req, res): Promise<void> => {
  const userId = (req as any).user?.id;
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const parsedBody = CheckInBodySchema.safeParse(req.body ?? {});
  const { photo, lat, lng, address } = parsedBody.success ? parsedBody.data : {};

  const [profile] = await db
    .select()
    .from(employeeProfilesTable)
    .where(eq(employeeProfilesTable.userId, userId));

  if (!profile) { res.status(404).json({ error: "لا يوجد بروفايل موظف" }); return; }

  const today = cairoTodayString();
  const time = cairoTimeString(); // HH:MM بتوقيت القاهرة

  const [existing] = await db
    .select()
    .from(attendanceTable)
    .where(and(eq(attendanceTable.profileId, profile.id), eq(attendanceTable.date, today)));

  if (!existing || !existing.checkIn) { res.status(400).json({ error: "لم يتم تسجيل الحضور اليوم بعد" }); return; }
  if (existing.checkOut) { res.status(409).json({ error: "تم تسجيل الخروج اليوم بالفعل" }); return; }

  await db
    .update(attendanceTable)
    .set({
      checkOut: time,
      checkOutPhoto: photo ?? null,
      checkOutLat: lat ?? null,
      checkOutLng: lng ?? null,
      checkOutAddress: address ?? null,
    })
    .where(eq(attendanceTable.id, existing.id));
  const [updated] = await db.select().from(attendanceTable).where(eq(attendanceTable.id, existing.id));
  res.json(updated);
});

// ─── GET my today's attendance status (current user from token) ──────────────
// GET /attendance/my/today
router.get("/attendance/my/today", async (req, res): Promise<void> => {
  const userId = (req as any).user?.id;
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const [profile] = await db
    .select()
    .from(employeeProfilesTable)
    .where(eq(employeeProfilesTable.userId, userId));

  if (!profile) { res.json(null); return; }

  const today = cairoTodayString();
  const [record] = await db
    .select()
    .from(attendanceTable)
    .where(and(eq(attendanceTable.profileId, profile.id), eq(attendanceTable.date, today)));

  res.json({ ...(record ?? {}), isFlagged: !!(profile as any).isFlagged });
});

// ─── GET my salary report (current user from token) ──────────────────────────
// GET /attendance/my/salary-report?month=YYYY-MM
router.get("/attendance/my/salary-report", async (req, res): Promise<void> => {
  const userId = (req as any).user?.id;
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const month = (req.query.month as string) || currentPayPeriodMonth();
  const [year, mon] = month.split("-").map(Number);
  const daysInMonth = new Date(year, mon, 0).getDate();

  const [profile] = await db
    .select()
    .from(employeeProfilesTable)
    .where(eq(employeeProfilesTable.userId, userId));

  if (!profile) {
    res.json({
      profileId: null, displayName: null, noProfile: true,
      month, baseSalary: 0, workedDays: 0, absentDays: 0, lateDays: 0,
      halfDays: 0, totalWorkingDays: daysInMonth,
      attendanceDeduction: 0, bonuses: 0, extraDeductions: 0, netSalary: 0,
      attendance: [], adjustments: [],
    });
    return;
  }

  const allRecords = await db.select().from(attendanceTable).where(eq(attendanceTable.profileId, profile.id));
  const { from: periodFrom, to: periodTo } = getPayPeriodDates(month);
  const records = allRecords.filter((r) => r.date >= periodFrom && r.date <= periodTo);

  const adjustments = await db
    .select()
    .from(payrollAdjustmentsTable)
    .where(and(eq(payrollAdjustmentsTable.profileId, profile.id), eq(payrollAdjustmentsTable.month, `${year}-${String(mon).padStart(2, "0")}`)));

  let workedDays = 0, absentDays = 0, lateDays = 0, halfDays = 0, holidayDays = 0, excusedDays = 0, totalDeduction = 0;
  for (const r of records) {
    if (r.status === "present")   workedDays++;
    else if (r.status === "late") { workedDays++; lateDays++; }
    else if (r.status === "absent")   absentDays++;
    else if (r.status === "half_day") halfDays++;
    else if (r.status === "holiday")  holidayDays++;
    else if (r.status === "excused")  excusedDays++;
    totalDeduction += Number(r.deduction) || 0;
  }

  const bonuses = adjustments.filter(a => a.type === "bonus").reduce((s, a) => s + Number(a.amount), 0);
  const extraDeductions = adjustments.filter(a => a.type === "deduction").reduce((s, a) => s + Number(a.amount), 0);
  const baseSalary = Number(profile.monthlySalary) || 0;
  const netSalary = baseSalary - totalDeduction + bonuses - extraDeductions;
  const totalRecordedDays = records.length;
  const workDays = records.filter(r => r.status !== "holiday").length;

  res.json({
    profileId: profile.id,
    displayName: profile.displayName,
    month,
    baseSalary,
    workedDays,
    absentDays,
    lateDays,
    halfDays,
    holidayDays,
    excusedDays,
    totalWorkingDays: daysInMonth,
    totalRecordedDays,
    workDays,
    attendanceDeduction: totalDeduction,
    bonuses,
    extraDeductions,
    netSalary,
    attendance: records,
    adjustments,
  });
});

// ─── إعدادات سماحية التأخير العامة (سوبر أدمن فقط) ───────────────────────────
// لازم تتسجل قبل /attendance/:profileId عشان Express متفسرش "settings" كـ profileId
// GET /attendance/settings/late-grace
router.get("/attendance/settings/late-grace", async (req, res): Promise<void> => {
  const graceMinutes = await getLateGraceMinutes();
  res.json({ graceMinutes });
});

// PATCH /attendance/settings/late-grace  { graceMinutes: number }
const LateGraceSchema = z.object({ graceMinutes: z.number().int().min(0).max(240) });
router.patch("/attendance/settings/late-grace", requireSuperAdmin, async (req, res): Promise<void> => {
  const parsed = LateGraceSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  await setLateGraceMinutes(parsed.data.graceMinutes);
  res.json({ graceMinutes: parsed.data.graceMinutes });
});

// ─── PATCH فك علامة "عائب" عن موظف (أدمن فقط) ────────────────────────────────
// PATCH /attendance/profile/:profileId/unflag
router.patch("/attendance/profile/:profileId/unflag", requireAdmin, async (req, res): Promise<void> => {
  const profileId = parseInt(req.params.profileId);
  if (isNaN(profileId)) { res.status(400).json({ error: "Invalid profileId" }); return; }

  await db.update(employeeProfilesTable).set({ isFlagged: false } as any).where(eq(employeeProfilesTable.id, profileId));
  const [updated] = await db.select().from(employeeProfilesTable).where(eq(employeeProfilesTable.id, profileId));
  res.json(updated);
});

// ─── GET attendance for a profile in a month ─────────────────────────────────
// GET /attendance/:profileId?month=YYYY-MM
router.get("/attendance/:profileId", async (req, res): Promise<void> => {
  const profileId = parseInt(req.params.profileId);
  if (isNaN(profileId)) { res.status(400).json({ error: "Invalid profileId" }); return; }

  const month = (req.query.month as string) || currentPayPeriodMonth();
  const { from: periodFrom, to: periodTo } = getPayPeriodDates(month);

  const records = await db
    .select()
    .from(attendanceTable)
    .where(
      and(
        eq(attendanceTable.profileId, profileId),
      )
    );

  // filter by pay period (varchar date field YYYY-MM-DD)
  const filtered = records.filter((r) => r.date >= periodFrom && r.date <= periodTo);

  res.json(filtered);
});

// ─── POST استثناء/تعديل يوم حضور (عفو عن غياب/تأخير أو خصم يدوي) ─────────────
// POST /attendance/:id/exception  { action: "excuse_absence" | "excuse_late" | "custom_deduction", reason, deductionAmount? }
const ExceptionSchema = z.object({
  action: z.enum(["excuse_absence", "excuse_late", "custom_deduction"]),
  reason: z.string().min(1).max(500),
  deductionAmount: z.number().min(0).optional(), // مطلوب فقط لو action = custom_deduction
});

router.post("/attendance/:id/exception", requireAdmin, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const parsed = ExceptionSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const { action, reason, deductionAmount } = parsed.data;

  const [record] = await db.select().from(attendanceTable).where(eq(attendanceTable.id, id));
  if (!record) { res.status(404).json({ error: "سجل الحضور غير موجود" }); return; }

  if (action === "custom_deduction" && (deductionAmount === undefined)) {
    res.status(400).json({ error: "deductionAmount مطلوب لهذا الإجراء" }); return;
  }

  let newStatus = record.status;
  let newDeduction = record.deduction;

  if (action === "excuse_absence") {
    newStatus = "excused";
    newDeduction = 0;
  } else if (action === "excuse_late") {
    newStatus = "present";
    newDeduction = 0;
  } else if (action === "custom_deduction") {
    newDeduction = deductionAmount!;
  }

  await db.update(attendanceTable)
    .set({ status: newStatus, deduction: newDeduction, notes: reason })
    .where(eq(attendanceTable.id, id));

  // تسجيل الإجراء في سجل الـ adjustments كمرجع تاريخي
  const month = record.date.slice(0, 7);
  await db.insert(payrollAdjustmentsTable).values({
    profileId: record.profileId,
    month,
    type: newDeduction < record.deduction ? "bonus" : "deduction", // "bonus" لو الخصم اتقل (استثناء)
    amount: Math.abs(record.deduction - newDeduction) || 0.01, // قيمة رمزية لو مفيش فرق مادي
    reason: `${action === "excuse_absence" ? "عفو عن غياب" : action === "excuse_late" ? "عفو عن تأخير" : "تعديل خصم يدوي"}: ${reason}`,
    attendanceId: id,
  });

  const [updated] = await db.select().from(attendanceTable).where(eq(attendanceTable.id, id));
  res.json(updated);
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

  const month = (req.query.month as string) || currentPayPeriodMonth();
  const [year, mon] = month.split("-").map(Number);
  const daysInMonth = new Date(year, mon, 0).getDate();

  const [profile] = await db
    .select()
    .from(employeeProfilesTable)
    .where(eq(employeeProfilesTable.id, profileId));

  if (!profile) { res.status(404).json({ error: "Profile not found" }); return; }

  const allRecords = await db.select().from(attendanceTable).where(eq(attendanceTable.profileId, profileId));
  const { from: periodFrom, to: periodTo } = getPayPeriodDates(month);
  const records = allRecords.filter((r) => r.date >= periodFrom && r.date <= periodTo);

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

  const month = (req.query.month as string) || currentPayPeriodMonth();

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
