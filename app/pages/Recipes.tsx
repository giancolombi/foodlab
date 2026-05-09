import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { CalendarCheck, Clock, Snowflake, Star } from "lucide-react";

import { AddToPlanButton } from "@/components/AddToPlanButton";
import {
  Badge,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
  PageHeader,
  ProfileChip,
} from "@/design-system";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { usePlan } from "@/contexts/PlanContext";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { RecipeListItem } from "@/types";

type OwnerFilter = "all" | "curated" | "mine";

export default function Recipes() {
  const { user } = useAuth();
  const { t, locale } = useLanguage();
  const { isInPlan, slotsForSlug } = usePlan();
  const [recipes, setRecipes] = useState<RecipeListItem[]>([]);
  const [search, setSearch] = useState("");
  const [ownerFilter, setOwnerFilter] = useState<OwnerFilter>("all");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const localeParam = encodeURIComponent(locale);
    api<{ recipes: RecipeListItem[] }>(`/recipes?locale=${localeParam}`)
      .then(({ recipes }) => setRecipes(recipes))
      .finally(() => setLoading(false));
  }, [locale]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return recipes.filter((r) => {
      if (q) {
        const matchesQ =
          r.title.toLowerCase().includes(q) ||
          (r.cuisine ?? "").toLowerCase().includes(q);
        if (!matchesQ) return false;
      }
      if (ownerFilter === "mine") {
        return user && r.owner_user_id === user.id;
      }
      if (ownerFilter === "curated") {
        return !r.owner_user_id;
      }
      return true;
    });
  }, [recipes, search, ownerFilter, user]);

  const mineCount = user
    ? recipes.filter((r) => r.owner_user_id === user.id).length
    : 0;

  const filters: { value: OwnerFilter; label: string; count?: number }[] = [
    { value: "all", label: t("recipes.filter.all") },
    { value: "curated", label: t("recipes.filter.curated") },
    ...(user
      ? [
          {
            value: "mine" as const,
            label: t("recipes.filter.mine"),
            count: mineCount,
          },
        ]
      : []),
  ];

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-4">
      <PageHeader
        title={t("recipes.title")}
        subtitle={
          recipes.length === 1
            ? t("recipes.countOne")
            : t("recipes.count", { n: recipes.length })
        }
      />

      <div className="flex flex-wrap gap-2">
        {filters.map((f) => (
          <ProfileChip
            key={f.value}
            active={ownerFilter === f.value}
            onToggle={() => setOwnerFilter(f.value)}
          >
            {f.label}
            {typeof f.count === "number" && (
              <span className="ml-1 text-[10px] opacity-80">{f.count}</span>
            )}
          </ProfileChip>
        ))}
      </div>

      <Input
        placeholder={t("recipes.searchPlaceholder")}
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      {loading ? (
        <p className="text-muted-foreground text-sm">{t("recipes.loading")}</p>
      ) : filtered.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          {ownerFilter === "mine"
            ? t("recipes.empty.mine")
            : t("recipes.empty.none")}
        </p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((r) => {
            const time =
              (r.prep_minutes ?? 0) + (r.cook_minutes ?? 0) || null;
            const isMine = user && r.owner_user_id === user.id;
            const inPlan = isInPlan(r.slug);
            const slotCount = inPlan ? slotsForSlug(r.slug).length : 0;
            return (
              <Link key={r.id} to={`/recipes/${r.slug}`}>
                <Card
                  className={cn(
                    "h-full hover:border-primary/50 transition-colors",
                    inPlan && "border-primary/40 bg-primary/[0.03]",
                  )}
                >
                  <CardHeader>
                    <div className="flex items-start justify-between gap-2">
                      <CardTitle className="leading-tight break-words [overflow-wrap:anywhere] min-w-0">
                        {r.title}
                      </CardTitle>
                      <div className="flex flex-wrap justify-end gap-1 shrink-0">
                        {inPlan && (
                          <Badge
                            variant="secondary"
                            className="gap-1"
                            title={t("recipes.badge.inPlanHint", {
                              n: slotCount,
                            })}
                          >
                            <CalendarCheck className="h-3 w-3" />
                            {slotCount > 1
                              ? t("recipes.badge.inPlanN", { n: slotCount })
                              : t("recipes.badge.inPlan")}
                          </Badge>
                        )}
                        {isMine && (
                          <Badge variant="accent">
                            {t("recipes.badge.mine")}
                          </Badge>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2 items-center text-sm text-muted-foreground">
                      {r.cuisine && <span>{r.cuisine}</span>}
                      {time && (
                        <span className="inline-flex items-center gap-1">
                          <Clock className="h-3 w-3" />{" "}
                          {t("recipes.minutes", { n: time })}
                        </span>
                      )}
                      {r.freezer_friendly && (
                        <span className="inline-flex items-center gap-1">
                          <Snowflake className="h-3 w-3" />{" "}
                          {t("recipes.freezer")}
                        </span>
                      )}
                      {r.avg_rating != null && (
                        <span className="inline-flex items-center gap-1 text-amber-500">
                          <Star className="h-3 w-3 fill-current" />{" "}
                          {r.avg_rating.toFixed(1)}
                          {r.rating_count ? (
                            <span className="text-muted-foreground">
                              ({r.rating_count})
                            </span>
                          ) : null}
                        </span>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0 space-y-2">
                    <div className="flex flex-wrap gap-1">
                      {r.versions.map((v) => (
                        <Badge key={v.name} variant="secondary">
                          {v.name}
                        </Badge>
                      ))}
                    </div>
                    <AddToPlanButton slug={r.slug} title={r.title} />
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

