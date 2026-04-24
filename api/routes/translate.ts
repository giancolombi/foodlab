import { Router } from "express";
import { z } from "zod";

import { requireAuth } from "../middleware/auth.js";
import { translateTexts, warmOllama } from "../llm.js";

const router = Router();

/**
 * POST /api/translate/warm — fire-and-forget warmup.
 * Returns immediately; the Ollama load happens in the background.
 */
router.post("/warm", requireAuth, (_req, res) => {
  void warmOllama();
  res.json({ ok: true });
});

const translateSchema = z.object({
  texts: z.array(z.string().min(1).max(500)).min(1).max(60),
  src: z.enum(["en", "es", "pt-BR"]),
  tgt: z.enum(["en", "es", "pt-BR"]),
});

/**
 * POST /api/translate — batched text translation via Ollama.
 * Body: { texts: string[], src, tgt }
 * Returns: { translations: string[] } — same length as `texts`.
 */
router.post("/", requireAuth, async (req, res) => {
  const parsed = translateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Provide 1–60 strings and src/tgt locales" });
    return;
  }
  try {
    const translations = await translateTexts(parsed.data);
    res.json({ translations });
  } catch (err) {
    console.error("[translate]", err);
    res.status(502).json({
      error: err instanceof Error ? err.message : "Translation failed",
    });
  }
});

export default router;
