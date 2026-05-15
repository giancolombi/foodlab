// Recipe hunter — generates one new curated recipe per run via Ollama,
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
//   OLLAMA_URL      Where the Ollama service lives (default localhost).
//   OLLAMA_MODEL    Model tag, default qwen2.5:3b.
//   HUNT_CATEGORY   "mains" | "breakfast" (default mains)
//   HUNT_LOCALE     "en" | "es" | "pt-BR" (default en — EN-only for now;
//                   translations are a follow-up to keep generation cheap)

import { pool } from "../api/db.js";
import {
  expandDishToRecipe,
  type ComposeDish,
  type Locale,
} from "../api/llm.js";
import { parseRecipe } from "../api/recipeParser.js";

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

function pickLocale(): Locale {
  const raw = (process.env.HUNT_LOCALE || "en").toLowerCase();
  if (raw === "es") return "es";
  if (raw === "pt-br" || raw === "pt") return "pt-BR";
  return "en";
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

async function add(): Promise<void> {
  const locale = pickLocale();
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

  console.log(`[hunt] generating ${pick.cuisine} recipe via Ollama…`);
  const markdown = await expandDishToRecipe({ dish, locale });

  // Parse + sanity-check before saving — this is the "vet" step for new
  // recipes. Models occasionally return malformed structure or empty
  // sections; we'd rather skip a turn than poison the catalog.
  const titleMatch = markdown.match(/^#\s+(.+?)\s*$/m);
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

  // recipeParser stores under "en" | "es" | "pt" — collapse pt-BR.
  const dbLocale: "en" | "es" | "pt" =
    locale === "es" ? "es" : locale === "pt-BR" ? "pt" : "en";

  const parsed = parseRecipe(markdown, category, slug, dbLocale);
  if (parsed.versions.length === 0 || parsed.shared_ingredients.length === 0) {
    console.warn(
      `[hunt] generated recipe failed validation — versions=${parsed.versions.length} shared=${parsed.shared_ingredients.length}`,
    );
    return;
  }

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
  console.log(`[hunt] saved ${parsed.slug} (${pick.cuisine}, ${dbLocale}).`);
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
