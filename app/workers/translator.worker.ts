/// <reference lib="webworker" />
// Web Worker: loads NLLB-200-distilled-600M via Transformers.js and answers
// translation requests over postMessage. Runs off the main thread so the UI
// stays responsive during the (~600 MB) initial model download and inference.
//
// Message protocol:
//   in:  { id, text, src, tgt }
//   out: { id, translation } | { id, error } | { status: "loading" | "ready" }

import { pipeline, env } from "@huggingface/transformers";

// Serve models from the HuggingFace CDN (default) and cache them in the
// browser's IndexedDB. No local model bundle needed.
env.allowLocalModels = false;
env.useBrowserCache = true;

const NLLB_LANG: Record<string, string> = {
  en: "eng_Latn",
  es: "spa_Latn",
  "pt-BR": "por_Latn",
};

// The transformers.js pipeline type graph is enormous and blows up TS's
// inference ("union too complex"). We treat the translator as opaque here —
// type narrowing happens at the message boundary.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let instance: any = null;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let loading: Promise<any> | null = null;

async function getPipeline() {
  if (instance) return instance;
  if (loading) return loading;
  postMessage({ status: "loading" });
  loading = pipeline("translation", "Xenova/nllb-200-distilled-600M", {
    // WebGPU when available; transformers.js falls back to WASM automatically.
    device: "webgpu",
  });
  instance = await loading;
  postMessage({ status: "ready" });
  return instance;
}

type Request = { id: number; text: string; src: string; tgt: string };

self.addEventListener("message", async (e: MessageEvent<Request>) => {
  const { id, text, src, tgt } = e.data;
  try {
    const t = await getPipeline();
    const result = await t(text, {
      src_lang: NLLB_LANG[src] ?? "eng_Latn",
      tgt_lang: NLLB_LANG[tgt] ?? "eng_Latn",
    });
    const translation = Array.isArray(result)
      ? (result[0] as { translation_text: string }).translation_text
      : (result as { translation_text: string }).translation_text;
    postMessage({ id, translation });
  } catch (err) {
    postMessage({ id, error: err instanceof Error ? err.message : String(err) });
  }
});

export {};
