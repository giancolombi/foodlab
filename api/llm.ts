// Ollama client — uses /api/chat with streaming so the frontend can show
// recipe cards as soon as the model finishes writing each one.
// Docs: https://github.com/ollama/ollama/blob/main/docs/api.md

const OLLAMA_URL = process.env.OLLAMA_URL || "http://localhost:11434";
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || "qwen2.5:3b";

export type Locale = "en" | "es" | "pt-BR";

// Keep in sync with web/app/i18n/strings.ts LOCALE_LLM_DIRECTIVE.
const LOCALE_DIRECTIVE: Record<Locale, string> = {
  en: "Respond in English.",
  es: "Respond in Latin American Spanish — neutral for Cuban, Peruvian, Colombian, Dominican, Venezuelan, Mexican readers. Use: frijoles, aguacate, taza, cucharada, cucharadita, cebolla, ajo, res. Avoid Spain-specific terms (judías, patata, zumo).",
  "pt-BR":
    "Respond in Brazilian Portuguese. Use: xícara, colher de sopa, colher de chá, feijão, abacate, mandioca, geladeira, cebola, alho, carne. Avoid European Portuguese (chávena, frigorífico, ananás).",
};

function normalizeLocale(input: unknown): Locale {
  if (input === "es" || input === "pt-BR" || input === "en") return input;
  return "en";
}

interface RecipeRow {
  id: string;
  slug: string;
  title: string;
  cuisine: string | null;
  shared_ingredients: string[];
  versions: Array<{
    name: string;
    protein?: string | null;
    group_label?: string | null;
  }>;
}

interface ProfileContext {
  name: string;
  restrictions: string[];
  allergies: string[];
  preferences: string[];
}

export interface Recommendation {
  slug: string;
  title?: string;
  score: number;
  matched_ingredients: string[];
  missing_ingredients: string[];
  reason: string;
}

const SYSTEM_PROMPT = `You are FoodLab's recipe recommender. Pick up to 3 recipes from the provided catalog that fit the user's pantry and (if given) eaters' dietary profiles.

Respond ONLY with JSON of shape:
{"recommendations":[{"slug":string,"score":number,"reason":string}]}

Rules:
- slug MUST be one of the slugs in the catalog below — never invent one.
- score is 0-100: how well the recipe matches what the user has. Higher = more of their ingredients are used. A recipe with no overlap should not be returned at all.
- Pick the top 3 recipes by overlap. If fewer than 3 recipes use ANY of the user's ingredients, return fewer.
- When multiple eaters are listed, the recipe must work for ALL of them. Exclude any recipe whose shared base contains an ingredient violating ANY eater's restrictions or allergies. (Per-eater protein swaps are okay — those are handled by versions.)
- reason is ONE short sentence (≤ 20 words). If multiple eaters are present, mention briefly how it accommodates them.
- Output JSON only. No prose, no markdown fences.

Do NOT include matched_ingredients or missing_ingredients fields — the server computes those.

LANGUAGE: {LOCALE_DIRECTIVE}
The recipe catalog below is in English, but write the "reason" field in the target language. Recipe slugs must NEVER be translated — they are identifiers.`;

function tokenize(s: string): string[] {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2);
}

/**
 * Cheap pre-filter: rank catalog recipes by token overlap with the user's
 * ingredient list, then keep the top N. Sending fewer rows to the LLM means
 * shorter prompt processing and fewer tokens to attend to per generated token.
 */
function shortlistRecipes(
  recipes: RecipeRow[],
  ingredients: string[],
  limit = 8,
): RecipeRow[] {
  const wanted = new Set(ingredients.flatMap(tokenize));
  if (wanted.size === 0) return recipes.slice(0, limit);

  const scored = recipes.map((r) => {
    const tokens = new Set([
      ...tokenize(r.title),
      ...r.shared_ingredients.flatMap(tokenize),
    ]);
    let overlap = 0;
    for (const w of wanted) if (tokens.has(w)) overlap++;
    return { recipe: r, overlap };
  });

  scored.sort((a, b) => b.overlap - a.overlap);
  // Always include some recipes even if zero overlap, so the model has options.
  return scored.slice(0, limit).map((s) => s.recipe);
}

function buildUserPrompt(args: {
  ingredients: string[];
  profiles: ProfileContext[];
  recipes: RecipeRow[];
}): string {
  const catalog = args.recipes
    .map((r) => {
      const base = r.shared_ingredients.slice(0, 8).join(", ");
      return `- ${r.slug} | ${r.title}${r.cuisine ? ` (${r.cuisine})` : ""} | base: ${base}`;
    })
    .join("\n");

  const lines: string[] = [];
  lines.push(`User has: ${args.ingredients.join(", ")}`);
  if (args.profiles.length === 1) {
    const p = args.profiles[0];
    lines.push(`Eater: ${p.name}`);
    if (p.restrictions.length)
      lines.push(`Restrictions: ${p.restrictions.join(", ")}`);
    if (p.allergies.length)
      lines.push(`Allergies: ${p.allergies.join(", ")}`);
    if (p.preferences.length)
      lines.push(`Preferences: ${p.preferences.join(", ")}`);
  } else if (args.profiles.length > 1) {
    lines.push(`Eaters (${args.profiles.length}):`);
    for (const p of args.profiles) {
      const parts: string[] = [];
      if (p.restrictions.length)
        parts.push(`restrictions: ${p.restrictions.join(", ")}`);
      if (p.allergies.length)
        parts.push(`allergies: ${p.allergies.join(", ")}`);
      if (p.preferences.length)
        parts.push(`prefers: ${p.preferences.join(", ")}`);
      lines.push(`- ${p.name}${parts.length ? ` — ${parts.join("; ")}` : ""}`);
    }
    lines.push(
      `Recipe must work for ALL eaters above (combined restrictions and allergies).`,
    );
  }
  lines.push("");
  lines.push("Recipe catalog:");
  lines.push(catalog);
  return lines.join("\n");
}

export interface StreamHandlers {
  onContent: (chunk: string) => void;
  onDone: (final: { recommendations: Recommendation[]; raw: string }) => void;
}

/**
 * Stream a recommendation request through Ollama. Each token of `message.content`
 * is forwarded via `onContent` as it arrives. When the stream finishes we attempt
 * to JSON-parse the accumulated text, validate slugs against the catalog, and
 * pass the cleaned recommendations to `onDone`.
 */
export async function streamRecommendations(
  args: {
    ingredients: string[];
    profiles: ProfileContext[];
    recipes: RecipeRow[];
    locale?: Locale;
  },
  handlers: StreamHandlers,
): Promise<void> {
  const locale = normalizeLocale(args.locale);
  const shortlist = shortlistRecipes(args.recipes, args.ingredients);
  const systemPrompt = SYSTEM_PROMPT.replace(
    "{LOCALE_DIRECTIVE}",
    LOCALE_DIRECTIVE[locale],
  );
  const body = {
    model: OLLAMA_MODEL,
    stream: true,
    format: "json",
    messages: [
      { role: "system", content: systemPrompt },
      {
        role: "user",
        content: buildUserPrompt({ ...args, recipes: shortlist }),
      },
    ],
    options: {
      temperature: 0.2,
      // Keep context tight — our prompt is small, and a smaller window means
      // faster prompt processing.
      num_ctx: 2048,
      // Cap output so the model doesn't ramble past the JSON closing brace.
      num_predict: 512,
    },
  };

  const res = await fetch(`${OLLAMA_URL}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok || !res.body) {
    throw new Error(`Ollama ${res.status}: ${await res.text()}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let full = "";

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    // Ollama emits newline-delimited JSON, one event per chunk.
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      try {
        const event = JSON.parse(trimmed) as {
          message?: { content?: string };
          done?: boolean;
        };
        const piece = event.message?.content;
        if (piece) {
          full += piece;
          handlers.onContent(piece);
        }
      } catch {
        // ignore malformed line — Ollama is generally well-behaved
      }
    }
  }

  // Parse the final accumulated content. Models can occasionally wrap the JSON.
  let parsed: { recommendations?: Recommendation[] };
  try {
    parsed = JSON.parse(full);
  } catch {
    const match = full.match(/\{[\s\S]*\}/);
    parsed = match ? JSON.parse(match[0]) : { recommendations: [] };
  }

  // Validate slugs against the catalog and compute matched/missing ingredients
  // server-side. The model only contributes slug + score + reason — we don't
  // trust it for ingredient-level claims because it tends to hallucinate them.
  const userTokens = new Set(args.ingredients.flatMap(tokenize));

  const recs = (parsed.recommendations ?? [])
    .map((r) => ({
      slug: r.slug,
      score:
        typeof r.score === "number" ? Math.max(0, Math.min(100, r.score)) : 0,
      reason: typeof r.reason === "string" ? r.reason : "",
    }))
    .filter((r) => args.recipes.some((c) => c.slug === r.slug))
    .map((r) => {
      const recipe = args.recipes.find((c) => c.slug === r.slug)!;
      const ingredientList = recipe.shared_ingredients ?? [];
      const matched: string[] = [];
      const missing: string[] = [];
      for (const ing of ingredientList) {
        const ingTokens = tokenize(ing);
        const overlaps = ingTokens.some((t) => userTokens.has(t));
        if (overlaps) matched.push(ing);
        else missing.push(ing);
      }
      // Cap to keep payloads + UI tidy.
      return {
        slug: r.slug,
        title: recipe.title,
        score: r.score,
        reason: r.reason,
        matched_ingredients: matched.slice(0, 8),
        missing_ingredients: missing.slice(0, 12),
      };
    })
    .slice(0, 3);

  handlers.onDone({ recommendations: recs, raw: full });
}

// ---------- Modify ----------

export interface ModifiedVersion {
  name: string;
  group_label: string | null;
  protein: string | null;
  instructions: string[];
}

export interface ModifiedRecipe {
  title: string;
  cuisine: string | null;
  freezer_friendly: boolean | null;
  prep_minutes: number | null;
  cook_minutes: number | null;
  shared_ingredients: string[];
  serve_with: string[];
  versions: ModifiedVersion[];
  modification_summary: string;
}

const MODIFY_SYSTEM_PROMPT = `You are FoodLab's recipe editor. The user gives you an existing recipe and a short instruction describing what to change. You return the modified recipe as STRUCTURED JSON.

Respond ONLY with JSON of this exact shape:
{
  "title": string,
  "cuisine": string | null,
  "freezer_friendly": boolean | null,
  "prep_minutes": number | null,
  "cook_minutes": number | null,
  "shared_ingredients": string[],
  "serve_with": string[],
  "versions": [
    {
      "name": string,
      "group_label": string | null,
      "protein": string | null,
      "instructions": string[]
    }
  ],
  "modification_summary": string
}

Rules:
- Adjust title to reflect the change when meaningful (e.g. "Spicy Chipotle Sweet Potato Bowls").
- shared_ingredients are ingredients used in ALL versions, with quantities (e.g. "2 large sweet potatoes, peeled and cubed").
- serve_with are toppings/garnishes/sides — exclude these from shared_ingredients.
- Each instruction is one numbered step as a plain sentence (no leading "1." — just the text).
- group_label describes dietary fit, e.g. "No Soy / No Dairy", or null.
- protein names the per-version protein, e.g. "1 lb chicken thighs" — null for vegetarian-only single-version.
- modification_summary is one short sentence describing what changed and why.
- Preserve the original structure. Only change what the user asked. Keep quantities consistent.
- Output JSON only. No prose, no markdown fences.

LANGUAGE: {LOCALE_DIRECTIVE}
Translate all human-readable strings (title, cuisine, group_label, protein, shared_ingredients, serve_with, instructions, modification_summary) into the target language. Use that locale's natural culinary terms. Quantities and units should use the locale's conventions (e.g. Portuguese uses "xícara" for cup).`;

export interface ModifyHandlers {
  onContent: (chunk: string) => void;
  onDone: (final: { recipe: ModifiedRecipe; raw: string }) => void;
}

/**
 * Stream a recipe modification through Ollama using structured JSON output.
 * Frontend can render a structured preview from the parsed object; the server
 * converts it to canonical markdown when saving.
 */
export async function streamModifyRecipe(
  args: { originalMarkdown: string; instruction: string; locale?: Locale },
  handlers: ModifyHandlers,
): Promise<void> {
  const locale = normalizeLocale(args.locale);
  const systemPrompt = MODIFY_SYSTEM_PROMPT.replace(
    "{LOCALE_DIRECTIVE}",
    LOCALE_DIRECTIVE[locale],
  );
  const body = {
    model: OLLAMA_MODEL,
    stream: true,
    format: "json",
    messages: [
      { role: "system", content: systemPrompt },
      {
        role: "user",
        content: `Modification: ${args.instruction}\n\nOriginal recipe:\n\n${args.originalMarkdown}`,
      },
    ],
    options: {
      temperature: 0.2,
      num_ctx: 4096,
      num_predict: 1500,
    },
  };

  const res = await fetch(`${OLLAMA_URL}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok || !res.body) {
    throw new Error(`Ollama ${res.status}: ${await res.text()}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let full = "";

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      try {
        const event = JSON.parse(trimmed) as {
          message?: { content?: string };
          done?: boolean;
        };
        const piece = event.message?.content;
        if (piece) {
          full += piece;
          handlers.onContent(piece);
        }
      } catch {
        // ignore malformed line
      }
    }
  }

  let parsed: any;
  try {
    parsed = JSON.parse(full);
  } catch {
    const m = full.match(/\{[\s\S]*\}/);
    if (!m) throw new Error("Model returned unparseable JSON");
    parsed = JSON.parse(m[0]);
  }

  // Defensive normalization — fill defaults so the route can always render
  // markdown. The route applies a stricter Zod check before saving.
  const recipe: ModifiedRecipe = {
    title: typeof parsed.title === "string" ? parsed.title : "Untitled recipe",
    cuisine: typeof parsed.cuisine === "string" ? parsed.cuisine : null,
    freezer_friendly:
      typeof parsed.freezer_friendly === "boolean"
        ? parsed.freezer_friendly
        : null,
    prep_minutes:
      typeof parsed.prep_minutes === "number" ? parsed.prep_minutes : null,
    cook_minutes:
      typeof parsed.cook_minutes === "number" ? parsed.cook_minutes : null,
    shared_ingredients: Array.isArray(parsed.shared_ingredients)
      ? parsed.shared_ingredients.filter((s: any) => typeof s === "string")
      : [],
    serve_with: Array.isArray(parsed.serve_with)
      ? parsed.serve_with.filter((s: any) => typeof s === "string")
      : [],
    versions: Array.isArray(parsed.versions)
      ? parsed.versions
          .map((v: any) => ({
            name: typeof v?.name === "string" ? v.name : "Version",
            group_label:
              typeof v?.group_label === "string" ? v.group_label : null,
            protein: typeof v?.protein === "string" ? v.protein : null,
            instructions: Array.isArray(v?.instructions)
              ? v.instructions.filter((s: any) => typeof s === "string")
              : [],
          }))
          .filter((v: ModifiedVersion) => v.instructions.length > 0)
      : [],
    modification_summary:
      typeof parsed.modification_summary === "string"
        ? parsed.modification_summary
        : "",
  };

  handlers.onDone({ recipe, raw: full });
}

/**
 * Render a structured ModifiedRecipe to canonical FoodLab markdown. Keeping
 * this server-side (rather than asking the LLM to produce markdown) means the
 * format is deterministic and parseable by the existing recipeParser.
 */
export function renderRecipeMarkdown(
  r: ModifiedRecipe,
  parentTitle: string,
): string {
  const lines: string[] = [];
  lines.push(`# ${r.title}`);
  lines.push("");

  const meta: string[] = [];
  if (r.cuisine) meta.push(`**Cuisine:** ${r.cuisine}`);
  if (r.freezer_friendly !== null)
    meta.push(`**Freezer-friendly:** ${r.freezer_friendly ? "Yes" : "No"}`);
  if (r.prep_minutes != null) meta.push(`**Prep:** ${r.prep_minutes} min`);
  if (r.cook_minutes != null) meta.push(`**Cook:** ${r.cook_minutes} min`);
  if (meta.length) {
    lines.push(meta.join(" | "));
    lines.push("");
  }

  if (r.shared_ingredients.length) {
    lines.push("## Shared ingredients");
    for (const ing of r.shared_ingredients) lines.push(`- ${ing}`);
    lines.push("");
  }
  if (r.serve_with.length) {
    lines.push("## Serve with");
    for (const ing of r.serve_with) lines.push(`- ${ing}`);
    lines.push("");
  }

  for (const v of r.versions) {
    lines.push("---");
    lines.push("");
    const heading = v.group_label
      ? `## ${v.name} (${v.group_label})`
      : `## ${v.name}`;
    lines.push(heading);
    if (v.protein) lines.push(`**Protein:** ${v.protein}`);
    lines.push("");
    v.instructions.forEach((step, i) => lines.push(`${i + 1}. ${step}`));
    lines.push("");
  }

  if (r.modification_summary) {
    lines.push("---");
    lines.push("");
    lines.push(`*Modified from ${parentTitle}: ${r.modification_summary}*`);
  }

  return lines.join("\n").trim() + "\n";
}

export async function checkOllama(): Promise<{
  ok: boolean;
  model: string;
  error?: string;
}> {
  try {
    const res = await fetch(`${OLLAMA_URL}/api/tags`);
    if (!res.ok) {
      return {
        ok: false,
        model: OLLAMA_MODEL,
        error: `Ollama returned ${res.status}`,
      };
    }
    return { ok: true, model: OLLAMA_MODEL };
  } catch (err) {
    return {
      ok: false,
      model: OLLAMA_MODEL,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
