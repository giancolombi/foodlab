import { useEffect, useState } from "react";

import { translate } from "@/lib/translator";
import type { Locale } from "@/i18n/strings";
import type { ConsolidatedList } from "@/lib/shoppingList";

interface TranslatedCart {
  /** en -> localized lookup for ingredient names and raw note lines. */
  translations: Record<string, string>;
  translating: boolean;
}

// Heuristic: only send clean, word-like ingredient names through the
// translator. Anything with digits, fractions, or "/" is likely a raw
// unparseable line (e.g. "1/5 cup brined peppers") and the small LLM
// tends to hallucinate on those ("2/10 taza salitre de pimiento"), so
// we leave them in English rather than risk garbage output.
function looksLikeCleanName(s: string): boolean {
  if (!s || s.length > 40) return false;
  // No digits, no fractions, no slashes.
  if (/[0-9/¼½¾⅓⅔⅕⅖⅗⅘⅙⅚⅛⅜⅝⅞]/.test(s)) return false;
  // Must contain at least one letter.
  if (!/[a-zA-Z]/.test(s)) return false;
  return true;
}

// Progressively translates every ingredient name in a consolidated shopping
// list to the target locale. Returns a lookup map; the caller keeps the
// original `name` as its render key so the bought-state survives a language
// switch. Note lines are deliberately NOT translated — they're raw fallback
// text and the small LLM mangles them; we render them as-is instead.
export function useTranslatedCart(
  list: ConsolidatedList,
  targetLocale: Locale,
): TranslatedCart {
  const [translations, setTranslations] = useState<Record<string, string>>({});
  const [pending, setPending] = useState(0);

  useEffect(() => {
    setTranslations({});
    if (targetLocale === "en") {
      setPending(0);
      return;
    }

    const unique = new Set<string>();
    for (const items of Object.values(list.sections)) {
      for (const item of items) {
        if (item.name && looksLikeCleanName(item.name)) unique.add(item.name);
      }
    }
    const texts = [...unique];
    if (texts.length === 0) {
      setPending(0);
      return;
    }

    let cancelled = false;
    setPending(texts.length);
    for (const text of texts) {
      void translate(text, "en", targetLocale)
        .then((out) => {
          if (cancelled) return;
          setTranslations((prev) =>
            prev[text] === out ? prev : { ...prev, [text]: out },
          );
        })
        .catch(() => {
          // Backend unavailable — leave original text; user still sees English.
        })
        .finally(() => {
          if (cancelled) return;
          setPending((n) => Math.max(0, n - 1));
        });
    }

    return () => {
      cancelled = true;
    };
  }, [list, targetLocale]);

  return { translations, translating: pending > 0 };
}
