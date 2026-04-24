import { useEffect, useState } from "react";

import { translate } from "@/lib/translator";
import type { Locale } from "@/i18n/strings";
import type { RecipeDetail } from "@/types";

interface TranslatedRecipe {
  recipe: RecipeDetail | null;
  /** True while any field is still being translated. */
  translating: boolean;
}

// Progressively hydrates a recipe's user-facing strings into `targetLocale`.
// Returns the original recipe immediately; each field updates as it resolves so
// the UI can render a partial translation while the rest streams in. All
// translate() calls fire concurrently — the translator batches them into a
// single API request via its microtask-flushed queue.
// If the locale is English, returns the recipe as-is. If the backend is
// unavailable, individual translate() calls reject and we keep the original.
export function useTranslatedRecipe(
  recipe: RecipeDetail | null,
  targetLocale: Locale,
): TranslatedRecipe {
  const [overrides, setOverrides] = useState<Partial<RecipeDetail> | null>(null);
  // Tracks how many of the four translation groups are still in flight so
  // the caller can render a spinner. Starts at 4 when the effect kicks off
  // and decrements as each group resolves (or errors).
  const [pending, setPending] = useState(0);

  useEffect(() => {
    setOverrides(null);
    if (!recipe || targetLocale === "en") {
      setPending(0);
      return;
    }
    let cancelled = false;
    setPending(4);
    const done = () => {
      if (cancelled) return;
      setPending((n) => Math.max(0, n - 1));
    };

    const tr = (s: string) => translate(s, "en", targetLocale);
    const trMaybe = (s: string | null) => (s ? tr(s) : Promise.resolve(s));

    // Kick off EVERY translation synchronously so the batcher collapses them
    // into a single request. Then attach .then handlers to land results as
    // they arrive — each field lights up independently, no stage gating.
    const titleP = tr(recipe.title);
    const cuisineP = trMaybe(recipe.cuisine);
    const sharedP = Promise.all(recipe.shared_ingredients.map(tr));
    const serveWithP = Promise.all(recipe.serve_with.map(tr));
    const versionsP = recipe.versions.map((v) => ({
      raw: v,
      name: tr(v.name),
      group_label: trMaybe(v.group_label),
      protein: trMaybe(v.protein),
      instructions: Promise.all(v.instructions.map(tr)),
    }));

    // Title + cuisine land together (small, visible).
    void Promise.all([titleP, cuisineP])
      .then(([title, cuisine]) => {
        if (cancelled) return;
        setOverrides((o) => ({ ...o, title, cuisine }));
      })
      .finally(done);

    void sharedP
      .then((shared_ingredients) => {
        if (cancelled) return;
        setOverrides((o) => ({ ...o, shared_ingredients }));
      })
      .finally(done);

    void serveWithP
      .then((serve_with) => {
        if (cancelled) return;
        setOverrides((o) => ({ ...o, serve_with }));
      })
      .finally(done);

    // Versions: fire each version's assembly independently so a slow one
    // doesn't block the others from rendering.
    void Promise.all(
      versionsP.map(async (v) => ({
        ...v.raw,
        name: await v.name,
        group_label: await v.group_label,
        protein: await v.protein,
        instructions: await v.instructions,
      })),
    )
      .then((versions) => {
        if (cancelled) return;
        setOverrides((o) => ({ ...o, versions }));
      })
      .finally(done);

    return () => {
      cancelled = true;
    };
  }, [recipe, targetLocale]);

  if (!recipe) return { recipe: null, translating: false };
  if (targetLocale === "en") return { recipe, translating: false };
  const translating = pending > 0;
  if (!overrides) return { recipe, translating };
  return { recipe: { ...recipe, ...overrides }, translating };
}
