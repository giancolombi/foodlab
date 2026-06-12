// Render a ConsolidatedList to plaintext for sharing / download.
//
// Kept separate from shoppingList.ts so UI concerns (labels, emoji, layout)
// don't leak into the pure consolidation logic. Callers supply the localized
// section labels so the output matches the user's language.

import {
  SECTION_ORDER,
  type ConsolidatedItem,
  type ConsolidatedList,
  type Section,
} from "@/lib/shoppingList";

export interface ExportOptions {
  /** Localized section headers, e.g. { produce: "Produce", ... } */
  sectionLabel: Record<Section, string>;
  /** Localized "for {names}" suffix renderer, e.g. (n) => `for ${n}`. */
  forLabel: (names: string) => string;
  /** Optional title shown at the top, e.g. "Shopping list — Week 17". */
  title?: string;
}

function renderItem(
  item: ConsolidatedList["sections"][Section][number],
  opts: ExportOptions,
  prefix: string,
): string {
  const parts: string[] = [`${prefix} ${item.name}`];
  if (item.quantity) parts.push(`(${item.quantity})`);
  if (item.forProfiles.length) {
    parts.push(`— ${opts.forLabel(item.forProfiles.join(", "))}`);
  }
  const first = parts.join(" ");
  const extra: string[] = [];
  if (item.notes.length) extra.push(`    ${item.notes.join(" · ")}`);
  return [first, ...extra].join("\n");
}

export function toPlainText(list: ConsolidatedList, opts: ExportOptions): string {
  const lines: string[] = [];
  if (opts.title) {
    lines.push(opts.title);
    lines.push("=".repeat(opts.title.length));
    lines.push("");
  }
  for (const section of SECTION_ORDER) {
    const items = list.sections[section];
    if (!items.length) continue;
    lines.push(opts.sectionLabel[section]);
    lines.push("-".repeat(opts.sectionLabel[section].length));
    for (const item of items) {
      lines.push(renderItem(item, opts, "-"));
    }
    lines.push("");
  }
  return lines.join("\n").trimEnd() + "\n";
}

/**
 * Render a ConsolidatedList as a clean line-per-item list suitable for
 * pasting into Instacart's bulk list import (instacart.com/lists). Drops
 * the section headers — Instacart's parser handles each line on its own.
 * Pass `onlyUnbought` with a predicate to send just the items still to buy.
 */
export function toInstacartList(
  list: ConsolidatedList,
  opts?: { onlyUnbought?: (entry: { section: Section; item: ConsolidatedItem }) => boolean },
): string {
  const lines: string[] = [];
  for (const section of SECTION_ORDER) {
    const items = list.sections[section];
    for (const item of items) {
      if (opts?.onlyUnbought && !opts.onlyUnbought({ section, item })) continue;
      const qty = item.quantity ? ` ${item.quantity}` : "";
      // "2 lb chicken thighs" reads better to Instacart than "chicken thighs (2 lb)".
      lines.push(`${qty.trim()} ${item.name}`.trim());
    }
  }
  return lines.join("\n");
}

/**
 * Share text via the Web Share API if available, falling back to the
 * clipboard. Returns the mode used so the UI can toast accordingly.
 */
export async function shareOrCopy(
  text: string,
  title?: string,
): Promise<"shared" | "copied"> {
  const nav = navigator as Navigator & {
    share?: (data: { title?: string; text: string }) => Promise<void>;
  };
  if (typeof nav.share === "function") {
    try {
      await nav.share({ title, text });
      return "shared";
    } catch (err: any) {
      // User cancelled — treat as no-op, propagate abort so caller can skip toast.
      if (err?.name === "AbortError") throw err;
      // Fall through to clipboard on share failure.
    }
  }
  await navigator.clipboard.writeText(text);
  return "copied";
}
