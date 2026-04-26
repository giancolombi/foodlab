// Weekly meal plan — a 7-day × 3-meal grid. Each cell shows the recipe
// assigned to that breakfast / lunch / dinner slot (if any) and lets the user
// assign, swap, or unassign it. The derived shopping list lives on the Cart
// page; this page is strictly about *what to eat when*.
//
// Mobile-first: on narrow viewports the grid collapses into a vertical stack
// of days so each day's three meals are easy to tap with a thumb. On wider
// screens we show a 7-column "week at a glance" grid.

import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import {
  AlertTriangle,
  CalendarDays,
  ChefHat,
  MessageSquare,
  ShoppingCart,
  Sparkles,
  Trash2,
  Users,
  Utensils,
  X,
} from "lucide-react";

import {
  Badge,
  Button,
  Card,
  CardContent,
  EmptyState,
  LoadingRow,
  PageHeader,
  ProfileChip,
  SectionHeader,
} from "@/design-system";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  DAY_KEYS,
  DAYS,
  MEALS,
  slotKey,
  usePlan,
  type Day,
  type Meal,
} from "@/contexts/PlanContext";
import { api } from "@/lib/api";
import { pickVersion } from "@/lib/shoppingList";
import { cn } from "@/lib/utils";
import type { Profile, RecipeDetail } from "@/types";

export default function Plan() {
  const { t } = useLanguage();
  const {
    assignments,
    planSlugs,
    filledCount,
    recipeCount,
    unassign,
    clearPlan,
    mergeAssignments,
    activeProfileIds,
    toggleProfile,
    setActiveProfileIds,
    includeServeWith,
    setIncludeServeWith,
  } = usePlan();

  const [recipes, setRecipes] = useState<Record<string, RecipeDetail>>({});
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  // Fetch every recipe referenced by the plan, plus the user's profiles.
  // We key recipes by slug so slot lookups are O(1).
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
        const next: Record<string, RecipeDetail> = {};
        rcps.forEach((r) => {
          if (r) next[r.slug] = r;
        });
        setRecipes(next);
        setProfiles(prs);
        if (activeProfileIds.length === 0 && prs.length > 0) {
          setActiveProfileIds(prs.map((p) => p.id));
        }
      })
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [planSlugs.size]);

  const activeProfiles = useMemo(
    () => profiles.filter((p) => activeProfileIds.includes(p.id)),
    [profiles, activeProfileIds],
  );

  const handleGenerate = useCallback(async () => {
    setGenerating(true);
    try {
      const { assignments: incoming } = await api<{
        assignments: Record<string, { slug: string; assignedAt: number }>;
      }>("/plans/generate", {
        method: "POST",
        body: {
          profileIds: activeProfileIds,
          excludeSlugs: [...planSlugs],
        },
      });
      mergeAssignments(incoming as any);
      toast.success(t("plan.generated"));
    } catch (err: any) {
      toast.error(err?.message ?? t("plan.generateFailed"));
    } finally {
      setGenerating(false);
    }
  }, [activeProfileIds, planSlugs, mergeAssignments, t]);

  if (filledCount === 0) {
    return (
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
        <PageHeader
          title={t("plan.title")}
          subtitle={t("plan.subtitle")}
        />
        <EmptyState
          icon={CalendarDays}
          title={t("plan.empty")}
          description={t("plan.emptyHint")}
          action={
            <div className="flex gap-2 flex-wrap justify-center">
              <Button onClick={handleGenerate} disabled={generating}>
                <Sparkles className="h-4 w-4" />
                {generating ? t("plan.generating") : t("plan.generate")}
              </Button>
              <Button asChild variant="secondary">
                <Link to="/plan/compose">
                  <MessageSquare className="h-4 w-4" /> {t("plan.compose")}
                </Link>
              </Button>
              <Button asChild variant="outline">
                <Link to="/recipes">
                  <ChefHat className="h-4 w-4" /> {t("plan.browse")}
                </Link>
              </Button>
            </div>
          }
        />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
      <PageHeader
        title={t("plan.title")}
        subtitle={
          recipeCount === 1
            ? t("plan.countOne", { filled: filledCount })
            : t("plan.count", { n: recipeCount, filled: filledCount })
        }
        actions={
          <>
            <Button
              size="sm"
              variant="outline"
              onClick={handleGenerate}
              disabled={generating}
              aria-label={t("plan.generate")}
              title={t("plan.generateHint")}
            >
              <Sparkles className="h-4 w-4" />
              <span>
                {generating ? t("plan.generating") : t("plan.generate")}
              </span>
            </Button>
            <Button
              asChild
              variant="ghost"
              size="sm"
              aria-label={t("plan.compose")}
              title={t("plan.composeHint")}
            >
              <Link to="/plan/compose">
                <MessageSquare className="h-4 w-4" />
                <span>{t("plan.compose")}</span>
              </Link>
            </Button>
            <Button asChild variant="secondary" size="sm">
              <Link to="/cart">
                <ShoppingCart className="h-4 w-4" /> {t("plan.goToCart")}
              </Link>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                if (confirm(t("plan.confirmClear"))) clearPlan();
              }}
            >
              <Trash2 className="h-4 w-4" /> {t("plan.clear")}
            </Button>
          </>
        }
      />

      {profiles.length > 0 && (
        <section className="space-y-2">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Users className="h-4 w-4" /> {t("plan.cookingFor")}
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
          <p className="text-xs text-muted-foreground">
            {activeProfiles.length === 0
              ? t("plan.cookingForAll")
              : t("plan.cookingForHint", {
                  names: activeProfiles.map((p) => p.name).join(", "),
                })}
          </p>
        </section>
      )}

      <section className="space-y-2">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Utensils className="h-4 w-4" /> {t("plan.shoppingOptions")}
        </div>
        <div className="flex flex-wrap gap-2">
          <ProfileChip
            active={includeServeWith}
            onToggle={() => setIncludeServeWith(!includeServeWith)}
            leading={<Utensils className="h-3 w-3" />}
          >
            {t("plan.includeServeWith")}
          </ProfileChip>
        </div>
        <p className="text-xs text-muted-foreground">
          {includeServeWith
            ? t("plan.includeServeWithOnHint")
            : t("plan.includeServeWithOffHint")}
        </p>
      </section>

      {loading && (
        <LoadingRow label={t("plan.loadingRecipes")} />
      )}

      {/* Desktop: 7 columns (one per day). Mobile: vertical stack of days. */}
      <section>
        <div className="hidden md:grid md:grid-cols-7 md:gap-2">
          {DAYS.map((d) => (
            <DayColumn
              key={d}
              day={d}
              recipes={recipes}
              assignments={assignments}
              activeProfiles={activeProfiles}
              onUnassign={unassign}
              t={t}
            />
          ))}
        </div>
        <div className="md:hidden space-y-3">
          {DAYS.map((d) => (
            <DayStack
              key={d}
              day={d}
              recipes={recipes}
              assignments={assignments}
              activeProfiles={activeProfiles}
              onUnassign={unassign}
              t={t}
            />
          ))}
        </div>
      </section>

      <SectionHeader
        title={t("plan.nextStep")}
        hint={t("plan.nextStepHint")}
      />
      <div className="flex flex-wrap gap-2">
        <Button asChild>
          <Link to="/cart">
            <ShoppingCart className="h-4 w-4" /> {t("plan.goToCart")}
          </Link>
        </Button>
        <Button asChild variant="outline">
          <Link to="/recipes">
            <ChefHat className="h-4 w-4" /> {t("plan.browseMore")}
          </Link>
        </Button>
      </div>
    </div>
  );
}

// ---------- Day column (desktop) ----------

interface DayViewProps {
  day: Day;
  recipes: Record<string, RecipeDetail>;
  assignments: ReturnType<typeof usePlan>["assignments"];
  activeProfiles: Profile[];
  onUnassign: (d: Day, m: Meal) => void;
  t: (k: string, vars?: Record<string, unknown>) => string;
}

function DayColumn({
  day,
  recipes,
  assignments,
  activeProfiles,
  onUnassign,
  t,
}: DayViewProps) {
  return (
    <div className="min-w-0">
      <div className="text-xs font-medium text-muted-foreground mb-1 uppercase tracking-wide">
        {t(`plan.day.${DAY_KEYS[day]}`)}
      </div>
      <div className="space-y-1.5">
        {MEALS.map((m) => (
          <SlotCard
            key={m}
            day={day}
            meal={m}
            recipe={lookupSlot(assignments, recipes, day, m)}
            activeProfiles={activeProfiles}
            onUnassign={onUnassign}
            t={t}
            compact
          />
        ))}
      </div>
    </div>
  );
}

// ---------- Day stack (mobile) ----------

function DayStack({
  day,
  recipes,
  assignments,
  activeProfiles,
  onUnassign,
  t,
}: DayViewProps) {
  return (
    <Card>
      <CardContent className="p-3 space-y-2">
        <div className="text-sm font-medium">{t(`plan.day.${DAY_KEYS[day]}`)}</div>
        <div className="grid grid-cols-1 gap-1.5">
          {MEALS.map((m) => (
            <SlotCard
              key={m}
              day={day}
              meal={m}
              recipe={lookupSlot(assignments, recipes, day, m)}
              activeProfiles={activeProfiles}
              onUnassign={onUnassign}
              t={t}
            />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function lookupSlot(
  assignments: ReturnType<typeof usePlan>["assignments"],
  recipes: Record<string, RecipeDetail>,
  day: Day,
  meal: Meal,
): RecipeDetail | null {
  const a = assignments[slotKey(day, meal)];
  if (!a) return null;
  return recipes[a.slug] ?? null;
}

// ---------- Individual slot ----------

interface SlotCardProps {
  day: Day;
  meal: Meal;
  recipe: RecipeDetail | null;
  activeProfiles: Profile[];
  onUnassign: (d: Day, m: Meal) => void;
  t: (k: string, vars?: Record<string, unknown>) => string;
  compact?: boolean;
}

function SlotCard({
  day,
  meal,
  recipe,
  activeProfiles,
  onUnassign,
  t,
  compact,
}: SlotCardProps) {
  // Empty slot — dashed placeholder that points users at the recipe list so
  // they can use AddToPlanButton to fill it. A direct "assign from plan"
  // flow would require a recipe picker modal; we keep the source of recipes
  // as the recipes page to reduce surface area.
  if (!recipe) {
    return (
      <Link
        to="/recipes"
        className={cn(
          "block rounded border border-dashed border-input bg-background/50",
          "text-xs text-muted-foreground hover:bg-accent/30 hover:border-primary/40 transition-colors",
          compact ? "px-2 py-1.5" : "px-3 py-2",
        )}
      >
        <div className="font-medium text-foreground/70 capitalize">
          {t(`plan.slot.${meal}`)}
        </div>
        <div>{t("plan.slotEmpty")}</div>
      </Link>
    );
  }

  return (
    <div
      className={cn(
        "rounded border bg-card text-card-foreground",
        compact ? "px-2 py-1.5" : "px-3 py-2",
      )}
    >
      <div className="flex items-start justify-between gap-1">
        <div className="min-w-0 flex-1">
          <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide capitalize">
            {t(`plan.slot.${meal}`)}
          </div>
          <Link
            to={`/recipes/${recipe.slug}`}
            className="block text-sm font-medium leading-tight hover:underline truncate"
            title={recipe.title}
          >
            {recipe.title}
          </Link>
        </div>
        <button
          type="button"
          onClick={() => onUnassign(day, meal)}
          className="h-5 w-5 rounded text-muted-foreground hover:text-foreground hover:bg-accent/40 inline-flex items-center justify-center flex-shrink-0"
          aria-label={t("plan.remove")}
        >
          <X className="h-3 w-3" />
        </button>
      </div>
      {activeProfiles.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-1">
          {activeProfiles.map((p) => {
            const { version, matched } = pickVersion(p, recipe.versions);
            if (!version) return null;
            if (!matched) {
              return (
                <Badge
                  key={p.id}
                  variant="destructive"
                  className="gap-1 text-[10px] py-0 px-1.5"
                  title={t("plan.versionWarningHint")}
                >
                  <AlertTriangle className="h-2.5 w-2.5" />
                  {p.name}
                </Badge>
              );
            }
            return (
              <Badge
                key={p.id}
                variant="secondary"
                className="text-[10px] py-0 px-1.5"
                title={version.name}
              >
                {p.name}
              </Badge>
            );
          })}
        </div>
      )}
    </div>
  );
}
