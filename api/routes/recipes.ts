import crypto from "node:crypto";

import { Router } from "express";
import { z } from "zod";

import { pool } from "../db.js";
import { renderRecipeMarkdown, streamModifyRecipe } from "../llm.js";
import { requireAuth, verifyToken } from "../middleware/auth.js";
import { parseRecipe } from "../recipeParser.js";

const router = Router();

/**
 * Optional auth — if a token is present we attach req.user, otherwise we
 * continue anonymously. Used by the public list/detail endpoints so logged-in
 * users see their private recipes mixed in with curated ones.
 */
function optionalAuth(req: any, _res: any, next: any) {
  const header = req.headers.authorization;
  if (header?.startsWith("Bearer ")) {
    try {
      req.user = verifyToken(header.slice("Bearer ".length));
    } catch {
      // Ignore — treat as anonymous.
    }
  }
  next();
}

// Visibility: a row is visible if it's curated (no owner) OR owned by the
// caller OR marked public. Currently public is reserved (sharing UI is
// disabled in v1) so `is_public` rows are still hidden for now.
function buildVisibilityClause(
  userId: string | undefined,
  paramOffset = 0,
): {
  clause: string;
  params: any[];
} {
  if (userId) {
    return {
      clause: `(owner_user_id IS NULL OR owner_user_id = $${paramOffset + 1}::uuid)`,
      params: [userId],
    };
  }
  return { clause: `owner_user_id IS NULL`, params: [] };
}

router.get("/", optionalAuth, async (req, res) => {
  const category =
    typeof req.query.category === "string" ? req.query.category : null;
  const search =
    typeof req.query.search === "string" ? req.query.search.trim() : "";
  const ownerFilter =
    typeof req.query.owner === "string" ? req.query.owner : null; // "mine" | "curated" | null

  const vis = buildVisibilityClause(req.user?.sub);
  const params: any[] = [...vis.params];
  const where: string[] = [vis.clause];

  if (category) {
    params.push(category);
    where.push(`category = $${params.length}`);
  }
  if (search) {
    params.push(`%${search.toLowerCase()}%`);
    where.push(
      `(LOWER(title) LIKE $${params.length} OR LOWER(cuisine) LIKE $${params.length})`,
    );
  }
  if (ownerFilter === "mine" && req.user?.sub) {
    params.push(req.user.sub);
    where.push(`owner_user_id = $${params.length}::uuid`);
  } else if (ownerFilter === "curated") {
    where.push(`owner_user_id IS NULL`);
  }

  const { rows } = await pool.query(
    `SELECT id, slug, title, category, cuisine, freezer_friendly,
            prep_minutes, cook_minutes, shared_ingredients, serve_with, versions,
            owner_user_id, parent_slug, is_public, modification_note
     FROM recipes
     WHERE ${where.join(" AND ")}
     ORDER BY title ASC`,
    params,
  );
  res.json({ recipes: rows });
});

router.get("/:slug", optionalAuth, async (req, res) => {
  // slug is $1, so visibility params start at $2.
  const vis = buildVisibilityClause(req.user?.sub, 1);
  const { rows } = await pool.query(
    `SELECT * FROM recipes WHERE slug = $1 AND ${vis.clause}`,
    [req.params.slug, ...vis.params],
  );
  if (!rows[0]) {
    res.status(404).json({ error: "Recipe not found" });
    return;
  }
  res.json({ recipe: rows[0] });
});

/**
 * POST /api/recipes/:slug/modify — Server-Sent Events.
 * Streams the modified recipe markdown back to the client.
 *
 * Events:
 *   - { type: "chunk",    content: string }     — raw markdown token
 *   - { type: "complete", markdown: string }    — final cleaned markdown
 *   - { type: "error",    message: string }
 */
const modifySchema = z.object({
  instruction: z.string().min(3).max(400),
  locale: z.enum(["en", "es", "pt-BR"]).optional(),
});

router.post("/:slug/modify", requireAuth, async (req, res) => {
  const parsed = modifySchema.safeParse(req.body);
  if (!parsed.success) {
    res
      .status(400)
      .json({ error: "Provide a 3–400 character instruction string" });
    return;
  }

  // Load the source recipe (must be visible to the caller).
  let original: { raw_markdown: string; title: string; slug: string };
  try {
    // slug is $1, so visibility params start at $2.
    const vis = buildVisibilityClause(req.user!.sub, 1);
    const { rows } = await pool.query(
      `SELECT raw_markdown, title, slug FROM recipes
       WHERE slug = $1 AND ${vis.clause}`,
      [req.params.slug, ...vis.params],
    );
    if (!rows[0]) {
      res.status(404).json({ error: "Recipe not found" });
      return;
    }
    original = rows[0];
  } catch (err) {
    console.error("modify db error", err);
    res.status(500).json({ error: "Database error" });
    return;
  }

  // Begin SSE stream.
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders?.();

  const send = (payload: object) => {
    res.write(`data: ${JSON.stringify(payload)}\n\n`);
  };
  const heartbeat = setInterval(() => res.write(`: keepalive\n\n`), 15000);

  let aborted = false;
  req.on("close", () => {
    aborted = true;
    clearInterval(heartbeat);
  });

  try {
    await streamModifyRecipe(
      {
        originalMarkdown: original.raw_markdown,
        instruction: parsed.data.instruction,
        locale: parsed.data.locale,
      },
      {
        onContent: (chunk) => {
          if (aborted) return;
          send({ type: "chunk", content: chunk });
        },
        onDone: ({ recipe }) => {
          if (aborted) return;
          const markdown = renderRecipeMarkdown(recipe, original.title);
          send({ type: "complete", recipe, markdown });
        },
      },
    );
  } catch (err) {
    console.error("modify stream error", err);
    if (!aborted) {
      send({
        type: "error",
        message: "The local LLM is unavailable. Try again in a minute.",
      });
    }
  } finally {
    clearInterval(heartbeat);
    res.end();
  }
});

/**
 * POST /api/recipes — save a user-owned recipe (typically a modification).
 * Body: { markdown: string, parentSlug?: string, modificationNote?: string }
 */
const createSchema = z.object({
  markdown: z.string().min(50).max(50_000),
  parentSlug: z.string().min(1).max(120).optional(),
  modificationNote: z.string().max(400).optional(),
});

router.post("/", requireAuth, async (req, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid recipe payload" });
    return;
  }
  const { markdown, parentSlug, modificationNote } = parsed.data;

  // Inherit category from parent if present, otherwise default to mains.
  let category: "mains" | "breakfast" = "mains";
  if (parentSlug) {
    try {
      const { rows } = await pool.query(
        `SELECT category FROM recipes WHERE slug = $1`,
        [parentSlug],
      );
      if (rows[0]?.category === "breakfast") category = "breakfast";
    } catch {
      // Non-fatal — keep default.
    }
  }

  // Generate a unique slug. Base off the parent (so URLs stay readable) and
  // append a short hash. If the user happens to fork the same recipe twice,
  // each gets a distinct slug.
  const baseSlug = parentSlug ?? `custom-recipe`;
  const suffix = crypto.randomBytes(3).toString("hex");
  const newSlug = `${baseSlug}-${suffix}`.slice(0, 120);

  let parsedRecipe;
  try {
    parsedRecipe = parseRecipe(markdown, category, newSlug);
  } catch (err) {
    console.error("recipe parse error", err);
    res.status(400).json({ error: "Could not parse recipe markdown" });
    return;
  }

  try {
    const { rows } = await pool.query(
      `INSERT INTO recipes (
         slug, title, category, cuisine, freezer_friendly,
         prep_minutes, cook_minutes, shared_ingredients, serve_with,
         versions, raw_markdown, source_urls,
         owner_user_id, parent_slug, modification_note, is_public
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,FALSE)
       RETURNING id, slug, title`,
      [
        parsedRecipe.slug,
        parsedRecipe.title,
        parsedRecipe.category,
        parsedRecipe.cuisine,
        parsedRecipe.freezer_friendly,
        parsedRecipe.prep_minutes,
        parsedRecipe.cook_minutes,
        parsedRecipe.shared_ingredients,
        parsedRecipe.serve_with,
        JSON.stringify(parsedRecipe.versions),
        parsedRecipe.raw_markdown,
        parsedRecipe.source_urls,
        req.user!.sub,
        parentSlug ?? null,
        modificationNote ?? null,
      ],
    );
    res.status(201).json({ recipe: rows[0] });
  } catch (err) {
    console.error("recipe create error", err);
    res.status(500).json({ error: "Could not save recipe" });
  }
});

export default router;
