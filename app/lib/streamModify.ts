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
  shared_ingredients: string[];
  serve_with: string[];
  versions: ModifiedVersion[];
  modification_summary: string;
}

export interface ModifyCallbacks {
  onChunk: (totalRaw: string, delta: string) => void;
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
 * Stream POST /api/recipes/:slug/modify. Forwards each markdown token via
 * onChunk, then onComplete with the final cleaned markdown.
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
