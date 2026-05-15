import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ChevronDown, Pencil, Sparkles, X } from "lucide-react";
import { toast } from "sonner";

import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Label,
  PageHeader,
  ProfileChip,
  Textarea,
} from "@/design-system";
import { RecipeModifyPanel } from "@/components/RecipeModifyPanel";
import { ThinkingTrace } from "@/components/ThinkingTrace";
import { useLanguage } from "@/contexts/LanguageContext";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { streamMatch } from "@/lib/streamMatch";
import type { Profile, Recommendation } from "@/types";

function splitIngredients(raw: string): string[] {
  return raw
    .split(/[\n,]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export default function IngredientMatcher() {
  const navigate = useNavigate();
  const { locale, t } = useLanguage();
  const [ingredients, setIngredients] = useState("");
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [selectedProfileIds, setSelectedProfileIds] = useState<string[]>([]);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [streamedChars, setStreamedChars] = useState(0);
  const [thinking, setThinking] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [modifyOpenSlug, setModifyOpenSlug] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    api<{ profiles: Profile[] }>("/profiles")
      .then(({ profiles }) => setProfiles(profiles))
      .catch(() => {});
  }, []);

  // Cancel an in-flight request on unmount.
  useEffect(() => () => abortRef.current?.abort(), []);

  const toggleProfile = (id: string) => {
    setSelectedProfileIds((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id],
    );
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const list = splitIngredients(ingredients);
    if (!list.length) {
      toast.error(t("match.errorEmptyList"));
      return;
    }

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setStreaming(true);
    setStreamedChars(0);
    setThinking("");
    setRecommendations([]);

    try {
      await streamMatch(
        {
          ingredients: list,
          profileIds: selectedProfileIds.length
            ? selectedProfileIds
            : undefined,
          locale,
          signal: controller.signal,
        },
        {
          onChunk: (total) => setStreamedChars(total.length),
          onPartial: (rec) => {
            setRecommendations((prev) =>
              prev.some((r) => r.slug === rec.slug) ? prev : [...prev, rec],
            );
          },
          onThinking: (total) => setThinking(total),
          onComplete: (final) => {
            setRecommendations(final);
            if (!final.length) {
              toast.message(t("match.noStrongMatches"));
            }
          },
          onError: (msg) => toast.error(msg),
        },
      );
    } catch (err: any) {
      if (err.name !== "AbortError") {
        toast.error(err.message ?? t("common.generic.error"));
      }
    } finally {
      setStreaming(false);
    }
  };

  const handleStop = () => {
    abortRef.current?.abort();
    setStreaming(false);
  };

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
      <PageHeader title={t("match.title")} subtitle={t("match.subtitle")} />

      <Card>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4 pt-6">
            <div className="space-y-1.5">
              <Label htmlFor="ingredients">{t("match.ingredientsLabel")}</Label>
              <Textarea
                id="ingredients"
                rows={4}
                placeholder={t("match.ingredientsPlaceholder")}
                value={ingredients}
                onChange={(e) => setIngredients(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                {t("match.ingredientsHint")}
              </p>
            </div>
            <div className="space-y-1.5">
              <Label>{t("match.eatingFor")}</Label>
              {profiles.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  <Link
                    to="/profiles"
                    className="text-primary hover:underline"
                  >
                    {t("match.addProfilePrompt")}
                  </Link>
                  {t("match.addProfileSuffix")}
                </p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {profiles.map((p) => {
                    const active = selectedProfileIds.includes(p.id);
                    return (
                      <ProfileChip
                        key={p.id}
                        active={active}
                        onToggle={() => toggleProfile(p.id)}
                      >
                        {p.name}
                        {p.restrictions.length > 0 && (
                          <span
                            className={cn(
                              "text-[10px] opacity-80",
                              !active && "text-muted-foreground",
                            )}
                          >
                            {p.restrictions.slice(0, 2).join(", ")}
                            {p.restrictions.length > 2 ? "…" : ""}
                          </span>
                        )}
                      </ProfileChip>
                    );
                  })}
                  <p className="text-xs text-muted-foreground w-full">
                    {selectedProfileIds.length === 0
                      ? t("match.filterNone")
                      : t("match.filterSome", { n: selectedProfileIds.length })}
                  </p>
                </div>
              )}
            </div>
            <div className="flex gap-2">
              <Button type="submit" disabled={streaming}>
                <Sparkles className="h-4 w-4" />
                {streaming ? t("match.streaming") : t("match.submit")}
              </Button>
              {streaming && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleStop}
                >
                  <X className="h-4 w-4" />
                  {t("match.stop")}
                </Button>
              )}
            </div>
          </CardContent>
        </form>
      </Card>

      {(streaming || recommendations.length > 0) && (
        <div className="space-y-3">
          {thinking && (
            <ThinkingTrace text={thinking} streaming={streaming} />
          )}
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-medium">{t("match.topMatches")}</h2>
            {streaming && (
              <span className="text-xs text-muted-foreground inline-flex items-center gap-2">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-primary" />
                </span>
                {streamedChars > 0
                  ? t("match.progress", {
                      chars: streamedChars,
                      n: recommendations.length,
                    })
                  : t("match.thinking")}
              </span>
            )}
          </div>

          {recommendations.map((r) => {
            const modifyOpen = modifyOpenSlug === r.slug;
            return (
              <Card
                key={r.slug}
                className="animate-in fade-in slide-in-from-bottom-2 duration-300"
              >
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <CardTitle>
                        <Link
                          to={`/recipes/${r.slug}`}
                          className="hover:underline"
                        >
                          {r.title ?? r.slug}
                        </Link>
                      </CardTitle>
                      <p className="text-sm text-muted-foreground">
                        {r.reason}
                      </p>
                    </div>
                    <Badge variant="accent">{Math.round(r.score)}%</Badge>
                  </div>
                </CardHeader>
                <CardContent className="pt-0 space-y-3 text-sm">
                  {r.matched_ingredients?.length > 0 && (
                    <BadgeList
                      label={t("match.youHave")}
                      items={r.matched_ingredients}
                      variant="secondary"
                    />
                  )}
                  {r.missing_ingredients?.length > 0 && (
                    <BadgeList
                      label={t("match.youllNeed")}
                      items={r.missing_ingredients}
                      variant="outline"
                    />
                  )}

                  <div className="flex flex-wrap gap-2 pt-1">
                    <Button asChild size="sm" variant="outline">
                      <Link to={`/recipes/${r.slug}`}>
                        {t("match.viewRecipe")}
                      </Link>
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant={modifyOpen ? "default" : "ghost"}
                      onClick={() =>
                        setModifyOpenSlug(modifyOpen ? null : r.slug)
                      }
                    >
                      <Pencil className="h-3.5 w-3.5" />
                      {modifyOpen ? t("match.close") : t("match.customize")}
                      <ChevronDown
                        className={cn(
                          "h-3.5 w-3.5 transition-transform",
                          modifyOpen && "rotate-180",
                        )}
                      />
                    </Button>
                  </div>

                  {modifyOpen && (
                    <div className="pt-2 border-t mt-2">
                      <RecipeModifyPanel
                        slug={r.slug}
                        compact
                        onSaved={(newSlug) => navigate(`/recipes/${newSlug}`)}
                      />
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}

          {!streaming && recommendations.length === 0 && (
            <p className="text-muted-foreground text-sm">
              {t("match.noMatches")}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

interface BadgeListProps {
  label: string;
  items: string[];
  variant: "secondary" | "outline";
}

// Caps visible badges so a recipe with 12 missing ingredients doesn't blow
// the card height up on phones. Tap "+N more" to expand inline.
function BadgeList({ label, items, variant }: BadgeListProps) {
  const [expanded, setExpanded] = useState(false);
  const VISIBLE = 5;
  const overflowCount = items.length - VISIBLE;
  const visibleItems = expanded ? items : items.slice(0, VISIBLE);
  return (
    <div>
      <div className="text-xs text-muted-foreground mb-1">{label}</div>
      <div className="flex flex-wrap gap-1">
        {visibleItems.map((ing) => (
          <Badge key={ing} variant={variant}>
            {ing}
          </Badge>
        ))}
        {!expanded && overflowCount > 0 && (
          <button
            type="button"
            onClick={() => setExpanded(true)}
            className="inline-flex items-center text-xs text-muted-foreground hover:text-foreground rounded-md border border-dashed px-2 py-0.5"
          >
            +{overflowCount}
          </button>
        )}
      </div>
    </div>
  );
}
