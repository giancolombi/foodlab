import type { Locale } from "@/i18n/strings";
import type { RecipeDetail } from "@/types";

interface TranslatedRecipe {
  recipe: RecipeDetail | null;
  translating: boolean;
}

// Recipes are stored pre-translated in every supported locale and the API
// returns the row matching `?locale=`, so this hook is now a pass-through.
// Kept as a hook so existing call sites stay untouched.
export function useTranslatedRecipe(
  recipe: RecipeDetail | null,
  _targetLocale: Locale,
): TranslatedRecipe {
  return { recipe, translating: false };
}
