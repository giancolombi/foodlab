import type { Locale } from "@/i18n/strings";
import type { ConsolidatedList } from "@/lib/shoppingList";

interface TranslatedCart {
  /** en -> localized lookup. Empty now that ingredients arrive pre-localized. */
  translations: Record<string, string>;
  translating: boolean;
}

// Recipes (and therefore the consolidated shopping list derived from them)
// are now built from rows already in the user's locale, so the cart no
// longer needs a runtime translation pass. Kept as a hook so existing call
// sites continue to work unchanged.
export function useTranslatedCart(
  _list: ConsolidatedList,
  _targetLocale: Locale,
): TranslatedCart {
  return { translations: {}, translating: false };
}
