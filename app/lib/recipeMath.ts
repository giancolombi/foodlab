// Pure utilities for parsing and scaling ingredient quantities.
//
// Used by the "quick edit" ladder to apply halve / double / scale-to-N
// operations client-side without an LLM round-trip. The format we read in is
// the same one the LLM produces and recipeParser stores: free-form lines like
// "1.5 cups long-grain rice" or "1/2 tsp cumin" or "Pinch of saffron".
//
// Only the leading numeric quantity gets multiplied. Unitless qualifiers like
// "to taste" / "pinch" / "as needed" are left alone — multiplying "Salt to
// taste" by 2 makes no sense.

export interface ParsedQuantity {
  /** Numeric value (decimal). */
  value: number;
  /** Original text occupying the quantity (incl. fraction / mixed-number). */
  raw: string;
  /** Index range in the source line where the quantity occupies. */
  start: number;
  end: number;
}

const UNICODE_FRACTIONS: Record<string, number> = {
  "¼": 0.25,
  "½": 0.5,
  "¾": 0.75,
  "⅐": 1 / 7,
  "⅑": 1 / 9,
  "⅒": 0.1,
  "⅓": 1 / 3,
  "⅔": 2 / 3,
  "⅕": 0.2,
  "⅖": 0.4,
  "⅗": 0.6,
  "⅘": 0.8,
  "⅙": 1 / 6,
  "⅚": 5 / 6,
  "⅛": 0.125,
  "⅜": 0.375,
  "⅝": 0.625,
  "⅞": 0.875,
};

// Matches at the start of a line (after optional whitespace):
//   - mixed number: "1 1/2"
//   - fraction:     "1/2"
//   - decimal:      "1.5"
//   - integer:      "3"
//   - unicode frac: "½"
//   - integer + unicode: "1½"
const QUANTITY_RE =
  /^\s*(\d+\s+\d+\/\d+|\d+\/\d+|\d+(?:\.\d+)?|[¼½¾⅐⅑⅒⅓⅔⅕⅖⅗⅘⅙⅚⅛⅜⅝⅞]|\d+[¼½¾⅐⅑⅒⅓⅔⅕⅖⅗⅘⅙⅚⅛⅜⅝⅞])(?=\s|$|[a-zA-Z])/;

export function parseQuantity(line: string): ParsedQuantity | null {
  const m = line.match(QUANTITY_RE);
  if (!m) return null;
  const raw = m[1];
  const value = readNumeric(raw);
  if (value === null || value === 0) return null;
  const start = m.index ?? 0;
  // Account for leading whitespace consumed by `\s*`.
  const leadingWs = m[0].length - raw.length;
  return { value, raw, start: start + leadingWs, end: start + leadingWs + raw.length };
}

function readNumeric(s: string): number | null {
  // Mixed number "1 1/2"
  const mixed = s.match(/^(\d+)\s+(\d+)\/(\d+)$/);
  if (mixed) return parseInt(mixed[1], 10) + parseInt(mixed[2], 10) / parseInt(mixed[3], 10);
  // Plain fraction
  const frac = s.match(/^(\d+)\/(\d+)$/);
  if (frac) return parseInt(frac[1], 10) / parseInt(frac[2], 10);
  // Integer + unicode fraction "1½"
  const intFrac = s.match(/^(\d+)([¼½¾⅐⅑⅒⅓⅔⅕⅖⅗⅘⅙⅚⅛⅜⅝⅞])$/);
  if (intFrac) return parseInt(intFrac[1], 10) + UNICODE_FRACTIONS[intFrac[2]];
  // Unicode fraction alone
  if (UNICODE_FRACTIONS[s] !== undefined) return UNICODE_FRACTIONS[s];
  // Decimal / integer
  const num = parseFloat(s);
  return Number.isFinite(num) ? num : null;
}

/**
 * Render a number back to a clean fraction or decimal. Common cooking
 * fractions land on unicode glyphs (½, ¼, ¾, ⅓, ⅔, ⅛, ⅜, ⅝, ⅞); other
 * values fall back to decimal with reasonable precision.
 */
export function formatQuantity(n: number): string {
  if (n === 0) return "0";
  // Whole numbers
  if (Math.abs(n - Math.round(n)) < 1e-6) return String(Math.round(n));

  const sign = n < 0 ? "-" : "";
  const abs = Math.abs(n);
  const whole = Math.floor(abs);
  const frac = abs - whole;

  const knownFractions: Array<[number, string]> = [
    [1 / 8, "⅛"],
    [1 / 4, "¼"],
    [1 / 3, "⅓"],
    [3 / 8, "⅜"],
    [1 / 2, "½"],
    [5 / 8, "⅝"],
    [2 / 3, "⅔"],
    [3 / 4, "¾"],
    [7 / 8, "⅞"],
  ];

  for (const [val, glyph] of knownFractions) {
    if (Math.abs(frac - val) < 0.01) {
      return whole === 0 ? `${sign}${glyph}` : `${sign}${whole}${glyph}`;
    }
  }

  // Fall back to decimal, trimmed to 2 places, no trailing zeros.
  const decimal = abs.toFixed(2).replace(/\.?0+$/, "");
  return `${sign}${decimal}`;
}

/**
 * Scale the leading quantity in an ingredient line. Returns the line
 * unchanged if no leading quantity is found (e.g. "Salt to taste",
 * "Pinch of saffron", "Olive oil").
 */
export function scaleIngredientLine(line: string, factor: number): string {
  const q = parseQuantity(line);
  if (!q) return line;
  const newRaw = formatQuantity(q.value * factor);
  return line.slice(0, q.start) + newRaw + line.slice(q.end);
}

// ---------- recipe-level scaling ----------

export interface ScalableRecipe {
  shared_ingredients: string[];
  serve_with: string[];
  versions: Array<{
    name: string;
    group_label: string | null;
    protein: string | null;
    instructions: string[];
  }>;
  // Carried through unchanged but we re-export for the modify preview type.
  title: string;
  cuisine: string | null;
  freezer_friendly: boolean | null;
  prep_minutes: number | null;
  cook_minutes: number | null;
  servings?: number | null;
}

/**
 * Apply a multiplicative scale factor to a recipe's ingredient quantities.
 * Instructions are NOT touched — they often reference times, temperatures,
 * and pan sizes that don't scale linearly. The servings count IS scaled
 * (rounded to the nearest whole serving) so a halved 4-serve recipe lands
 * at 2 instead of staying at 4.
 */
export function scaleRecipe<T extends ScalableRecipe>(
  recipe: T,
  factor: number,
): T {
  return {
    ...recipe,
    servings:
      recipe.servings != null
        ? Math.max(1, Math.round(recipe.servings * factor))
        : recipe.servings ?? null,
    shared_ingredients: recipe.shared_ingredients.map((l) =>
      scaleIngredientLine(l, factor),
    ),
    serve_with: recipe.serve_with.map((l) => scaleIngredientLine(l, factor)),
    versions: recipe.versions.map((v) => ({
      ...v,
      protein: v.protein ? scaleIngredientLine(v.protein, factor) : v.protein,
    })),
  };
}
