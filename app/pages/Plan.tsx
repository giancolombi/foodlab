// Weekly meal plan page. Users build up a list of recipes via the
// AddToPlanButton on Recipes / RecipeDetail, pick which dietary profiles are
// eating this week, and get a consolidated shopping list. The list is
// computed client-side by default (deterministic, instant, offline-capable);
// a "Smart consolidate" button hits /api/plans/shopping-list for an LLM
// upgrade that handles odd duplicates and better categorization.

import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Sparkles, Trash2, Users, X } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useLanguage } from "@/contexts/LanguageContext";
import { usePlan } from "@/contexts/PlanContext";
import { api } from "@/lib/api";
import {
  consolidate,
  pickVersion,
  SECTION_ORDER,
  type ConsolidatedItem,
  type ConsolidatedList,
  type RecipeForPlan,
  type Section,
} from "@/lib/shoppingList";
import { cn } from "@/lib/utils";
import type { Profile, RecipeDetail } from "@/types";

export default function Plan() {
  const { t, locale } = useLanguage();
  const {
    entries,
    remove,
    clear,
    activeProfileIds,
    toggleProfile,
    setActiveProfileIds,
  } = usePlan();

  const [recipes, setRecipes] = useState<RecipeDetail[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [smartLoading, setSmartLoading] = useState(false);
  // When a smart result is present we render it instead of the local one.
  const [smart, setSmart] = useState<ConsolidatedList | null>(null);

  // Load all selected recipes + available profiles in parallel.
  useEffect(() => {
    setLoading(true);
    const slugs = entries.map((e) => e.slug);
    Promise.all([
      Promise.all(
        slugs.map((slug) =>
          api<{ recipe: RecipeDetail }>(`/recipes/${slug}`)
            .then(({ recipe }) => recipe)
            .catch(() => null),
        ),
      ),
      api<{ profiles: Profile[] }>("/profiles").catch(() => ({
        profiles: [] as Profile[],
      })),
    ])
      .then(([rcps, { profiles: prs }]) => {
        setRecipes(rcps.filter((r): r is RecipeDetail => r !== null));
        setProfiles(prs);
        // Default "cooking for" = all profiles once we know who exists.
        // Only seed if the user hasn't picked yet (empty array = "pick all").
        if (activeProfileIds.length === 0 && prs.length > 0) {
          setActiveProfileIds(prs.map((p) => p.id));
        }
      })
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entries.length]);

  // Smart result goes stale if the user toggles profiles or removes a recipe.
  useEffect(() => {
    setSmart(null);
  }, [entries, activeProfileIds]);

  const activeProfiles = useMemo(
    () => profiles.filter((p) => activeProfileIds.includes(p.id)),
    [profiles, activeProfileIds],
  );

  const local: ConsolidatedList = useMemo(() => {
    const plan: RecipeForPlan[] = recipes.map((r) => ({
      slug: r.slug,
      title: r.title,
      shared_ingredients: r.shared_ingredients,
      versions: r.versions,
    }));
    return consolidate(plan, activeProfiles);
  }, [recipes, activeProfiles]);

  const display: ConsolidatedList = smart ?? local;

  const smartConsolidate = async () => {
    if (recipes.length === 0) return;
    setSmartLoading(true);
    // Build the same per-profile pseudo-recipe split we'd pass to the local
    // consolidator, but send ingredient strings instead of structured parses.
    const payload = {
      locale,
      recipes: recipes.flatMap((r) => {
        const out: Array<{
          title: string;
          forProfiles?: string[];
          ingredients: string[];
        }> = [];
        if (r.shared_ingredients.length) {
          out.push({ title: r.title, ingredients: r.shared_ingredients });
        }
        // Distinct versions across active profiles.
        const versionToNames = new Map<number, string[]>();
        if (activeProfiles.length === 0) {
          r.versions.forEach((_, i) => versionToNames.set(i, []));
        } else {
          for (const p of activeProfiles) {
            const v = pickVersion(p, r.versions);
            if (!v) continue;
            const idx = r.versions.indexOf(v);
            const list = versionToNames.get(idx) ?? [];
            list.push(p.name);
            versionToNames.set(idx, list);
          }
        }
        for (const [idx, names] of versionToNames.entries()) {
          const v = r.versions[idx];
          if (!v?.protein) continue;
          out.push({
            title: r.title,
            forProfiles: names,
            ingredients: [v.protein],
          });
        }
        return out;
      }),
    };
    try {
      const { sections } = await api<{
        sections: Record<Section, ConsolidatedItem[]>;
      }>("/plans/shopping-list", { method: "POST", body: payload });
      const total = Object.values(sections).reduce(
        (n, arr) => n + arr.length,
        0,
      );
      // Ensure client-side `notes` field is defaulted since the LLM doesn't
      // emit it; the rest of the shape aligns with ConsolidatedItem.
      const normalized: Record<Section, ConsolidatedItem[]> = {
        produce: sections.produce.map(withNotes),
        proteins: sections.proteins.map(withNotes),
        dairy: sections.dairy.map(withNotes),
        pantry: sections.pantry.map(withNotes),
        other: sections.other.map(withNotes),
      };
      setSmart({ sections: normalized, total });
      toast.success(t("plan.smartDone"));
    } catch (err: any) {
      toast.error(err?.message ?? t("plan.smartFailed"));
    } finally {
      setSmartLoading(false);
    }
  };

  if (entries.length === 0) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-8 space-y-4">
        <h1 className="text-2xl font-semibold">{t("plan.title")}</h1>
        <p className="text-muted-foreground">{t("plan.empty")}</p>
        <Button asChild>
          <Link to="/recipes">{t("plan.browse")}</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
      <div className="flex items-start justify-between gap-2 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold">{t("plan.title")}</h1>
          <p className="text-muted-foreground">
            {entries.length === 1
              ? t("plan.countOne")
              : t("plan.count", { n: entries.length })}
          </p>
        </div>
        {entries.length > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              if (confirm(t("plan.confirmClear"))) clear();
            }}
          >
            <Trash2 className="h-4 w-4" /> {t("plan.clear")}
          </Button>
        )}
      </div>

      {profiles.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-2 text-sm text-muted-foreground">
            <Users className="h-4 w-4" /> {t("plan.cookingFor")}
          </div>
          <div className="flex flex-wrap gap-2">
            {profiles.map((p) => {
              const active = activeProfileIds.includes(p.id);
              return (
                <button
                  type="button"
                  key={p.id}
                  onClick={() => toggleProfile(p.id)}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                    active
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-background text-foreground border-input hover:bg-accent",
                  )}
                  aria-pressed={active}
                >
                  {p.name}
                </button>
              );
            })}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            {activeProfiles.length === 0
              ? t("plan.cookingForAll")
              : t("plan.cookingForHint", {
                  names: activeProfiles.map((p) => p.name).join(", "),
                })}
          </p>
        </section>
      )}

      <section className="space-y-2">
        <h2 className="font-medium">{t("plan.recipes")}</h2>
        {loading ? (
          <p className="text-muted-foreground text-sm">
            {t("recipes.loading")}
          </p>
        ) : (
          <div className="grid gap-2">
            {recipes.map((r) => (
              <Card key={r.slug} className="p-3">
                <div className="flex items-center justify-between gap-2">
                  <Link
                    to={`/recipes/${r.slug}`}
                    className="font-medium hover:underline"
                  >
                    {r.title}
                  </Link>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => remove(r.slug)}
                    aria-label={t("plan.remove")}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
                {activeProfiles.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1">
                    {activeProfiles.map((p) => {
                      const v = pickVersion(p, r.versions);
                      if (!v) return null;
                      return (
                        <Badge key={p.id} variant="secondary">
                          {p.name}: {v.name}
                        </Badge>
                      );
                    })}
                  </div>
                )}
              </Card>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h2 className="font-medium">
            {t("plan.shoppingList")}{" "}
            <span className="text-muted-foreground text-sm">
              ({display.total})
            </span>
          </h2>
          <Button
            size="sm"
            variant={smart ? "secondary" : "outline"}
            onClick={smartConsolidate}
            disabled={smartLoading || recipes.length === 0}
          >
            <Sparkles className="h-4 w-4" />
            {smartLoading
              ? t("plan.smartLoading")
              : smart
                ? t("plan.smartDone")
                : t("plan.smartConsolidate")}
          </Button>
        </div>

        {SECTION_ORDER.map((section) => {
          const items = display.sections[section];
          if (!items.length) return null;
          return (
            <Card key={section}>
              <CardHeader className="pb-1">
                <CardTitle className="text-sm capitalize">
                  {t(`plan.section.${section}` as any)}
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <ul className="space-y-1 text-sm">
                  {items.map((item, i) => (
                    <li key={`${item.name}-${i}`}>
                      <div className="flex items-baseline gap-2 flex-wrap">
                        <span className="capitalize">{item.name}</span>
                        {item.quantity && (
                          <span className="text-muted-foreground">
                            {item.quantity}
                          </span>
                        )}
                        {item.forProfiles.length > 0 && (
                          <Badge variant="outline" className="text-[10px]">
                            {t("plan.forLabel", {
                              names: item.forProfiles.join(", "),
                            })}
                          </Badge>
                        )}
                      </div>
                      {item.notes.length > 0 && (
                        <div className="text-[11px] text-muted-foreground pl-2">
                          {item.notes.join(" · ")}
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          );
        })}
      </section>
    </div>
  );
}

function withNotes(item: ConsolidatedItem | Omit<ConsolidatedItem, "notes">): ConsolidatedItem {
  return { notes: [], ...(item as ConsolidatedItem) };
}
