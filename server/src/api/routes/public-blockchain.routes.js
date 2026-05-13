import { Router } from "express";
import * as publicBlockchainController from "../controllers/public-blockchain.controller.js";
import { requireAuth } from "../../middleware/auth.middleware.js";

const router = Router();

router.get("/blocks", publicBlockchainController.getBlocks);
router.post("/blocks", requireAuth, publicBlockchainController.postBlock);

export { router as publicBlockchainRouter };