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

// Patterns are unanchored and case-insensitive — users may type "halve it"
// or "please halve the recipe". We test against the trimmed instruction.
const PHRASINGS: Record<Locale, Phrasings> = {
  en: {
    halve: [
      /\bhalve\b/i,
      /\bhalf(\s+(?:the\s+)?(?:recipe|amounts?|portions?))?\b/i,
      /\b(cut|reduce)\s+(?:in\s+|by\s+)?half\b/i,
      /\bx\s*0\.5\b/i,
    ],
    double: [/\bdouble\b/i, /\b2\s*x\b/i, /\bx\s*2\b/i, /\btwice\s+(?:the\s+)?(?:recipe|amount)/i],
    triple: [/\btriple\b/i, /\b3\s*x\b/i, /\bx\s*3\b/i],
    quadruple: [/\bquadruple\b/i, /\b4\s*x\b/i, /\bx\s*4\b/i],
    scaleTo: [
      /\bscale\s+(?:it\s+)?(?:up\s+|down\s+)?(?:to\s+)?(\d+)\s+(?:servings?|portions?|people)/i,
      /\b(?:make|cook|feed)\s+(?:it\s+)?(?:for\s+)?(\d+)\s+(?:servings?|portions?|people)\b/i,
      /\bfor\s+(\d+)\s+(?:servings?|portions?|people)\b/i,
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
      /\bmitad\b/i,
      /\b(reducir|reduce|reducí|cortar|corta)\s+(?:a\s+la\s+|por\s+la\s+|en\s+)?mitad/i,
      /\bla\s+mitad\b/i,
    ],
    double: [/\bdobl(?:ar|a|á|e)\b/i, /\bel\s+doble\b/i, /\b2\s*x\b/i],
    triple: [/\btriplicar?\b/i, /\bel\s+triple\b/i, /\b3\s*x\b/i],
    quadruple: [/\bcuadruplic(?:ar|a)\b/i, /\b4\s*x\b/i],
    scaleTo: [
      /\b(?:escalar|ajustar|ajusta)\s+(?:para\s+)?(\d+)\s+(?:porciones?|personas?|raciones?)/i,
      /\b(?:para|por)\s+(\d+)\s+(?:porciones?|personas?|raciones?)\b/i,
      /\bhacer\s+(?:para\s+)?(\d+)\s+(?:porciones?|personas?|raciones?)\b/i,
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
      /\bmetade\b/i,
      /\b(reduzir|reduza|cortar|corte)\s+(?:pela\s+|na\s+|à\s+|a\s+)?metade/i,
      /\bna\s+metade\b/i,
    ],
    double: [/\bdobr(?:ar|e|a)\b/i, /\bo\s+dobro\b/i, /\b2\s*x\b/i],
    triple: [/\btriplicar?\b/i, /\bo\s+triplo\b/i, /\b3\s*x\b/i],
    quadruple: [/\bquadruplicar?\b/i, /\b4\s*x\b/i],
    scaleTo: [
      /\b(?:ajustar?|escalar?)\s+(?:para\s+)?(\d+)\s+(?:porç(?:ões|ao)|pessoas?)/i,
      /\b(?:para|por)\s+(\d+)\s+(?:porç(?:ões|ao)|pessoas?)\b/i,
      /\bfazer\s+(?:para\s+)?(\d+)\s+(?:porç(?:ões|ao)|pessoas?)\b/i,
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
