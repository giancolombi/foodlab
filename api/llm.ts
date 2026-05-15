// Ollama client — uses /api/chat with streaming so the frontend can show
// recipe cards as soon as the model finishes writing each one.
// Docs: https://github.com/ollama/ollama/blob/main/docs/api.md

const OLLAMA_URL = process.env.OLLAMA_URL || "http://localhost:11434";
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || "qwen3.5:4b";

// Per-function model overrides. Each job has different latency / quality
// tradeoffs — the matcher is hot-path and benefits from a smaller / faster
// model, while the modify + compose paths benefit from the strongest model
// the deployment can afford (or even a cloud model like deepseek-v4-flash
// when stricter JSON adherence is worth the per-token cost). Each falls
// back to OLLAMA_MODEL so a single env keeps working.
const MODEL_FOR = {
  match: process.env.OLLAMA_MODEL_MATCH || OLLAMA_MODEL,
  modify: process.env.OLLAMA_MODEL_MODIFY || OLLAMA_MODEL,
  compose: process.env.OLLAMA_MODEL_COMPOSE || OLLAMA_MODEL,
  shopping: process.env.OLLAMA_MODEL_SHOPPING || OLLAMA_MODEL,
  extract: process.env.OLLAMA_MODEL_EXTRACT || OLLAMA_MODEL,
  expand: process.env.OLLAMA_MODEL_EXPAND || OLLAMA_MODEL,
} as const;

// Reasoning-capable models (qwen3.5, deepseek-v4, kimi, magistral) emit a
// separate `message.thinking` field on each streamed event when called with
// `think: true`. Defaults to ON since the default model (qwen3.5:4b) is
// thinking-capable; set OLLAMA_THINKING=false to disable, e.g. when
// swapping to a non-thinking model.
const OLLAMA_THINKING = process.env.OLLAMA_THINKING !== "false";

export type Locale = "en" | "es" | "pt-BR";

// Keep in sync with web/app/i18n/strings.ts LOCALE_LLM_DIRECTIVE.
//
// Important: this covers BOTH the model's user-visible output AND any
// internal reasoning / "thinking" trace on reasoning-capable models. The
// frontend may surface the reasoning live, so it has to match the user's
// chosen language — English thinking under Spanish output is jarring.
const LOCALE_DIRECTIVE: Record<Locale, string> = {
  en: "Write BOTH your internal reasoning (any thinking / scratchpad) AND your final answer in English.",
  es: "Write BOTH your internal reasoning (any thinking / scratchpad) AND your final answer in Latin American Spanish — neutral for Cuban, Peruvian, Colombian, Dominican, Venezuelan, Mexican readers. Use: frijoles, aguacate, taza, cucharada, cucharadita, cebolla, ajo, res. Avoid Spain-specific terms (judías, patata, zumo). Do not switch to English at any point.",
  "pt-BR":
    "Write BOTH your internal reasoning (any thinking / scratchpad) AND your final answer in Brazilian Portuguese. Use: xícara, colher de sopa, colher de chá, feijão, abacate, mandioca, geladeira, cebola, alho, carne. Avoid European Portuguese (chávena, frigorífico, ananás). Do not switch to English at any point.",
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
  serve_with?: string[];
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
- score is 0-100: how well the recipe matches what the user has. Higher = more of their ingredients are used.
- ONLY return a recipe if at least HALF of the recipe's shared base is satisfied by the user's pantry. Better to return 1 strong match than 3 stretch matches. If nothing meets that bar, return an empty list.
- Prefer recipes with the FEWEST missing ingredients overall. A user who provides 6 ingredients should not see a recipe needing 8 they don't have.
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
 *
 * The token set per recipe pulls from title, shared base ingredients,
 * per-version protein options, AND serve-with toppings — so a user with
 * "chicken" in the fridge matches a dish whose meat version uses chicken
 * even though the shared base is meatless, and a user with "mango" matches
 * the Caribbean bowls whose mango lives only in the serve-with.
 */
function shortlistRecipes(
  recipes: RecipeRow[],
  ingredients: string[],
  limit = 8,
): RecipeRow[] {
  const wanted = new Set(ingredients.flatMap(tokenize));
  if (wanted.size === 0) return recipes.slice(0, limit);

  const scored = recipes.map((r) => {
    const proteinTokens = (r.versions ?? []).flatMap((v) =>
      v.protein ? tokenize(v.protein) : [],
    );
    const serveTokens = (r.serve_with ?? []).flatMap(tokenize);
    const tokens = new Set([
      ...tokenize(r.title),
      ...r.shared_ingredients.flatMap(tokenize),
      ...proteinTokens,
      ...serveTokens,
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
      const proteins = (r.versions ?? [])
        .map((v) => v.protein)
        .filter((p): p is string => Boolean(p))
        .join(" | ");
      const proteinPart = proteins ? ` | proteins: ${proteins}` : "";
      return `- ${r.slug} | ${r.title}${r.cuisine ? ` (${r.cuisine})` : ""} | base: ${base}${proteinPart}`;
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
  /** Reasoning tokens from thinking-capable models (qwen3, deepseek-r1, …). */
  onThinking?: (chunk: string) => void;
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
  const body: Record<string, unknown> = {
    model: MODEL_FOR.match,
    stream: true,
    format: "json",
    // Keep the model resident so the next call doesn't pay cold-start.
    keep_alive: "5m",
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
  if (OLLAMA_THINKING) body.think = true;

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
          message?: { content?: string; thinking?: string };
          done?: boolean;
        };
        const piece = event.message?.content;
        if (piece) {
          full += piece;
          handlers.onContent(piece);
        }
        const thought = event.message?.thinking;
        if (thought && handlers.onThinking) {
          handlers.onThinking(thought);
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
      const total = matched.length + missing.length;
      const coverage = total === 0 ? 0 : matched.length / total;
      return {
        slug: r.slug,
        title: recipe.title,
        score: r.score,
        reason: r.reason,
        matched_ingredients: matched,
        missing_ingredients: missing,
        coverage,
      };
    })
    // Drop stretch matches: the user's "I gave 6, missing 8" complaint. Keep
    // recipes where the user already has at least ~40% of the base AND the
    // missing list isn't more than 1.5× the matched list. Fall back to the
    // best-coverage pick if the strict pass returns nothing so the page
    // never goes empty when the LLM did surface SOMETHING usable.
    .filter((r) => r.matched_ingredients.length > 0)
    .sort((a, b) => b.coverage - a.coverage || b.score - a.score);

  const strict = recs.filter(
    (r) =>
      r.coverage >= 0.4 &&
      r.missing_ingredients.length <= Math.max(3, r.matched_ingredients.length * 1.5),
  );

  // Cap to keep payloads + UI tidy. The matcher caps to 3 picks; the badge
  // lists are kept short so a recipe needing 8 things doesn't dominate.
  const picked = (strict.length ? strict : recs.slice(0, 1)).slice(0, 3).map((r) => ({
    slug: r.slug,
    title: r.title,
    score: r.score,
    reason: r.reason,
    matched_ingredients: r.matched_ingredients.slice(0, 8),
    missing_ingredients: r.missing_ingredients.slice(0, 6),
  }));

  handlers.onDone({ recommendations: picked, raw: full });
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
  servings: number | null;
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
  "servings": number | null,
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
  onThinking?: (chunk: string) => void;
  onDone: (final: { recipe: ModifiedRecipe; raw: string }) => void;
}

/**
 * Stream a recipe modification through Ollama using structured JSON output.
 * Frontend can render a structured preview from the parsed object; the server
 * converts it to canonical markdown when saving.
 *
 * The user message ships the original recipe as a JSON object rather than
 * raw markdown when `originalStructured` is provided — JSON is ~30% fewer
 * tokens than the markdown form (no section headers, no bullets, no
 * separators) and gets us closer to the response shape so the model has
 * less translation work to do. Falls back to the markdown form when
 * structured isn't available (e.g. older callers).
 */
export async function streamModifyRecipe(
  args: {
    originalMarkdown: string;
    originalStructured?: {
      title: string;
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
    instruction: string;
    locale?: Locale;
  },
  handlers: ModifyHandlers,
): Promise<void> {
  const locale = normalizeLocale(args.locale);
  const systemPrompt = MODIFY_SYSTEM_PROMPT.replace(
    "{LOCALE_DIRECTIVE}",
    LOCALE_DIRECTIVE[locale],
  );
  const userContent = args.originalStructured
    ? `Modification: ${args.instruction}\n\nOriginal recipe (JSON):\n\n${JSON.stringify(args.originalStructured)}`
    : `Modification: ${args.instruction}\n\nOriginal recipe:\n\n${args.originalMarkdown}`;
  const body: Record<string, unknown> = {
    model: MODEL_FOR.modify,
    stream: true,
    format: "json",
    keep_alive: "5m",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userContent },
    ],
    options: {
      temperature: 0.2,
      // Tighter ceilings for faster prompt-eval and so the model can't
      // ramble past the JSON close. Recipes serialize to ~400-700 tokens
      // as JSON (vs ~600-900 as markdown).
      num_ctx: 2048,
      num_predict: 1024,
    },
  };
  if (OLLAMA_THINKING) body.think = true;

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
          message?: { content?: string; thinking?: string };
          done?: boolean;
        };
        const piece = event.message?.content;
        if (piece) {
          full += piece;
          handlers.onContent(piece);
        }
        const thought = event.message?.thinking;
        if (thought && handlers.onThinking) {
          handlers.onThinking(thought);
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
    servings: typeof parsed.servings === "number" ? parsed.servings : null,
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

// Per-locale markdown labels for the canonical recipe format. Keeping these
// in sync across locales matters because the file gets parsed back via
// recipeParser.ts when the user later views or modifies it — and the parser
// recognises localized headers, but storing them in the user's language
// keeps the saved file readable.
const RENDER_LABELS: Record<
  Locale,
  {
    cuisine: string;
    freezer: string;
    prep: string;
    cook: string;
    servings: string;
    yes: string;
    no: string;
    sharedIngredients: string;
    serveWith: string;
    protein: string;
    modifiedFrom: (parent: string, summary: string) => string;
  }
> = {
  en: {
    cuisine: "Cuisine",
    freezer: "Freezer-friendly",
    prep: "Prep",
    cook: "Cook",
    servings: "Serves",
    yes: "Yes",
    no: "No",
    sharedIngredients: "Shared ingredients",
    serveWith: "Serve with",
    protein: "Protein",
    modifiedFrom: (parent, summary) => `Modified from ${parent}: ${summary}`,
  },
  es: {
    cuisine: "Cocina",
    freezer: "Apta para congelar",
    prep: "Preparación",
    cook: "Cocción",
    servings: "Porciones",
    yes: "Sí",
    no: "No",
    sharedIngredients: "Ingredientes compartidos",
    serveWith: "Para servir",
    protein: "Proteína",
    modifiedFrom: (parent, summary) => `Modificada de ${parent}: ${summary}`,
  },
  "pt-BR": {
    cuisine: "Cozinha",
    freezer: "Vai ao freezer",
    prep: "Preparo",
    cook: "Cozimento",
    servings: "Porções",
    yes: "Sim",
    no: "Não",
    sharedIngredients: "Ingredientes compartilhados",
    serveWith: "Para servir",
    protein: "Proteína",
    modifiedFrom: (parent, summary) => `Modificada de ${parent}: ${summary}`,
  },
};

/**
 * Render a structured ModifiedRecipe to canonical FoodLab markdown. Keeping
 * this server-side (rather than asking the LLM to produce markdown) means the
 * format is deterministic and parseable by the existing recipeParser.
 */
export function renderRecipeMarkdown(
  r: ModifiedRecipe,
  parentTitle: string,
  locale: Locale = "en",
): string {
  const L = RENDER_LABELS[locale] ?? RENDER_LABELS.en;
  const lines: string[] = [];
  lines.push(`# ${r.title}`);
  lines.push("");

  const meta: string[] = [];
  if (r.cuisine) meta.push(`**${L.cuisine}:** ${r.cuisine}`);
  if (r.freezer_friendly !== null)
    meta.push(
      `**${L.freezer}:** ${r.freezer_friendly ? L.yes : L.no}`,
    );
  if (r.prep_minutes != null) meta.push(`**${L.prep}:** ${r.prep_minutes} min`);
  if (r.cook_minutes != null) meta.push(`**${L.cook}:** ${r.cook_minutes} min`);
  if (r.servings != null) meta.push(`**${L.servings}:** ${r.servings}`);
  if (meta.length) {
    lines.push(meta.join(" | "));
    lines.push("");
  }

  if (r.shared_ingredients.length) {
    lines.push(`## ${L.sharedIngredients}`);
    for (const ing of r.shared_ingredients) lines.push(`- ${ing}`);
    lines.push("");
  }
  if (r.serve_with.length) {
    lines.push(`## ${L.serveWith}`);
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
    if (v.protein) lines.push(`**${L.protein}:** ${v.protein}`);
    lines.push("");
    v.instructions.forEach((step, i) => lines.push(`${i + 1}. ${step}`));
    lines.push("");
  }

  if (r.modification_summary) {
    lines.push("---");
    lines.push("");
    lines.push(`*${L.modifiedFrom(parentTitle, r.modification_summary)}*`);
  }

  return lines.join("\n").trim() + "\n";
}

// ---------- Shopping list consolidation ----------

const SHOPPING_LIST_SYSTEM_PROMPT = `You consolidate a multi-recipe ingredient list into a clean grocery shopping list for a household.

Input: an array of {recipe, forProfiles?: string[], ingredients[]} objects — raw ingredient lines per recipe. When "forProfiles" is present, those lines are only needed when cooking that version for those specific people (e.g. a protein swap). Lines without "forProfiles" are shared across the household.
Output: ONLY a JSON object of shape:
{"sections": {"produce": Item[], "proteins": Item[], "dairy": Item[], "pantry": Item[], "other": Item[]}}
where Item = {"name": string, "quantity": string, "sources": string[], "forProfiles": string[]}

Rules:
- Merge duplicate ingredients across recipes when they apply to the same audience. If two recipes both use garlic for everyone, output ONE entry with summed quantity.
- Do NOT merge a per-profile line into a shared line. If "chicken thighs" is tagged forProfiles=["Gian"], keep it separate from any other chicken entries.
- Sum quantities when units match (e.g. "2 tbsp olive oil" + "1 tbsp olive oil" = "3 tbsp olive oil").
- When units differ for the same item, list them separated by "+" (e.g. "1 cup + 2 tbsp").
- Strip prep modifiers (minced, diced, chopped) from the name; keep the core ingredient.
- Categorize into exactly one of: produce, proteins, dairy, pantry, other.
- "sources" lists the recipe titles (from the input) that contributed to this item.
- "forProfiles" echoes which people the item is for; empty array [] means it's for everyone.
- Alphabetize within each section.
- Output JSON only. No prose, no markdown fences.

LANGUAGE: {LOCALE_DIRECTIVE}`;

export interface ConsolidatedListItem {
  name: string;
  quantity: string;
  sources: string[];
  forProfiles: string[];
}

export type ConsolidatedSections = Record<
  "produce" | "proteins" | "dairy" | "pantry" | "other",
  ConsolidatedListItem[]
>;

/**
 * Use Ollama to consolidate and categorize ingredients across multiple recipes.
 * Falls back to returning empty sections if parsing fails — callers should
 * keep their client-side deterministic version as the default so this is
 * purely a quality upgrade.
 */
export async function consolidateShoppingList(args: {
  recipes: Array<{
    title: string;
    forProfiles?: string[];
    ingredients: string[];
  }>;
  locale?: Locale;
}): Promise<ConsolidatedSections> {
  const locale = normalizeLocale(args.locale);
  const systemPrompt = SHOPPING_LIST_SYSTEM_PROMPT.replace(
    "{LOCALE_DIRECTIVE}",
    LOCALE_DIRECTIVE[locale],
  );

  const body = {
    model: MODEL_FOR.shopping,
    stream: false,
    format: "json",
    keep_alive: "5m",
    messages: [
      { role: "system", content: systemPrompt },
      {
        role: "user",
        content: `Consolidate these recipes:\n${JSON.stringify(args.recipes)}`,
      },
    ],
    options: {
      temperature: 0,
      num_ctx: 4096,
      num_predict: 2000,
    },
  };

  const res = await fetch(`${OLLAMA_URL}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`Ollama ${res.status}: ${await res.text()}`);
  }
  const data = (await res.json()) as { message?: { content?: string } };
  const content = data.message?.content ?? "";

  let parsed: { sections?: Partial<ConsolidatedSections> };
  try {
    parsed = JSON.parse(content);
  } catch {
    const m = content.match(/\{[\s\S]*\}/);
    parsed = m ? JSON.parse(m[0]) : {};
  }

  const empty: ConsolidatedSections = {
    produce: [],
    proteins: [],
    dairy: [],
    pantry: [],
    other: [],
  };

  // Shape-check each section and each item defensively — the model sometimes
  // inserts unexpected keys or drops fields.
  const sanitize = (arr: unknown): ConsolidatedListItem[] => {
    if (!Array.isArray(arr)) return [];
    return arr
      .map((x: unknown) => {
        if (!x || typeof x !== "object") return null;
        const item = x as Record<string, unknown>;
        const name = typeof item.name === "string" ? item.name : "";
        if (!name) return null;
        return {
          name,
          quantity:
            typeof item.quantity === "string" ? item.quantity : "",
          sources: Array.isArray(item.sources)
            ? item.sources.filter((s: unknown): s is string => typeof s === "string")
            : [],
          forProfiles: Array.isArray(item.forProfiles)
            ? item.forProfiles.filter(
                (s: unknown): s is string => typeof s === "string",
              )
            : [],
        };
      })
      .filter((x): x is ConsolidatedListItem => x !== null);
  };

  const sections = parsed.sections ?? {};
  return {
    produce: sanitize(sections.produce),
    proteins: sanitize(sections.proteins),
    dairy: sanitize(sections.dairy),
    pantry: sanitize(sections.pantry),
    other: sanitize(sections.other),
  } ?? empty;
}

/**
 * Ask Ollama to load the model into memory without generating anything. Used
 * as a background "warmup" so the first real translation request doesn't pay
 * cold-start latency. Per Ollama docs, omitting `prompt` with `keep_alive` set
 * just loads the model.
 */
export async function warmOllama(): Promise<void> {
  try {
    await fetch(`${OLLAMA_URL}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: OLLAMA_MODEL,
        keep_alive: "5m",
      }),
    });
  } catch {
    // non-fatal: translation will just cold-start on its first real call
  }
}

// ---------- Iterative menu composer ----------

export interface ComposeDish {
  id: string;
  name: string;
  cuisine?: string;
  base?: string;
  vegProtein?: string;
  meatProtein?: string;
  notes?: string;
  isBreakfast: boolean;
}

export interface ComposeDraft {
  dishes: ComposeDish[];
}

export interface ComposeMessage {
  role: "user" | "assistant";
  content: string;
}

export interface ComposeResult {
  reply: string;
  draft: ComposeDraft;
}

const COMPOSE_SYSTEM_PROMPT = `You are FoodLab's weekly menu planning assistant. The user is planning a week of meal prep — they want around 4 mains + 1 breakfast, all high-protein, freezer-friendly, and ideally with both a vegetarian and a meat protein swap on the same shared base.

Always respond with ONLY this JSON shape — no prose outside it, no markdown fences:
{"reply": "<short chatty reply, 2-4 sentences>", "draft": {"dishes": [{"id": "<id>", "name": "<dish name>", "cuisine": "<cuisine or null>", "base": "<shared veggies + spices, one short sentence>", "vegProtein": "<veg protein or null>", "meatProtein": "<meat protein or null>", "isBreakfast": <true|false>}]}}

Rules for draft.dishes:
- ALWAYS return the COMPLETE updated menu (every dish the user wants), not a delta. The previous draft is provided for context.
- Preserve dish ids across turns. Only mint a new id (a short slug-like string) for newly proposed dishes.
- Keep the same dish structure: shared base + vegProtein + meatProtein. Variations on protein only.
- Aim for diverse cuisines and methods (don't propose two stews; mix tagine + sheet-pan + bake + stir-fry).
- High-protein and freezer-friendly preferred.
- "base" is a single short sentence describing the shared veggies and spice profile.
- Mark exactly one dish per week as isBreakfast=true (unless the user only asks for mains).
- If the user mentions dietary restrictions (no soy/dairy/etc), respect them in the meatProtein/vegProtein swaps.

Rules for reply:
- Be conversational. Acknowledge what the user asked, briefly justify the picks, and end with a forward question (e.g. "want to swap any?", "ready to lock this in?").
- Keep it tight — 2-4 sentences max.
- If the user only chatted (didn't ask for menu changes), return the same draft and reply naturally.

LANGUAGE: {LOCALE_DIRECTIVE}`;

/**
 * Multi-turn menu composition. The caller passes the full chat history plus
 * the current draft; the model returns an updated draft and a chatty reply.
 * Falls back to the previous draft if the model returns malformed JSON.
 */
export async function composeMenu(args: {
  messages: ComposeMessage[];
  currentDraft: ComposeDraft;
  locale?: Locale;
}): Promise<ComposeResult> {
  const locale = normalizeLocale(args.locale);
  const systemPrompt = COMPOSE_SYSTEM_PROMPT.replace(
    "{LOCALE_DIRECTIVE}",
    LOCALE_DIRECTIVE[locale],
  );

  // Embed the current draft as the first system-tagged user message so the
  // model treats it as ground truth rather than something to chat about.
  const draftContext: ComposeMessage = {
    role: "user",
    content: `[CURRENT_DRAFT]\n${JSON.stringify(args.currentDraft)}`,
  };

  const body = {
    model: MODEL_FOR.compose,
    stream: false,
    format: "json",
    keep_alive: "5m",
    messages: [
      { role: "system", content: systemPrompt },
      draftContext,
      ...args.messages,
    ],
    options: {
      temperature: 0.4,
      num_ctx: 4096,
      num_predict: 1500,
    },
  };

  const res = await fetch(`${OLLAMA_URL}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`Ollama compose ${res.status}`);
  }
  const data = (await res.json()) as { message?: { content?: string } };
  const content = data?.message?.content ?? "";

  let parsed: { reply?: unknown; draft?: { dishes?: unknown } } = {};
  try {
    parsed = JSON.parse(content);
  } catch {
    const m = content.match(/\{[\s\S]*\}/);
    parsed = m ? JSON.parse(m[0]) : {};
  }

  const reply =
    typeof parsed.reply === "string" && parsed.reply.trim().length > 0
      ? parsed.reply.trim()
      : "Updated.";

  const rawDishes = Array.isArray(parsed.draft?.dishes) ? parsed.draft!.dishes : [];
  const dishes: ComposeDish[] = rawDishes
    .map((d, i) => coerceDish(d, i))
    .filter((d): d is ComposeDish => d !== null);

  // If parsing produced nothing, keep the previous draft so the user doesn't
  // lose their work to a single bad turn.
  return {
    reply,
    draft: { dishes: dishes.length > 0 ? dishes : args.currentDraft.dishes },
  };
}

function coerceDish(raw: unknown, index: number): ComposeDish | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const name = typeof r.name === "string" ? r.name.trim() : "";
  if (!name) return null;
  const id = typeof r.id === "string" && r.id.trim().length > 0
    ? r.id.trim()
    : `dish-${Date.now().toString(36)}-${index}`;
  return {
    id,
    name,
    cuisine: optStr(r.cuisine),
    base: optStr(r.base),
    vegProtein: optStr(r.vegProtein),
    meatProtein: optStr(r.meatProtein),
    notes: optStr(r.notes),
    isBreakfast: Boolean(r.isBreakfast),
  };
}

function optStr(v: unknown): string | undefined {
  if (typeof v !== "string") return undefined;
  const t = v.trim();
  if (!t || t.toLowerCase() === "null") return undefined;
  return t;
}

// ---------- Expand a draft dish into a full recipe markdown ----------

const EXPAND_DISH_SYSTEM_PROMPT = `You write a single recipe in FoodLab's markdown format. Given a dish concept (name, cuisine, shared base, optional veg + meat protein), produce ONE complete recipe document that the FoodLab parser can ingest.

Output ONLY the markdown — no JSON, no fences, no commentary.

Required structure (use these section headers EXACTLY):

# <Dish Name>

**Cuisine:** <cuisine> | **Freezer-friendly:** Yes | **Prep:** <N> min | **Cook:** <N> min

## Shared Base
- <ingredient with quantity, one per bullet>
- ...

## Serve With
- <serving suggestion, one per bullet>
- ...

---

## <Group Name> Version
**Protein:** <protein with quantity>

1. <step>
2. <step>
...

(if a meat version was requested, repeat the "---" separator and a second "## Meat Version" block)

Rules:
- Quantities use common US units: tbsp, tsp, cup, cloves, oz, lb, can.
- Shared Base contains EVERY ingredient that's the same across both versions (veggies, spices, oil, broth). Proteins go in each version block.
- Each version block has 5–8 numbered instruction steps. Be specific but concise.
- If only a vegProtein is given, write only one version (label it "Vegetarian").
- If only a meatProtein is given, write one version (label it the protein, e.g. "Chicken").
- Both proteins given → two version blocks separated by "---".
- Use a freezer-friendly approach: one-pot or sheet-pan when possible.
- Output the markdown ONLY.

LANGUAGE: {LOCALE_DIRECTIVE}`;

export async function expandDishToRecipe(args: {
  dish: ComposeDish;
  locale?: Locale;
}): Promise<string> {
  const locale = normalizeLocale(args.locale);
  const systemPrompt = EXPAND_DISH_SYSTEM_PROMPT.replace(
    "{LOCALE_DIRECTIVE}",
    LOCALE_DIRECTIVE[locale],
  );

  const body = {
    model: MODEL_FOR.expand,
    stream: false,
    keep_alive: "5m",
    messages: [
      { role: "system", content: systemPrompt },
      {
        role: "user",
        content: `Dish concept:\n${JSON.stringify(args.dish)}`,
      },
    ],
    options: {
      temperature: 0.4,
      num_ctx: 4096,
      num_predict: 1500,
    },
  };

  const res = await fetch(`${OLLAMA_URL}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Ollama expand ${res.status}`);
  const data = (await res.json()) as { message?: { content?: string } };
  let md = (data?.message?.content ?? "").trim();
  // Strip any accidental fenced blocks the model wraps around the markdown.
  md = md.replace(/^```(?:markdown|md)?\s*\n/i, "").replace(/\n```\s*$/i, "");
  return md;
}

// ---------- Extract a recipe from pasted text ----------

const EXTRACT_RECIPE_SYSTEM_PROMPT = `You convert a pasted recipe (often messy web copy with ads, headers, comments) into FoodLab's markdown format.

Output ONLY the markdown — no JSON, no fences, no commentary.

Required structure (use these section headers EXACTLY):

# <Dish Name>

**Cuisine:** <cuisine if known> | **Freezer-friendly:** Yes | **Prep:** <N> min | **Cook:** <N> min

## Shared Base
- <ingredient with quantity, one per bullet>
- ...

## Serve With
- <serving suggestion, one per bullet>
- ...

---

## <Version Name> Version
**Protein:** <protein with quantity>

1. <step>
2. <step>
...

Rules:
- Strip all extraneous prose (intro paragraphs, ads, "tips" sections). Keep only ingredients + instructions.
- Quantities use common US units (tbsp, tsp, cup, cloves, oz, lb, can). Convert metric only if needed.
- "Shared Base" = every ingredient that's part of the dish independent of protein. The protein itself goes in the version block.
- KEEP IT SIMPLE: condense to 5–8 numbered steps. Combine adjacent prep/cook actions into one sentence rather than splitting into many micro-steps. Drop optional garnishes and flourishes that aren't load-bearing.
- Prefer common pantry ingredients. If the source uses something specialty (gochujang, berbere, etc.) keep it only if it's central to the cuisine.
- If the source mentions a single protein only, output one version block named after that protein (or "Original").
- If the source has multiple variants (veg + meat), output one version block per variant separated by "---".
- Output the markdown ONLY.

LANGUAGE: {LOCALE_DIRECTIVE}`;

export async function extractRecipeFromText(args: {
  text: string;
  locale?: Locale;
}): Promise<string> {
  const locale = normalizeLocale(args.locale);
  const systemPrompt = EXTRACT_RECIPE_SYSTEM_PROMPT.replace(
    "{LOCALE_DIRECTIVE}",
    LOCALE_DIRECTIVE[locale],
  );

  const body = {
    model: MODEL_FOR.extract,
    stream: false,
    keep_alive: "5m",
    messages: [
      { role: "system", content: systemPrompt },
      {
        role: "user",
        content: `Pasted recipe:\n${args.text.slice(0, 12000)}`,
      },
    ],
    options: {
      temperature: 0.3,
      num_ctx: 8192,
      num_predict: 1800,
    },
  };

  const res = await fetch(`${OLLAMA_URL}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Ollama extract ${res.status}`);
  const data = (await res.json()) as { message?: { content?: string } };
  let md = (data?.message?.content ?? "").trim();
  md = md.replace(/^```(?:markdown|md)?\s*\n/i, "").replace(/\n```\s*$/i, "");
  return md;
}

export async function checkOllama(): Promise<{
  ok: boolean;
  model: string;
  error?: string;
}> {
  try {
    const res = await fetch(`${OLLAMA_URL}/api/tags`, {
      signal: AbortSignal.timeout(2000),
    });
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
