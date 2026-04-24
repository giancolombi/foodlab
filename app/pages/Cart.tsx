// Shopping cart — derived from the current plan's recipes + the profiles
// you're shopping for. Each line item has a checkbox; ticking it remembers
// the item as "bought" in localStorage so the list survives reloads while
// you shop. A "Smart consolidate" button upgrades the deterministic grouping
// via the Ollama backend; "Clear ticks" resets checkboxes when you start a
// new shop.

import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  CheckCheck,
  ShoppingCart,
  Sparkles,
  Trash2,
  Users,
} from "lucide-react";
import { toast } from "sonner";

import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  EmptyState,
  LoadingRow,
  PageHeader,
  ProfileChip,
  SectionHeader,
} from "@/design-system";
import { useCart } from "@/contexts/CartContext";
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

export default function Cart() {
  const { t, locale } = useLanguage();
  const {
    planSlugs,
    filledCount,
    activeProfileIds,
    toggleProfile,
    setActiveProfileIds,
  } = usePlan();
  const { isBought, toggleBought, clearBought, boughtCount } = useCart();

  const [recipes, setRecipes] = useState<RecipeDetail[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [smartLoading, setSmartLoading] = useState(false);
  const [smart, setSmart] = useState<ConsolidatedList | null>(null);

  useEffect(() => {
    setLoading(true);
    const slugs = [...planSlugs];
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
        if (activeProfileIds.length === 0 && prs.length > 0) {
          setActiveProfileIds(prs.map((p) => p.id));
        }
      })
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [planSlugs.size]);

  // Smart result is invalidated by plan / profile changes.
  useEffect(() => {
    setSmart(null);
  }, [planSlugs, activeProfileIds]);

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
        const versionToNames = new Map<number, string[]>();
        if (activeProfiles.length === 0) {
          r.versions.forEach((_, i) => versionToNames.set(i, []));
        } else {
          for (const p of activeProfiles) {
            const { version, matched } = pickVersion(p, r.versions);
            if (!version || !matched) continue;
            const idx = r.versions.indexOf(version);
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
      const normalized: Record<Section, ConsolidatedItem[]> = {
        produce: sections.produce.map(withNotes),
        proteins: sections.proteins.map(withNotes),
        dairy: sections.dairy.map(withNotes),
        pantry: sections.pantry.map(withNotes),
        other: sections.other.map(withNotes),
      };
      setSmart({ sections: normalized, total });
      toast.success(t("cart.smartDone"));
    } catch (err: any) {
      toast.error(err?.message ?? t("cart.smartFailed"));
    } finally {
      setSmartLoading(false);
    }
  };

  // Empty cart: no recipes assigned to any slot yet.
  if (filledCount === 0) {
    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
        <PageHeader title={t("cart.title")} subtitle={t("cart.subtitle")} />
        <EmptyState
          icon={ShoppingCart}
          title={t("cart.empty")}
          description={t("cart.emptyHint")}
          action={
            <Button asChild>
              <Link to="/plan">{t("cart.goToPlan")}</Link>
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
      <PageHeader
        title={t("cart.title")}
        subtitle={t("cart.subtitle")}
        actions={
          <>
            <Button
              size="sm"
              variant={smart ? "secondary" : "outline"}
              onClick={smartConsolidate}
              disabled={smartLoading || recipes.length === 0}
            >
              <Sparkles className="h-4 w-4" />
              <span className="hidden sm:inline">
                {smartLoading
                  ? t("cart.smartLoading")
                  : smart
                    ? t("cart.smartDone")
                    : t("cart.smartConsolidate")}
              </span>
            </Button>
            {boughtCount > 0 && (
              <Button
                size="sm"
                variant="ghost"
                onClick={clearBought}
                title={t("cart.clearBoughtHint")}
              >
                <Trash2 className="h-4 w-4" />
                <span className="hidden sm:inline">{t("cart.clearBought")}</span>
              </Button>
            )}
          </>
        }
      />

      {profiles.length > 0 && (
        <section className="space-y-2">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Users className="h-4 w-4" /> {t("cart.shoppingFor")}
          </div>
          <div className="flex flex-wrap gap-2">
            {profiles.map((p) => (
              <ProfileChip
                key={p.id}
                active={activeProfileIds.includes(p.id)}
                onToggle={() => toggleProfile(p.id)}
              >
                {p.name}
              </ProfileChip>
            ))}
          </div>
        </section>
      )}

      {loading && <LoadingRow label={t("cart.loadingRecipes")} />}
      {smartLoading && <LoadingRow label={t("cart.smartLoading")} />}

      <SectionHeader
        title={t("cart.shoppingList")}
        hint={
          boughtCount > 0
            ? t("cart.boughtProgress", {
                bought: boughtCount,
                total: display.total,
              })
            : `(${display.total})`
        }
      />

      <div className="space-y-3">
        {SECTION_ORDER.map((section) => {
          const items = display.sections[section];
          if (!items.length) return null;
          return (
            <Card key={section}>
              <CardHeader className="pb-1">
                <CardTitle className="text-sm capitalize">
                  {t(`cart.section.${section}` as const)}
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <ul className="space-y-1.5">
                  {items.map((item, i) => {
                    const key = `${section}:${item.name}:${i}`;
                    const bought = isBought(key);
                    return (
                      <li key={key}>
                        <label
                          className={cn(
                            "flex items-start gap-2 rounded px-2 py-1.5 -mx-2 cursor-pointer transition-colors",
                            "hover:bg-accent/30",
                            bought && "text-muted-foreground",
                          )}
                        >
                          <input
                            type="checkbox"
                            className="mt-1 h-4 w-4 rounded border-input accent-primary cursor-pointer flex-shrink-0"
                            checked={bought}
                            onChange={() => toggleBought(key)}
                            aria-label={t("cart.markBought", {
                              name: item.name,
                            })}
                          />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-baseline gap-2 flex-wrap">
                              <span
                                className={cn(
                                  "capitalize text-sm",
                                  bought && "line-through",
                                )}
                              >
                                {item.name}
                              </span>
                              {item.quantity && (
                                <span className="text-xs text-muted-foreground">
                                  {item.quantity}
                                </span>
                              )}
                              {item.forProfiles.length > 0 && (
                                <Badge
                                  variant="outline"
                                  className="text-[10px] py-0 px-1.5"
                                >
                                  {t("cart.forLabel", {
                                    names: item.forProfiles.join(", "),
                                  })}
                                </Badge>
                              )}
                            </div>
                            {item.notes.length > 0 && (
                              <div className="text-[11px] text-muted-foreground">
                                {item.notes.join(" · ")}
                              </div>
                            )}
                            {item.sources.length > 1 && (
                              <div className="text-[10px] text-muted-foreground/70">
                                {t("cart.forDishes", {
                                  names: item.sources.join(", "),
                                })}
                              </div>
                            )}
                          </div>
                        </label>
                      </li>
                    );
                  })}
                </ul>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {boughtCount === display.total && display.total > 0 && (
        <EmptyState
          icon={CheckCheck}
          title={t("cart.allDone")}
          description={t("cart.allDoneHint")}
        />
      )}
    </div>
  );
}

function withNotes(
  item: ConsolidatedItem | Omit<ConsolidatedItem, "notes">,
): ConsolidatedItem {
  return { notes: [], ...(item as ConsolidatedItem) };
}
