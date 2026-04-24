// Client for the Ollama-backed /api/translate endpoint. Same public signature
// as the old WebGPU worker, so `useTranslatedRecipe` doesn't care which backend
// is in use. Calls are debounced + batched: multiple translate() invocations on
// the same tick collapse into a single POST.

import { api } from "@/lib/api";
import type { Locale } from "@/i18n/strings";

type Pending = {
  text: string;
  src: Locale;
  tgt: Locale;
  resolve: (s: string) => void;
  reject: (e: Error) => void;
};

const queue: Pending[] = [];
let flushScheduled = false;
// qwen2.5:3b handles ~40–50 short lines per call comfortably; stay below to
// leave headroom for system prompt + response overhead.
const BATCH_MAX = 30;

const statusListeners = new Set<(s: "idle" | "loading" | "ready") => void>();
let currentStatus: "idle" | "loading" | "ready" = "idle";

function emitStatus(s: "idle" | "loading" | "ready") {
  currentStatus = s;
  statusListeners.forEach((fn) => fn(s));
}

export function onStatus(fn: (s: "idle" | "loading" | "ready") => void) {
  statusListeners.add(fn);
  fn(currentStatus);
  return () => {
    statusListeners.delete(fn);
  };
}

/**
 * Reports whether the server-side translator is reachable. We check
 * /api/health which surfaces Ollama status. Cached for the session after
 * first call — refresh the page to re-check.
 */
let availabilityPromise: Promise<boolean> | null = null;
export function translateAvailable(): Promise<boolean> {
  if (!availabilityPromise) {
    availabilityPromise = api<{ ollama?: { ok?: boolean } }>("/health", {
      auth: false,
    })
      .then((r) => Boolean(r.ollama?.ok))
      .catch(() => false);
  }
  return availabilityPromise;
}

/**
 * Fire-and-forget request to preload the Ollama model. Safe to call multiple
 * times; Ollama idempotently refreshes the model's keep-alive window. We
 * debounce client-side to avoid thrashing when the toggle is flipped rapidly.
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

// --- IndexedDB cache ---

const DB_NAME = "foodlab_translations";
const STORE = "cache";
let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

function cacheKey(text: string, src: string, tgt: string) {
  return `${src}|${tgt}|${text}`;
}

async function cacheGet(key: string): Promise<string | undefined> {
  try {
    const db = await openDb();
    return await new Promise((resolve, reject) => {
      const req = db.transaction(STORE).objectStore(STORE).get(key);
      req.onsuccess = () => resolve(req.result as string | undefined);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return undefined;
  }
}

async function cacheSet(key: string, value: string): Promise<void> {
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).put(value, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    // non-fatal: translation still works, just won't be cached
  }
}

// --- Batcher ---

function scheduleFlush() {
  if (flushScheduled) return;
  flushScheduled = true;
  queueMicrotask(flush);
}

async function flush() {
  flushScheduled = false;
  if (queue.length === 0) return;

  const drained = queue.splice(0, queue.length);

  // Concurrent cache lookup for the whole batch; items with a hit resolve
  // immediately and never go to the server.
  const needsNetwork: Pending[] = [];
  await Promise.all(
    drained.map(async (item) => {
      const hit = await cacheGet(cacheKey(item.text, item.src, item.tgt));
      if (hit !== undefined) item.resolve(hit);
      else needsNetwork.push(item);
    }),
  );
  if (needsNetwork.length === 0) return;

  // Group by (src, tgt) — different language pairs can't share one API call.
  const groups = new Map<string, Pending[]>();
  for (const item of needsNetwork) {
    const k = `${item.src}|${item.tgt}`;
    const arr = groups.get(k);
    if (arr) arr.push(item);
    else groups.set(k, [item]);
  }

  emitStatus("loading");
  await Promise.all(
    Array.from(groups.values()).flatMap((items) => {
      // Chunk to respect BATCH_MAX — chunks for one pair run concurrently.
      const chunks: Pending[][] = [];
      for (let i = 0; i < items.length; i += BATCH_MAX) {
        chunks.push(items.slice(i, i + BATCH_MAX));
      }
      return chunks.map(translateChunk);
    }),
  );
  emitStatus("ready");
}

async function translateChunk(items: Pending[]) {
  if (items.length === 0) return;
  const { src, tgt } = items[0];
  const texts = items.map((i) => i.text);
  try {
    const { translations } = await api<{ translations: string[] }>(
      "/translate",
      {
        method: "POST",
        body: { texts, src, tgt },
      },
    );
    items.forEach((item, i) => {
      const out = translations[i] ?? item.text;
      void cacheSet(cacheKey(item.text, item.src, item.tgt), out);
      item.resolve(out);
    });
  } catch (err) {
    const e = err instanceof Error ? err : new Error(String(err));
    items.forEach((item) => item.reject(e));
  }
}

// --- Public API ---

export function translate(
  text: string,
  src: Locale,
  tgt: Locale,
): Promise<string> {
  if (!text || src === tgt) return Promise.resolve(text);
  // Queue synchronously — cache lookup happens inside flush() so the whole
  // call burst lands in one batch regardless of IDB timing.
  return new Promise<string>((resolve, reject) => {
    queue.push({ text, src, tgt, resolve, reject });
    scheduleFlush();
  });
}
