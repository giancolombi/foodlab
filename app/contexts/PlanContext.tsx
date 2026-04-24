// Tracks the user's current week plan: a set of recipe slugs with timestamps,
// plus which dietary profiles will be eating this week. Both persist to
// localStorage so the plan survives reloads; mirrored in React state so any
// component (list page, detail page, header badge) re-renders on change.

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export interface PlanEntry {
  slug: string;
  addedAt: number;
}

interface PlanContextValue {
  entries: PlanEntry[];
  slugs: Set<string>;
  count: number;
  has: (slug: string) => boolean;
  add: (slug: string) => void;
  remove: (slug: string) => void;
  clear: () => void;
  /** Profile IDs that will be eating this week. [] = cook all versions. */
  activeProfileIds: string[];
  setActiveProfileIds: (ids: string[]) => void;
  toggleProfile: (id: string) => void;
}

const PlanContext = createContext<PlanContextValue | null>(null);
const PLAN_KEY = "foodlab_plan";
const PROFILES_KEY = "foodlab_plan_profiles";

function loadPlan(): PlanEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(PLAN_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (e): e is PlanEntry =>
        e && typeof e.slug === "string" && typeof e.addedAt === "number",
    );
  } catch {
    return [];
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
  const [entries, setEntries] = useState<PlanEntry[]>(loadPlan);
  const [activeProfileIds, setActiveProfileIdsState] =
    useState<string[]>(loadProfiles);

  useEffect(() => {
    try {
      localStorage.setItem(PLAN_KEY, JSON.stringify(entries));
    } catch {
      // quota exceeded or private-mode; plan still works for the session
    }
  }, [entries]);

  useEffect(() => {
    try {
      localStorage.setItem(PROFILES_KEY, JSON.stringify(activeProfileIds));
    } catch {
      // ignore
    }
  }, [activeProfileIds]);

  const slugs = useMemo(() => new Set(entries.map((e) => e.slug)), [entries]);

  const has = useCallback((slug: string) => slugs.has(slug), [slugs]);

  const add = useCallback((slug: string) => {
    setEntries((prev) => {
      if (prev.some((e) => e.slug === slug)) return prev;
      return [...prev, { slug, addedAt: Date.now() }];
    });
  }, []);

  const remove = useCallback((slug: string) => {
    setEntries((prev) => prev.filter((e) => e.slug !== slug));
  }, []);

  const clear = useCallback(() => setEntries([]), []);

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
      entries,
      slugs,
      count: entries.length,
      has,
      add,
      remove,
      clear,
      activeProfileIds,
      setActiveProfileIds,
      toggleProfile,
    }),
    [
      entries,
      slugs,
      has,
      add,
      remove,
      clear,
      activeProfileIds,
      setActiveProfileIds,
      toggleProfile,
    ],
  );

  return <PlanContext.Provider value={value}>{children}</PlanContext.Provider>;
}

export function usePlan(): PlanContextValue {
  const ctx = useContext(PlanContext);
  if (!ctx) throw new Error("usePlan must be used inside PlanProvider");
  return ctx;
}
