import { Router, type IRouter } from "express";
import healthRouter from "./health";
import ordersRouter from "./orders";
import productsRouter from "./products";
import variantsRouter from "./variants";
import shippingRouter from "./shipping";
import importRouter from "./import";
import movementsRouter from "./movements";
import analyticsRouter from "./analytics";
import authRouter from "./auth";
import usersRouter from "./users";
import auditRouter from "./audit";
import manifestsRouter from "./manifests";
import warehousesRouter from "./warehouses";
import teamAnalyticsRouter from "./team-analytics";
import employeeRouter from "./employee";
import brandRouter from "./brand";
import settingsRouter from "./settings";
import exportRouter from "./export";
import whatsappRouter from "./whatsapp";
import sessionsRouter from "./sessions";
import { requireAuth } from "../middlewares/requireAuth.js";

const router: IRouter = Router();

// Public routes (no auth required)
router.use(healthRouter);
router.use("/auth", authRouter);
router.use(brandRouter); // GET /brand + GET /brand/logo are public; PATCH/POST/DELETE self-protect internally
router.use(settingsRouter); // GET/PATCH /settings — app feature flags

// All routes below require authentication
router.use(requireAuth);
router.use("/users", usersRouter);
router.use("/audit-logs", auditRouter);
router.use(importRouter);
router.use(movementsRouter);
router.use(analyticsRouter);
router.use(variantsRouter);
router.use(ordersRouter);
router.use(productsRouter);
router.use(shippingRouter);
router.use(manifestsRouter);
router.use(warehousesRouter);
router.use(teamAnalyticsRouter);
router.use(employeeRouter);
router.use(exportRouter);
router.use(whatsappRouter);
router.use("/sessions", sessionsRouter);

export default router;
