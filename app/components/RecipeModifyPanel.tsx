import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import {
  Check,
  Divide,
  Save,
  Share2,
  Sparkles,
  Users,
  X,
  Zap,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ThinkingTrace } from "@/components/ThinkingTrace";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { api } from "@/lib/api";
import {
  quickEditFromInstruction,
  type QuickEditAction,
} from "@/lib/quickEdit";
import { renderRecipeMarkdown } from "@/lib/recipeMarkdown";
import { scaleRecipe } from "@/lib/recipeMath";
import {
  streamModify,
  type ModifiedRecipe,
  type PartialRecipe,
} from "@/lib/streamModify";
import { warmTranslator } from "@/lib/translator";
import type { RecipeDetail } from "@/types";

interface Props {
  slug: string;
  /**
   * The currently-loaded recipe, when available. Required for client-side
   * quick edits (halve, double, scale to N) — without it those fall through
   * to the LLM. The matcher embeds this panel without a loaded recipe; the
   * detail page passes one.
   */
  recipe?: RecipeDetail;
  /** Called with the new slug after a successful save. */
  onSaved?: (newSlug: string) => void;
  /** Compact variant for embedding inside recommendation cards. */
  compact?: boolean;
}

/**
 * Single-turn recipe modification UI. User describes a change → LLM streams
 * structured JSON → we render a preview of the typed recipe → user can save it
 * as a personal copy. Used on both the RecipeDetail page and inline on the
 * IngredientMatcher.
 */
export function RecipeModifyPanel({
  slug,
  recipe: recipeProp,
  onSaved,
  compact = false,
}: Props) {
  const { user } = useAuth();
  const { locale, t } = useLanguage();
  const [instruction, setInstruction] = useState("");
  const [preview, setPreview] = useState<ModifiedRecipe | null>(null);
  const [partial, setPartial] = useState<PartialRecipe | null>(null);
  // If the parent didn't pass a recipe (e.g. the matcher embeds this panel
  // with just a slug), fetch it ourselves in the background so the
  // instant chips light up. Falls back gracefully if the fetch fails —
  // chips just won't appear.
  const [fetchedRecipe, setFetchedRecipe] = useState<RecipeDetail | null>(null);
  const recipe = recipeProp ?? fetchedRecipe;
  useEffect(() => {
    if (recipeProp) return;
    let cancelled = false;
    const localeParam = encodeURIComponent(locale);
    api<{ recipe: RecipeDetail }>(`/recipes/${slug}?locale=${localeParam}`)
      .then(({ recipe }) => {
        if (!cancelled) setFetchedRecipe(recipe);
      })
      .catch(() => {
        // Non-fatal — chips just won't be available, free-form still works.
      });
    return () => {
      cancelled = true;
    };
  }, [slug, locale, recipeProp]);
  const [previewMarkdown, setPreviewMarkdown] = useState("");
  const [thinking, setThinking] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [saving, setSaving] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const warmedRef = useRef(false);

  useEffect(() => () => abortRef.current?.abort(), []);

  // Legacy pre-warm hook, kept harmless. The hosted LLM has no model to
  // preload so the warm endpoint is a no-op; we still gate it once per
  // mount so opening many recipes doesn't spam the call.
  const handleWarm = () => {
    if (warmedRef.current) return;
    warmedRef.current = true;
    warmTranslator();
  };

  /**
   * Apply a quick-edit action locally without an LLM round-trip. Returns
   * true if applied; false if the action couldn't run (e.g. no recipe
   * loaded) and the caller should fall through to the streaming path.
   */
  const applyQuickEdit = (action: QuickEditAction): boolean => {
    if (!recipe) return false;
    let scaled = recipe;
    if (action.type === "scale") {
      scaled = scaleRecipe(recipe, action.factor);
    }
    const modified: ModifiedRecipe = {
      title: scaled.title,
      cuisine: scaled.cuisine,
      freezer_friendly: scaled.freezer_friendly,
      prep_minutes: scaled.prep_minutes,
      cook_minutes: scaled.cook_minutes,
      servings: scaled.servings ?? null,
      shared_ingredients: scaled.shared_ingredients,
      serve_with: scaled.serve_with,
      versions: scaled.versions.map((v) => ({
        name: v.name,
        group_label: v.group_label,
        protein: v.protein,
        instructions: v.instructions,
      })),
      modification_summary: action.summary,
    };
    const md = renderRecipeMarkdown(modified, recipe.title, locale);
    setPreview(modified);
    setPartial(null);
    setPreviewMarkdown(md);
    setThinking("");
    toast.success(action.toastLabel);
    return true;
  };

  const handleModify = async (e: FormEvent) => {
    e.preventDefault();
    const trimmed = instruction.trim();
    if (trimmed.length < 3) {
      toast.error(t("modify.errorTooShort"));
      return;
    }
    if (!user) {
      toast.error(t("modify.errorSignin"));
      return;
    }

    // Cheap path: if the instruction matches a known scale operation and
    // we have the recipe loaded, apply it locally and skip the LLM
    // entirely. Halve / double / "scale to N" land instantly this way.
    const quick = quickEditFromInstruction(trimmed, locale, recipe?.servings);
    if (quick && applyQuickEdit(quick)) return;

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setStreaming(true);
    setPreview(null);
    setPartial(null);
    setThinking("");
    setPreviewMarkdown("");

    try {
      await streamModify(
        { slug, instruction: trimmed, locale, signal: controller.signal },
        {
          onChunk: () => {},
          onPartial: (p) => setPartial(p),
          onThinking: (total) => setThinking(total),
          onComplete: ({ recipe, markdown }) => {
            setPreview(recipe);
            setPartial(null);
            setPreviewMarkdown(markdown);
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

  /** Apply a quick edit directly from a chip click. Bypasses the textarea. */
  const handleChipQuickEdit = (action: QuickEditAction) => {
    if (!user) {
      toast.error(t("modify.errorSignin"));
      return;
    }
    if (!applyQuickEdit(action)) {
      // Recipe not loaded — pre-fill the textarea instead so the user can
      // submit and let the LLM handle it.
      setInstruction(action.toastLabel);
    }
  };

  const handleStop = () => {
    abortRef.current?.abort();
    setStreaming(false);
  };

  const handleDiscard = () => {
    setPreview(null);
    setPartial(null);
    setThinking("");
    setPreviewMarkdown("");
    setInstruction("");
  };

  const handleSave = async () => {
    if (!previewMarkdown.trim()) return;
    setSaving(true);
    try {
      const { recipe: created } = await api<{
        recipe: { slug: string; title: string };
      }>("/recipes", {
        method: "POST",
        body: {
          markdown: previewMarkdown,
          parentSlug: slug,
          modificationNote: instruction,
          locale,
        },
      });
      toast.success(t("modify.savedToast", { title: created.title }));
      onSaved?.(created.slug);
      setPreview(null);
      setPreviewMarkdown("");
      setInstruction("");
    } catch (err: any) {
      toast.error(err.message ?? t("modify.errorSave"));
    } finally {
      setSaving(false);
    }
  };

  // Chips: the first three are deterministic / instant when a recipe is
  // loaded; the last two pre-fill the textarea so the LLM handles them.
  const instantChips = recipe
    ? [
        {
          key: "halve",
          label: t("modify.chip.halve"),
          icon: Divide,
          action: { type: "scale", factor: 0.5, summary: t("modify.chip.halve"), toastLabel: t("modify.chip.halve") } as QuickEditAction,
        },
        {
          key: "double",
          label: t("modify.chip.double"),
          icon: Users,
          action: { type: "scale", factor: 2, summary: t("modify.chip.double"), toastLabel: t("modify.chip.double") } as QuickEditAction,
        },
      ]
    : [];

  const fillChips = [
    { key: "spicier", label: t("modify.chip.spicier") },
    { key: "milder", label: t("modify.chip.milder") },
    { key: "swap", label: t("modify.chip.swapProtein") },
  ];

  return (
    <div className="space-y-3">
      <form onSubmit={handleModify} className="space-y-2">
        <Label htmlFor={`instruction-${slug}`} className="sr-only">
          {t("detail.customizeTitle")}
        </Label>
        {(instantChips.length > 0 || fillChips.length > 0) && (
          <div className="flex flex-wrap gap-1.5">
            {instantChips.map((c) => {
              const Icon = c.icon;
              return (
                <button
                  key={c.key}
                  type="button"
                  onClick={() => handleChipQuickEdit(c.action)}
                  disabled={streaming || !user}
                  className="inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary/5 px-2.5 py-1 text-xs text-primary hover:bg-primary/10 disabled:opacity-50 disabled:cursor-not-allowed"
                  title={t("modify.instantLabel")}
                >
                  <Zap className="h-3 w-3" />
                  {c.label}
                </button>
              );
            })}
            {fillChips.map((c) => (
              <button
                key={c.key}
                type="button"
                onClick={() => {
                  setInstruction(c.label);
                  handleWarm();
                }}
                disabled={streaming}
                className="inline-flex items-center rounded-full border bg-background px-2.5 py-1 text-xs text-muted-foreground hover:bg-accent/40 hover:text-foreground disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {c.label}
              </button>
            ))}
          </div>
        )}
        <Textarea
          id={`instruction-${slug}`}
          rows={compact ? 2 : 2}
          placeholder={t("modify.instructionPlaceholder")}
          value={instruction}
          onChange={(e) => setInstruction(e.target.value)}
          onFocus={handleWarm}
          disabled={streaming}
        />
        <div className="flex gap-2">
          <Button type="submit" size="sm" disabled={streaming || !user}>
            <Sparkles className="h-4 w-4" />
            {streaming ? t("modify.cooking") : t("modify.generate")}
          </Button>
          {streaming && (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={handleStop}
            >
              <X className="h-4 w-4" /> {t("modify.stop")}
            </Button>
          )}
        </div>
        {!user && (
          <p className="text-xs text-muted-foreground">
            <Link to="/signin" className="text-primary hover:underline">
              {t("modify.signinPrompt")}
            </Link>
            {t("modify.signinSuffix")}
          </p>
        )}
        {streaming && !preview && !partial && (
          <p className="text-xs text-muted-foreground inline-flex items-center gap-1.5">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-primary" />
            </span>
            {t("modify.streaming")}
          </p>
        )}
      </form>

      {thinking && <ThinkingTrace text={thinking} streaming={streaming} />}

      {(preview || partial) && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-medium">{t("modify.preview")}</h4>
            {streaming && partial && !preview && (
              <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-primary" />
                </span>
                {t("modify.streaming")}
              </span>
            )}
          </div>
          <StructuredPreview
            recipe={preview ?? (partial as PartialRecipe)}
            compact={compact}
            t={t}
          />
          {!streaming && preview && (
            <>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" onClick={handleSave} disabled={saving}>
                  <Save className="h-4 w-4" />
                  {saving ? t("modify.saving") : t("modify.save")}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled
                  title={t("modify.shareTooltip")}
                >
                  <Share2 className="h-4 w-4" />
                  {t("modify.share")}
                </Button>
                <Button size="sm" variant="ghost" onClick={handleDiscard}>
                  <X className="h-4 w-4" /> {t("modify.discard")}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground inline-flex items-center gap-1">
                <Check className="h-3 w-3" /> {t("modify.reviewHint")}
              </p>
            </>
          )}
        </div>
      )}
    </div>
  );
}

interface PreviewProps {
  recipe: PartialRecipe;
  compact: boolean;
  t: (k: any, p?: Record<string, string | number>) => string;
}

function StructuredPreview({ recipe, compact, t }: PreviewProps) {
  const sharedIngredients = recipe.shared_ingredients ?? [];
  const serveWith = recipe.serve_with ?? [];
  const versions = recipe.versions ?? [];
  return (
    <div
      className={`bg-muted/50 border rounded-md p-3 text-sm space-y-3 overflow-auto ${
        compact ? "max-h-80" : "max-h-[28rem]"
      }`}
    >
      {recipe.title && (
        <div>
          <div className="text-xs text-muted-foreground">
            {t("modify.title")}
          </div>
          <div className="font-semibold">{recipe.title}</div>
        </div>
      )}
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
        {recipe.cuisine && (
          <span>
            {t("modify.cuisine")}: {recipe.cuisine}
          </span>
        )}
        {recipe.prep_minutes != null && (
          <span>
            {t("modify.prep")}: {recipe.prep_minutes} min
          </span>
        )}
        {recipe.cook_minutes != null && (
          <span>
            {t("modify.cook")}: {recipe.cook_minutes} min
          </span>
        )}
      </div>
      {sharedIngredients.length > 0 && (
        <div>
          <div className="text-xs text-muted-foreground mb-1">
            {t("detail.sharedIngredients")}
          </div>
          <ul className="list-disc pl-5 text-sm sm:text-xs space-y-0.5">
            {sharedIngredients.map((i, idx) => (
              <li key={idx}>{i}</li>
            ))}
          </ul>
        </div>
      )}
      {serveWith.length > 0 && (
        <div>
          <div className="text-xs text-muted-foreground mb-1">
            {t("detail.serveWith")}
          </div>
          <ul className="list-disc pl-5 text-sm sm:text-xs space-y-0.5">
            {serveWith.map((i, idx) => (
              <li key={idx}>{i}</li>
            ))}
          </ul>
        </div>
      )}
      {versions.map((v, i) => {
        const instructions = v?.instructions ?? [];
        return (
          <div key={i} className="border-t pt-2">
            <div className="font-medium text-sm sm:text-xs">
              {v?.name}
              {v?.group_label && (
                <span className="text-muted-foreground font-normal">
                  {" "}
                  — {v.group_label}
                </span>
              )}
            </div>
            {v?.protein && (
              <div className="text-sm sm:text-xs">
                <span className="text-muted-foreground">
                  {t("detail.protein")}
                </span>{" "}
                {v.protein}
              </div>
            )}
            {instructions.length > 0 && (
              <ol className="list-decimal pl-5 text-sm sm:text-xs space-y-1 sm:space-y-0.5 mt-1">
                {instructions.map((s, idx) => (
                  <li key={idx}>{s}</li>
                ))}
              </ol>
            )}
          </div>
        );
      })}
      {recipe.modification_summary && (
        <div className="border-t pt-2">
          <div className="text-xs text-muted-foreground mb-0.5">
            {t("modify.summary")}
          </div>
          <div className="text-sm sm:text-xs italic">
            {recipe.modification_summary}
          </div>
        </div>
      )}
    </div>
  );
}
