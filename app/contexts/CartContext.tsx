// Shopping cart: which line-items the user has already ticked off in the
// store. The cart list itself is *derived* from the current plan — we don't
// store ingredient strings here. We only persist a set of line-item keys
// that the user has marked as "bought" so state survives reloads while they
// shop aisle by aisle.
//
// Line-item keys are built by the Cart page as `${section}:${name}` so that
// changing a recipe's ingredient strings doesn't leak ticks onto different
// items. If a bought key disappears from the current list (user removes a
// recipe from the plan), the tick is harmless — we just don't render it.

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

interface CartContextValue {
  bought: Set<string>;
  isBought: (key: string) => boolean;
  toggleBought: (key: string) => void;
  clearBought: () => void;
  /** How many distinct line-items are ticked. */
  boughtCount: number;
}

const CartContext = createContext<CartContextValue | null>(null);

const STORAGE_KEY = "foodlab_cart_bought";

function loadBought(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.filter((x): x is string => typeof x === "string"));
  } catch {
    return new Set();
  }
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [bought, setBought] = useState<Set<string>>(loadBought);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify([...bought]));
    } catch {
      // quota / private mode — session-only
    }
  }, [bought]);

  const isBought = useCallback((key: string) => bought.has(key), [bought]);

  const toggleBought = useCallback((key: string) => {
    setBought((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const clearBought = useCallback(() => setBought(new Set()), []);

  const value = useMemo<CartContextValue>(
    () => ({
      bought,
      isBought,
      toggleBought,
      clearBought,
      boughtCount: bought.size,
    }),
    [bought, isBought, toggleBought, clearBought],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used inside CartProvider");
  return ctx;
}
