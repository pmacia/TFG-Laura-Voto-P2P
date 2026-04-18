import { Router } from "express";
import { healthController } from "../controllers/health.controller.js";
import { requireAuth } from "../../middleware/auth.middleware.js";

const router = Router();

router.get("/", healthController);
router.get("/healthAuth", requireAuth, healthController);

export { router as healthRouter };