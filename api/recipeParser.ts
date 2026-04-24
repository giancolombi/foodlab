// Parse a FoodLab recipe markdown file into a structured record.
// The markdown schema is defined in foodlab's root CLAUDE.md.

export interface RecipeVersion {
  name: string;
  group_label: string | null; // e.g. "No Soy / No Dairy"
  protein: string | null;
  instructions: string[];
}

export interface ParsedRecipe {
  slug: string;
  title: string;
  category: "mains" | "breakfast";
  cuisine: string | null;
  freezer_friendly: boolean | null;
  prep_minutes: number | null;
  cook_minutes: number | null;
  shared_ingredients: string[];
  serve_with: string[];
  versions: RecipeVersion[];
  source_urls: string[];
  raw_markdown: string;
}

const META_PATTERNS: Record<string, RegExp> = {
  cuisine: /\*\*Cuisine:\*\*\s*([^|]+)/i,
  freezer: /\*\*Freezer-friendly:\*\*\s*([^|]+)/i,
  prep: /\*\*Prep:\*\*\s*([^|]+)/i,
  cook: /\*\*Cook:\*\*\s*([^|]+)/i,
};

function parseMinutes(raw: string | null): number | null {
  if (!raw) return null;
  const text = raw.trim().toLowerCase();
  // Handle "1.5 hrs", "45 min", "1 hour 10 min"
  let total = 0;
  const hrsMatch = text.match(/([\d.]+)\s*(?:hr|hour)/);
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
  // Fallback bare URLs near a "Source:" line
  const sourceLine = markdown.match(/\*?Source:[^\n]*/i);
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

  const proteinMatch = chunk.match(/\*\*Protein:\*\*\s*([^\n]+)/);
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
): ParsedRecipe {
  const titleMatch = markdown.match(/^#\s+(.+?)\s*$/m);
  const title = titleMatch ? titleMatch[1].trim() : slug;

  const cuisineRaw = markdown.match(META_PATTERNS.cuisine)?.[1]?.trim() ?? null;
  const freezerRaw = markdown.match(META_PATTERNS.freezer)?.[1]?.trim() ?? null;
  const prepRaw = markdown.match(META_PATTERNS.prep)?.[1]?.trim() ?? null;
  const cookRaw = markdown.match(META_PATTERNS.cook)?.[1]?.trim() ?? null;

  const freezer_friendly = freezerRaw
    ? /^yes/i.test(freezerRaw)
      ? true
      : /^no/i.test(freezerRaw)
        ? false
        : null
    : null;

  // Split on "---" horizontal rules. First chunk = header + shared sections, rest = versions.
  const chunks = markdown.split(/^---\s*$/m).map((c) => c.trim()).filter(Boolean);
  const header = chunks[0] ?? "";
  const versionChunks = chunks.slice(1);

  const serve_with = collectBullets(header, [
    "serve with",
    "serving",
    "garnish",
    "topping",
  ]);
  // Everything else in the header is "shared" — ingredients used by all versions.
  const shared_ingredients = collectAllBulletsExcept(header, [
    "serve with",
    "serving",
    "garnish",
    "topping",
  ]);

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
    title,
    category,
    cuisine: cuisineRaw,
    freezer_friendly,
    prep_minutes: parseMinutes(prepRaw),
    cook_minutes: parseMinutes(cookRaw),
    shared_ingredients,
    serve_with,
    versions,
    source_urls: extractSourceUrls(markdown),
    raw_markdown: markdown,
  };
}
