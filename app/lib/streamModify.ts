import { getToken } from "./api";
import { getStoredLocale } from "@/contexts/LanguageContext";
import type { Locale } from "@/i18n/strings";

export interface ModifiedVersion {
  name: string;
  group_label: string | null;
  protein: string | null;
  instructions: string[];
}

export interface ModifiedRecipe {
  title: string;
  cuisine: string | null;
  freezer_friendly: boolean | null;
  prep_minutes: number | null;
  cook_minutes: number | null;
  servings: number | null;
  shared_ingredients: string[];
  serve_with: string[];
  versions: ModifiedVersion[];
  modification_summary: string;
}

/** A best-effort partial — every field optional, arrays may grow over time. */
export type PartialRecipe = Partial<ModifiedRecipe>;

export interface ModifyCallbacks {
  onChunk: (totalRaw: string, delta: string) => void;
  /**
   * Fires whenever a fresh partial parse succeeds — the recipe object grows
   * as more JSON streams in. Renderers should use this to progressively fill
   * in the preview instead of waiting for `onComplete`.
   */
  onPartial?: (recipe: PartialRecipe) => void;
  /**
   * Fires per thinking-token from a reasoning-capable model. Not emitted
   * by the current hosted LLM, but kept so reasoning models can use it
   * later; otherwise this stays silent.
   */
  onThinking?: (totalThinking: string, delta: string) => void;
  onComplete: (final: { recipe: ModifiedRecipe; markdown: string }) => void;
  onError: (message: string) => void;
}

export interface ModifyRequest {
  slug: string;
  instruction: string;
  locale?: Locale;
  signal?: AbortSignal;
}

/**
 * Stream POST /api/recipes/:slug/modify. Forwards each token via onChunk,
 * emits a `PartialRecipe` after each tokens-flush via onPartial so the UI
 * can render fields as they arrive, and finally calls onComplete with the
 * server-validated structured recipe + canonical markdown.
 */
export async function streamModify(
  req: ModifyRequest,
  cb: ModifyCallbacks,
): Promise<void> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "text/event-stream",
  };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`/api/recipes/${req.slug}/modify`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      instruction: req.instruction,
      locale: req.locale ?? getStoredLocale(),
    }),
    signal: req.signal,
  });

  if (!res.ok || !res.body) {
    let message = `Request failed (${res.status})`;
    try {
      const data = await res.json();
      if (data?.error) message = data.error;
    } catch {}
    cb.onError(message);
    return;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let sseBuffer = "";
  let raw = "";
  let thinking = "";
  let lastEmittedKey = "";

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    sseBuffer += decoder.decode(value, { stream: true });

    const events = sseBuffer.split("\n\n");
    sseBuffer = events.pop() ?? "";

    for (const event of events) {
      const dataLine = event
        .split("\n")
        .find((line) => line.startsWith("data: "));
      if (!dataLine) continue;
      let payload: any;
      try {
        payload = JSON.parse(dataLine.slice(6));
      } catch {
        continue;
      }

      if (payload.type === "chunk" && typeof payload.content === "string") {
        raw += payload.content;
        cb.onChunk(raw, payload.content);
        if (cb.onPartial) {
          const partial = tolerantParseRecipe(raw);
          if (partial) {
            // Cheap dedupe so we only re-render when something actually
            // changed — JSON.stringify avoids a deep-equal lib.
            const key = JSON.stringify(partial);
            if (key !== lastEmittedKey) {
              lastEmittedKey = key;
              cb.onPartial(partial);
            }
          }
        }
      } else if (
        payload.type === "thinking" &&
        typeof payload.content === "string"
      ) {
        thinking += payload.content;
        cb.onThinking?.(thinking, payload.content);
      } else if (payload.type === "complete") {
        cb.onComplete({
          recipe: payload.recipe as ModifiedRecipe,
          markdown: payload.markdown as string,
        });
      } else if (payload.type === "error") {
        cb.onError(payload.message ?? "Unknown error");
      }
    }
  }
}

/**
 * Parse possibly-truncated JSON. Walks the string tracking string/array/
 * object depth, then closes whatever's still open before handing off to
 * `JSON.parse`. Returns null if even the recovered candidate fails to
 * parse — caller should treat that as "no progress yet, keep waiting."
 */
export function tolerantParseRecipe(s: string): PartialRecipe | null {
  if (!s) return null;
  // Strict parse first — once the model finishes, this is the fast path.
  try {
    const direct = JSON.parse(s);
    return direct && typeof direct === "object" ? direct : null;
  } catch {
    // fall through
  }

  // Walk to find the open structures we'd need to close.
  const stack: string[] = []; // entries: '"', '}', ']'
  let inString = false;
  let escaped = false;
  let lastClosable = -1; // index of last char that's safe to truncate after

  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (inString) {
      if (c === "\\") {
        escaped = true;
        continue;
      }
      if (c === '"') {
        inString = false;
        stack.pop(); // pops the matching '"'
        lastClosable = i;
      }
      continue;
    }
    if (c === '"') {
      inString = true;
      stack.push('"');
      continue;
    }
    if (c === "{") stack.push("}");
    else if (c === "[") stack.push("]");
    else if (c === "}" || c === "]") {
      if (stack[stack.length - 1] === c) stack.pop();
      lastClosable = i;
    } else if (c === "," || c === ":") {
      // Position right before a comma/colon is structurally complete.
      lastClosable = i - 1;
    }
  }

  // Try a few recovery strategies, cheapest first.
  const variants: string[] = [];

  // (a) Close opens as-is.
  variants.push(s + closingFromStack(stack));

  // (b) Strip trailing comma + close.
  variants.push(s.replace(/,\s*$/, "") + closingFromStack(stack));

  // (c) Strip a trailing partial key/value (e.g. `,"versions":` or `,"name":"Veg`).
  //     Cut back to the last structurally-safe index and close from there.
  if (lastClosable >= 0 && lastClosable < s.length - 1) {
    const truncated = s.slice(0, lastClosable + 1);
    // Recompute stack for the truncated string — cheap, O(n) and n is small.
    variants.push(truncated.replace(/,\s*$/, "") + closingFromStack(buildStack(truncated)));
  }

  for (const v of variants) {
    try {
      const obj = JSON.parse(v);
      if (obj && typeof obj === "object") return obj;
    } catch {
      // try next
    }
  }
  return null;
}

function closingFromStack(stack: string[]): string {
  let out = "";
  for (let i = stack.length - 1; i >= 0; i--) out += stack[i];
  return out;
}

function buildStack(s: string): string[] {
  const stack: string[] = [];
  let inString = false;
  let escaped = false;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (inString) {
      if (c === "\\") {
        escaped = true;
        continue;
      }
      if (c === '"') {
        inString = false;
        stack.pop();
      }
      continue;
    }
    if (c === '"') {
      inString = true;
      stack.push('"');
    } else if (c === "{") stack.push("}");
    else if (c === "[") stack.push("]");
    else if (c === "}" || c === "]") {
      if (stack[stack.length - 1] === c) stack.pop();
    }
  }
  return stack;
}
