// Parse a FoodLab recipe markdown file into a structured record.
// The markdown schema is defined in foodlab's root CLAUDE.md.
//
// Recipes are stored pre-translated in every supported locale (en/es/pt). The
// structure is identical across languages, but section headers and metadata
// labels are translated, so most regexes accept all three locale variants.

export type Locale = "en" | "es" | "pt";

export interface RecipeVersion {
  name: string;
  group_label: string | null; // e.g. "No Soy / No Dairy"
  protein: string | null;
  instructions: string[];
}

export interface ParsedRecipe {
  slug: string;
  locale: Locale;
  title: string;
  category: "mains" | "breakfast";
  cuisine: string | null;
  freezer_friendly: boolean | null;
  prep_minutes: number | null;
  cook_minutes: number | null;
  /** Number of servings the base recipe yields, when explicit. */
  servings: number | null;
  shared_ingredients: string[];
  serve_with: string[];
  versions: RecipeVersion[];
  source_urls: string[];
  raw_markdown: string;
}

// Each metadata key has a list of label aliases — one per supported locale —
// joined into an alternation so the same regex matches across languages.
const META_LABEL_ALIASES = {
  cuisine: ["Cuisine", "Cocina", "Cozinha"],
  freezer: ["Freezer-friendly", "Apta para congelar", "Apto para congelar", "Vai ao freezer", "Apto para freezer"],
  prep: ["Prep", "Preparación", "Preparacion", "Preparo"],
  cook: ["Cook", "Cocción", "Coccion", "Cozimento"],
  servings: [
    "Servings", "Serves", "Yield", "Yields", "Makes",
    "Porciones", "Raciones", "Rinde", "Para",
    "Porções", "Porcoes", "Rende", "Rendimento",
  ],
};

function metaPattern(aliases: string[]): RegExp {
  const alt = aliases
    .map((a) => a.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .join("|");
  return new RegExp(`\\*\\*(?:${alt}):\\*\\*\\s*([^|\\n]+)`, "i");
}

const META_PATTERNS: Record<keyof typeof META_LABEL_ALIASES, RegExp> = {
  cuisine: metaPattern(META_LABEL_ALIASES.cuisine),
  freezer: metaPattern(META_LABEL_ALIASES.freezer),
  prep: metaPattern(META_LABEL_ALIASES.prep),
  cook: metaPattern(META_LABEL_ALIASES.cook),
  servings: metaPattern(META_LABEL_ALIASES.servings),
};

function parseServings(raw: string | null): number | null {
  if (!raw) return null;
  // Pull the first integer out of strings like "4", "~8 burritos",
  // "12 muffins", "4 personas", "6 porções". Tilde / "about" prefixes
  // are common — we just take the leading digits.
  const m = raw.match(/(\d+)/);
  if (!m) return null;
  const n = parseInt(m[1], 10);
  return Number.isFinite(n) && n > 0 && n < 1000 ? n : null;
}

const PROTEIN_LABEL = /\*\*(?:Protein|Proteína|Proteina):\*\*\s*([^\n]+)/;

// Heading text that signals a "serving suggestions / garnish / toppings"
// section. Wide net — recipes phrase this many ways.
const SERVE_HEADINGS = [
  // English
  "serve with", "serving", "garnish", "topping",
  // Spanish
  "servir con", "para servir", "guarnición", "guarnicion", "decorar", "para decorar", "para encima", "encima",
  // Portuguese
  "servir com", "para servir", "guarnição", "guarnicao", "para decorar", "cobertura",
];

// Affirmative tokens that map to freezer_friendly = true (vs false). No `\b`
// because JS `\b` is ASCII-only and "Sí" -> non-word-char gap would block
// the match — any of these as a prefix is enough signal.
const FREEZER_TRUE = /^(yes|sí|si|sim)/i;
const FREEZER_FALSE = /^(no|não|nao)/i;

function parseMinutes(raw: string | null): number | null {
  if (!raw) return null;
  const text = raw.trim().toLowerCase();
  // Handle "1.5 hrs", "45 min", "1 hour 10 min", "1.5 horas", etc.
  let total = 0;
  const hrsMatch = text.match(/([\d.]+)\s*(?:hr|hour|hora)/);
  if (hrsMatch) total += parseFloat(hrsMatch[1]) * 60;
  const minMatch = text.match(/([\d.]+)\s*min/);
  if (minMatch) total += parseFloat(minMatch[1]);
  if (!total) {
    const loneNum = text.match(/^([\d.]+)$/);
    if (loneNum) total = parseFloat(loneNum[1]);
  }
  return total ? Math.round(total) : null;
}

function collectBullets(chunk: string, headings: string[]): string[] {
  const items: string[] = [];
  const lines = chunk.split("\n");
  let inTargetSection = false;
  for (const line of lines) {
    const heading = line.match(/^##\s+(.+?)\s*$/);
    if (heading) {
      inTargetSection = headings.some((h) =>
        heading[1].toLowerCase().includes(h.toLowerCase()),
      );
      continue;
    }
    if (!inTargetSection) continue;
    const bullet = line.match(/^-\s+(.*\S)\s*$/);
    if (bullet) items.push(bullet[1]);
  }
  return items;
}

/**
 * Grab every bullet from the header chunk, excluding sections that match
 * `excludeHeadings` (typically toppings/serving/garnish, which are already
 * captured as serve_with). Recipes use varied section names — "Ingredients",
 * "Spice Rub", "Coconut Rice & Beans", etc. — so we cast a wide net rather
 * than hard-coding every variant.
 */
function collectAllBulletsExcept(
  chunk: string,
  excludeHeadings: string[],
): string[] {
  const items: string[] = [];
  const lines = chunk.split("\n");
  let skip = false;
  for (const line of lines) {
    const heading = line.match(/^##\s+(.+?)\s*$/);
    if (heading) {
      skip = excludeHeadings.some((h) =>
        heading[1].toLowerCase().includes(h.toLowerCase()),
      );
      continue;
    }
    if (skip) continue;
    const bullet = line.match(/^-\s+(.*\S)\s*$/);
    if (bullet) items.push(bullet[1]);
  }
  return items;
}

function extractSourceUrls(markdown: string): string[] {
  const urls: string[] = [];
  const linkRe = /\[[^\]]+\]\((https?:\/\/[^)]+)\)/g;
  for (const m of markdown.matchAll(linkRe)) urls.push(m[1]);
  // Fallback bare URLs near a "Source:" / "Fuente:" / "Fonte:" line
  const sourceLine = markdown.match(/\*?(?:Source|Fuente|Fonte):[^\n]*/i);
  if (sourceLine) {
    const bare = sourceLine[0].match(/https?:\/\/\S+/g);
    if (bare) urls.push(...bare.map((u) => u.replace(/[.)]+$/, "")));
  }
  return [...new Set(urls)];
}

function parseVersion(chunk: string): RecipeVersion | null {
  const headingMatch = chunk.match(/^##\s+(.+?)\s*$/m);
  if (!headingMatch) return null;
  const rawHeading = headingMatch[1].trim();
  // "Meat Version (No Soy / No Dairy)" → name="Meat Version", group_label="No Soy / No Dairy"
  const groupMatch = rawHeading.match(/^(.*?)\s*\(([^)]+)\)\s*$/);
  const name = (groupMatch ? groupMatch[1] : rawHeading).trim();
  const group_label = groupMatch ? groupMatch[2].trim() : null;

  const proteinMatch = chunk.match(PROTEIN_LABEL);
  const protein = proteinMatch ? proteinMatch[1].trim() : null;

  const instructions: string[] = [];
  for (const line of chunk.split("\n")) {
    const step = line.match(/^\s*\d+\.\s+(.+?)\s*$/);
    if (step) instructions.push(step[1]);
  }

  return { name, group_label, protein, instructions };
}

export function parseRecipe(
  markdown: string,
  category: "mains" | "breakfast",
  slug: string,
  locale: Locale = "en",
): ParsedRecipe {
  const titleMatch = markdown.match(/^#\s+(.+?)\s*$/m);
  const title = titleMatch ? titleMatch[1].trim() : slug;

  const cuisineRaw = markdown.match(META_PATTERNS.cuisine)?.[1]?.trim() ?? null;
  const freezerRaw = markdown.match(META_PATTERNS.freezer)?.[1]?.trim() ?? null;
  const prepRaw = markdown.match(META_PATTERNS.prep)?.[1]?.trim() ?? null;
  const cookRaw = markdown.match(META_PATTERNS.cook)?.[1]?.trim() ?? null;
  const servingsRaw = markdown.match(META_PATTERNS.servings)?.[1]?.trim() ?? null;

  const freezer_friendly = freezerRaw
    ? FREEZER_TRUE.test(freezerRaw)
      ? true
      : FREEZER_FALSE.test(freezerRaw)
        ? false
        : null
    : null;

  // Split on "---" horizontal rules. First chunk = header + shared sections, rest = versions.
  const chunks = markdown.split(/^---\s*$/m).map((c) => c.trim()).filter(Boolean);
  const header = chunks[0] ?? "";
  const versionChunks = chunks.slice(1);

  const serve_with = collectBullets(header, SERVE_HEADINGS);
  // Everything else in the header is "shared" — ingredients used by all versions.
  const shared_ingredients = collectAllBulletsExcept(header, SERVE_HEADINGS);

  const versions: RecipeVersion[] = [];
  for (const chunk of versionChunks) {
    const v = parseVersion(chunk);
    if (v) versions.push(v);
  }

  // If no "---" separators and no version headers were found, treat whole body as a
  // single version using any numbered steps.
  if (!versions.length) {
    const v = parseVersion(`## Default Version\n${markdown}`);
    if (v && v.instructions.length) versions.push(v);
  }

  return {
    slug,
    locale,
    title,
    category,
    cuisine: cuisineRaw,
    freezer_friendly,
    prep_minutes: parseMinutes(prepRaw),
    cook_minutes: parseMinutes(cookRaw),
    servings: parseServings(servingsRaw),
    shared_ingredients,
    serve_with,
    versions,
    source_urls: extractSourceUrls(markdown),
    raw_markdown: markdown,
  };
}
