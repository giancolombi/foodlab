import { Router } from "express";
import { z } from "zod";

import { pool } from "../db.js";
import { consolidateShoppingList } from "../llm.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

// ---- Plan persistence (one current plan per user) ----

const slotKeyPattern = /^[0-6]-(breakfast|lunch|dinner)$/;

const planSchema = z.object({
  assignments: z.record(
    z.string().regex(slotKeyPattern),
    z.object({
      slug: z.string().min(1).max(200),
      assignedAt: z.number(),
    }),
  ),
  activeProfileIds: z.array(z.string().uuid()).default([]),
  includeServeWith: z.boolean().default(false),
});

router.get("/", requireAuth, async (req, res) => {
  const { rows } = await pool.query(
    `SELECT assignments, active_profile_ids, include_serve_with, updated_at
     FROM meal_plans WHERE user_id = $1`,
    [req.user!.sub],
  );
  if (!rows[0]) {
    res.json({
      plan: {
        assignments: {},
        activeProfileIds: [],
        includeServeWith: false,
        updatedAt: null,
      },
    });
    return;
  }
  const row = rows[0];
  res.json({
    plan: {
      assignments: row.assignments,
      activeProfileIds: row.active_profile_ids,
      includeServeWith: row.include_serve_with,
      updatedAt: row.updated_at,
    },
  });
});

router.put("/", requireAuth, async (req, res) => {
  const parsed = planSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid plan payload" });
    return;
  }
  const { assignments, activeProfileIds, includeServeWith } = parsed.data;
  const { rows } = await pool.query(
    `INSERT INTO meal_plans (user_id, assignments, active_profile_ids, include_serve_with)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (user_id) DO UPDATE
       SET assignments = EXCLUDED.assignments,
           active_profile_ids = EXCLUDED.active_profile_ids,
           include_serve_with = EXCLUDED.include_serve_with,
           updated_at = now()
     RETURNING assignments, active_profile_ids, include_serve_with, updated_at`,
    [req.user!.sub, JSON.stringify(assignments), activeProfileIds, includeServeWith],
  );
  const row = rows[0];
  res.json({
    plan: {
      assignments: row.assignments,
      activeProfileIds: row.active_profile_ids,
      includeServeWith: row.include_serve_with,
      updatedAt: row.updated_at,
    },
  });
});

// ---- Auto-generate plan ----

const generateSchema = z.object({
  profileIds: z.array(z.string().uuid()).default([]),
  excludeSlugs: z.array(z.string().max(200)).default([]),
});

interface RecipeRow {
  slug: string;
  title: string;
  category: string;
  cuisine: string | null;
  versions: Array<{ name: string; group_label?: string | null }>;
}

router.post("/generate", requireAuth, async (req, res) => {
  const parsed = generateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid payload" });
    return;
  }
  const { profileIds, excludeSlugs } = parsed.data;

  // Load visible recipes.
  const { rows: recipes } = await pool.query<RecipeRow>(
    `SELECT slug, title, category, cuisine, versions
     FROM recipes
     WHERE owner_user_id IS NULL OR owner_user_id = $1
     ORDER BY random()`,
    [req.user!.sub],
  );

  // Load average ratings.
  const { rows: ratingRows } = await pool.query<{
    recipe_id: string;
    slug: string;
    avg: string;
  }>(
    `SELECT r.recipe_id, rec.slug, AVG(r.stars)::text AS avg
     FROM ratings r JOIN recipes rec ON r.recipe_id = rec.id
     GROUP BY r.recipe_id, rec.slug`,
  );
  const avgRating = new Map(ratingRows.map((r) => [r.slug, parseFloat(r.avg)]));

  // Load profiles if provided.
  let profileRestrictions: string[][] = [];
  if (profileIds.length) {
    const { rows: profiles } = await pool.query<{ restrictions: string[] }>(
      `SELECT restrictions FROM profiles WHERE id = ANY($1) AND user_id = $2`,
      [profileIds, req.user!.sub],
    );
    profileRestrictions = profiles.map((p) => p.restrictions);
  }

  const excludeSet = new Set(excludeSlugs);

  // Filter: every active profile must have a plausible version match.
  // Simple heuristic: if profile has restrictions, at least one version
  // group_label must contain a restriction keyword.
  const eligible = recipes.filter((r) => {
    if (excludeSet.has(r.slug)) return false;
    if (avgRating.get(r.slug) !== undefined && avgRating.get(r.slug)! < 2) return false;
    if (!profileRestrictions.length) return true;
    return profileRestrictions.every((restrictions) => {
      if (!restrictions.length) return true;
      return r.versions.some((v) => {
        const label = (v.group_label ?? v.name ?? "").toLowerCase();
        return restrictions.some((rest) => label.includes(rest.toLowerCase()));
      });
    });
  });

  const mains = eligible.filter((r) => r.category === "mains");
  const breakfasts = eligible.filter((r) => r.category === "breakfast");

  // Score: higher avg rating = picked first. Ties broken by random() in query.
  const score = (r: RecipeRow) => avgRating.get(r.slug) ?? 3;
  mains.sort((a, b) => score(b) - score(a));
  breakfasts.sort((a, b) => score(b) - score(a));

  // Pick ensuring cuisine diversity.
  const picked: Array<{ slug: string; category: string }> = [];
  const usedCuisines = new Set<string>();

  function pickFrom(pool: RecipeRow[], n: number) {
    // First pass: prefer diverse cuisines.
    for (const r of pool) {
      if (picked.length >= n + picked.length) break;
      if (picked.some((p) => p.slug === r.slug)) continue;
      const c = (r.cuisine ?? "").toLowerCase();
      if (c && usedCuisines.has(c)) continue;
      picked.push({ slug: r.slug, category: r.category });
      if (c) usedCuisines.add(c);
      if (picked.filter((p) => p.category === r.category).length >= n) return;
    }
    // Second pass: fill remaining without cuisine constraint.
    for (const r of pool) {
      if (picked.filter((p) => p.category === r.category).length >= n) return;
      if (picked.some((p) => p.slug === r.slug)) continue;
      picked.push({ slug: r.slug, category: r.category });
    }
  }

  pickFrom(mains, 4);
  pickFrom(breakfasts, 1);

  // Assign to slots: breakfasts to Saturday breakfast, mains to Mon-Thu dinners.
  const assignments: Record<string, { slug: string; assignedAt: number }> = {};
  const now = Date.now();
  const mainPicks = picked.filter((p) => p.category === "mains");
  const breakfastPicks = picked.filter((p) => p.category === "breakfast");

  mainPicks.forEach((p, i) => {
    if (i < 4) {
      assignments[`${i}-dinner`] = { slug: p.slug, assignedAt: now };
    }
  });
  breakfastPicks.forEach((p) => {
    assignments["5-breakfast"] = { slug: p.slug, assignedAt: now };
  });

  res.json({ assignments });
});

// ---- Smart shopping list ----

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
