import { Router } from "express";
import * as tokenController from "../controllers/token.controller.js";
import { requireAuth } from "../../middleware/auth.middleware.js";

const router = Router();

router.post("/", requireAuth, tokenController.requestToken);

export { router as tokenRouter };