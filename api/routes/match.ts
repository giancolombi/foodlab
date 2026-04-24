import { Router } from "express";
import { z } from "zod";

import { pool } from "../db.js";
import { requireAuth } from "../middleware/auth.js";
import { streamRecommendations } from "../llm.js";

const router = Router();

const matchSchema = z.object({
  ingredients: z.array(z.string().min(1).max(80)).min(1).max(40),
  profileIds: z.array(z.string().uuid()).max(20).optional(),
  locale: z.enum(["en", "es", "pt-BR"]).optional(),
});

/**
 * POST /api/match — Server-Sent Events stream.
 *
 * Event types emitted as `data: <json>\n\n`:
 *   - { type: "chunk",    content: string }      — raw token from the LLM
 *   - { type: "complete", recommendations: [...] } — final validated payload
 *   - { type: "error",    message: string }
 */
router.post("/", requireAuth, async (req, res) => {
  const parsed = matchSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Provide 1–40 ingredient strings" });
    return;
  }
  const { ingredients, profileIds, locale } = parsed.data;

  // Up-front loads so a DB error returns a normal 500 rather than mid-stream.
  let recipes;
  let profiles: Array<{
    name: string;
    restrictions: string[];
    allergies: string[];
    preferences: string[];
  }> = [];
  try {
    // Match against curated recipes plus the caller's own saved/modified ones.
    const recipesResult = await pool.query(
      `SELECT id, slug, title, cuisine, shared_ingredients, versions
       FROM recipes
       WHERE owner_user_id IS NULL OR owner_user_id = $1::uuid`,
      [req.user!.sub],
    );
    recipes = recipesResult.rows;

    if (profileIds && profileIds.length) {
      const { rows } = await pool.query(
        `SELECT name, restrictions, allergies, preferences
         FROM profiles WHERE id = ANY($1) AND user_id = $2`,
        [profileIds, req.user!.sub],
      );
      profiles = rows;
    }
  } catch (err) {
    console.error("match db error", err);
    res.status(500).json({ error: "Database error" });
    return;
  }

  // Begin SSE stream.
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no"); // disable nginx buffering
  res.flushHeaders?.();

  const send = (payload: object) => {
    res.write(`data: ${JSON.stringify(payload)}\n\n`);
  };

  // Heartbeat so any intermediate proxy keeps the connection open while the
  // model is still loading on the first request after a cold start.
  const heartbeat = setInterval(() => res.write(`: keepalive\n\n`), 15000);

  // If the client navigates away, abort.
  let aborted = false;
  req.on("close", () => {
    aborted = true;
    clearInterval(heartbeat);
  });

  try {
    await streamRecommendations(
      { ingredients, profiles, recipes, locale },
      {
        onContent: (chunk) => {
          if (aborted) return;
          send({ type: "chunk", content: chunk });
        },
        onDone: ({ recommendations }) => {
          if (aborted) return;
          send({ type: "complete", recommendations });
        },
      },
    );
  } catch (err) {
    console.error("match stream error", err);
    if (!aborted) {
      send({
        type: "error",
        message:
          "The local LLM is unavailable. It may still be loading the model — try again in a minute.",
      });
    }
  } finally {
    clearInterval(heartbeat);
    res.end();
  }
});

export default router;
