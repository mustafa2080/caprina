import { db, employeeProfilesTable, attendanceTable } from "@workspace/db";
import { and, eq, isNull, or } from "drizzle-orm";

/**
 * attendanceCron — يشتغل كل 10 دقايق
 * مواعيد العمل الثابتة (نظام 12 ساعة): من 10:00 ص لحد 7:00 م
 * أي موظف يعدي عليه الساعة 1:01 ظهرًا من غير تسجيل حضور
 * بيتحول لـ "absent" تلقائيًا لليوم الحالي (خصم يوم كامل)
 * (لازم يتطابق مع HALF_DAY_WINDOW_END_MINUTES في routes/attendance.ts — نافذة خصم نص اليوم لحد 1:00 ظهرًا)
 */
const ABSENT_CUTOFF_MINUTES = 13 * 60; // 1:00 ظهرًا
const CAIRO_TZ = "Africa/Cairo";

export async function runAttendanceAbsentCron(): Promise<void> {
  // السيرفر شغال UTC، فلازم نحول الوقت الحالي لتوقيت القاهرة صراحة
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: CAIRO_TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  const cairoParts = new Intl.DateTimeFormat("en-GB", { timeZone: CAIRO_TZ, hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(new Date());
  const cairoHour = Number(cairoParts.find(p => p.type === "hour")?.value ?? "0");
  const cairoMinute = Number(cairoParts.find(p => p.type === "minute")?.value ?? "0");
  const nowMinutes = cairoHour * 60 + cairoMinute;

  // قبل الـ cutoff (12 ظهرًا) لسه في وقت للموظف يحضر (تأخير / نص يوم)
  if (nowMinutes < ABSENT_CUTOFF_MINUTES) return;

  try {
    const profiles = await db.select().from(employeeProfilesTable);
    let markedCount = 0;

    for (const profile of profiles) {
      const [existing] = await db
        .select()
        .from(attendanceTable)
        .where(and(eq(attendanceTable.profileId, profile.id), eq(attendanceTable.date, today)));

      if (existing) {
        // لو موجود بالفعل وسجل حضور، سيبه. لو موجود وحالته absent خلاص، سيبه.
        if (existing.checkIn || existing.status === "absent") continue;
        await db.update(attendanceTable)
          .set({ status: "absent" })
          .where(eq(attendanceTable.id, existing.id));
        markedCount++;
        continue;
      }

      // مفيش سجل خالص لليوم ده — أنشئ صف absent جديد
      await db.insert(attendanceTable).values({
        profileId: profile.id,
        date: today,
        status: "absent",
      });
      markedCount++;
    }

    if (markedCount > 0) {
      console.log(`[AttendanceCron] 🔴 ${markedCount} موظف اتسجل غياب تلقائي`);
    }
  } catch (err) {
    console.error("[AttendanceCron] ❌ فشل:", err);
  }
}

/**
 * startAttendanceCron — بيشغل الفحص كل 10 دقايق
 * يستدعيها مرة واحدة في app.ts
 */
export function startAttendanceCron(): void {
  const MS_10_MIN = 10 * 60 * 1000;
  runAttendanceAbsentCron();
  setInterval(runAttendanceAbsentCron, MS_10_MIN);
  console.log("[AttendanceCron] ✅ تم تشغيل فحص الغياب التلقائي — كل 10 دقايق");
}
