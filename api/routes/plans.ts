import dns from "node:dns/promises";
import net from "node:net";

import { Router } from "express";
import { z } from "zod";

import { pool } from "../db.js";
import {
  composeMenu,
  consolidateShoppingList,
  expandDishToRecipe,
  extractRecipeFromText,
} from "../llm.js";
import { requireAuth } from "../middleware/auth.js";
import { saveUserRecipe } from "./recipes.js";

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
  locale: z.enum(["en", "es", "pt-BR", "pt"]).optional(),
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
  const { profileIds, excludeSlugs, locale } = parsed.data;
  const planLocale =
    locale === "es" ? "es" : locale === "pt-BR" || locale === "pt" ? "pt" : "en";

  // Load visible recipes — one row per slug, preferring the user's locale.
  const { rows: recipes } = await pool.query<RecipeRow>(
    `SELECT * FROM (
       SELECT DISTINCT ON (slug) slug, title, category, cuisine, versions, locale
       FROM recipes
       WHERE (owner_user_id IS NULL OR owner_user_id = $1)
         AND (locale = $2 OR locale = 'en')
       ORDER BY slug, CASE WHEN locale = $2 THEN 0 ELSE 1 END
     ) r
     ORDER BY random()`,
    [req.user!.sub, planLocale],
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

  // Cooking method classifier — keyword scan over title + cuisine. Coarse
  // but enough to avoid filling a week with four stews even if they're
  // from four different cuisines.
  function methodOf(r: RecipeRow): string {
    const text = `${r.title} ${r.cuisine ?? ""}`.toLowerCase();
    if (/\bsheet[- ]?pan\b/.test(text)) return "sheet-pan";
    if (/\bbake|roast|baked|tagine\b/.test(text)) return "baked";
    if (/\bstew|chili|ragu|goulash|curry|soup|simmer|braise|adobo|tagine\b/.test(text)) return "simmered";
    if (/\bbowl|bibimbap|burrito|wrap\b/.test(text)) return "assembled";
    if (/\bstir[- ]?fry|fry|saute|sauté|skillet\b/.test(text)) return "stovetop";
    return "other";
  }

  const usedMethods = new Set<string>();

  function pickFrom(pool: RecipeRow[], n: number) {
    const isCategoryFull = () =>
      picked.filter((p) => p.category === pool[0]?.category).length >= n;

    // First pass: prefer diverse cuisines AND cooking methods so a week
    // doesn't end up as four stews from four cuisines.
    for (const r of pool) {
      if (isCategoryFull()) return;
      if (picked.some((p) => p.slug === r.slug)) continue;
      const c = (r.cuisine ?? "").toLowerCase();
      if (c && usedCuisines.has(c)) continue;
      const m = methodOf(r);
      if (usedMethods.has(m)) continue;
      picked.push({ slug: r.slug, category: r.category });
      if (c) usedCuisines.add(c);
      usedMethods.add(m);
    }
    // Second pass: relax method constraint, keep cuisine diversity.
    for (const r of pool) {
      if (isCategoryFull()) return;
      if (picked.some((p) => p.slug === r.slug)) continue;
      const c = (r.cuisine ?? "").toLowerCase();
      if (c && usedCuisines.has(c)) continue;
      picked.push({ slug: r.slug, category: r.category });
      if (c) usedCuisines.add(c);
    }
    // Third pass: fill remaining without any diversity constraint.
    for (const r of pool) {
      if (isCategoryFull()) return;
      if (picked.some((p) => p.slug === r.slug)) continue;
      picked.push({ slug: r.slug, category: r.category });
    }
  }

  pickFrom(mains, 4);
  pickFrom(breakfasts, 1);

  // Assign to slots. 4 mains spread across the week (Mon, Tue, Thu, Sat
  // — leaves Wed/Fri/Sun open for leftovers, takeout, or shared meals);
  // breakfast on Sat morning so the Sat dinner pairs with prep day.
  const assignments: Record<string, { slug: string; assignedAt: number }> = {};
  const now = Date.now();
  const mainPicks = picked.filter((p) => p.category === "mains");
  const breakfastPicks = picked.filter((p) => p.category === "breakfast");

  const MAIN_DAYS = [0, 1, 3, 5] as const; // Mon, Tue, Thu, Sat
  mainPicks.forEach((p, i) => {
    if (i < MAIN_DAYS.length) {
      assignments[`${MAIN_DAYS[i]}-dinner`] = {
        slug: p.slug,
        assignedAt: now,
      };
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
 * list via the LLM. The client already has a deterministic fallback; this is a
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

// ---- Iterative menu composer ----

const composeDishSchema = z.object({
  id: z.string().min(1).max(80),
  name: z.string().min(1).max(120),
  cuisine: z.string().max(80).optional(),
  base: z.string().max(400).optional(),
  vegProtein: z.string().max(120).optional(),
  meatProtein: z.string().max(120).optional(),
  notes: z.string().max(400).optional(),
  isBreakfast: z.boolean(),
});

const composeSchema = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().min(1).max(4000),
      }),
    )
    .min(1)
    .max(40),
  currentDraft: z.object({
    dishes: z.array(composeDishSchema).max(10),
  }),
  locale: z.enum(["en", "es", "pt-BR"]).optional(),
});

/**
 * POST /api/plans/compose — multi-turn menu planning chat. Caller passes the
 * full conversation + current draft; we return a chatty reply and an updated
 * draft. Stateless on the server (history lives in the client).
 */
router.post("/compose", requireAuth, async (req, res) => {
  const parsed = composeSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid payload" });
    return;
  }
  try {
    const result = await composeMenu(parsed.data);
    res.json(result);
  } catch (err) {
    console.error("[plans/compose]", err);
    res.status(502).json({
      error: err instanceof Error ? err.message : "Compose failed",
    });
  }
});

const applySchema = z.object({
  draft: z.object({
    dishes: z.array(composeDishSchema).min(1).max(10),
  }),
  locale: z.enum(["en", "es", "pt-BR"]).optional(),
});

/**
 * POST /api/plans/compose/apply — turn a draft into real recipes.
 * For each dish we ask the LLM to expand the concept into FoodLab markdown,
 * then persist it as a user-owned recipe. Returns the saved slugs (in the
 * same order as the input dishes) so the client can drop them into the plan
 * grid. The grid update itself stays client-side via PlanContext.
 */
router.post("/compose/apply", requireAuth, async (req, res) => {
  const parsed = applySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid payload" });
    return;
  }
  const { draft, locale } = parsed.data;
  const userId = req.user!.sub;

  const saved: Array<{
    dishId: string;
    slug: string;
    title: string;
    category: "mains" | "breakfast";
    isBreakfast: boolean;
  }> = [];
  const errors: Array<{ dishId: string; name: string; error: string }> = [];

  for (const dish of draft.dishes) {
    try {
      const markdown = await expandDishToRecipe({ dish, locale });
      const category: "mains" | "breakfast" = dish.isBreakfast
        ? "breakfast"
        : "mains";
      const recipe = await saveUserRecipe({
        userId,
        markdown,
        modificationNote: `Generated from compose draft (${dish.id})`,
        category,
        locale,
      });
      saved.push({
        dishId: dish.id,
        slug: recipe.slug,
        title: recipe.title,
        category,
        isBreakfast: dish.isBreakfast,
      });
    } catch (err: any) {
      errors.push({
        dishId: dish.id,
        name: dish.name,
        error: err?.message ?? "Unknown error",
      });
    }
  }

  res.json({ saved, errors });
});

const extractSchema = z.object({
  text: z.string().min(40).max(20_000),
  locale: z.enum(["en", "es", "pt-BR"]).optional(),
});

/**
 * POST /api/plans/compose/extract — turn pasted recipe text into FoodLab
 * markdown via the LLM. Doesn't persist; the client decides whether to attach
 * the result to a draft dish or save it as a standalone recipe.
 */
router.post("/compose/extract", requireAuth, async (req, res) => {
  const parsed = extractSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid payload" });
    return;
  }
  try {
    const markdown = await extractRecipeFromText(parsed.data);
    res.json({ markdown });
  } catch (err) {
    console.error("[plans/compose/extract]", err);
    res.status(502).json({
      error: err instanceof Error ? err.message : "Extract failed",
    });
  }
});

const extractUrlSchema = z.object({
  url: z.string().url().max(2000),
  locale: z.enum(["en", "es", "pt-BR"]).optional(),
});

const URL_FETCH_TIMEOUT_MS = 10_000;
const URL_MAX_BYTES = 2_000_000;

/**
 * Reject URLs that point at the host's loopback or RFC1918/CGNAT ranges so a
 * malicious user can't pivot the API into the internal network. We resolve
 * the hostname to an IP and check that it is publicly routable.
 */
function isPrivateIp(addr: string): boolean {
  const family = net.isIP(addr);
  if (family === 4) {
    const [a, b] = addr.split(".").map(Number);
    if (a === 10) return true;
    if (a === 127) return true;
    if (a === 0) return true;
    if (a === 169 && b === 254) return true; // link-local
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
    return false;
  }
  if (family === 6) {
    const lower = addr.toLowerCase();
    if (lower === "::1") return true;
    if (lower.startsWith("fc") || lower.startsWith("fd")) return true; // ULA
    if (lower.startsWith("fe80")) return true; // link-local
    if (lower.startsWith("::ffff:")) return isPrivateIp(lower.slice(7));
    return false;
  }
  return true; // unknown family — refuse
}

async function safeUrl(input: string): Promise<URL> {
  const u = new URL(input);
  if (u.protocol !== "http:" && u.protocol !== "https:") {
    throw new Error("Only http(s) URLs are allowed");
  }
  const host = u.hostname;
  if (!host) throw new Error("URL has no host");
  if (host === "localhost") throw new Error("Refusing to fetch localhost");
  // Resolve every A/AAAA record and refuse if any of them is private.
  const addrs = await dns.lookup(host, { all: true });
  for (const a of addrs) {
    if (isPrivateIp(a.address)) {
      throw new Error("Refusing to fetch private IP");
    }
  }
  return u;
}

function htmlToText(html: string): string {
  // Strip script/style blocks then collapse all tags to whitespace. Cheap
  // but good enough — the LLM extractor is forgiving about extra noise.
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * POST /api/plans/compose/extract-url — fetch a recipe URL, strip HTML to
 * plain text, then run extractRecipeFromText. Guards against SSRF by
 * resolving the hostname and refusing private IPs.
 */
router.post("/compose/extract-url", requireAuth, async (req, res) => {
  const parsed = extractUrlSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid payload" });
    return;
  }
  const { url, locale } = parsed.data;

  let target: URL;
  try {
    target = await safeUrl(url);
  } catch (err: any) {
    res.status(400).json({ error: err?.message ?? "URL not allowed" });
    return;
  }

  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), URL_FETCH_TIMEOUT_MS);
  let html: string;
  try {
    const response = await fetch(target.toString(), {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15",
        Accept: "text/html,application/xhtml+xml",
        "Accept-Language": "en-US,en;q=0.9",
      },
      signal: ac.signal,
      redirect: "follow",
    });
    if (!response.ok) {
      res.status(502).json({ error: `Fetch returned ${response.status}` });
      return;
    }
    const reader = response.body?.getReader();
    if (!reader) {
      res.status(502).json({ error: "Empty response body" });
      return;
    }
    const chunks: Uint8Array[] = [];
    let total = 0;
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > URL_MAX_BYTES) {
        try {
          await reader.cancel();
        } catch {
          // ignore
        }
        res.status(413).json({ error: "Page too large" });
        return;
      }
      chunks.push(value);
    }
    html = Buffer.concat(chunks).toString("utf-8");
  } catch (err: any) {
    if (err?.name === "AbortError") {
      res.status(504).json({ error: "Fetch timed out" });
      return;
    }
    console.error("[plans/compose/extract-url] fetch", err);
    res.status(502).json({
      error: err instanceof Error ? err.message : "Fetch failed",
    });
    return;
  } finally {
    clearTimeout(timer);
  }

  const text = htmlToText(html).slice(0, 18_000);
  if (text.length < 80) {
    res.status(422).json({ error: "Page didn't contain enough text" });
    return;
  }

  try {
    const markdown = await extractRecipeFromText({ text, locale });
    res.json({ markdown });
  } catch (err) {
    console.error("[plans/compose/extract-url] extract", err);
    res.status(502).json({
      error: err instanceof Error ? err.message : "Extract failed",
    });
  }
});

export default router;
