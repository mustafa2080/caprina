import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";
import { db, usersTable } from "@workspace/db";
import { hashPassword } from "./lib/auth.js";

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
    if (existing.length > 0) return; // already seeded

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

seedDefaultAdmin();

export default app;
