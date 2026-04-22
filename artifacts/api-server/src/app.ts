import express, { type Express } from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";
import { db, usersTable } from "@workspace/db";
import { hashPassword } from "./lib/auth.js";
import { eq, sql } from "drizzle-orm";

import crypto from "node:crypto";

const app: Express = express();

// ─── Trust proxy (for Apache reverse proxy) ──────────────────────────────────
app.set("trust proxy", 1);

// ─── Security: Helmet (sets secure HTTP headers) ────────────────────────────
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" },
}));

// ─── Security: CORS — restrict to ALLOWED_ORIGINS env var ───────────────────
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(",").map((o) => o.trim())
  : [];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    if (allowedOrigins.length === 0 || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    callback(new Error(`CORS: origin '${origin}' not allowed`));
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
}));

// ─── Security: Global rate limiter ──────────────────────────────────────────
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 500,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "طلبات كثيرة جداً، يرجى المحاولة بعد قليل" },
});
app.use(globalLimiter);

// ─── Logging ─────────────────────────────────────────────────────────────────
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
        return { statusCode: res.statusCode };
      },
    },
  }),
);

// ─── Body parsing ─────────────────────────────────────────────────────────────
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

app.use("/api", router);

// ─── Global JSON error handler (must be AFTER routes) ────────────────────────
// Ensures all unhandled errors return JSON instead of an HTML error page.
import type { Request, Response, NextFunction } from "express";
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  console.error("[global error handler]", err);
  res.status(err.status ?? 500).json({
    error: err.message ?? "حدث خطأ غير متوقع",
  });
});

// ─── Seed default admin on startup ───────────────────────────────────────────
// Generates a strong random password on first run and logs it ONCE.
// Change this password immediately after first login.
async function seedDefaultAdmin() {
  try {
    const existing = await db.select({ id: usersTable.id }).from(usersTable).limit(1);
    if (existing.length > 0) return;

    // Generate a secure random password instead of a hardcoded one
    const randomPassword = crypto.randomBytes(12).toString("base64url");
    const passwordHash = await hashPassword(randomPassword);

    await db.insert(usersTable).values({
      username: "admin",
      passwordHash,
      displayName: "المدير",
      role: "admin",
      permissions: [],
      isActive: true,
    });

    // Log the password clearly — change it immediately after first login
    logger.warn("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    logger.warn(`  DEFAULT ADMIN CREATED`);
    logger.warn(`  Username : admin`);
    logger.warn(`  Password : ${randomPassword}`);
    logger.warn(`  ⚠️  Change this password immediately after first login!`);
    logger.warn("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  } catch (err) {
    logger.error({ err }, "Failed to seed default admin");
  }
}

// ─── Backfill: employee profile IDs + displayNames ───────────────────────────
async function backfillEmployeeProfileIds() {
  try {
    await db.execute(sql`
      UPDATE employee_profiles ep
      JOIN users u ON ep.user_id = u.id
      SET ep.display_name = u.display_name
      WHERE ep.display_name IS NULL
    `);
    await db.execute(sql`
      UPDATE employee_kpis k
      JOIN employee_profiles ep ON ep.user_id = k.user_id
      SET k.profile_id = ep.id
      WHERE k.profile_id IS NULL AND k.user_id IS NOT NULL
    `);
    await db.execute(sql`
      UPDATE employee_daily_logs l
      JOIN employee_profiles ep ON ep.user_id = l.user_id
      SET l.profile_id = ep.id
      WHERE l.profile_id IS NULL AND l.user_id IS NOT NULL
    `);
  } catch (err) {
    logger.error({ err }, "Failed to backfill employee profile IDs");
  }
}

seedDefaultAdmin();
backfillEmployeeProfileIds();

// ─── Ensure app_settings table exists (safe for VPS without migrations) ──────
async function ensureAppSettingsTable() {
  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS app_settings (
        \`key\` VARCHAR(100) NOT NULL PRIMARY KEY,
        \`value\` LONGTEXT,
        \`updated_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);
    // Migrate existing TEXT column to LONGTEXT (safe to run multiple times)
    await db.execute(sql`
      ALTER TABLE app_settings MODIFY COLUMN \`value\` LONGTEXT
    `);
    logger.info("app_settings table ensured");
  } catch (err) {
    logger.error({ err }, "Failed to ensure app_settings table");
  }
}
ensureAppSettingsTable();

export default app;
