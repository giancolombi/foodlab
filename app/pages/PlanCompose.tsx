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
import { ClipboardPaste, Save, Send, Sparkles } from "lucide-react";

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

export default function PlanCompose() {
  const { t, locale } = useLanguage();
  const { mergeAssignments } = usePlan();
  const navigate = useNavigate();

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [applying, setApplying] = useState(false);
  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasteText, setPasteText] = useState("");
  const [pasting, setPasting] = useState(false);

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
    void send(prompt);
  };

  const handleApply = async () => {
    if (applying || draft.dishes.length === 0) return;
    setApplying(true);
    try {
      const res = await api<{
        saved: Array<{ dishId: string; slug: string; isBreakfast: boolean }>;
        errors: Array<{ dishId: string; name: string; error: string }>;
      }>("/plans/compose/apply", {
        method: "POST",
        body: { draft, locale },
      });

      if (res.saved.length === 0) {
        toast.error(t("compose.applyNoneSaved"));
        return;
      }

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
    const text = pasteText.trim();
    if (!text || pasting) return;
    setPasting(true);
    try {
      const { markdown } = await api<{ markdown: string }>(
        "/plans/compose/extract",
        { method: "POST", body: { text, locale } },
      );
      // Feed the extracted markdown back into the chat as user context so the
      // model can fold it into the draft on the next turn.
      setMessages((prev) => [
        ...prev,
        {
          role: "user",
          content: t("compose.pastedRecipePrefix") + "\n\n" + markdown,
        },
      ]);
      setPasteText("");
      setPasteOpen(false);
      // Now run a follow-up turn so the model integrates it.
      const next: ChatMessage[] = [
        ...messages,
        {
          role: "user",
          content: t("compose.pastedRecipePrefix") + "\n\n" + markdown,
        },
      ];
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
              <span className="hidden sm:inline">{t("compose.pasteRecipe")}</span>
            </Button>
            <Button
              size="sm"
              onClick={handleApply}
              disabled={applying || draft.dishes.length === 0}
            >
              <Save className="h-4 w-4" />
              <span className="hidden sm:inline">
                {applying ? t("compose.applying") : t("compose.saveAndApply")}
              </span>
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
            <textarea
              value={pasteText}
              onChange={(e) => setPasteText(e.target.value)}
              placeholder={t("compose.pastePlaceholder")}
              rows={8}
              className="w-full rounded-md border bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              disabled={pasting}
            />
            <div className="flex gap-2 justify-end">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setPasteOpen(false);
                  setPasteText("");
                }}
                disabled={pasting}
              >
                {t("compose.pasteCancel")}
              </Button>
              <Button
                size="sm"
                onClick={handlePasteSubmit}
                disabled={pasting || pasteText.trim().length < 40}
              >
                {pasting ? t("compose.pasteExtracting") : t("compose.pasteSubmit")}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Left: chat */}
        <Card className="flex flex-col h-[70vh]">
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
                    ? "ml-auto max-w-[85%] rounded-2xl bg-primary text-primary-foreground px-3 py-2 text-sm whitespace-pre-wrap"
                    : "mr-auto max-w-[85%] rounded-2xl bg-muted px-3 py-2 text-sm whitespace-pre-wrap"
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
              className="flex-1 rounded-md border bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
