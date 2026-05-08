// Iterative menu planning chat. Left pane is the conversation with FoodLab's
// menu agent; right pane renders the current draft as a card grid. The user
// nudges the menu via natural language ("swap dish 3 for something Korean",
// "no soy or dairy", "add 1 more main") and the agent returns an updated
// draft. Stateless on the server — the full chat lives in this component.
//
// Currently does NOT save dishes as recipes or apply to /plan. That's the
// next step once the iteration loop feels right.

import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  ClipboardPaste,
  Download,
  RotateCcw,
  Save,
  Send,
  Sparkles,
} from "lucide-react";

import {
  Button,
  Card,
  CardContent,
  EmptyState,
  LoadingRow,
  PageHeader,
} from "@/design-system";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  slotKey,
  usePlan,
  type Day,
  type SlotKey,
  type SlotAssignment,
} from "@/contexts/PlanContext";
import { api } from "@/lib/api";
import { downloadTextFile, toMarkdown } from "@/lib/exportShoppingList";
import {
  consolidate,
  SECTION_ORDER,
  type RecipeForPlan,
  type Section,
} from "@/lib/shoppingList";
import { useUnits } from "@/contexts/UnitsContext";
import type { Profile, RecipeDetail } from "@/types";

interface ComposeDish {
  id: string;
  name: string;
  cuisine?: string;
  base?: string;
  vegProtein?: string;
  meatProtein?: string;
  notes?: string;
  isBreakfast: boolean;
}

interface Draft {
  dishes: ComposeDish[];
}

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

const EMPTY_DRAFT: Draft = { dishes: [] };
const MESSAGES_KEY = "foodlab_compose_messages";
const DRAFT_KEY = "foodlab_compose_draft";
const SAVED_KEY = "foodlab_compose_saved";

interface SavedRecipeRef {
  dishId: string;
  slug: string;
  title: string;
  isBreakfast: boolean;
}

function loadJSON<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    return parsed ?? fallback;
  } catch {
    return fallback;
  }
}

export default function PlanCompose() {
  const { t, locale } = useLanguage();
  const { mergeAssignments } = usePlan();
  const { units } = useUnits();
  const navigate = useNavigate();

  const [messages, setMessages] = useState<ChatMessage[]>(() =>
    loadJSON<ChatMessage[]>(MESSAGES_KEY, []),
  );
  const [draft, setDraft] = useState<Draft>(() =>
    loadJSON<Draft>(DRAFT_KEY, EMPTY_DRAFT),
  );
  const [savedRefs, setSavedRefs] = useState<SavedRecipeRef[]>(() =>
    loadJSON<SavedRecipeRef[]>(SAVED_KEY, []),
  );
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [applying, setApplying] = useState(false);
  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasteText, setPasteText] = useState("");
  const [pasteTarget, setPasteTarget] = useState<string>("new");
  const [pasteUrl, setPasteUrl] = useState("");
  const [pasting, setPasting] = useState(false);
  const [exporting, setExporting] = useState(false);

  // Persist chat + draft + saved-slugs across reloads.
  useEffect(() => {
    try {
      localStorage.setItem(MESSAGES_KEY, JSON.stringify(messages));
    } catch {
      // ignore quota
    }
  }, [messages]);
  useEffect(() => {
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
    } catch {
      // ignore
    }
  }, [draft]);
  useEffect(() => {
    try {
      localStorage.setItem(SAVED_KEY, JSON.stringify(savedRefs));
    } catch {
      // ignore
    }
  }, [savedRefs]);

  const transcriptRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    transcriptRef.current?.scrollTo({
      top: transcriptRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, loading]);

  const send = async (raw: string) => {
    const text = raw.trim();
    if (!text || loading) return;
    setInput("");
    const next: ChatMessage[] = [...messages, { role: "user", content: text }];
    setMessages(next);
    setLoading(true);
    try {
      const res = await api<{ reply: string; draft: Draft }>(
        "/plans/compose",
        {
          method: "POST",
          body: { messages: next, currentDraft: draft, locale },
        },
      );
      setMessages((prev) => [...prev, { role: "assistant", content: res.reply }]);
      setDraft(res.draft);
    } catch (err: any) {
      toast.error(err?.message ?? t("compose.error"));
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: t("compose.errorReply"),
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void send(input);
  };

  const startFresh = (prompt: string) => {
    if (loading) return;
    setMessages([]);
    setDraft(EMPTY_DRAFT);
    setSavedRefs([]);
    void send(prompt);
  };

  const handleStartOver = () => {
    if (loading || applying) return;
    if (
      messages.length > 0 &&
      !confirm(t("compose.startOverConfirm"))
    ) {
      return;
    }
    setMessages([]);
    setDraft(EMPTY_DRAFT);
    setSavedRefs([]);
    setInput("");
  };

  const handleApply = async () => {
    if (applying || draft.dishes.length === 0) return;
    setApplying(true);
    try {
      const res = await api<{
        saved: Array<{
          dishId: string;
          slug: string;
          title: string;
          isBreakfast: boolean;
        }>;
        errors: Array<{ dishId: string; name: string; error: string }>;
      }>("/plans/compose/apply", {
        method: "POST",
        body: { draft, locale },
      });

      if (res.saved.length === 0) {
        toast.error(t("compose.applyNoneSaved"));
        return;
      }
      setSavedRefs(res.saved);

      // Distribute: mains across Mon..Thu dinners, breakfasts to Saturday.
      const incoming: Partial<Record<SlotKey, SlotAssignment>> = {};
      const now = Date.now();
      let mainIdx = 0;
      for (const r of res.saved) {
        if (r.isBreakfast) {
          incoming[slotKey(5 as Day, "breakfast")] = {
            slug: r.slug,
            assignedAt: now,
          };
        } else if (mainIdx < 4) {
          incoming[slotKey(mainIdx as Day, "dinner")] = {
            slug: r.slug,
            assignedAt: now,
          };
          mainIdx++;
        }
      }
      mergeAssignments(incoming);

      if (res.errors.length > 0) {
        toast.warning(
          t("compose.applyPartial", {
            saved: res.saved.length,
            failed: res.errors.length,
          }),
        );
      } else {
        toast.success(t("compose.appliedToPlan", { n: res.saved.length }));
      }
      navigate("/plan");
    } catch (err: any) {
      toast.error(err?.message ?? t("compose.applyFailed"));
    } finally {
      setApplying(false);
    }
  };

  const handlePasteSubmit = async () => {
    const url = pasteUrl.trim();
    const text = pasteText.trim();
    if (!url && !text) return;
    if (pasting) return;

    setPasting(true);
    try {
      let markdown: string;
      if (url) {
        const res = await api<{ markdown: string }>(
          "/plans/compose/extract-url",
          { method: "POST", body: { url, locale } },
        );
        markdown = res.markdown;
      } else {
        const res = await api<{ markdown: string }>(
          "/plans/compose/extract",
          { method: "POST", body: { text, locale } },
        );
        markdown = res.markdown;
      }

      // Build the user message with explicit targeting so the model knows
      // whether to add a new dish or replace an existing one (by id).
      let prefix: string;
      if (pasteTarget === "new") {
        prefix = t("compose.pastedAddNew");
      } else {
        const target = draft.dishes.find((d) => d.id === pasteTarget);
        prefix = t("compose.pastedReplace", {
          name: target?.name ?? pasteTarget,
          id: pasteTarget,
        });
      }

      const userMsg: ChatMessage = {
        role: "user",
        content: `${prefix}\n\n${markdown}`,
      };

      setPasteUrl("");
      setPasteText("");
      setPasteOpen(false);
      setPasteTarget("new");

      const next: ChatMessage[] = [...messages, userMsg];
      setMessages(next);
      setLoading(true);
      try {
        const res = await api<{ reply: string; draft: Draft }>(
          "/plans/compose",
          {
            method: "POST",
            body: { messages: next, currentDraft: draft, locale },
          },
        );
        setMessages((prev) => [...prev, { role: "assistant", content: res.reply }]);
        setDraft(res.draft);
      } finally {
        setLoading(false);
      }
    } catch (err: any) {
      toast.error(err?.message ?? t("compose.pasteFailed"));
    } finally {
      setPasting(false);
    }
  };

  const handleExport = async () => {
    if (exporting || draft.dishes.length === 0) return;
    setExporting(true);
    try {
      // If we have saved slugs, fetch each recipe's full markdown so the doc
      // includes the LLM-expanded recipes + a consolidated shopping list.
      // Otherwise just dump the draft summary.
      let recipes: RecipeDetail[] = [];
      let profiles: Profile[] = [];
      if (savedRefs.length > 0) {
        const localeParam = encodeURIComponent(locale);
        const [fetched, profileRes] = await Promise.all([
          Promise.all(
            savedRefs.map((r) =>
              api<{ recipe: RecipeDetail }>(`/recipes/${r.slug}?locale=${localeParam}`)
                .then(({ recipe }) => recipe)
                .catch(() => null),
            ),
          ),
          api<{ profiles: Profile[] }>("/profiles").catch(() => ({
            profiles: [] as Profile[],
          })),
        ]);
        recipes = fetched.filter((r): r is RecipeDetail => r !== null);
        profiles = profileRes.profiles;
      }

      // Consolidate ingredients deterministically from the saved recipes —
      // same logic the Cart page uses, so the doc and the in-app cart match.
      let shoppingMarkdown: string | undefined;
      if (recipes.length > 0) {
        const planForCart: RecipeForPlan[] = recipes.map((r) => ({
          slug: r.slug,
          title: r.title,
          shared_ingredients: r.shared_ingredients,
          serve_with: r.serve_with,
          versions: r.versions,
        }));
        const list = consolidate(planForCart, profiles, {
          includeServeWith: false,
          unitSystem: units,
        });
        const sectionLabels: Record<Section, string> = {
          produce: t("cart.section.produce"),
          proteins: t("cart.section.proteins"),
          dairy: t("cart.section.dairy"),
          pantry: t("cart.section.pantry"),
          other: t("cart.section.other"),
        };
        // Skip if everything's empty (no recipe parsed cleanly).
        const hasItems = SECTION_ORDER.some(
          (s) => list.sections[s].length > 0,
        );
        if (hasItems) {
          shoppingMarkdown = toMarkdown(list, {
            title: t("compose.shoppingListLabel"),
            sectionLabel: sectionLabels,
            forLabel: (names) => t("cart.forLabel", { names }),
          });
        }
      }

      const md = buildMenuDoc({
        draft,
        recipes,
        shoppingMarkdown,
        title: t("compose.docTitle"),
        sections: {
          mainsLabel: t("compose.mainsLabel", {
            n: draft.dishes.filter((d) => !d.isBreakfast).length,
          }),
          breakfastLabel: t("compose.breakfastLabel"),
          baseLabel: t("compose.baseLabel"),
          vegLabel: t("compose.vegLabel"),
          meatLabel: t("compose.meatLabel"),
          recipesLabel: t("compose.recipesLabel"),
          notSavedHint: t("compose.notSavedHint"),
        },
      });
      const stamp = new Date().toISOString().slice(0, 10);
      downloadTextFile(`menu-${stamp}.md`, md, "text/markdown;charset=utf-8");
      toast.success(t("compose.docDownloaded"));
    } catch (err: any) {
      toast.error(err?.message ?? t("compose.docFailed"));
    } finally {
      setExporting(false);
    }
  };

  const breakfasts = draft.dishes.filter((d) => d.isBreakfast);
  const mains = draft.dishes.filter((d) => !d.isBreakfast);

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
      <PageHeader
        title={t("compose.title")}
        subtitle={t("compose.subtitle")}
        actions={
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPasteOpen((v) => !v)}
            >
              <ClipboardPaste className="h-4 w-4" />
              <span>{t("compose.pasteRecipe")}</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleExport}
              disabled={exporting || draft.dishes.length === 0}
            >
              <Download className="h-4 w-4" />
              <span>
                {exporting ? t("compose.docExporting") : t("compose.docExport")}
              </span>
            </Button>
            <Button
              size="sm"
              onClick={handleApply}
              disabled={applying || draft.dishes.length === 0}
            >
              <Save className="h-4 w-4" />
              <span>
                {applying ? t("compose.applying") : t("compose.saveAndApply")}
              </span>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleStartOver}
              disabled={loading || applying}
              title={t("compose.startOver")}
            >
              <RotateCcw className="h-4 w-4" />
              <span>{t("compose.startOver")}</span>
            </Button>
            <Button asChild variant="ghost" size="sm">
              <Link to="/plan">{t("compose.backToPlan")}</Link>
            </Button>
          </>
        }
      />

      {pasteOpen && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <p className="text-sm text-muted-foreground">
              {t("compose.pasteHint")}
            </p>
            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground">
                {t("compose.pasteUrlLabel")}
              </label>
              <input
                type="url"
                value={pasteUrl}
                onChange={(e) => setPasteUrl(e.target.value)}
                placeholder="https://…"
                className="w-full rounded-md border bg-background px-3 py-2 text-base sm:text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                disabled={pasting}
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground">
                {t("compose.pasteTextLabel")}
              </label>
              <textarea
                value={pasteText}
                onChange={(e) => setPasteText(e.target.value)}
                placeholder={t("compose.pastePlaceholder")}
                rows={6}
                className="w-full rounded-md border bg-background px-3 py-2 text-base sm:text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                disabled={pasting || pasteUrl.trim().length > 0}
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground">
                {t("compose.pasteTargetLabel")}
              </label>
              <select
                value={pasteTarget}
                onChange={(e) => setPasteTarget(e.target.value)}
                className="w-full rounded-md border bg-background px-3 py-2 text-base sm:text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                disabled={pasting}
              >
                <option value="new">{t("compose.pasteTargetNew")}</option>
                {draft.dishes.map((d) => (
                  <option key={d.id} value={d.id}>
                    {t("compose.pasteTargetReplace", { name: d.name })}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex gap-2 justify-end">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setPasteOpen(false);
                  setPasteText("");
                  setPasteUrl("");
                  setPasteTarget("new");
                }}
                disabled={pasting}
              >
                {t("compose.pasteCancel")}
              </Button>
              <Button
                size="sm"
                onClick={handlePasteSubmit}
                disabled={
                  pasting ||
                  (!pasteUrl.trim() && pasteText.trim().length < 40)
                }
              >
                {pasting
                  ? pasteUrl
                    ? t("compose.pasteFetching")
                    : t("compose.pasteExtracting")
                  : t("compose.pasteSubmit")}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid md:grid-cols-2 gap-4 sm:gap-6">
        {/* Left: chat. Capped lower on mobile so the input + soft keyboard
            still leave room for the draft cards below. */}
        <Card className="flex flex-col h-[60vh] md:h-[70vh]">
          <div
            ref={transcriptRef}
            className="flex-1 overflow-y-auto p-4 space-y-3"
          >
            {messages.length === 0 && (
              <div className="text-sm text-muted-foreground space-y-3">
                <p>{t("compose.intro")}</p>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => startFresh(t("compose.starter1"))}
                    disabled={loading}
                  >
                    {t("compose.starter1")}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => startFresh(t("compose.starter2"))}
                    disabled={loading}
                  >
                    {t("compose.starter2")}
                  </Button>
                </div>
              </div>
            )}
            {messages.map((m, i) => (
              <div
                key={i}
                className={
                  m.role === "user"
                    ? "ml-auto max-w-[90%] sm:max-w-[80%] rounded-2xl bg-primary text-primary-foreground px-3 py-2 text-sm whitespace-pre-wrap break-words [overflow-wrap:anywhere]"
                    : "mr-auto max-w-[90%] sm:max-w-[80%] rounded-2xl bg-muted px-3 py-2 text-sm whitespace-pre-wrap break-words [overflow-wrap:anywhere]"
                }
              >
                {m.content}
              </div>
            ))}
            {loading && <LoadingRow label={t("compose.thinking")} />}
          </div>

          <form
            onSubmit={handleSubmit}
            className="flex gap-2 p-3 border-t bg-background"
          >
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={t("compose.placeholder")}
              className="flex-1 rounded-md border bg-background px-3 py-2 text-base sm:text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              disabled={loading}
            />
            <Button type="submit" disabled={loading || !input.trim()}>
              <Send className="h-4 w-4" />
            </Button>
          </form>
        </Card>

        {/* Right: draft */}
        <div className="space-y-4">
          {draft.dishes.length === 0 ? (
            <EmptyState
              icon={Sparkles}
              title={t("compose.draftEmpty")}
              description={t("compose.draftEmptyHint")}
            />
          ) : (
            <>
              {mains.length > 0 && (
                <DishGroup
                  label={t("compose.mainsLabel", { n: mains.length })}
                  dishes={mains}
                />
              )}
              {breakfasts.length > 0 && (
                <DishGroup
                  label={t("compose.breakfastLabel")}
                  dishes={breakfasts}
                />
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function DishGroup({ label, dishes }: { label: string; dishes: ComposeDish[] }) {
  const { t } = useLanguage();
  return (
    <section className="space-y-2">
      <h2 className="text-sm font-semibold text-muted-foreground">{label}</h2>
      <div className="space-y-2">
        {dishes.map((d) => (
          <Card key={d.id}>
            <CardContent className="p-4 space-y-2">
              <div className="flex items-baseline justify-between gap-3 flex-wrap">
                <h3 className="font-semibold">{d.name}</h3>
                {d.cuisine && (
                  <span className="text-xs text-muted-foreground">
                    {d.cuisine}
                  </span>
                )}
              </div>
              {d.base && (
                <p className="text-sm text-muted-foreground">{d.base}</p>
              )}
              <div className="grid sm:grid-cols-2 gap-2 text-sm">
                {d.vegProtein && (
                  <div>
                    <span className="text-muted-foreground text-xs">
                      {t("compose.vegLabel")}
                    </span>
                    <div>{d.vegProtein}</div>
                  </div>
                )}
                {d.meatProtein && (
                  <div>
                    <span className="text-muted-foreground text-xs">
                      {t("compose.meatLabel")}
                    </span>
                    <div>{d.meatProtein}</div>
                  </div>
                )}
              </div>
              {d.notes && (
                <p className="text-xs text-muted-foreground">{d.notes}</p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
}

interface DocSectionLabels {
  mainsLabel: string;
  breakfastLabel: string;
  baseLabel: string;
  vegLabel: string;
  meatLabel: string;
  recipesLabel: string;
  notSavedHint: string;
}

function buildMenuDoc(args: {
  draft: Draft;
  recipes: RecipeDetail[];
  shoppingMarkdown?: string;
  title: string;
  sections: DocSectionLabels;
}): string {
  const { draft, recipes, shoppingMarkdown, title, sections } = args;
  const stamp = new Date().toISOString().slice(0, 10);
  const out: string[] = [];
  out.push(`# ${title}`);
  out.push("");
  out.push(`_${stamp}_`);
  out.push("");

  const mains = draft.dishes.filter((d) => !d.isBreakfast);
  const breakfasts = draft.dishes.filter((d) => d.isBreakfast);

  const renderDish = (d: ComposeDish) => {
    out.push(`### ${d.name}`);
    if (d.cuisine) out.push(`_${d.cuisine}_`);
    if (d.base) out.push(`**${sections.baseLabel}:** ${d.base}`);
    if (d.vegProtein) out.push(`**${sections.vegLabel}:** ${d.vegProtein}`);
    if (d.meatProtein) out.push(`**${sections.meatLabel}:** ${d.meatProtein}`);
    if (d.notes) out.push(d.notes);
    out.push("");
  };

  if (mains.length > 0) {
    out.push(`## ${sections.mainsLabel}`);
    out.push("");
    mains.forEach(renderDish);
  }
  if (breakfasts.length > 0) {
    out.push(`## ${sections.breakfastLabel}`);
    out.push("");
    breakfasts.forEach(renderDish);
  }

  if (recipes.length > 0) {
    out.push(`## ${sections.recipesLabel}`);
    out.push("");
    for (const recipe of recipes) {
      out.push(recipe.raw_markdown.trim());
      out.push("");
      out.push("---");
      out.push("");
    }
  } else {
    out.push(`_${sections.notSavedHint}_`);
    out.push("");
  }

  if (shoppingMarkdown) {
    // toMarkdown() already includes its own H1/H2 structure — append as-is.
    out.push(shoppingMarkdown.trim());
    out.push("");
  }

  return out.join("\n");
}
