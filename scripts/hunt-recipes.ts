// Recipe hunter — generates one new curated recipe per run via the LLM, in
// every supported language (English canonical + es/pt translations), and
// optionally re-vets existing curated rows for parse breakage. Designed to
// be invoked as a Railway cron service (see railway.cron.json).
//
// Modes (CLI flag, default "both"):
//   --mode=add    Generate one new recipe (skips if catalog already has the
//                 picked cuisine).
//   --mode=vet    Re-parse all curated rows and warn on anything that
//                 produced zero versions or zero shared ingredients.
//   --mode=both   Vet, then add.
//
// Env:
//   DATABASE_URL    Postgres connection.
//   LLM_API_KEY     Key for the LLM provider (see api/llm.ts).
//   HUNT_CATEGORY   "mains" | "breakfast" (default mains)

import { pool } from "../api/db.js";
import {
  expandDishToRecipe,
  translateRecipeMarkdown,
  type ComposeDish,
} from "../api/llm.js";
import { parseRecipe, type ParsedRecipe } from "../api/recipeParser.js";

type Mode = "add" | "vet" | "both";

interface CuisineSeed {
  cuisine: string;
  vegProtein: string;
  meatProtein: string | null;
  base: string;
  isBreakfast: boolean;
}

// Curated wishlist of cuisines + protein swaps biased toward simple, freezer-
// friendly one-pot dishes that fit FoodLab's style. The hunter picks one
// whose cuisine isn't already represented in the catalog.
const WISHLIST: CuisineSeed[] = [
  {
    cuisine: "Vietnamese",
    vegProtein: "1 block extra-firm tofu, cubed",
    meatProtein: "1 lb chicken thighs",
    base: "Lemongrass, garlic, ginger, fish sauce, lime, jasmine rice",
    isBreakfast: false,
  },
  {
    cuisine: "Lebanese",
    vegProtein: "2 cans chickpeas",
    meatProtein: "1 lb ground lamb",
    base: "Onion, garlic, cumin, allspice, lemon, parsley, bulgur",
    isBreakfast: false,
  },
  {
    cuisine: "Japanese",
    vegProtein: "1 block firm tofu",
    meatProtein: "1 lb ground turkey",
    base: "Onion, ginger, garlic, mirin, rice vinegar, scallion, short-grain rice",
    isBreakfast: false,
  },
  {
    cuisine: "Indonesian",
    vegProtein: "1 block tempeh",
    meatProtein: "1 lb chicken thighs",
    base: "Shallot, garlic, lemongrass, kecap manis, lime, jasmine rice",
    isBreakfast: false,
  },
  {
    cuisine: "Egyptian",
    vegProtein: "2 cans lentils",
    meatProtein: null,
    base: "Onion, garlic, cumin, coriander, tomato, rice, macaroni",
    isBreakfast: false,
  },
  {
    cuisine: "Senegalese",
    vegProtein: "2 cans black-eyed peas",
    meatProtein: "1 lb chicken thighs",
    base: "Onion, garlic, ginger, scotch bonnet, tomato, peanut butter, jasmine rice",
    isBreakfast: false,
  },
  {
    cuisine: "Polish",
    vegProtein: "1 block smoked tofu",
    meatProtein: "1 lb kielbasa",
    base: "Onion, garlic, caraway, sauerkraut, mushrooms, potato",
    isBreakfast: false,
  },
  {
    cuisine: "Sri Lankan",
    vegProtein: "2 cans chickpeas",
    meatProtein: "1 lb chicken thighs",
    base: "Onion, garlic, curry leaves, cinnamon, cardamom, tomato, coconut milk, basmati rice",
    isBreakfast: false,
  },
];

function pickMode(argv: string[]): Mode {
  const m = argv.find((a) => a.startsWith("--mode="))?.split("=")[1] as Mode | undefined;
  return m === "add" || m === "vet" ? m : "both";
}

async function existingCuisines(): Promise<Set<string>> {
  const { rows } = await pool.query<{ cuisine: string | null }>(
    `SELECT DISTINCT LOWER(cuisine) AS cuisine FROM recipes WHERE owner_user_id IS NULL AND cuisine IS NOT NULL`,
  );
  return new Set(rows.map((r) => r.cuisine!).filter(Boolean));
}

async function existingSlugs(): Promise<Set<string>> {
  const { rows } = await pool.query<{ slug: string }>(
    `SELECT DISTINCT slug FROM recipes`,
  );
  return new Set(rows.map((r) => r.slug));
}

function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

async function vet(): Promise<void> {
  const { rows } = await pool.query(
    `SELECT slug, locale, title, raw_markdown, category
     FROM recipes WHERE owner_user_id IS NULL`,
  );
  let broken = 0;
  for (const r of rows) {
    try {
      const parsed = parseRecipe(r.raw_markdown, r.category, r.slug, r.locale);
      const ok = parsed.versions.length > 0 && parsed.shared_ingredients.length > 0;
      if (!ok) {
        broken++;
        console.warn(
          `[vet] ${r.slug}.${r.locale} — versions=${parsed.versions.length} shared=${parsed.shared_ingredients.length}`,
        );
      }
    } catch (err) {
      broken++;
      console.warn(`[vet] ${r.slug}.${r.locale} — parse threw: ${(err as Error).message}`);
    }
  }
  console.log(`[vet] checked ${rows.length} curated recipe rows, ${broken} flagged.`);
}

// Languages every new recipe must be available in. English is canonical;
// es/pt are produced by translating the English markdown so structure and
// numeric quantities stay identical across languages.
const TARGET_LANGUAGES: Array<{ db: "es" | "pt"; app: "es" | "pt-BR" }> = [
  { db: "es", app: "es" },
  { db: "pt", app: "pt-BR" },
];

function validParse(p: ParsedRecipe): boolean {
  return p.versions.length > 0 && p.shared_ingredients.length > 0;
}

async function insertCurated(parsed: ParsedRecipe): Promise<void> {
  await pool.query(
    `INSERT INTO recipes (
       slug, locale, title, category, cuisine, freezer_friendly,
       prep_minutes, cook_minutes, servings,
       shared_ingredients, serve_with,
       versions, raw_markdown, source_urls,
       owner_user_id, is_public
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,NULL,FALSE)`,
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
    ],
  );
}

async function add(): Promise<void> {
  const category =
    (process.env.HUNT_CATEGORY as "mains" | "breakfast" | undefined) || "mains";

  const haveCuisines = await existingCuisines();
  const fresh = WISHLIST.filter((w) => !haveCuisines.has(w.cuisine.toLowerCase()));
  if (fresh.length === 0) {
    console.log("[hunt] catalog already covers every wishlist cuisine — nothing to add.");
    return;
  }
  const pick = fresh[Math.floor(Math.random() * fresh.length)];

  // Build a dish concept the existing expandDishToRecipe LLM step understands.
  const dish: ComposeDish = {
    id: `hunt-${Date.now().toString(36)}`,
    name: `${pick.cuisine} one-pot`,
    cuisine: pick.cuisine,
    base: pick.base,
    vegProtein: pick.vegProtein,
    meatProtein: pick.meatProtein ?? undefined,
    isBreakfast: pick.isBreakfast,
  };

  // English is canonical — generate and validate it first.
  console.log(`[hunt] generating ${pick.cuisine} recipe (English) via the LLM…`);
  const enMarkdown = await expandDishToRecipe({ dish, locale: "en" });

  // Parse + sanity-check before saving — this is the "vet" step for new
  // recipes. Models occasionally return malformed structure or empty
  // sections; we'd rather skip a turn than poison the catalog.
  const titleMatch = enMarkdown.match(/^#\s+(.+?)\s*$/m);
  if (!titleMatch) {
    console.warn("[hunt] LLM returned no title — skipping save.");
    return;
  }
  const title = titleMatch[1].trim();

  const slugBase = slugify(title) || slugify(`${pick.cuisine} dish`);
  const slugs = await existingSlugs();
  let slug = slugBase;
  let n = 2;
  while (slugs.has(slug)) {
    slug = `${slugBase}-${n++}`;
    if (n > 50) {
      console.warn("[hunt] couldn't find a unique slug — skipping.");
      return;
    }
  }

  const enParsed = parseRecipe(enMarkdown, category, slug, "en");
  if (!validParse(enParsed)) {
    console.warn(
      `[hunt] generated recipe failed validation — versions=${enParsed.versions.length} shared=${enParsed.shared_ingredients.length}`,
    );
    return;
  }

  // Translate the canonical English recipe into every other supported
  // language so the dish is browsable in all of them from day one. A failed
  // translation is non-fatal — English still gets saved.
  const toSave: ParsedRecipe[] = [enParsed];
  for (const { db, app } of TARGET_LANGUAGES) {
    try {
      const translated = await translateRecipeMarkdown({
        markdown: enMarkdown,
        target: app,
      });
      const tParsed = parseRecipe(translated, category, slug, db);
      if (!validParse(tParsed)) {
        console.warn(`[hunt] ${db} translation failed validation — skipping that language.`);
        continue;
      }
      toSave.push(tParsed);
    } catch (err) {
      console.warn(`[hunt] ${db} translation failed: ${(err as Error).message}`);
    }
  }

  for (const r of toSave) await insertCurated(r);
  console.log(
    `[hunt] saved ${slug} (${pick.cuisine}) in ${toSave.map((r) => r.locale).join("/")}.`,
  );
}

async function main(): Promise<void> {
  const mode = pickMode(process.argv.slice(2));
  console.log(`[hunt] mode=${mode}`);
  if (mode === "vet" || mode === "both") {
    await vet();
  }
  if (mode === "add" || mode === "both") {
    await add();
  }
  await pool.end();
}

main().catch(async (err) => {
  console.error("[hunt] failed:", err);
  try {
    await pool.end();
  } catch {
    // ignore
  }
  process.exit(1);
});
