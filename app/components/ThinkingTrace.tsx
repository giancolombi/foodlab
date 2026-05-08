import { useEffect, useRef, useState } from "react";
import { Brain, ChevronDown, ChevronRight } from "lucide-react";

import { useLanguage } from "@/contexts/LanguageContext";

interface Props {
  /** Cumulative reasoning text (whatever the model has emitted so far). */
  text: string;
  /** True while still streaming — keeps the panel open and pinned to the
   *  bottom so new tokens are visible without manual scrolling. Auto-collapses
   *  once streaming stops. */
  streaming: boolean;
}

/**
 * Live reasoning trace from a thinking-capable model (qwen3, deepseek-r1,
 * gpt-oss, …). Renders as a collapsible panel — open while the model is
 * still thinking so the user sees tokens land, then auto-collapsed when
 * generation finishes (the answer below is what they actually want).
 */
export function ThinkingTrace({ text, streaming }: Props) {
  const { t } = useLanguage();
  const [open, setOpen] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Pin to bottom while streaming. Once it stops, fold so the answer below
  // gets the focus.
  useEffect(() => {
    if (!streaming) setOpen(false);
  }, [streaming]);

  useEffect(() => {
    if (!open || !streaming) return;
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [text, open, streaming]);

  if (!text) return null;

  return (
    <div className="rounded-md border border-border/60 bg-muted/30 text-xs">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-2 px-2.5 py-1.5 text-left text-muted-foreground hover:text-foreground"
        aria-expanded={open}
      >
        {open ? (
          <ChevronDown className="h-3.5 w-3.5 flex-shrink-0" />
        ) : (
          <ChevronRight className="h-3.5 w-3.5 flex-shrink-0" />
        )}
        <Brain className="h-3.5 w-3.5 flex-shrink-0 text-primary/70" />
        <span className="font-medium">{t("ai.thinking")}</span>
        {streaming && (
          <span className="ml-auto inline-flex items-center gap-1.5">
            <span className="relative flex h-1.5 w-1.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-primary" />
            </span>
          </span>
        )}
      </button>
      {open && (
        <div
          ref={scrollRef}
          className="px-2.5 pb-2 max-h-40 overflow-y-auto whitespace-pre-wrap break-words [overflow-wrap:anywhere] text-muted-foreground/80 font-mono text-[11px] leading-relaxed"
        >
          {text}
        </div>
      )}
    </div>
  );
}
