import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Clock, Snowflake } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { RecipeListItem } from "@/types";

type OwnerFilter = "all" | "curated" | "mine";

export default function Recipes() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [recipes, setRecipes] = useState<RecipeListItem[]>([]);
  const [search, setSearch] = useState("");
  const [ownerFilter, setOwnerFilter] = useState<OwnerFilter>("all");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api<{ recipes: RecipeListItem[] }>("/recipes")
      .then(({ recipes }) => setRecipes(recipes))
      .finally(() => setLoading(false));
  }, []);

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
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">{t("recipes.title")}</h1>
        <p className="text-muted-foreground">
          {recipes.length === 1
            ? t("recipes.countOne")
            : t("recipes.count", { n: recipes.length })}
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {filters.map((f) => {
          const active = ownerFilter === f.value;
          return (
            <button
              type="button"
              key={f.value}
              onClick={() => setOwnerFilter(f.value)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                active
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-background text-foreground border-input hover:bg-accent",
              )}
              aria-pressed={active}
            >
              {f.label}
              {typeof f.count === "number" && (
                <span
                  className={cn(
                    "text-[10px] opacity-80",
                    !active && "text-muted-foreground",
                  )}
                >
                  {f.count}
                </span>
              )}
            </button>
          );
        })}
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
            return (
              <Link key={r.id} to={`/recipes/${r.slug}`}>
                <Card className="h-full hover:border-primary/50 transition-colors">
                  <CardHeader>
                    <div className="flex items-start justify-between gap-2">
                      <CardTitle>{r.title}</CardTitle>
                      {isMine && (
                        <Badge variant="accent" className="shrink-0">
                          {t("recipes.badge.mine")}
                        </Badge>
                      )}
                    </div>
                    <CardDescription className="flex flex-wrap gap-2 items-center">
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
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="flex flex-wrap gap-1">
                      {r.versions.map((v) => (
                        <Badge key={v.name} variant="secondary">
                          {v.name}
                        </Badge>
                      ))}
                    </div>
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
