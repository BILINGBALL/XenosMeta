import { Router } from "express";
import { authMiddleware } from "@middleware/auth";
import { asyncHandler } from "@utils/async-handler";
import { aiGenerateController } from "@modules/developer/controller/ai-generate.controller";

const router = Router();

router.post(
  "/ai-generate",
  authMiddleware,
  asyncHandler(aiGenerateController.generate),
);

export default router;
