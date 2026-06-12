// Shopping cart — derived from the current plan's recipes + the profiles
// you're shopping for. Each line item has a checkbox; ticking it remembers
// the item as "bought" in localStorage so the list survives reloads while
// you shop. A "Smart consolidate" button upgrades the deterministic grouping
// via the LLM; "Clear ticks" resets checkboxes when you start a new shop.

import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  AlertTriangle,
  CheckCheck,
  Download,
  ExternalLink,
  Share2,
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
import { useUnits } from "@/contexts/UnitsContext";
import { api } from "@/lib/api";
import {
  consolidate,
  groupProfilesByVersion,
  localizeQuantity,
  SECTION_ORDER,
  type ConsolidatedItem,
  type ConsolidatedList,
  type RecipeForPlan,
  type Section,
} from "@/lib/shoppingList";
import {
  shareOrCopy,
  toInstacartList,
  toPlainText,
} from "@/lib/exportShoppingList";
import { exportShoppingListPdf } from "@/lib/exportPdf";
import { cn } from "@/lib/utils";
import type { Profile, RecipeDetail } from "@/types";

export default function Cart() {
  const { t, locale } = useLanguage();
  const {
    planSlugs,
    filledCount,
    activeProfileIds,
    profilesInitialized,
    toggleProfile,
    setActiveProfileIds,
    includeServeWith,
  } = usePlan();
  const { isBought, toggleBought, clearBought, boughtCount } = useCart();
  const { units } = useUnits();

  const [smartLoading, setSmartLoading] = useState(false);

  // Stable serialization of the plan's slugs — swapping one recipe for
  // another at constant count must still trigger a refetch.
  const planKey = useMemo(() => [...planSlugs].sort().join(","), [planSlugs]);
  const requestKey = `${planKey}|${locale}`;

  // Loading is derived by comparing the result's key with the current
  // request key. Stale recipes stay rendered while a refetch is in flight.
  const [fetched, setFetched] = useState<{
    key: string;
    recipes: RecipeDetail[];
    profiles: Profile[];
    failed: number;
  } | null>(null);

  useEffect(() => {
    const key = requestKey;
    let cancelled = false;
    const slugs = [...planSlugs];
    const localeParam = encodeURIComponent(locale);
    Promise.all([
      Promise.all(
        slugs.map((slug) =>
          api<{ recipe: RecipeDetail }>(`/recipes/${slug}?locale=${localeParam}`)
            .then(({ recipe }) => recipe)
            .catch(() => null),
        ),
      ),
      api<{ profiles: Profile[] }>("/profiles").catch(() => ({
        profiles: [] as Profile[],
      })),
    ]).then(([rcps, { profiles: prs }]) => {
      if (cancelled) return;
      const ok = rcps.filter((r): r is RecipeDetail => r !== null);
      setFetched({
        key,
        recipes: ok,
        profiles: prs,
        failed: rcps.length - ok.length,
      });
      // Default-select everyone exactly once; never override a deliberate
      // deselect-all ([] with profilesInitialized=true).
      if (!profilesInitialized && prs.length > 0) {
        setActiveProfileIds(prs.map((p) => p.id));
      }
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestKey]);

  const loading = fetched?.key !== requestKey;
  const recipes = useMemo(() => fetched?.recipes ?? [], [fetched]);
  const profiles = useMemo(() => fetched?.profiles ?? [], [fetched]);
  const failedCount = !loading && fetched ? fetched.failed : 0;

  const activeProfiles = useMemo(
    () => profiles.filter((p) => activeProfileIds.includes(p.id)),
    [profiles, activeProfileIds],
  );

  // Smart result is tagged with the inputs it was computed from; any change
  // to the plan, profiles, sides toggle, units, or locale invalidates it by
  // key mismatch (no synchronous reset effect needed).
  const smartKey = useMemo(
    () =>
      `${requestKey}|${[...activeProfileIds].sort().join(",")}|${
        includeServeWith ? 1 : 0
      }|${units}`,
    [requestKey, activeProfileIds, includeServeWith, units],
  );
  const [smartResult, setSmartResult] = useState<{
    key: string;
    list: ConsolidatedList;
  } | null>(null);
  const smart = smartResult?.key === smartKey ? smartResult.list : null;

  const local: ConsolidatedList = useMemo(() => {
    const plan: RecipeForPlan[] = recipes.map((r) => ({
      slug: r.slug,
      title: r.title,
      shared_ingredients: r.shared_ingredients,
      serve_with: r.serve_with,
      versions: r.versions,
    }));
    return consolidate(plan, activeProfiles, { includeServeWith, unitSystem: units });
  }, [recipes, activeProfiles, includeServeWith, units]);

  const display: ConsolidatedList = smart ?? local;

  const exportOpts = useMemo(
    () => ({
      title: t("cart.exportTitle"),
      sectionLabel: {
        produce: t("cart.section.produce"),
        proteins: t("cart.section.proteins"),
        dairy: t("cart.section.dairy"),
        pantry: t("cart.section.pantry"),
        other: t("cart.section.other"),
      } as Record<Section, string>,
      forLabel: (names: string) => t("cart.forLabel", { names }),
    }),
    [t],
  );

  const handleShare = async () => {
    if (display.total === 0) return;
    const text = toPlainText(display, exportOpts);
    try {
      const mode = await shareOrCopy(text, exportOpts.title);
      toast.success(mode === "shared" ? t("cart.shared") : t("cart.copied"));
    } catch (err: any) {
      if (err?.name === "AbortError") return;
      toast.error(t("cart.shareFailed"));
    }
  };

  const handleInstacart = async () => {
    if (display.total === 0) return;
    // Send only the items the user hasn't ticked off — the user's "list of
    // missing items for Instacart" ask. If nothing is ticked yet, the whole
    // list goes.
    const text = toInstacartList(display, {
      onlyUnbought: ({ section, item }) => !isBought(boughtKey(section, item)),
    });
    if (!text.trim()) {
      toast.message(t("cart.instacartEmpty"));
      return;
    }
    try {
      await navigator.clipboard.writeText(text);
      toast.success(t("cart.instacartCopied"));
    } catch {
      toast.error(t("cart.shareFailed"));
      return;
    }
    // Open Instacart's bulk-list page so the user can paste immediately.
    // Pop-ups blocked? They've still got the clipboard payload.
    window.open("https://www.instacart.com/lists", "_blank", "noopener,noreferrer");
  };

  const handleDownload = async () => {
    if (display.total === 0) return;
    try {
      await exportShoppingListPdf(display, exportOpts);
      toast.success(t("cart.downloaded"));
    } catch (err: any) {
      toast.error(err?.message ?? t("common.generic.error"));
    }
  };

  const smartConsolidate = async () => {
    if (recipes.length === 0) return;
    setSmartLoading(true);

    // Build one payload entry per recipe. Shared ingredients (+ optional
    // serve_with) go in a single shared entry; per-profile proteins are
    // grouped by version so each distinct version is one entry with the
    // profile names attached. This replaces the old approach that fragmented
    // each recipe into many pseudo-entries.
    const payload = {
      locale,
      recipes: recipes.flatMap((r) => {
        const out: Array<{
          title: string;
          forProfiles?: string[];
          ingredients: string[];
        }> = [];

        // Shared base + optional sides → one entry (no forProfiles).
        const shared = [
          ...r.shared_ingredients,
          ...(includeServeWith ? r.serve_with : []),
        ];
        if (shared.length) {
          out.push({ title: r.title, ingredients: shared });
        }

        // Per-version proteins: group profiles → version index, then emit
        // one entry per distinct version needed.
        const versionToNames = groupProfilesByVersion(r.versions, activeProfiles);
        for (const [idx, names] of versionToNames.entries()) {
          const v = r.versions[idx];
          if (!v?.protein) continue;
          out.push({
            title: r.title,
            forProfiles: names.length ? names : undefined,
            ingredients: [v.protein],
          });
        }
        return out;
      }),
    };
    try {
      const { sections } = await api<{
        sections: Partial<Record<Section, ConsolidatedItem[]>>;
      }>("/plans/shopping-list", { method: "POST", body: payload });
      // Guard every section against a partial server payload — a missing key
      // must not crash the render — and default the array fields per item.
      const normalized: Record<Section, ConsolidatedItem[]> = {
        produce: (sections?.produce ?? []).map(withDefaults),
        proteins: (sections?.proteins ?? []).map(withDefaults),
        dairy: (sections?.dairy ?? []).map(withDefaults),
        pantry: (sections?.pantry ?? []).map(withDefaults),
        other: (sections?.other ?? []).map(withDefaults),
      };
      const total = Object.values(normalized).reduce(
        (n, arr) => n + arr.length,
        0,
      );
      setSmartResult({ key: smartKey, list: { sections: normalized, total } });
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
              <span>
                {smartLoading
                  ? t("cart.smartLoading")
                  : smart
                    ? t("cart.smartDone")
                    : t("cart.smartConsolidate")}
              </span>
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={handleShare}
              disabled={display.total === 0}
              title={t("cart.shareHint")}
            >
              <Share2 className="h-4 w-4" />
              <span>{t("cart.share")}</span>
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={handleInstacart}
              disabled={display.total === 0}
              title={t("cart.instacartHint")}
            >
              <ExternalLink className="h-4 w-4" />
              <span>{t("cart.instacart")}</span>
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={handleDownload}
              disabled={display.total === 0}
              title={t("cart.downloadHint")}
            >
              <Download className="h-4 w-4" />
              <span>{t("cart.download")}</span>
            </Button>
            {boughtCount > 0 && (
              <Button
                size="sm"
                variant="ghost"
                onClick={clearBought}
                title={t("cart.clearBoughtHint")}
              >
                <Trash2 className="h-4 w-4" />
                <span>{t("cart.clearBought")}</span>
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
      {failedCount > 0 && (
        <p className="text-sm text-destructive inline-flex items-center gap-1.5">
          <AlertTriangle className="h-4 w-4 flex-shrink-0" />
          {t("cart.loadWarning", { n: failedCount })}
        </p>
      )}

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
          const items = display.sections[section] ?? [];
          if (!items.length) return null;
          return (
            <Card key={section} data-testid="cart-section">
              <CardHeader className="pb-1">
                <CardTitle className="text-sm capitalize">
                  {t(`cart.section.${section}` as const)}
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <ul className="divide-y divide-border/40 sm:divide-y-0 sm:space-y-1.5">
                  {items.map((item, i) => {
                    const key = boughtKey(section, item);
                    const bought = isBought(key);
                    return (
                      <li key={`${key}#${i}`}>
                        <label
                          className={cn(
                            "flex items-start gap-3 sm:gap-2 rounded px-2 py-2.5 sm:py-1.5 -mx-2 cursor-pointer transition-colors",
                            "hover:bg-accent/30",
                            bought && "text-muted-foreground",
                          )}
                        >
                          <input
                            type="checkbox"
                            className="mt-0.5 sm:mt-1 h-5 w-5 sm:h-4 sm:w-4 rounded border-input accent-primary cursor-pointer flex-shrink-0"
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
                                  "capitalize text-base sm:text-sm break-words",
                                  bought && "line-through",
                                )}
                              >
                                {item.name}
                              </span>
                              {item.quantity && (
                                <span className="text-sm sm:text-xs text-muted-foreground">
                                  {localizeQuantity(item.quantity, locale)}
                                </span>
                              )}
                              {item.forProfiles.length > 0 && (
                                <Badge
                                  variant="outline"
                                  className="text-xs sm:text-[10px] py-0.5 sm:py-0 px-1.5"
                                >
                                  {t("cart.forLabel", {
                                    names: item.forProfiles.join(", "),
                                  })}
                                </Badge>
                              )}
                            </div>
                            {item.notes.length > 0 && (
                              <div className="text-xs sm:text-[11px] text-muted-foreground mt-0.5">
                                {item.notes.join(" · ")}
                              </div>
                            )}
                            {item.sources.length > 1 && (
                              <div className="text-xs sm:text-[10px] text-muted-foreground/70 mt-0.5">
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

/**
 * Tick keys follow CartContext's `${section}:${name}` contract; per-profile
 * duplicates of the same name disambiguate with the profile names — never
 * the array index — so ticks don't migrate when the list composition or
 * order changes.
 */
function boughtKey(section: Section, item: ConsolidatedItem): string {
  return item.forProfiles.length > 0
    ? `${section}:${item.name}:${item.forProfiles.join("+")}`
    : `${section}:${item.name}`;
}

/** Default every array field the smart endpoint may omit. */
function withDefaults(item: Partial<ConsolidatedItem>): ConsolidatedItem {
  return {
    name: "",
    quantity: "",
    section: "other",
    ...item,
    notes: item.notes ?? [],
    sources: item.sources ?? [],
    forProfiles: item.forProfiles ?? [],
  } as ConsolidatedItem;
}
