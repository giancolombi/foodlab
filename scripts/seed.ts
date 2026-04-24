import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { pool } from "../api/db.js";
import { parseRecipe } from "../api/recipeParser.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// RECIPES_DIR can be absolute or relative to scripts/. Defaults to
// ../test-kitchen/recipes (the markdown recipe folder at the root of the foodlab repo).
const RECIPES_DIR = path.resolve(
  __dirname,
  "..",
  process.env.RECIPES_DIR || "../test-kitchen/recipes",
);

async function exists(p: string): Promise<boolean> {
  try {
    await stat(p);
    return true;
  } catch {
    return false;
  }
}

async function readCategory(
  category: "mains" | "breakfast",
): Promise<Array<{ slug: string; markdown: string }>> {
  const dir = path.join(RECIPES_DIR, category);
  if (!(await exists(dir))) {
    console.warn(`[seed] skipping missing dir: ${dir}`);
    return [];
  }
  const files = (await readdir(dir)).filter((f) => f.endsWith(".md"));
  const out: Array<{ slug: string; markdown: string }> = [];
  for (const file of files) {
    const slug = file.replace(/\.md$/, "");
    const markdown = await readFile(path.join(dir, file), "utf8");
    out.push({ slug, markdown });
  }
  return out;
}

async function upsertRecipe(
  category: "mains" | "breakfast",
  slug: string,
  markdown: string,
) {
  const recipe = parseRecipe(markdown, category, slug);
  await pool.query(
    `INSERT INTO recipes (
       slug, title, category, cuisine, freezer_friendly,
       prep_minutes, cook_minutes, shared_ingredients, serve_with,
       versions, raw_markdown, source_urls, updated_at
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12, now())
     ON CONFLICT (slug) DO UPDATE SET
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
  for (const category of ["mains", "breakfast"] as const) {
    const files = await readCategory(category);
    for (const { slug, markdown } of files) {
      await upsertRecipe(category, slug, markdown);
      count++;
    }
  }
  console.log(`[seed] upserted ${count} recipe(s).`);
  await pool.end();
}

main().catch((err) => {
  console.error("[seed] failed:", err);
  process.exit(1);
});
