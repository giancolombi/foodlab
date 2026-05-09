// Client-side mirror of api/llm.ts:renderRecipeMarkdown. Used by the
// quick-edit ladder (halve / double / scale) so a deterministic local
// modification can flow through the same Save → POST /api/recipes pipe
// that the LLM-streamed path uses, without an LLM round-trip.
//
// The server still re-parses the markdown via recipeParser (which is
// locale-aware), so emitting English-label markdown would also work —
// but writing the user's locale produces nicer saved files.

import type { Locale } from "@/i18n/strings";
import type { ModifiedRecipe } from "@/lib/streamModify";

interface RenderLabels {
  cuisine: string;
  freezer: string;
  prep: string;
  cook: string;
  yes: string;
  no: string;
  sharedIngredients: string;
  serveWith: string;
  protein: string;
  modifiedFrom: (parent: string, summary: string) => string;
}

const LABELS: Record<Locale, RenderLabels> = {
  en: {
    cuisine: "Cuisine",
    freezer: "Freezer-friendly",
    prep: "Prep",
    cook: "Cook",
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
    yes: "Sim",
    no: "Não",
    sharedIngredients: "Ingredientes compartilhados",
    serveWith: "Para servir",
    protein: "Proteína",
    modifiedFrom: (parent, summary) => `Modificada de ${parent}: ${summary}`,
  },
};

export function renderRecipeMarkdown(
  r: ModifiedRecipe,
  parentTitle: string,
  locale: Locale = "en",
): string {
  const L = LABELS[locale] ?? LABELS.en;
  const lines: string[] = [];
  lines.push(`# ${r.title}`);
  lines.push("");

  const meta: string[] = [];
  if (r.cuisine) meta.push(`**${L.cuisine}:** ${r.cuisine}`);
  if (r.freezer_friendly !== null)
    meta.push(`**${L.freezer}:** ${r.freezer_friendly ? L.yes : L.no}`);
  if (r.prep_minutes != null) meta.push(`**${L.prep}:** ${r.prep_minutes} min`);
  if (r.cook_minutes != null) meta.push(`**${L.cook}:** ${r.cook_minutes} min`);
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
