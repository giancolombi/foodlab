import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { Check, Save, Share2, Sparkles, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { api } from "@/lib/api";
import {
  streamModify,
  type ModifiedRecipe,
  type PartialRecipe,
} from "@/lib/streamModify";
import { warmTranslator } from "@/lib/translator";

interface Props {
  slug: string;
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
export function RecipeModifyPanel({ slug, onSaved, compact = false }: Props) {
  const { user } = useAuth();
  const { locale, t } = useLanguage();
  const [instruction, setInstruction] = useState("");
  const [preview, setPreview] = useState<ModifiedRecipe | null>(null);
  const [partial, setPartial] = useState<PartialRecipe | null>(null);
  const [previewMarkdown, setPreviewMarkdown] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [saving, setSaving] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const warmedRef = useRef(false);

  useEffect(() => () => abortRef.current?.abort(), []);

  // Pre-warm Ollama as soon as the user shows intent. Fire-and-forget; the
  // server-side warm endpoint is already debounced. We only do this once per
  // mount of the panel so opening many recipes doesn't spam the warm call.
  const handleWarm = () => {
    if (warmedRef.current) return;
    warmedRef.current = true;
    warmTranslator();
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
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setStreaming(true);
    setPreview(null);
    setPartial(null);
    setPreviewMarkdown("");

    try {
      await streamModify(
        { slug, instruction: trimmed, locale, signal: controller.signal },
        {
          onChunk: () => {},
          onPartial: (p) => setPartial(p),
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

  const handleStop = () => {
    abortRef.current?.abort();
    setStreaming(false);
  };

  const handleDiscard = () => {
    setPreview(null);
    setPartial(null);
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

  return (
    <div className="space-y-3">
      <form onSubmit={handleModify} className="space-y-2">
        <Label htmlFor={`instruction-${slug}`} className="sr-only">
          {t("detail.customizeTitle")}
        </Label>
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
