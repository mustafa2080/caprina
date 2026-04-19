import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";
import { db, usersTable, employeeProfilesTable, employeeKpisTable, employeeDailyLogsTable } from "@workspace/db";
import { hashPassword } from "./lib/auth.js";
import { eq, isNull, sql } from "drizzle-orm";

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api", router);

// ─── Seed default admin on startup ─────────────────────────────────────────
async function seedDefaultAdmin() {
  try {
    const existing = await db.select({ id: usersTable.id }).from(usersTable).limit(1);
    if (existing.length > 0) return;

    const passwordHash = await hashPassword("admin123");
    await db.insert(usersTable).values({
      username: "admin",
      passwordHash,
      displayName: "المدير",
      role: "admin",
      permissions: [],
      isActive: true,
    });
    logger.info("Default admin user created: admin / admin123");
  } catch (err) {
    logger.error({ err }, "Failed to seed default admin");
  }
}

// ─── Backfill: populate profileId + displayName for existing records ─────────
async function backfillEmployeeProfileIds() {
  try {
    // 1. Fill profile.displayName from linked user where still null
    await db.execute(sql`
      UPDATE employee_profiles ep
      SET display_name = u.display_name
      FROM users u
      WHERE ep.user_id = u.id AND ep.display_name IS NULL
    `);

    // 2. Fill kpis.profileId where still null (match via userId)
    await db.execute(sql`
      UPDATE employee_kpis k
      SET profile_id = ep.id
      FROM employee_profiles ep
      WHERE ep.user_id = k.user_id AND k.profile_id IS NULL AND k.user_id IS NOT NULL
    `);

    // 3. Fill daily_logs.profileId where still null (match via userId)
    await db.execute(sql`
      UPDATE employee_daily_logs l
      SET profile_id = ep.id
      FROM employee_profiles ep
      WHERE ep.user_id = l.user_id AND l.profile_id IS NULL AND l.user_id IS NOT NULL
    `);
  } catch (err) {
    logger.error({ err }, "Failed to backfill employee profile IDs");
  }
}

seedDefaultAdmin();
backfillEmployeeProfileIds();

export default app;
