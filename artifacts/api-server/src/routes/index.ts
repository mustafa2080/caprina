import { Router, type IRouter } from "express";
import healthRouter from "./health";
import ordersRouter from "./orders";
import productsRouter from "./products";
import variantsRouter from "./variants";
import shippingRouter from "./shipping";
import importRouter from "./import";
import movementsRouter from "./movements";

const router: IRouter = Router();

router.use(healthRouter);
router.use(importRouter);
router.use(movementsRouter);
router.use(variantsRouter);
router.use(ordersRouter);
router.use(productsRouter);
router.use(shippingRouter);

export default router;
