import { Router } from "express";
import { z } from "zod";

import { consolidateShoppingList } from "../llm.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

const shoppingListSchema = z.object({
  recipes: z
    .array(
      z.object({
        title: z.string().min(1).max(200),
        forProfiles: z.array(z.string().min(1).max(100)).optional(),
        ingredients: z.array(z.string().min(1).max(400)).min(1).max(80),
      }),
    )
    .min(1)
    .max(20),
  locale: z.enum(["en", "es", "pt-BR"]).optional(),
});

/**
 * POST /api/plans/shopping-list — smart-consolidate a multi-recipe shopping
 * list via Ollama. The client already has a deterministic fallback; this is a
 * quality upgrade (merges odd duplicates, better categorization, localizes
 * item names). Caller is expected to pre-split per-profile items into
 * separate pseudo-recipe entries with `forProfiles` set.
 */
router.post("/shopping-list", requireAuth, async (req, res) => {
  const parsed = shoppingListSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid payload" });
    return;
  }
  try {
    const sections = await consolidateShoppingList(parsed.data);
    res.json({ sections });
  } catch (err) {
    console.error("[plans/shopping-list]", err);
    res.status(502).json({
      error: err instanceof Error ? err.message : "Consolidation failed",
    });
  }
});

export default router;
