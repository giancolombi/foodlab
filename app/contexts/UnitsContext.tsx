// User preference for measurement units. Persisted to localStorage.
//
// "imperial": cups, tbsp, tsp, oz, lb, °F  (US/UK default)
// "metric":   ml, g, kg, °C
//
// The setting affects two things:
//   1. Shopping list quantity formatting (shoppingList.ts)
//   2. Temperature display in recipe instructions (regex swap)

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type UnitSystem = "imperial" | "metric";

interface UnitsContextValue {
  units: UnitSystem;
  setUnits: (u: UnitSystem) => void;
}

const UnitsContext = createContext<UnitsContextValue | null>(null);

const STORAGE_KEY = "foodlab_units";

function loadUnits(): UnitSystem {
  if (typeof window === "undefined") return "imperial";
  try {
    const val = localStorage.getItem(STORAGE_KEY);
    if (val === "metric" || val === "imperial") return val;
  } catch {
    // ignore
  }
  return "imperial";
}

export function UnitsProvider({ children }: { children: ReactNode }) {
  const [units, setUnitsState] = useState<UnitSystem>(loadUnits);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, units);
    } catch {
      // ignore
    }
  }, [units]);

  const setUnits = useCallback((u: UnitSystem) => {
    setUnitsState(u);
  }, []);

  const value = useMemo(() => ({ units, setUnits }), [units, setUnits]);

  return (
    <UnitsContext.Provider value={value}>{children}</UnitsContext.Provider>
  );
}

export function useUnits(): UnitsContextValue {
  const ctx = useContext(UnitsContext);
  if (!ctx) throw new Error("useUnits must be used inside UnitsProvider");
  return ctx;
}

// ---- Conversion helpers ----

const CONVERSIONS: Record<string, { to: string; factor: number }> = {
  // imperial → metric
  "oz→g": { to: "g", factor: 28.3495 },
  "lb→kg": { to: "kg", factor: 0.453592 },
  "cup→ml": { to: "ml", factor: 236.588 },
  "tbsp→ml": { to: "ml", factor: 14.787 },
  "tsp→ml": { to: "ml", factor: 4.929 },
  // metric → imperial
  "g→oz": { to: "oz", factor: 0.035274 },
  "kg→lb": { to: "lb", factor: 2.20462 },
  "ml→cup": { to: "cup", factor: 0.00422675 },
  "ml→tbsp": { to: "tbsp", factor: 0.067628 },
  "ml→tsp": { to: "tsp", factor: 0.202884 },
};

const IMPERIAL_UNITS = new Set(["cup", "tbsp", "tsp", "oz", "lb"]);
const METRIC_UNITS = new Set(["g", "kg", "ml", "l"]);

/** Convert a quantity from one unit system to another. Returns null if no conversion applies. */
export function convertUnit(
  qty: number,
  unit: string,
  target: UnitSystem,
): { qty: number; unit: string } | null {
  if (!unit) return null;
  const isImperial = IMPERIAL_UNITS.has(unit);
  const isMetric = METRIC_UNITS.has(unit);

  if (target === "metric" && isImperial) {
    // Special: ml > 1000 → l
    const key = `${unit}→${unit === "oz" || unit === "lb" ? (unit === "oz" ? "g" : "kg") : "ml"}`;
    const conv = CONVERSIONS[key];
    if (!conv) return null;
    let newQty = qty * conv.factor;
    let newUnit = conv.to;
    if (newUnit === "ml" && newQty >= 1000) {
      newQty /= 1000;
      newUnit = "l";
    }
    if (newUnit === "g" && newQty >= 1000) {
      newQty /= 1000;
      newUnit = "kg";
    }
    return { qty: round(newQty), unit: newUnit };
  }

  if (target === "imperial" && isMetric) {
    // l → ml first for uniform conversion
    let srcQty = qty;
    let srcUnit = unit;
    if (srcUnit === "l") {
      srcQty *= 1000;
      srcUnit = "ml";
    }
    if (srcUnit === "kg") {
      const conv = CONVERSIONS["kg→lb"];
      return { qty: round(srcQty * conv.factor), unit: conv.to };
    }
    if (srcUnit === "g") {
      const conv = CONVERSIONS["g→oz"];
      return { qty: round(srcQty * conv.factor), unit: conv.to };
    }
    // ml: pick the most natural imperial unit
    if (srcUnit === "ml") {
      if (srcQty >= 60) {
        return { qty: round(srcQty * CONVERSIONS["ml→cup"].factor), unit: "cup" };
      }
      if (srcQty >= 10) {
        return { qty: round(srcQty * CONVERSIONS["ml→tbsp"].factor), unit: "tbsp" };
      }
      return { qty: round(srcQty * CONVERSIONS["ml→tsp"].factor), unit: "tsp" };
    }
  }

  return null;
}

function round(n: number): number {
  // Cooking-sane precision — "240 ml", not "236.59 ml". Coarser grids at
  // larger magnitudes; quarter-steps near 1 to match recipe fractions.
  if (n >= 100) return Math.round(n / 10) * 10;
  if (n >= 10) return Math.round(n);
  if (n >= 1) return Math.round(n * 4) / 4;
  return Math.round(n * 100) / 100;
}

/**
 * Convert °F↔°C in a recipe instruction string via regex.
 *
 * An explicit degree marker (°F, ° F, degrees F) always converts. A bare
 * letter ("350 F") only converts when the magnitude is a plausible cooking
 * temperature (≥200 for F, ≥100 for C) so "1 C" (a cup) or "2 F" never get
 * rewritten into nonsense temperatures.
 */
export function convertTemperatures(text: string, target: UnitSystem): string {
  if (target === "metric") {
    // 350°F → 175°C, 350 °F → 175°C, 350F → 175°C
    return text.replace(
      /(\d+)(\s*(?:°\s*|degrees?\s+)?)F\b/g,
      (match, f, marker) => {
        const n = Number(f);
        const hasMarker = /°|degrees?/i.test(marker);
        if (!hasMarker && n < 200) return match;
        return `${Math.round(((n - 32) * 5) / 9)}°C`;
      },
    );
  }
  // imperial: °C → °F
  return text.replace(
    /(\d+)(\s*(?:°\s*|degrees?\s+)?)C\b/g,
    (match, c, marker) => {
      const n = Number(c);
      const hasMarker = /°|degrees?/i.test(marker);
      if (!hasMarker && n < 100) return match;
      return `${Math.round((n * 9) / 5 + 32)}°F`;
    },
  );
}
