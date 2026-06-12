// Detects "scale" intents in a free-form modify instruction and returns a
// deterministic action the UI can apply locally — no LLM call needed.
// Unmatched instructions return null so the caller falls through to the
// streaming LLM path.
//
// Locale-aware: reads English / Spanish / Portuguese phrasings of halve,
// double, and "scale to N servings".

import type { Locale } from "@/i18n/strings";

export interface QuickEditScale {
  type: "scale";
  /** Multiplicative factor to apply to ingredient quantities. */
  factor: number;
  /** Short, locale-aware summary for modification_summary. */
  summary: string;
  /** Localized verb for toasts ("Halved", "Doubled", "Scaled to 6 servings"). */
  toastLabel: string;
}

export type QuickEditAction = QuickEditScale;

interface Phrasings {
  halve: RegExp[];
  double: RegExp[];
  // captures the target servings count in match group 1
  scaleTo: RegExp[];
  triple: RegExp[];
  quadruple: RegExp[];
  summary: {
    halve: string;
    double: string;
    triple: string;
    quadruple: string;
    scaleTo: (n: number) => string;
  };
  toast: {
    halve: string;
    double: string;
    triple: string;
    quadruple: string;
    scaleTo: (n: number) => string;
  };
}

// Patterns are deliberately conservative: quick-edit must only intercept
// *unambiguous* scaling commands, so anything else falls through to the LLM.
//   - halve requires an explicit object ("halve the recipe", "halve it") —
//     a bare "half" inside "replace the cream with half and half" must NOT
//     trigger a 0.5x scale.
//   - scaleTo only matches instructions that are *about* scaling: either an
//     explicit "scale … to N servings", or the entire trimmed instruction is
//     a "make it for N people"-style sentence. "make it spicier for 2 people"
//     falls through to the LLM.
const PHRASINGS: Record<Locale, Phrasings> = {
  en: {
    halve: [
      /\bhalve\s+(?:the\s+|all\s+(?:the\s+)?)?(?:recipe|amounts?|portions?|quantities|ingredients?|it|everything)\b/i,
      /\bhalf\s+(?:the\s+|all\s+(?:the\s+)?)?(?:recipe|amounts?|portions?|quantities)\b/i,
      /\b(?:cut|reduce)\s+(?:the\s+recipe\s+|it\s+|everything\s+)?(?:in|by)\s+half\b/i,
      /\bx\s*0\.5\b/i,
      /^halve$/i,
    ],
    double: [/\bdouble\b/i, /\b2\s*x\b/i, /\bx\s*2\b/i, /\btwice\s+(?:the\s+)?(?:recipe|amount)/i],
    triple: [/\btriple\b/i, /\b3\s*x\b/i, /\bx\s*3\b/i],
    quadruple: [/\bquadruple\b/i, /\b4\s*x\b/i, /\bx\s*4\b/i],
    scaleTo: [
      /\bscale\s+(?:it\s+|this\s+|the\s+recipe\s+)?(?:up\s+|down\s+)?(?:to\s+|for\s+)?(\d+)\s+(?:servings?|portions?|people)\b/i,
      /^\s*(?:please\s+)?(?:make|cook|feed|adjust)\s+(?:it\s+|this\s+|the\s+recipe\s+)?for\s+(\d+)\s+(?:servings?|portions?|people)\s*[.!]*\s*$/i,
      /^\s*for\s+(\d+)\s+(?:servings?|portions?|people)\s*[.!]*\s*$/i,
    ],
    summary: {
      halve: "Halved all ingredient quantities.",
      double: "Doubled all ingredient quantities.",
      triple: "Tripled all ingredient quantities.",
      quadruple: "Quadrupled all ingredient quantities.",
      scaleTo: (n) =>
        `Scaled ingredient quantities for ${n} servings (assumes 4 base servings).`,
    },
    toast: {
      halve: "Halved",
      double: "Doubled",
      triple: "Tripled",
      quadruple: "Quadrupled",
      scaleTo: (n) => `Scaled to ${n} servings`,
    },
  },
  es: {
    halve: [
      /\b(?:reducir|reduce|reducí|cortar|corta)\s+(?:la\s+receta\s+|las\s+cantidades\s+|las\s+porciones\s+|todo\s+)?(?:a\s+la\s+|por\s+la\s+|en\s+)?mitad\b/i,
      /\b(?:la\s+)?mitad\s+de\s+(?:la\s+receta|las\s+cantidades|las\s+porciones|todo)\b/i,
      /^(?:a\s+la\s+)?mitad$/i,
    ],
    double: [/\bdobl(?:ar|a|á|e)\b/i, /\bel\s+doble\b/i, /\b2\s*x\b/i],
    triple: [/\btriplicar?\b/i, /\bel\s+triple\b/i, /\b3\s*x\b/i],
    quadruple: [/\bcuadruplic(?:ar|a)\b/i, /\b4\s*x\b/i],
    scaleTo: [
      /\b(?:escalar?|escala|ajustar?|ajusta)\s+(?:la\s+receta\s+)?(?:para\s+|a\s+)?(\d+)\s+(?:porciones?|personas?|raciones?)\b/i,
      /^\s*(?:hacer(?:la)?\s+|cocinar\s+)?(?:para|por)\s+(\d+)\s+(?:porciones?|personas?|raciones?)\s*[.!]*\s*$/i,
    ],
    summary: {
      halve: "Reducí las cantidades a la mitad.",
      double: "Dupliqué todas las cantidades.",
      triple: "Tripliqué todas las cantidades.",
      quadruple: "Cuadrupliqué todas las cantidades.",
      scaleTo: (n) =>
        `Ajusté las cantidades para ${n} porciones (asumiendo 4 porciones base).`,
    },
    toast: {
      halve: "Reducido a la mitad",
      double: "Duplicado",
      triple: "Triplicado",
      quadruple: "Cuadruplicado",
      scaleTo: (n) => `Ajustado a ${n} porciones`,
    },
  },
  "pt-BR": {
    halve: [
      /\b(?:reduzir|reduza|cortar|corte)\s+(?:a\s+receita\s+|as\s+quantidades\s+|as\s+porç(?:ões|oes)\s+|tudo\s+)?(?:pela\s+|na\s+|à\s+|a\s+)?metade\b/i,
      /\bmetade\s+d[ae]s?\s+(?:receita|quantidades|porç(?:ões|oes)|tudo)\b/i,
      /^(?:pela\s+|à\s+|a\s+)?metade$/i,
    ],
    double: [/\bdobr(?:ar|e|a)\b/i, /\bo\s+dobro\b/i, /\b2\s*x\b/i],
    triple: [/\btriplicar?\b/i, /\bo\s+triplo\b/i, /\b3\s*x\b/i],
    quadruple: [/\bquadruplicar?\b/i, /\b4\s*x\b/i],
    scaleTo: [
      /\b(?:ajustar?|ajuste|escalar?|escale)\s+(?:a\s+receita\s+)?(?:para\s+)?(\d+)\s+(?:porç(?:ões|ão|ao|oes)|pessoas?)\b/i,
      /^\s*(?:fazer\s+|cozinhar\s+)?(?:para|por)\s+(\d+)\s+(?:porç(?:ões|ão|ao|oes)|pessoas?)\s*[.!]*\s*$/i,
    ],
    summary: {
      halve: "Reduzi as quantidades pela metade.",
      double: "Dobrei todas as quantidades.",
      triple: "Tripliquei todas as quantidades.",
      quadruple: "Quadrupliquei todas as quantidades.",
      scaleTo: (n) =>
        `Ajustei as quantidades para ${n} porções (assumindo 4 porções base).`,
    },
    toast: {
      halve: "Reduzido à metade",
      double: "Dobrado",
      triple: "Triplicado",
      quadruple: "Quadruplicado",
      scaleTo: (n) => `Ajustado para ${n} porções`,
    },
  },
};

// Default base serving count when the recipe doesn't specify one. Most
// dishes in the catalog target ~4 servings; we use that as the fallback.
// Pass `baseServings` to the matcher to override with the recipe's
// actual count from metadata.
const DEFAULT_BASE_SERVINGS = 4;

export function quickEditFromInstruction(
  instruction: string,
  locale: Locale,
  baseServings?: number | null,
): QuickEditAction | null {
  const text = instruction.trim();
  if (!text) return null;
  const p = PHRASINGS[locale] ?? PHRASINGS.en;

  if (matches(text, p.halve)) {
    return {
      type: "scale",
      factor: 0.5,
      summary: p.summary.halve,
      toastLabel: p.toast.halve,
    };
  }
  if (matches(text, p.double)) {
    return {
      type: "scale",
      factor: 2,
      summary: p.summary.double,
      toastLabel: p.toast.double,
    };
  }
  if (matches(text, p.triple)) {
    return {
      type: "scale",
      factor: 3,
      summary: p.summary.triple,
      toastLabel: p.toast.triple,
    };
  }
  if (matches(text, p.quadruple)) {
    return {
      type: "scale",
      factor: 4,
      summary: p.summary.quadruple,
      toastLabel: p.toast.quadruple,
    };
  }
  for (const re of p.scaleTo) {
    const m = text.match(re);
    if (m && m[1]) {
      const n = parseInt(m[1], 10);
      if (Number.isFinite(n) && n > 0 && n <= 99) {
        const base =
          baseServings && baseServings > 0
            ? baseServings
            : DEFAULT_BASE_SERVINGS;
        return {
          type: "scale",
          factor: n / base,
          summary: p.summary.scaleTo(n),
          toastLabel: p.toast.scaleTo(n),
        };
      }
    }
  }
  return null;
}

function matches(text: string, patterns: RegExp[]): boolean {
  return patterns.some((re) => re.test(text));
}

/**
 * Build the canonical scale action for a known factor. Used by the instant
 * chips so chip-applied edits carry the same generated summary sentence and
 * toast label as typed instructions ("Halved all ingredient quantities."
 * instead of the bare chip label).
 */
export function quickEditForFactor(
  factor: 0.5 | 2 | 3 | 4,
  locale: Locale,
): QuickEditScale {
  const p = PHRASINGS[locale] ?? PHRASINGS.en;
  const kind =
    factor === 0.5
      ? ("halve" as const)
      : factor === 2
        ? ("double" as const)
        : factor === 3
          ? ("triple" as const)
          : ("quadruple" as const);
  return {
    type: "scale",
    factor,
    summary: p.summary[kind],
    toastLabel: p.toast[kind],
  };
}
