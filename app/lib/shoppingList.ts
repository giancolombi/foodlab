// Consolidates ingredient lines from multiple recipes into a grouped
// shopping list. Deterministic and client-side — no API call.
//
// Strategy:
//   1. For each recipe, collect the lines we need: every shared_ingredient
//      line (added once per recipe) plus — for each active profile — the
//      protein line of the version that matches their restrictions.
//   2. Parse each line into {qty, unit, item, raw}. Liberal regex — if it
//      doesn't match cleanly we keep the raw line as-is.
//   3. Normalize the item name (lowercase, strip prep modifiers like
//      "minced"/"diced"/"chopped", collapse whitespace).
//   4. Group by canonical item name. Within a group, sum quantities when all
//      entries share a unit; otherwise list them as "X unit + Y unit".
//   5. Categorize into grocery sections via a keyword dictionary.
//
// Per-profile math: proteins from recipe versions are kept separate per
// version (so "Gian's chicken" doesn't merge with "Maria's chickpeas"), but
// the shared base ingredients consolidate across every selected recipe.

import { restrictionCoverageScore } from "@/lib/dietaryTerms";
import type { Profile, RecipeVersion } from "@/types";

export type Section =
  | "produce"
  | "proteins"
  | "dairy"
  | "pantry"
  | "other";

export interface ConsolidatedItem {
  /** Display name, e.g. "garlic" or "olive oil". */
  name: string;
  /** Already-formatted quantity label, e.g. "6 cloves" or "1 tbsp + 2 tsp". */
  quantity: string;
  /** Which recipes contributed this item. */
  sources: string[];
  /** Fallback raw lines when parsing/summing failed — rendered under the item. */
  notes: string[];
  /** Profile names this item is for; empty = everyone. */
  forProfiles: string[];
  section: Section;
}

export interface ConsolidatedList {
  sections: Record<Section, ConsolidatedItem[]>;
  total: number;
}

// ---- units ----

const UNIT_ALIASES: Record<string, string> = {
  tsp: "tsp",
  teaspoon: "tsp",
  teaspoons: "tsp",
  tbsp: "tbsp",
  tablespoon: "tbsp",
  tablespoons: "tbsp",
  cup: "cup",
  cups: "cup",
  oz: "oz",
  ounce: "oz",
  ounces: "oz",
  lb: "lb",
  lbs: "lb",
  pound: "lb",
  pounds: "lb",
  g: "g",
  gram: "g",
  grams: "g",
  kg: "kg",
  kilogram: "kg",
  kilograms: "kg",
  ml: "ml",
  milliliter: "ml",
  milliliters: "ml",
  l: "l",
  liter: "l",
  liters: "l",
  clove: "clove",
  cloves: "clove",
  can: "can",
  cans: "can",
  sprig: "sprig",
  sprigs: "sprig",
  bunch: "bunch",
  bunches: "bunch",
  piece: "piece",
  pieces: "piece",
  slice: "slice",
  slices: "slice",
  head: "head",
  heads: "head",
};

const SIZES = new Set(["small", "medium", "large", "extra-large"]);

const PREP_MODIFIERS = [
  "minced",
  "diced",
  "chopped",
  "finely chopped",
  "roughly chopped",
  "sliced",
  "thinly sliced",
  "grated",
  "shredded",
  "crushed",
  "cubed",
  "peeled",
  "peeled and cubed",
  "peeled and diced",
  "drained",
  "rinsed",
  "drained and rinsed",
  "halved",
  "quartered",
  "smashed",
  "pressed",
  "pressed and cubed",
  "pitted",
  "zested",
  "juiced",
  "fresh",
  "dried",
  "extra-firm",
  "extra firm",
  "bone-in",
  "bone in",
  "boneless",
  "skinless",
  "skin-on",
  "skin on",
  "to taste",
];

// ---- parsing ----

const QTY_RE = /^(\d+(?:\.\d+)?(?:\s+\d+\/\d+)?|\d+\/\d+)/;

function parseQty(s: string): number | null {
  const m = s.match(QTY_RE);
  if (!m) return null;
  const raw = m[1];
  if (raw.includes("/")) {
    const parts = raw.split(" ");
    if (parts.length === 2) {
      const [num, denom] = parts[1].split("/").map(Number);
      return Number(parts[0]) + num / denom;
    }
    const [num, denom] = raw.split("/").map(Number);
    return num / denom;
  }
  return Number(raw);
}

interface Parsed {
  qty: number | null;
  unit: string | null;
  item: string;
  raw: string;
}

function stripPrepModifiers(name: string): string {
  let out = name;
  out = out.replace(/\([^)]*\)/g, " ");
  const parts = out.split(",").map((p) => p.trim()).filter(Boolean);
  const kept = parts.filter((p) => {
    const lower = p.toLowerCase();
    return !PREP_MODIFIERS.some((m) => lower === m || lower.startsWith(m + " "));
  });
  out = kept.join(", ");
  const tokens = out.split(/\s+/);
  while (tokens.length > 1 && SIZES.has(tokens[0].toLowerCase())) tokens.shift();
  return tokens.join(" ").toLowerCase().replace(/\s+/g, " ").trim();
}

function parseLine(raw: string): Parsed {
  const trimmed = raw.trim();
  if (!trimmed) return { qty: null, unit: null, item: "", raw };

  let rest = trimmed;
  const qty = parseQty(rest);
  if (qty !== null) {
    rest = rest.replace(QTY_RE, "").trim();
  }

  let unit: string | null = null;
  const firstToken = rest.split(/\s+/)[0]?.toLowerCase().replace(/[^a-z]/g, "");
  if (firstToken && UNIT_ALIASES[firstToken]) {
    unit = UNIT_ALIASES[firstToken];
    rest = rest.split(/\s+/).slice(1).join(" ");
  }

  const item = stripPrepModifiers(rest);
  return { qty, unit, item, raw };
}

// ---- sum + format ----

const UNIT_LABELS: Record<string, (n: number) => string> = {
  tsp: (n) => `${formatNum(n)} tsp`,
  tbsp: (n) => `${formatNum(n)} tbsp`,
  cup: (n) => `${formatNum(n)} cup${n === 1 ? "" : "s"}`,
  oz: (n) => `${formatNum(n)} oz`,
  lb: (n) => `${formatNum(n)} lb${n === 1 ? "" : "s"}`,
  g: (n) => `${formatNum(n)} g`,
  kg: (n) => `${formatNum(n)} kg`,
  ml: (n) => `${formatNum(n)} ml`,
  l: (n) => `${formatNum(n)} L`,
  clove: (n) => `${formatNum(n)} clove${n === 1 ? "" : "s"}`,
  can: (n) => `${formatNum(n)} can${n === 1 ? "" : "s"}`,
  sprig: (n) => `${formatNum(n)} sprig${n === 1 ? "" : "s"}`,
  bunch: (n) => `${formatNum(n)} bunch${n === 1 ? "" : "es"}`,
  piece: (n) => `${formatNum(n)} piece${n === 1 ? "" : "s"}`,
  slice: (n) => `${formatNum(n)} slice${n === 1 ? "" : "s"}`,
  head: (n) => `${formatNum(n)} head${n === 1 ? "" : "s"}`,
};

function formatNum(n: number): string {
  if (Number.isInteger(n)) return String(n);
  if (Math.abs(n - 0.25) < 1e-9) return "¼";
  if (Math.abs(n - 0.5) < 1e-9) return "½";
  if (Math.abs(n - 0.75) < 1e-9) return "¾";
  return (Math.round(n * 100) / 100).toString();
}

function formatQuantity(qty: number, unit: string | null): string {
  if (unit && UNIT_LABELS[unit]) return UNIT_LABELS[unit](qty);
  if (unit) return `${formatNum(qty)} ${unit}`;
  return formatNum(qty);
}

// ---- categorization ----

const SECTION_KEYWORDS: Record<Section, string[]> = {
  produce: [
    "onion", "garlic", "ginger", "tomato", "lettuce", "cilantro", "parsley",
    "mint", "basil", "thyme", "rosemary", "dill", "oregano", "chives",
    "scallion", "green onion", "shallot", "leek", "lemon", "lime", "orange",
    "avocado", "potato", "sweet potato", "yam", "carrot", "pepper",
    "bell pepper", "chili", "jalapeño", "habanero", "scotch bonnet",
    "spinach", "kale", "arugula", "mushroom", "zucchini", "squash", "pumpkin",
    "broccoli", "cauliflower", "cabbage", "cucumber", "celery", "mango",
    "peach", "apple", "banana", "pineapple", "eggplant", "corn", "pea",
    "green bean", "okra", "radish", "beet", "turnip", "fennel",
  ],
  proteins: [
    "chicken", "beef", "pork", "lamb", "turkey", "duck", "fish", "salmon",
    "tuna", "shrimp", "prawn", "scallop", "cod", "tilapia", "tofu", "tempeh",
    "seitan", "egg", "eggs", "chorizo", "sausage", "bacon", "ham", "prosciutto",
  ],
  dairy: [
    "milk", "butter", "cheese", "yogurt", "yoghurt", "sour cream", "cream",
    "feta", "parmesan", "mozzarella", "cheddar", "ricotta", "cream cheese",
    "queso", "cotija", "halloumi", "paneer", "ghee", "buttermilk", "kefir",
  ],
  pantry: [
    "oil", "vinegar", "salt", "sugar", "honey", "maple syrup", "soy sauce",
    "fish sauce", "hoisin", "sriracha", "gochujang", "miso", "tahini",
    "coconut milk", "coconut aminos", "rice", "pasta", "noodle", "flour",
    "cornstarch", "starch", "bread", "tortilla", "bread crumb", "breadcrumb",
    "panko", "broth", "stock", "bean", "beans", "lentil", "chickpea",
    "black-eye", "kidney", "pinto", "garbanzo", "paprika", "cumin",
    "coriander", "cinnamon", "nutmeg", "cardamom", "clove", "allspice",
    "peppercorn", "cayenne", "chili powder", "turmeric", "garam masala",
    "curry powder", "berbere", "ras el hanout", "za'atar", "sumac", "saffron",
    "bay leaf", "bay leaves", "anchovy", "capers", "olive", "tomato paste",
    "tomato sauce", "coconut", "nut", "peanut", "almond", "cashew", "walnut",
    "pecan", "pistachio", "seed", "sesame", "tortilla chip", "cracker",
    "wine", "mirin", "sake", "vanilla", "baking",
  ],
  other: [],
};

function categorize(name: string): Section {
  const lower = name.toLowerCase();
  for (const section of ["produce", "proteins", "dairy", "pantry"] as const) {
    for (const kw of SECTION_KEYWORDS[section]) {
      if (lower.includes(kw)) return section;
    }
  }
  return "other";
}

// ---- profile → version mapping ----

export interface VersionMatch {
  /** Best version to use for this profile. Null only when versions is empty. */
  version: RecipeVersion | null;
  /** True if at least one restriction matched the version's label. False means
   *  we fell back to versions[0] without any real signal — the caller should
   *  warn the user (allergies in particular shouldn't be silently ignored). */
  matched: boolean;
}

/**
 * Pick the recipe version that best matches this profile's restrictions.
 * Heuristic: for each version, count how many of the profile's restrictions
 * are substring-matched by the version's group_label. Highest match wins;
 * ties broken by array order.
 *
 * Returns a `matched` flag so callers can distinguish a real match from a
 * fallback. For profiles with no restrictions, matched=true (any version is
 * fine by definition). For profiles with restrictions but no label match,
 * matched=false and the first version is returned as a best-effort default.
 *
 * Rationale: the data model has no FK from profile→version, so we match on
 * the `group_label` string (e.g. "No Soy / No Dairy"). Fuzzy but works with
 * the conventions in test-kitchen/profiles + recipe version headers.
 */
export function pickVersion(
  profile: Pick<Profile, "restrictions" | "allergies"> | null,
  versions: RecipeVersion[],
): VersionMatch {
  if (!versions.length) return { version: null, matched: false };
  if (!profile || (!profile.restrictions.length && !profile.allergies.length)) {
    return { version: versions[0], matched: true };
  }
  const needles = [...profile.restrictions, ...profile.allergies];
  let bestIdx = 0;
  let bestScore = 0;
  versions.forEach((v, i) => {
    // restrictionCoverageScore canonicalizes Spanish/Portuguese restriction
    // phrases to English equivalents so "vegetariano" matches a "Vegetarian"
    // group_label. See lib/dietaryTerms.ts.
    const score = restrictionCoverageScore(needles, v.group_label ?? v.name);
    if (score > bestScore) {
      bestScore = score;
      bestIdx = i;
    }
  });
  return {
    version: versions[bestIdx],
    matched: bestScore > 0,
  };
}

// ---- public API ----

export interface RecipeForPlan {
  slug: string;
  title: string;
  shared_ingredients: string[];
  versions: RecipeVersion[];
}

interface Agg {
  name: string;
  sums: Map<string, number>;
  notes: string[];
  sources: Set<string>;
  forProfiles: Set<string>; // empty = everyone
}

function addLine(
  byItem: Map<string, Agg>,
  raw: string,
  source: string,
  forProfile: string | null,
): void {
  const parsed = parseLine(raw);
  if (!parsed.item) return;

  const key = forProfile ? `${forProfile}::${parsed.item}` : parsed.item;
  let agg = byItem.get(key);
  if (!agg) {
    agg = {
      name: parsed.item,
      sums: new Map(),
      notes: [],
      sources: new Set(),
      forProfiles: new Set(),
    };
    byItem.set(key, agg);
  }
  agg.sources.add(source);
  if (forProfile) agg.forProfiles.add(forProfile);

  if (parsed.qty !== null) {
    const unitKey = parsed.unit ?? "";
    agg.sums.set(unitKey, (agg.sums.get(unitKey) ?? 0) + parsed.qty);
  } else if (!agg.notes.includes(parsed.raw)) {
    agg.notes.push(parsed.raw);
  }
}

/**
 * Build a shopping list from the selected recipes, accounting for which
 * profiles will be eating.
 *
 * - Shared ingredients consolidate across all recipes (one "Onions 5" line
 *   instead of three).
 * - Each recipe contributes proteins for each *distinct* version needed by
 *   the active profiles — e.g. if both eaters map to the same version, one
 *   protein line; if they map to different versions, two protein lines each
 *   labeled with the profile names.
 * - With no profiles passed, we emit proteins for every version (the recipe
 *   is cooked for all dietary groups).
 */
export function consolidate(
  recipes: RecipeForPlan[],
  profiles: Profile[] = [],
): ConsolidatedList {
  const byItem = new Map<string, Agg>();

  for (const r of recipes) {
    // Shared ingredients: added once per recipe, no profile label.
    for (const line of r.shared_ingredients) {
      addLine(byItem, line, r.title, null);
    }

    // Proteins: group profiles by which version they'd eat.
    // versionIndex → [profile names]
    const groups = new Map<number, string[]>();
    if (profiles.length === 0) {
      // No profile filter — include every version's protein.
      r.versions.forEach((_, i) => groups.set(i, []));
    } else {
      for (const p of profiles) {
        const { version, matched } = pickVersion(p, r.versions);
        // If we couldn't actually match this profile's restrictions to any
        // version, skip the protein line entirely — better to miss a protein
        // the user has to re-add than to silently include a restricted one.
        if (!version || !matched) continue;
        const idx = r.versions.indexOf(version);
        const list = groups.get(idx) ?? [];
        list.push(p.name);
        groups.set(idx, list);
      }
    }

    for (const [vIdx, names] of groups.entries()) {
      const v = r.versions[vIdx];
      if (!v?.protein) continue;
      // Label the line so downstream rendering can show "for Gian" etc.
      // Joining names with "+" to make the key distinct per-group.
      const label = names.length ? names.join("+") : v.name;
      addLine(byItem, v.protein, r.title, label);
    }
  }

  const sections: Record<Section, ConsolidatedItem[]> = {
    produce: [],
    proteins: [],
    dairy: [],
    pantry: [],
    other: [],
  };

  for (const agg of byItem.values()) {
    const quantityParts: string[] = [];
    for (const [unit, total] of agg.sums.entries()) {
      quantityParts.push(formatQuantity(total, unit || null));
    }
    const item: ConsolidatedItem = {
      name: agg.name,
      quantity: quantityParts.join(" + "),
      sources: Array.from(agg.sources),
      notes: agg.notes,
      forProfiles: Array.from(agg.forProfiles),
      section: categorize(agg.name),
    };
    sections[item.section].push(item);
  }

  for (const section of Object.keys(sections) as Section[]) {
    sections[section].sort((a, b) => a.name.localeCompare(b.name));
  }

  return {
    sections,
    total: Object.values(sections).reduce((n, arr) => n + arr.length, 0),
  };
}

export const SECTION_ORDER: Section[] = [
  "produce",
  "proteins",
  "dairy",
  "pantry",
  "other",
];
