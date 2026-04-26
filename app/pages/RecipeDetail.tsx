import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Clock, Snowflake, Sparkles } from "lucide-react";

import { AddToPlanButton } from "@/components/AddToPlanButton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { RecipeModifyPanel } from "@/components/RecipeModifyPanel";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useUnits, convertTemperatures } from "@/contexts/UnitsContext";
import { useTranslatedRecipe } from "@/hooks/useTranslatedRecipe";
import { api } from "@/lib/api";
import type { RecipeDetail as RecipeDetailT } from "@/types";

export default function RecipeDetail() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { t, locale } = useLanguage();
  const { units } = useUnits();
  const [raw, setRaw] = useState<RecipeDetailT | null>(null);
  const { recipe, translating } = useTranslatedRecipe(raw, locale);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!slug) return;
    setRaw(null);
    setError(null);
    api<{ recipe: RecipeDetailT }>(`/recipes/${slug}`)
      .then(({ recipe }) => setRaw(recipe))
      .catch((e) => setError(e.message));
  }, [slug]);

  if (error) {
    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        <p className="text-destructive">{error}</p>
        <Link to="/recipes" className="text-primary hover:underline">
          {t("common.backToRecipes")}
        </Link>
      </div>
    );
  }

  if (!recipe) {
    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 sm:py-8 text-muted-foreground">
        {t("detail.loading")}
      </div>
    );
  }

  const totalMin = (recipe.prep_minutes ?? 0) + (recipe.cook_minutes ?? 0);
  const isMine =
    user && recipe.owner_user_id && recipe.owner_user_id === user.id;
  const isCurated = !recipe.owner_user_id;

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
      <div>
        <Button variant="ghost" size="sm" asChild>
          <Link to="/recipes">
            <ArrowLeft className="h-4 w-4" /> {t("detail.back")}
          </Link>
        </Button>
      </div>

      <div className="space-y-2">
        <div className="flex items-start gap-2 flex-wrap">
          <h1 className="text-3xl font-semibold">{recipe.title}</h1>
          {isMine && <Badge variant="accent">{t("detail.savedByYou")}</Badge>}
          {!isCurated && !isMine && (
            <Badge variant="outline">{t("detail.community")}</Badge>
          )}
          <div className="ml-auto">
            <AddToPlanButton slug={recipe.slug} title={recipe.title} />
          </div>
        </div>
        {translating && (
          <div className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
            <Spinner size="xs" label={t("detail.translating")} />
            {t("detail.translating")}
          </div>
        )}
        <div className="flex flex-wrap gap-2 text-sm text-muted-foreground">
          {recipe.cuisine && <Badge variant="secondary">{recipe.cuisine}</Badge>}
          {totalMin > 0 && (
            <span className="inline-flex items-center gap-1">
              <Clock className="h-3.5 w-3.5" />{" "}
              {t("detail.totalMin", { n: totalMin })}
            </span>
          )}
          {recipe.freezer_friendly && (
            <span className="inline-flex items-center gap-1">
              <Snowflake className="h-3.5 w-3.5" /> {t("detail.freezerFriendly")}
            </span>
          )}
        </div>
        {recipe.parent_slug && (
          <p className="text-xs text-muted-foreground">
            {t("detail.modifiedFrom")}{" "}
            <Link
              to={`/recipes/${recipe.parent_slug}`}
              className="text-primary hover:underline"
            >
              {recipe.parent_slug}
            </Link>
            {recipe.modification_note && <> — {recipe.modification_note}</>}
          </p>
        )}
      </div>

      {recipe.shared_ingredients.length > 0 && (
        <section>
          <h2 className="font-medium mb-2">{t("detail.sharedIngredients")}</h2>
          <ul className="list-disc pl-5 text-sm space-y-0.5">
            {recipe.shared_ingredients.map((ing) => (
              <li key={ing}>{ing}</li>
            ))}
          </ul>
        </section>
      )}

      {recipe.serve_with.length > 0 && (
        <section>
          <h2 className="font-medium mb-2">{t("detail.serveWith")}</h2>
          <ul className="list-disc pl-5 text-sm space-y-0.5">
            {recipe.serve_with.map((ing) => (
              <li key={ing}>{ing}</li>
            ))}
          </ul>
        </section>
      )}

      {recipe.versions.map((v) => (
        <section key={v.name} className="border-t pt-4">
          <div className="flex items-center gap-2 mb-2">
            <h2 className="font-medium">{v.name}</h2>
            {v.group_label && (
              <Badge variant="outline">{v.group_label}</Badge>
            )}
          </div>
          {v.protein && (
            <p className="text-sm mb-2">
              <span className="text-muted-foreground">
                {t("detail.protein")}
              </span>{" "}
              {v.protein}
            </p>
          )}
          {v.instructions.length > 0 && (
            <ol className="list-decimal pl-5 text-sm space-y-1">
              {v.instructions.map((step, i) => (
                <li key={i}>{convertTemperatures(step, units)}</li>
              ))}
            </ol>
          )}
        </section>
      ))}

      {recipe.source_urls.length > 0 && (
        <section className="border-t pt-4 text-xs text-muted-foreground">
          {t("detail.source")}{" "}
          {recipe.source_urls.map((u, i) => (
            <span key={u}>
              {i > 0 && ", "}
              <a
                href={u}
                target="_blank"
                rel="noreferrer"
                className="hover:underline"
              >
                {u}
              </a>
            </span>
          ))}
        </section>
      )}

      <Card className="border-primary/30">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            {t("detail.customizeTitle")}
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            {t("detail.customizeSubtitle")}
          </p>
        </CardHeader>
        <CardContent>
          <RecipeModifyPanel
            slug={recipe.slug}
            onSaved={(newSlug) => navigate(`/recipes/${newSlug}`)}
          />
        </CardContent>
      </Card>
    </div>
  );
}
