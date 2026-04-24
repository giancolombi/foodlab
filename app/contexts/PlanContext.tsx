// Weekly meal plan. Users assign recipes to specific day+meal slots
// (Mon..Sun × breakfast/lunch/dinner). The shopping cart is derived from
// whatever recipes are currently assigned — users can head over to the Cart
// page to tick off items as they shop.
//
// We also track which dietary profiles are eating this week so the cart can
// pick the right recipe version per person.
//
// Persists to localStorage; no server round-trips from here (a future task
// will mirror this into Postgres so plans sync across devices).

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { api, getToken } from "@/lib/api";

export const MEALS = ["breakfast", "lunch", "dinner"] as const;
export type Meal = (typeof MEALS)[number];

// Day index: 0 = Monday, 6 = Sunday. We standardize on Monday-start because
// meal prep weeks generally begin Monday; locales that prefer Sunday can flip
// the rendering later without changing storage.
export const DAYS = [0, 1, 2, 3, 4, 5, 6] as const;
export type Day = (typeof DAYS)[number];
export const DAY_KEYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;

export type SlotKey = `${Day}-${Meal}`;
export const slotKey = (day: Day, meal: Meal): SlotKey => `${day}-${meal}`;

export interface SlotAssignment {
  slug: string;
  assignedAt: number;
}

interface PlanContextValue {
  /** Day/meal slot → recipe assignment. */
  assignments: Partial<Record<SlotKey, SlotAssignment>>;
  /** Unique slugs across all assignments. */
  planSlugs: Set<string>;
  /** How many slots are filled. */
  filledCount: number;
  /** How many distinct recipes are in the plan. */
  recipeCount: number;
  isInPlan: (slug: string) => boolean;
  slotsForSlug: (slug: string) => Array<{ day: Day; meal: Meal }>;
  assign: (day: Day, meal: Meal, slug: string) => void;
  unassign: (day: Day, meal: Meal) => void;
  /** Remove a recipe from every slot it occupies. */
  removeSlug: (slug: string) => void;
  clearPlan: () => void;
  /** Merge a batch of assignments into the plan (used by auto-generate). */
  mergeAssignments: (incoming: Partial<Record<SlotKey, SlotAssignment>>) => void;

  /** Profiles that will eat this week. [] during init; default set after load. */
  activeProfileIds: string[];
  setActiveProfileIds: (ids: string[]) => void;
  toggleProfile: (id: string) => void;

  /** Include serve_with items in the shopping list. Off by default. */
  includeServeWith: boolean;
  setIncludeServeWith: (v: boolean) => void;
}

const PlanContext = createContext<PlanContextValue | null>(null);

const PLAN_KEY = "foodlab_plan_v2";
const PROFILES_KEY = "foodlab_plan_profiles";
const SERVE_WITH_KEY = "foodlab_plan_serve_with";
// Old v1 key — one-time migration: take every slug, dump them into Monday..
// slots as dinners so existing users don't lose their plan.
const LEGACY_KEY = "foodlab_plan";

type AssignmentMap = Partial<Record<SlotKey, SlotAssignment>>;

function loadAssignments(): AssignmentMap {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(PLAN_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object") {
        // Defensive: only keep keys that look like SlotKey and values that
        // have a string slug.
        const out: AssignmentMap = {};
        for (const [k, v] of Object.entries(parsed)) {
          if (
            /^[0-6]-(breakfast|lunch|dinner)$/.test(k) &&
            v &&
            typeof (v as any).slug === "string"
          ) {
            out[k as SlotKey] = {
              slug: (v as any).slug,
              assignedAt:
                typeof (v as any).assignedAt === "number"
                  ? (v as any).assignedAt
                  : Date.now(),
            };
          }
        }
        return out;
      }
    }
    // Migrate v1 pool → spread dinners across the week.
    const legacyRaw = localStorage.getItem(LEGACY_KEY);
    if (legacyRaw) {
      const legacy = JSON.parse(legacyRaw);
      if (Array.isArray(legacy)) {
        const out: AssignmentMap = {};
        legacy.slice(0, 7).forEach((e: any, i: number) => {
          if (e && typeof e.slug === "string") {
            out[slotKey(i as Day, "dinner")] = {
              slug: e.slug,
              assignedAt:
                typeof e.addedAt === "number" ? e.addedAt : Date.now(),
            };
          }
        });
        return out;
      }
    }
  } catch {
    // fall through to empty
  }
  return {};
}

function loadIncludeServeWith(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return localStorage.getItem(SERVE_WITH_KEY) === "1";
  } catch {
    return false;
  }
}

function loadProfiles(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(PROFILES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((s): s is string => typeof s === "string");
  } catch {
    return [];
  }
}

export function PlanProvider({ children }: { children: ReactNode }) {
  const [assignments, setAssignments] = useState<AssignmentMap>(loadAssignments);
  const [activeProfileIds, setActiveProfileIdsState] =
    useState<string[]>(loadProfiles);
  const [includeServeWith, setIncludeServeWithState] = useState<boolean>(
    loadIncludeServeWith,
  );

  useEffect(() => {
    try {
      localStorage.setItem(PLAN_KEY, JSON.stringify(assignments));
    } catch {
      // quota / private mode — session-only
    }
  }, [assignments]);

  useEffect(() => {
    try {
      localStorage.setItem(PROFILES_KEY, JSON.stringify(activeProfileIds));
    } catch {
      // ignore
    }
  }, [activeProfileIds]);

  useEffect(() => {
    try {
      localStorage.setItem(SERVE_WITH_KEY, includeServeWith ? "1" : "0");
    } catch {
      // ignore
    }
  }, [includeServeWith]);

  const setIncludeServeWith = useCallback((v: boolean) => {
    setIncludeServeWithState(v);
  }, []);

  // ---- Server sync ----
  // On mount, if authenticated, fetch the server plan and merge with local.
  // Server wins if it has a newer updatedAt; otherwise keep local (offline-first).
  const didFetch = useRef(false);
  useEffect(() => {
    if (didFetch.current) return;
    if (!getToken()) return;
    didFetch.current = true;
    api<{
      plan: {
        assignments: AssignmentMap;
        activeProfileIds: string[];
        includeServeWith: boolean;
        updatedAt: string | null;
      };
    }>("/plans")
      .then(({ plan }) => {
        if (!plan.updatedAt) return; // no server plan yet
        const serverSlots = Object.keys(plan.assignments).length;
        const localSlots = Object.keys(assignments).length;
        // Simple heuristic: take the richer plan (more slots filled).
        // A proper last-write-wins would require storing updatedAt locally too.
        if (serverSlots >= localSlots) {
          setAssignments(plan.assignments);
          if (plan.activeProfileIds.length) {
            setActiveProfileIdsState(plan.activeProfileIds);
          }
          setIncludeServeWithState(plan.includeServeWith);
        }
      })
      .catch(() => {
        // Offline or not authenticated — keep localStorage plan
      });
    // Only on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Debounce-save to server when plan changes.
  const saveTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => {
    if (!getToken()) return;
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      api("/plans", {
        method: "PUT",
        body: {
          assignments,
          activeProfileIds,
          includeServeWith,
        },
      }).catch(() => {
        // Silently fail — localStorage is the fallback
      });
    }, 1500);
    return () => clearTimeout(saveTimer.current);
  }, [assignments, activeProfileIds, includeServeWith]);

  const planSlugs = useMemo(() => {
    const s = new Set<string>();
    for (const a of Object.values(assignments)) {
      if (a?.slug) s.add(a.slug);
    }
    return s;
  }, [assignments]);

  const filledCount = useMemo(
    () => Object.values(assignments).filter(Boolean).length,
    [assignments],
  );
  const recipeCount = planSlugs.size;

  const isInPlan = useCallback(
    (slug: string) => planSlugs.has(slug),
    [planSlugs],
  );

  const slotsForSlug = useCallback(
    (slug: string) => {
      const out: Array<{ day: Day; meal: Meal }> = [];
      for (const [k, a] of Object.entries(assignments)) {
        if (a?.slug === slug) {
          const [dStr, meal] = k.split("-") as [string, Meal];
          out.push({ day: Number(dStr) as Day, meal });
        }
      }
      return out;
    },
    [assignments],
  );

  const assign = useCallback((day: Day, meal: Meal, slug: string) => {
    setAssignments((prev) => ({
      ...prev,
      [slotKey(day, meal)]: { slug, assignedAt: Date.now() },
    }));
  }, []);

  const unassign = useCallback((day: Day, meal: Meal) => {
    setAssignments((prev) => {
      const next = { ...prev };
      delete next[slotKey(day, meal)];
      return next;
    });
  }, []);

  const removeSlug = useCallback((slug: string) => {
    setAssignments((prev) => {
      const next: AssignmentMap = {};
      for (const [k, a] of Object.entries(prev)) {
        if (a && a.slug !== slug) next[k as SlotKey] = a;
      }
      return next;
    });
  }, []);

  const clearPlan = useCallback(() => setAssignments({}), []);

  const mergeAssignments = useCallback(
    (incoming: Partial<Record<SlotKey, SlotAssignment>>) => {
      setAssignments((prev) => ({ ...prev, ...incoming }));
    },
    [],
  );

  const setActiveProfileIds = useCallback((ids: string[]) => {
    setActiveProfileIdsState(ids);
  }, []);

  const toggleProfile = useCallback((id: string) => {
    setActiveProfileIdsState((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id],
    );
  }, []);

  const value = useMemo<PlanContextValue>(
    () => ({
      assignments,
      planSlugs,
      filledCount,
      recipeCount,
      isInPlan,
      slotsForSlug,
      assign,
      unassign,
      removeSlug,
      clearPlan,
      mergeAssignments,
      activeProfileIds,
      setActiveProfileIds,
      toggleProfile,
      includeServeWith,
      setIncludeServeWith,
    }),
    [
      assignments,
      planSlugs,
      filledCount,
      recipeCount,
      isInPlan,
      slotsForSlug,
      assign,
      unassign,
      removeSlug,
      clearPlan,
      mergeAssignments,
      activeProfileIds,
      setActiveProfileIds,
      toggleProfile,
      includeServeWith,
      setIncludeServeWith,
    ],
  );

  return <PlanContext.Provider value={value}>{children}</PlanContext.Provider>;
}

export function usePlan(): PlanContextValue {
  const ctx = useContext(PlanContext);
  if (!ctx) throw new Error("usePlan must be used inside PlanProvider");
  return ctx;
}
