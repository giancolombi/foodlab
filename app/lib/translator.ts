// Thin client over the API's health + warm endpoints. The legacy
// runtime translation path (the `translate()` function and its IndexedDB
// batching) is gone — recipes now arrive pre-localized from the API, so
// the only remaining job is checking whether the LLM is reachable.

import { api } from "@/lib/api";

/**
 * Reports whether the server-side LLM is reachable. Cached for the
 * session after first call — refresh the page to re-check.
 */
let availabilityPromise: Promise<boolean> | null = null;
export function translateAvailable(): Promise<boolean> {
  if (!availabilityPromise) {
    availabilityPromise = api<{ llm?: { ok?: boolean } }>("/health", {
      auth: false,
    })
      .then((r) => Boolean(r.llm?.ok))
      .catch(() => false);
  }
  return availabilityPromise;
}

/**
 * Fire-and-forget warm request, kept for backwards compatibility. The
 * LLM is now a hosted API with no model to preload, so the endpoint is
 * a no-op — but the call is debounced client-side regardless.
 */
let lastWarmAt = 0;
export function warmTranslator(): void {
  const now = Date.now();
  if (now - lastWarmAt < 30_000) return; // at most once per 30s
  lastWarmAt = now;
  void api("/translate/warm", { method: "POST" }).catch(() => {
    // Reset so a retry can happen sooner if warmup failed
    lastWarmAt = 0;
  });
}
