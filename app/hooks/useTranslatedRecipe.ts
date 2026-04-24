import { useEffect, useState } from "react";

import { translate } from "@/lib/translator";
import type { Locale } from "@/i18n/strings";
import type { RecipeDetail } from "@/types";

// Progressively hydrates a recipe's user-facing strings into `targetLocale`.
// Returns the original recipe immediately; mutations happen as each field
// resolves so the UI can render a partial translation while the rest streams.
// If `enabled` is false or the locale is English, returns the recipe as-is.
export function useTranslatedRecipe(
  recipe: RecipeDetail | null,
  targetLocale: Locale,
  enabled: boolean,
): RecipeDetail | null {
  const [overrides, setOverrides] = useState<Partial<RecipeDetail> | null>(null);

  useEffect(() => {
    setOverrides(null);
    if (!recipe || !enabled || targetLocale === "en") return;
    let cancelled = false;

    const tr = (s: string) => translate(s, "en", targetLocale);
    const trMaybe = (s: string | null) => (s ? tr(s) : Promise.resolve(s));

    (async () => {
      try {
        // Title + cuisine first (small, visible, low latency after model is warm).
        const [title, cuisine] = await Promise.all([
          tr(recipe.title),
          trMaybe(recipe.cuisine),
        ]);
        if (cancelled) return;
        setOverrides((o) => ({ ...o, title, cuisine }));

        // Shared ingredients + serve_with in parallel.
        const [shared_ingredients, serve_with] = await Promise.all([
          Promise.all(recipe.shared_ingredients.map(tr)),
          Promise.all(recipe.serve_with.map(tr)),
        ]);
        if (cancelled) return;
        setOverrides((o) => ({ ...o, shared_ingredients, serve_with }));

        // Versions — each one has metadata + instructions.
        const versions = await Promise.all(
          recipe.versions.map(async (v) => ({
            ...v,
            name: await tr(v.name),
            group_label: await trMaybe(v.group_label),
            protein: await trMaybe(v.protein),
            instructions: await Promise.all(v.instructions.map(tr)),
          })),
        );
        if (cancelled) return;
        setOverrides((o) => ({ ...o, versions }));
      } catch (err) {
        console.warn("[useTranslatedRecipe] failed:", err);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [recipe, targetLocale, enabled]);

  if (!recipe) return null;
  if (!enabled || targetLocale === "en" || !overrides) return recipe;
  return { ...recipe, ...overrides };
}
