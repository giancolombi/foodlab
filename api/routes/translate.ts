import { Router } from "express";

import { requireAuth } from "../middleware/auth.js";
import { warmOllama } from "../llm.js";

const router = Router();

/**
 * POST /api/translate/warm — fire-and-forget warmup. Returns immediately;
 * the Ollama model load happens in the background so the next streaming
 * call (modify, match, compose) doesn't pay cold-start.
 *
 * The route is mounted at /api/translate for backwards compatibility with
 * existing clients; all other translate endpoints are gone now that
 * recipes are pre-localized at the data layer.
 */
router.post("/warm", requireAuth, (_req, res) => {
  void warmOllama();
  res.json({ ok: true });
});

export default router;
