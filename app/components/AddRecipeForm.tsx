import { useState } from "react";
import { toast } from "sonner";

import { Button, Card, CardContent } from "@/design-system";
import { useLanguage } from "@/contexts/LanguageContext";
import { api } from "@/lib/api";

interface Props {
  onSaved: (slug: string) => void;
  onCancel: () => void;
}

/**
 * Standalone "add a recipe" form mounted on the Recipes page. Same paste / URL
 * flow the menu composer uses, but the result is saved as a user-owned recipe
 * directly (no draft step) so adding a quick weeknight dish doesn't require
 * starting a meal plan.
 */
export function AddRecipeForm({ onSaved, onCancel }: Props) {
  const { t, locale } = useLanguage();
  const [url, setUrl] = useState("");
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    const u = url.trim();
    const v = text.trim();
    if (!u && v.length < 40) return;
    setBusy(true);
    try {
      const { markdown } = u
        ? await api<{ markdown: string }>("/plans/compose/extract-url", {
            method: "POST",
            body: { url: u, locale },
          })
        : await api<{ markdown: string }>("/plans/compose/extract", {
            method: "POST",
            body: { text: v, locale },
          });

      const { recipe } = await api<{ recipe: { slug: string } }>("/recipes", {
        method: "POST",
        body: { markdown, locale },
      });
      toast.success(t("recipes.add.saved"));
      onSaved(recipe.slug);
    } catch (err: any) {
      toast.error(err?.message ?? t("compose.pasteFailed"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <p className="text-sm text-muted-foreground">{t("recipes.add.hint")}</p>
        <div className="space-y-2">
          <label className="text-xs font-medium text-muted-foreground">
            {t("compose.pasteUrlLabel")}
          </label>
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://…"
            className="w-full rounded-md border bg-background px-3 py-2 text-base sm:text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            disabled={busy}
          />
        </div>
        <div className="space-y-2">
          <label className="text-xs font-medium text-muted-foreground">
            {t("compose.pasteTextLabel")}
          </label>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={t("compose.pastePlaceholder")}
            rows={6}
            className="w-full rounded-md border bg-background px-3 py-2 text-base sm:text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            disabled={busy || url.trim().length > 0}
          />
        </div>
        <div className="flex gap-2 justify-end">
          <Button variant="ghost" size="sm" onClick={onCancel} disabled={busy}>
            {t("compose.pasteCancel")}
          </Button>
          <Button
            size="sm"
            onClick={submit}
            disabled={busy || (!url.trim() && text.trim().length < 40)}
          >
            {busy
              ? url
                ? t("compose.pasteFetching")
                : t("compose.pasteExtracting")
              : t("recipes.add.submit")}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
