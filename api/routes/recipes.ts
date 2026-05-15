import crypto from "node:crypto";

import { Router } from "express";
import { z } from "zod";

import { pool } from "../db.js";
import {
  renderRecipeMarkdown,
  streamModifyRecipe,
  translateRecipeMarkdown,
} from "../llm.js";
import { requireAuth, verifyToken } from "../middleware/auth.js";
import { parseRecipe, type Locale, type ParsedRecipe } from "../recipeParser.js";

const router = Router();

const SUPPORTED_LOCALES: readonly Locale[] = ["en", "es", "pt"] as const;

// The frontend uses BCP-47 locale codes ("pt-BR") in i18n strings, but
// recipes are stored under shorter ISO 639-1 codes ("pt") so the filename
// suffix is clean. Normalize at the API edge.
function normalizeLocale(raw: string | undefined | null): Locale {
  if (!raw) return "en";
  const lower = raw.toLowerCase();
  if (lower === "es" || lower.startsWith("es-")) return "es";
  if (lower === "pt" || lower.startsWith("pt-")) return "pt";
  return "en";
}

function readLocaleParam(req: any): Locale {
  return normalizeLocale(typeof req.query.locale === "string" ? req.query.locale : null);
}

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
  const locale = readLocaleParam(req);

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

  // Pre-translated recipes: pick the row in the caller's locale, fall back
  // to English when a translation hasn't been written yet. DISTINCT ON
  // collapses the (en, es, pt) triple per slug into one row. Average
  // ratings + count are joined on the slug-keyed agg table so the list
  // can show "★ 4.3" badges without a per-card fetch.
  params.push(locale);
  const localeIdx = params.length;
  where.push(`(locale = $${localeIdx} OR locale = 'en')`);

  const { rows } = await pool.query(
    `SELECT r.*, COALESCE(agg.avg_rating, NULL) AS avg_rating,
            COALESCE(agg.rating_count, 0) AS rating_count
     FROM (
       SELECT DISTINCT ON (slug)
         id, slug, locale, title, category, cuisine, freezer_friendly,
         prep_minutes, cook_minutes, shared_ingredients, serve_with, versions,
         owner_user_id, parent_slug, is_public, modification_note
       FROM recipes
       WHERE ${where.join(" AND ")}
       ORDER BY slug, CASE WHEN locale = $${localeIdx} THEN 0 ELSE 1 END
     ) r
     LEFT JOIN (
       SELECT rec.slug,
              ROUND(AVG(rt.stars)::numeric, 1)::float AS avg_rating,
              COUNT(*)::int AS rating_count
       FROM ratings rt JOIN recipes rec ON rt.recipe_id = rec.id
       GROUP BY rec.slug
     ) agg ON agg.slug = r.slug
     ORDER BY r.title ASC`,
    params,
  );
  res.json({ recipes: rows });
});

router.get("/:slug", optionalAuth, async (req, res) => {
  // slug is $1, so visibility params start at $2.
  const vis = buildVisibilityClause(req.user?.sub, 1);
  const locale = readLocaleParam(req);
  const params: any[] = [req.params.slug, ...vis.params, locale];
  const localeIdx = params.length;
  const { rows } = await pool.query(
    `SELECT * FROM recipes
     WHERE slug = $1 AND ${vis.clause}
       AND (locale = $${localeIdx} OR locale = 'en')
     ORDER BY CASE WHEN locale = $${localeIdx} THEN 0 ELSE 1 END
     LIMIT 1`,
    params,
  );
  if (!rows[0]) {
    res.status(404).json({ error: "Recipe not found" });
    return;
  }
  // Attach rating aggregates + the caller's own rating so the detail
  // page can render the star widget in one round-trip.
  const ratingAgg = await pool.query<{ avg: string | null; count: string }>(
    `SELECT AVG(rt.stars)::text AS avg, COUNT(*)::text AS count
     FROM ratings rt JOIN recipes rec ON rt.recipe_id = rec.id
     WHERE rec.slug = $1`,
    [req.params.slug],
  );
  const avgRaw = ratingAgg.rows[0]?.avg;
  const avg_rating = avgRaw === null || avgRaw === undefined
    ? null
    : Math.round(parseFloat(avgRaw) * 10) / 10;
  const rating_count = parseInt(ratingAgg.rows[0]?.count ?? "0", 10);

  let my_rating: { stars: number; notes: string | null } | null = null;
  if (req.user?.sub) {
    const mine = await pool.query<{ stars: number; notes: string | null }>(
      `SELECT rt.stars, rt.notes
       FROM ratings rt JOIN recipes rec ON rt.recipe_id = rec.id
       WHERE rec.slug = $1 AND rt.user_id = $2 AND rt.profile_id IS NULL
       LIMIT 1`,
      [req.params.slug, req.user.sub],
    );
    if (mine.rows[0]) my_rating = mine.rows[0];
  }

  res.json({
    recipe: { ...rows[0], avg_rating, rating_count, my_rating },
  });
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

  // Load the source recipe (must be visible to the caller). Prefer the row
  // matching the requested locale so the LLM starts from a localized
  // source, falling back to English when no translation exists yet. We
  // load the structured columns alongside raw_markdown so streamModifyRecipe
  // can hand the model JSON instead of verbose markdown.
  let original: {
    raw_markdown: string;
    title: string;
    slug: string;
    cuisine: string | null;
    freezer_friendly: boolean | null;
    prep_minutes: number | null;
    cook_minutes: number | null;
    servings: number | null;
    shared_ingredients: string[];
    serve_with: string[];
    versions: Array<{
      name: string;
      group_label: string | null;
      protein: string | null;
      instructions: string[];
    }>;
  };
  try {
    const vis = buildVisibilityClause(req.user!.sub, 1);
    const sourceLocale = normalizeLocale(parsed.data.locale);
    const params = [req.params.slug, ...vis.params, sourceLocale];
    const localeIdx = params.length;
    const { rows } = await pool.query(
      `SELECT raw_markdown, title, slug, cuisine, freezer_friendly,
              prep_minutes, cook_minutes, servings,
              shared_ingredients, serve_with, versions
       FROM recipes
       WHERE slug = $1 AND ${vis.clause}
         AND (locale = $${localeIdx} OR locale = 'en')
       ORDER BY CASE WHEN locale = $${localeIdx} THEN 0 ELSE 1 END
       LIMIT 1`,
      params,
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
        originalStructured: {
          title: original.title,
          cuisine: original.cuisine,
          freezer_friendly: original.freezer_friendly,
          prep_minutes: original.prep_minutes,
          cook_minutes: original.cook_minutes,
          servings: original.servings,
          shared_ingredients: original.shared_ingredients,
          serve_with: original.serve_with,
          versions: original.versions,
        },
        instruction: parsed.data.instruction,
        locale: parsed.data.locale,
      },
      {
        onContent: (chunk) => {
          if (aborted) return;
          send({ type: "chunk", content: chunk });
        },
        onThinking: (chunk) => {
          if (aborted) return;
          send({ type: "thinking", content: chunk });
        },
        onDone: ({ recipe }) => {
          if (aborted) return;
          const markdown = renderRecipeMarkdown(
            recipe,
            original.title,
            parsed.data.locale,
          );
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
 * Body: { markdown: string, parentSlug?: string, modificationNote?: string, locale?: "en"|"es"|"pt-BR" }
 */
const createSchema = z.object({
  markdown: z.string().min(50).max(50_000),
  parentSlug: z.string().min(1).max(120).optional(),
  modificationNote: z.string().max(400).optional(),
  locale: z.enum(["en", "es", "pt-BR", "pt"]).optional(),
});

router.post("/", requireAuth, async (req, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid recipe payload" });
    return;
  }
  try {
    const recipe = await saveUserRecipe({
      userId: req.user!.sub,
      markdown: parsed.data.markdown,
      parentSlug: parsed.data.parentSlug,
      modificationNote: parsed.data.modificationNote,
      locale: parsed.data.locale,
    });
    res.status(201).json({ recipe });
  } catch (err: any) {
    if (err?.code === "PARSE_ERROR") {
      res.status(400).json({ error: "Could not parse recipe markdown" });
      return;
    }
    console.error("recipe create error", err);
    res.status(500).json({ error: "Could not save recipe" });
  }
});

/**
 * Shared helper: parse + persist a user-owned recipe. Used by the manual
 * POST /api/recipes endpoint above and by the /plans/compose/apply endpoint
 * which writes a batch of recipes in one shot.
 */
export async function saveUserRecipe(args: {
  userId: string;
  markdown: string;
  parentSlug?: string;
  modificationNote?: string;
  category?: "mains" | "breakfast";
  locale?: string;
}): Promise<{ id: string; slug: string; title: string }> {
  const { userId, markdown, parentSlug, modificationNote } = args;
  const locale = normalizeLocale(args.locale);

  let category: "mains" | "breakfast" = args.category ?? "mains";
  if (!args.category && parentSlug) {
    try {
      const { rows } = await pool.query(
        `SELECT category FROM recipes WHERE slug = $1 LIMIT 1`,
        [parentSlug],
      );
      if (rows[0]?.category === "breakfast") category = "breakfast";
    } catch {
      // Non-fatal — keep default.
    }
  }

  const baseSlug = parentSlug ?? `custom-recipe`;
  const suffix = crypto.randomBytes(3).toString("hex");
  const newSlug = `${baseSlug}-${suffix}`.slice(0, 120);

  let parsedRecipe;
  try {
    parsedRecipe = parseRecipe(markdown, category, newSlug, locale);
  } catch (err) {
    const e = new Error(`parseRecipe failed: ${(err as Error).message}`) as Error & {
      code?: string;
    };
    e.code = "PARSE_ERROR";
    throw e;
  }

  // Save the primary-locale row first — that's what we return to the caller.
  const saved = await insertOwnedRecipe(parsedRecipe, {
    userId,
    parentSlug,
    modificationNote,
  });

  // Fill in every other supported language by translating the markdown, so
  // the recipe is browsable in all of them. Best-effort: a failed translation
  // is logged, not thrown — the primary row is already saved.
  const others = (["en", "es", "pt"] as Locale[]).filter((l) => l !== locale);
  await Promise.all(
    others.map(async (db) => {
      const target = db === "pt" ? "pt-BR" : db;
      try {
        const translated = await translateRecipeMarkdown({ markdown, target });
        const tParsed = parseRecipe(translated, category, newSlug, db);
        if (
          tParsed.versions.length === 0 ||
          tParsed.shared_ingredients.length === 0
        ) {
          console.warn(`saveUserRecipe: ${db} translation failed validation — skipped`);
          return;
        }
        await insertOwnedRecipe(tParsed, { userId, parentSlug, modificationNote });
      } catch (err) {
        console.error(`saveUserRecipe: ${db} translation failed`, err);
      }
    }),
  );

  return saved;
}

/** Insert one parsed recipe row owned by `userId`. */
async function insertOwnedRecipe(
  parsed: ParsedRecipe,
  opts: { userId: string; parentSlug?: string; modificationNote?: string },
): Promise<{ id: string; slug: string; title: string }> {
  const { rows } = await pool.query(
    `INSERT INTO recipes (
       slug, locale, title, category, cuisine, freezer_friendly,
       prep_minutes, cook_minutes, servings,
       shared_ingredients, serve_with,
       versions, raw_markdown, source_urls,
       owner_user_id, parent_slug, modification_note, is_public
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,FALSE)
     RETURNING id, slug, title`,
    [
      parsed.slug,
      parsed.locale,
      parsed.title,
      parsed.category,
      parsed.cuisine,
      parsed.freezer_friendly,
      parsed.prep_minutes,
      parsed.cook_minutes,
      parsed.servings,
      parsed.shared_ingredients,
      parsed.serve_with,
      JSON.stringify(parsed.versions),
      parsed.raw_markdown,
      parsed.source_urls,
      opts.userId,
      opts.parentSlug ?? null,
      opts.modificationNote ?? null,
    ],
  );
  return rows[0];
}

export default router;
