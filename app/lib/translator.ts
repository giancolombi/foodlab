// Main-thread client for the translator Web Worker. Promise-based API over
// postMessage, with an IndexedDB cache so repeat translations are instant.

import type { Locale } from "@/i18n/strings";

type Pending = { resolve: (s: string) => void; reject: (e: Error) => void };
type WorkerMsg =
  | { id: number; translation: string }
  | { id: number; error: string }
  | { status: "loading" | "ready" };

let worker: Worker | null = null;
let nextId = 0;
const pending = new Map<number, Pending>();
const statusListeners = new Set<(s: "idle" | "loading" | "ready") => void>();
let currentStatus: "idle" | "loading" | "ready" = "idle";

function emitStatus(s: "idle" | "loading" | "ready") {
  currentStatus = s;
  statusListeners.forEach((fn) => fn(s));
}

function getWorker(): Worker {
  if (worker) return worker;
  worker = new Worker(
    new URL("../workers/translator.worker.ts", import.meta.url),
    { type: "module" },
  );
  worker.addEventListener("message", (e: MessageEvent<WorkerMsg>) => {
    if ("status" in e.data) {
      emitStatus(e.data.status);
      return;
    }
    const p = pending.get(e.data.id);
    if (!p) return;
    pending.delete(e.data.id);
    if ("error" in e.data) p.reject(new Error(e.data.error));
    else p.resolve(e.data.translation);
  });
  worker.addEventListener("error", (e) => {
    console.warn("[translator worker error]", e.message);
  });
  return worker;
}

export function webgpuAvailable(): boolean {
  return typeof navigator !== "undefined" && "gpu" in navigator;
}

export function onStatus(fn: (s: "idle" | "loading" | "ready") => void) {
  statusListeners.add(fn);
  fn(currentStatus);
  return () => statusListeners.delete(fn);
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

// --- Public API ---

export async function translate(
  text: string,
  src: Locale,
  tgt: Locale,
): Promise<string> {
  if (!text || src === tgt) return text;
  const key = cacheKey(text, src, tgt);
  const cached = await cacheGet(key);
  if (cached) return cached;

  const out = await new Promise<string>((resolve, reject) => {
    const id = nextId++;
    pending.set(id, { resolve, reject });
    getWorker().postMessage({ id, text, src, tgt });
  });
  void cacheSet(key, out);
  return out;
}
