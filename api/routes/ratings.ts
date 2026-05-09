import { Router } from "express";
import { z } from "zod";

import { pool } from "../db.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

const rateSchema = z.object({
  slug: z.string().min(1).max(200),
  stars: z.number().int().min(1).max(5),
  notes: z.string().max(1000).optional(),
});

/**
 * POST /api/ratings — upsert the caller's rating for a recipe slug. The
 * existing UNIQUE on (user_id, recipe_id, profile_id) doesn't work
 * cleanly when profile_id IS NULL (NULL ≠ NULL in standard SQL), so we
 * delete-and-insert in a transaction instead of relying on ON CONFLICT.
 *
 * The slug→recipe lookup picks the English row (locale='en') since
 * ratings are conceptually per-dish, not per-translation.
 */
router.post("/", requireAuth, async (req, res) => {
  const parsed = rateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Provide slug, stars (1-5), optional notes" });
    return;
  }
  const { slug, stars, notes } = parsed.data;
  const userId = req.user!.sub;

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const recipe = await client.query<{ id: string }>(
      `SELECT id FROM recipes WHERE slug = $1 ORDER BY locale = 'en' DESC LIMIT 1`,
      [slug],
    );
    if (!recipe.rows[0]) {
      await client.query("ROLLBACK");
      res.status(404).json({ error: "Recipe not found" });
      return;
    }
    const recipeId = recipe.rows[0].id;

    await client.query(
      `DELETE FROM ratings
       WHERE user_id = $1 AND recipe_id = $2 AND profile_id IS NULL`,
      [userId, recipeId],
    );
    const ins = await client.query<{
      id: string;
      stars: number;
      notes: string | null;
    }>(
      `INSERT INTO ratings (user_id, recipe_id, profile_id, stars, notes)
       VALUES ($1, $2, NULL, $3, $4)
       RETURNING id, stars, notes`,
      [userId, recipeId, stars, notes ?? null],
    );
    await client.query("COMMIT");
    res.status(201).json({ rating: ins.rows[0] });
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("[ratings POST]", err);
    res.status(500).json({ error: "Could not save rating" });
  } finally {
    client.release();
  }
});

/**
 * DELETE /api/ratings/:slug — clear the caller's rating for a recipe.
 */
router.delete("/:slug", requireAuth, async (req, res) => {
  const userId = req.user!.sub;
  try {
    const recipe = await pool.query<{ id: string }>(
      `SELECT id FROM recipes WHERE slug = $1 ORDER BY locale = 'en' DESC LIMIT 1`,
      [req.params.slug],
    );
    if (!recipe.rows[0]) {
      res.status(404).json({ error: "Recipe not found" });
      return;
    }
    await pool.query(
      `DELETE FROM ratings
       WHERE user_id = $1 AND recipe_id = $2 AND profile_id IS NULL`,
      [userId, recipe.rows[0].id],
    );
    res.status(204).end();
  } catch (err) {
    console.error("[ratings DELETE]", err);
    res.status(500).json({ error: "Could not remove rating" });
  }
});

export default router;
