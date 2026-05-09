import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { pool } from "../api/db.js";
import { parseRecipe, type Locale } from "../api/recipeParser.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// RECIPES_DIR can be absolute or relative to the repo root. Defaults to
// test-kitchen/recipes (the markdown recipe folder at the root of the
// foodlab repo). Note we resolve from `__dirname/..` (the repo root) so
// the relative path "test-kitchen/recipes" lands inside the repo, not one
// level above it.
const RECIPES_DIR = path.resolve(
  __dirname,
  "..",
  process.env.RECIPES_DIR || "test-kitchen/recipes",
);

const SUPPORTED_LOCALES: readonly Locale[] = ["en", "es", "pt"] as const;

async function exists(p: string): Promise<boolean> {
  try {
    await stat(p);
    return true;
  } catch {
    return false;
  }
}

interface RecipeFile {
  slug: string;
  locale: Locale;
  markdown: string;
}

// Filenames are <slug>.<locale>.md. Anything that doesn't end in a known
// locale suffix is skipped with a warning so legacy or in-progress files
// don't silently corrupt the catalog.
function parseFilename(file: string): { slug: string; locale: Locale } | null {
  if (!file.endsWith(".md")) return null;
  const base = file.replace(/\.md$/, "");
  const dot = base.lastIndexOf(".");
  if (dot < 0) return null;
  const locale = base.slice(dot + 1) as Locale;
  if (!SUPPORTED_LOCALES.includes(locale)) return null;
  return { slug: base.slice(0, dot), locale };
}

async function readCategory(
  category: "mains" | "breakfast",
): Promise<RecipeFile[]> {
  const dir = path.join(RECIPES_DIR, category);
  if (!(await exists(dir))) {
    console.warn(`[seed] skipping missing dir: ${dir}`);
    return [];
  }
  const files = await readdir(dir);
  const out: RecipeFile[] = [];
  for (const file of files) {
    const parsed = parseFilename(file);
    if (!parsed) {
      if (file.endsWith(".md")) {
        console.warn(
          `[seed] skipping ${file} — expected <slug>.<en|es|pt>.md`,
        );
      }
      continue;
    }
    const markdown = await readFile(path.join(dir, file), "utf8");
    out.push({ slug: parsed.slug, locale: parsed.locale, markdown });
  }
  return out;
}

async function upsertRecipe(
  category: "mains" | "breakfast",
  slug: string,
  locale: Locale,
  markdown: string,
) {
  const recipe = parseRecipe(markdown, category, slug, locale);
  await pool.query(
    `INSERT INTO recipes (
       slug, locale, title, category, cuisine, freezer_friendly,
       prep_minutes, cook_minutes, shared_ingredients, serve_with,
       versions, raw_markdown, source_urls, updated_at
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13, now())
     ON CONFLICT (slug, locale) DO UPDATE SET
       title = EXCLUDED.title,
       category = EXCLUDED.category,
       cuisine = EXCLUDED.cuisine,
       freezer_friendly = EXCLUDED.freezer_friendly,
       prep_minutes = EXCLUDED.prep_minutes,
       cook_minutes = EXCLUDED.cook_minutes,
       shared_ingredients = EXCLUDED.shared_ingredients,
       serve_with = EXCLUDED.serve_with,
       versions = EXCLUDED.versions,
       raw_markdown = EXCLUDED.raw_markdown,
       source_urls = EXCLUDED.source_urls,
       updated_at = now()`,
    [
      recipe.slug,
      recipe.locale,
      recipe.title,
      recipe.category,
      recipe.cuisine,
      recipe.freezer_friendly,
      recipe.prep_minutes,
      recipe.cook_minutes,
      recipe.shared_ingredients,
      recipe.serve_with,
      JSON.stringify(recipe.versions),
      recipe.raw_markdown,
      recipe.source_urls,
    ],
  );
}

async function main() {
  console.log(`[seed] reading recipes from ${RECIPES_DIR}`);
  let count = 0;
  const localeCounts: Record<string, number> = {};
  for (const category of ["mains", "breakfast"] as const) {
    const files = await readCategory(category);
    for (const { slug, locale, markdown } of files) {
      await upsertRecipe(category, slug, locale, markdown);
      count++;
      localeCounts[locale] = (localeCounts[locale] ?? 0) + 1;
    }
  }
  const breakdown = Object.entries(localeCounts)
    .map(([loc, n]) => `${loc}=${n}`)
    .join(", ");
  console.log(`[seed] upserted ${count} recipe(s) [${breakdown}].`);
  await pool.end();
}

main().catch((err) => {
  console.error("[seed] failed:", err);
  process.exit(1);
});
