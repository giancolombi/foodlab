import type { Recommendation } from "@/types";

import { getToken } from "./api";
import { getStoredLocale } from "@/contexts/LanguageContext";
import type { Locale } from "@/i18n/strings";

export interface StreamCallbacks {
  onChunk: (totalText: string, deltaText: string) => void;
  onPartial: (recommendation: Recommendation) => void;
  onComplete: (final: Recommendation[]) => void;
  onError: (message: string) => void;
}

export interface StreamRequest {
  ingredients: string[];
  profileIds?: string[];
  locale?: Locale;
  signal?: AbortSignal;
}

/**
 * Stream POST /api/match using fetch + ReadableStream. Parses partial JSON to
 * surface each recommendation object as soon as the model finishes writing it.
 */
export async function streamMatch(
  req: StreamRequest,
  cb: StreamCallbacks,
): Promise<void> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "text/event-stream",
  };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch("/api/match", {
    method: "POST",
    headers,
    body: JSON.stringify({
      ingredients: req.ingredients,
      profileIds: req.profileIds,
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
  let llmText = "";
  const seenSlugs = new Set<string>();

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    sseBuffer += decoder.decode(value, { stream: true });

    // SSE messages are separated by blank lines.
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
        const delta = payload.content as string;
        llmText += delta;
        cb.onChunk(llmText, delta);
        // Try to extract any newly-completed recommendation objects.
        for (const rec of extractCompleteRecommendations(llmText)) {
          if (!seenSlugs.has(rec.slug)) {
            seenSlugs.add(rec.slug);
            cb.onPartial(rec);
          }
        }
      } else if (payload.type === "complete") {
        cb.onComplete(payload.recommendations ?? []);
      } else if (payload.type === "error") {
        cb.onError(payload.message ?? "Unknown error");
      }
    }
  }
}

/**
 * Forgiving partial-JSON scanner. Looks for `"recommendations": [ ... ]` in the
 * accumulated text and returns every fully-closed `{...}` object inside the
 * array. Safe to call repeatedly as more text arrives.
 */
export function extractCompleteRecommendations(text: string): Recommendation[] {
  const keyIdx = text.indexOf('"recommendations"');
  if (keyIdx === -1) return [];
  const arrayStart = text.indexOf("[", keyIdx);
  if (arrayStart === -1) return [];

  const out: Recommendation[] = [];
  let i = arrayStart + 1;
  while (i < text.length) {
    // skip whitespace + commas between items
    while (i < text.length && /[\s,]/.test(text[i])) i++;
    if (i >= text.length) break;
    if (text[i] === "]") break;
    if (text[i] !== "{") {
      i++;
      continue;
    }

    const start = i;
    let depth = 0;
    let inString = false;
    let escape = false;
    let closed = false;

    while (i < text.length) {
      const c = text[i];
      if (escape) {
        escape = false;
        i++;
        continue;
      }
      if (c === "\\") {
        escape = true;
        i++;
        continue;
      }
      if (c === '"') inString = !inString;
      else if (!inString) {
        if (c === "{") depth++;
        else if (c === "}") {
          depth--;
          if (depth === 0) {
            closed = true;
            i++;
            break;
          }
        }
      }
      i++;
    }

    if (!closed) break; // wait for more bytes
    try {
      const obj = JSON.parse(text.slice(start, i)) as Recommendation;
      if (obj && typeof obj.slug === "string") out.push(obj);
    } catch {
      // leave it; will reappear in the final `complete` event
    }
  }
  return out;
}
