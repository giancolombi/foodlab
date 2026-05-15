import { Router } from "express";

import { requireAuth } from "../middleware/auth.js";
import { warmLLM } from "../llm.js";

const router = Router();

/**
 * POST /api/translate/warm — fire-and-forget warmup, kept for backwards
 * compatibility with existing clients. It's now a no-op: the LLM is a hosted
 * API with no model to pre-load. All other translate endpoints are gone now
 * that recipes are pre-localized at the data layer.
 */
router.post("/warm", requireAuth, (_req, res) => {
  void warmLLM();
  res.json({ ok: true });
});

export default router;
