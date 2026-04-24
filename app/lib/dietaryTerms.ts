// Multilingual dietary-term normalization.
//
// Profiles can be written in any supported language (English, Spanish, or
// Brazilian Portuguese), but recipe metadata in the repo stays in English
// (per CLAUDE.md). For deterministic client-side matching — e.g. picking
// which recipe version a profile should eat — we canonicalize both sides to
// English tokens so "vegetariano" and "vegetarian" match the same version.
//
// This is a small dictionary, not an exhaustive translator. It covers the
// dietary terms we actually see in profiles + recipe group labels. When a
// term isn't in the dictionary we fall through to substring matching on the
// raw text, which still works for English-on-English cases.
//
// For LLM-powered features (recommendations, modify) the Ollama model
// handles language variance natively — this file only matters where we do
// pure string comparison.

export const DIETARY_ALIASES: Record<string, string> = {
  // vegetarian / vegan
  vegetariano: "vegetarian",
  vegetariana: "vegetarian",
  vegetariano_a: "vegetarian",
  vegano: "vegan",
  vegana: "vegan",

  // pescatarian
  pescetariano: "pescatarian",
  pescetariana: "pescatarian",
  pescatariano: "pescatarian",
  pescatariana: "pescatarian",
  pescetarian: "pescatarian",

  // dairy
  "sin lacteos": "no dairy",
  "sin lácteos": "no dairy",
  "sem lacticínios": "no dairy",
  "sem laticínios": "no dairy",
  "sin leche": "no dairy",
  "sem leite": "no dairy",

  // soy
  "sin soya": "no soy",
  "sin soja": "no soy",
  "sem soja": "no soy",

  // gluten
  "sin gluten": "no gluten",
  "sem glúten": "no gluten",
  "libre de gluten": "no gluten",
  "sin trigo": "no wheat",
  "sem trigo": "no wheat",

  // nuts
  "sin nueces": "no nuts",
  "sem castanhas": "no nuts",
  "sem amêndoas": "no nuts",

  // pork / beef
  "sin cerdo": "no pork",
  "sem porco": "no pork",
  "sin res": "no beef",
  "sin carne de res": "no beef",
  "sem carne bovina": "no beef",

  // shellfish
  "sin mariscos": "no shellfish",
  "sem frutos do mar": "no shellfish",

  // eggs
  "sin huevo": "no eggs",
  "sin huevos": "no eggs",
  "sem ovos": "no eggs",
  "sem ovo": "no eggs",

  // halal / kosher
  "no cerdo": "no pork",
  "no alcohol": "no alcohol",
  "sem álcool": "no alcohol",
  halal: "halal",
  "comida halal": "halal",
  "alimentação halal": "halal",
  kosher: "kosher",
  "comida kosher": "kosher",
  "alimentação kosher": "kosher",
  casher: "kosher",

  // keto / low-carb
  keto: "keto",
  cetogenica: "keto",
  cetogénica: "keto",
  cetogênica: "keto",
  "dieta keto": "keto",
  "low carb": "low-carb",
  "low-carb": "low-carb",
  "baja en carbohidratos": "low-carb",
  "baixo carboidrato": "low-carb",
  "pouco carboidrato": "low-carb",

  // paleo
  paleo: "paleo",
  paleolítica: "paleo",
  paleolitica: "paleo",
  paleolítico: "paleo",

  // whole30
  whole30: "whole30",
  "whole 30": "whole30",

  // FODMAP
  fodmap: "low-fodmap",
  "low fodmap": "low-fodmap",
  "low-fodmap": "low-fodmap",
  "bajo en fodmap": "low-fodmap",
  "baixo fodmap": "low-fodmap",

  // diabetic / low-sugar
  diabetico: "low-sugar",
  diabética: "low-sugar",
  diabético: "low-sugar",
  "sin azúcar": "low-sugar",
  "sem açúcar": "low-sugar",
  "low sugar": "low-sugar",
  "low-sugar": "low-sugar",

  // sodium
  "sin sal": "low-sodium",
  "sem sal": "low-sodium",
  "low sodium": "low-sodium",
  "low-sodium": "low-sodium",
  "bajo en sodio": "low-sodium",
  "baixo sódio": "low-sodium",

  // common allergen variants
  "sin maní": "no peanuts",
  "sin cacahuate": "no peanuts",
  "sem amendoim": "no peanuts",
  peanut: "no peanuts",
  "sin pescado": "no fish",
  "sem peixe": "no fish",
  "sin sésamo": "no sesame",
  "sem gergelim": "no sesame",
};

/**
 * Canonicalize a dietary term to an English-equivalent token. Unknown terms
 * are returned lowercased + trimmed (so "No Dairy" still matches "no dairy").
 */
export function canonicalizeRestriction(raw: string): string {
  const lower = raw.toLowerCase().trim();
  if (!lower) return "";
  if (DIETARY_ALIASES[lower]) return DIETARY_ALIASES[lower];
  // Some profiles write "no-dairy" or "no_dairy" — normalize separators.
  const normalized = lower.replace(/[-_]+/g, " ").replace(/\s+/g, " ");
  return DIETARY_ALIASES[normalized] ?? normalized;
}

/**
 * Score how well a set of restrictions is covered by a group-label string.
 * Each restriction is canonicalized before matching, so a Spanish profile
 * "vegetariano" matches a recipe label "Vegetarian Version".
 */
export function restrictionCoverageScore(
  restrictions: string[],
  groupLabel: string | null | undefined,
): number {
  if (!groupLabel) return 0;
  const hay = canonicalizeRestriction(groupLabel);
  let score = 0;
  for (const r of restrictions) {
    const needle = canonicalizeRestriction(r);
    if (!needle) continue;
    if (hay.includes(needle)) score++;
  }
  return score;
}
