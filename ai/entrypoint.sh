#!/bin/sh
set -e

MODEL="${OLLAMA_MODEL:-qwen3.5:4b}"
# Railway assigns $PORT dynamically; bind Ollama to that so the platform
# healthcheck reaches the server. Fall back to 11434 for local dev.
OLLAMA_PORT="${PORT:-11434}"
export OLLAMA_HOST="0.0.0.0:${OLLAMA_PORT}"

# An aborted model pull leaves multi-GB "-partial" blobs that Ollama never
# garbage-collects. On a small volume they accumulate until the next pull
# dies with "no space left on device". Clear them before anything else.
echo "[ollama-entrypoint] clearing stale partial blobs…"
rm -f /root/.ollama/models/blobs/*-partial* 2>/dev/null || true

# Launch the ollama server in the background.
ollama serve &
SERVER_PID=$!

# Wait for the API to come up.
echo "[ollama-entrypoint] waiting for ollama server…"
for i in $(seq 1 60); do
  if curl -sf "http://127.0.0.1:${OLLAMA_PORT}/api/tags" >/dev/null 2>&1; then
    break
  fi
  sleep 1
done

# Drop any model that isn't the one we want, so swapping OLLAMA_MODEL never
# needs the volume to hold the old and new model at the same time.
for m in $(ollama list 2>/dev/null | awk 'NR>1 {print $1}'); do
  if [ -n "$m" ] && [ "$m" != "${MODEL}" ]; then
    echo "[ollama-entrypoint] removing stale model ${m}"
    ollama rm "$m" || true
  fi
done

# Pull the model if we don't already have it.
if ! ollama list | awk '{print $1}' | grep -q "^${MODEL}$"; then
  echo "[ollama-entrypoint] pulling ${MODEL} (this may take a while on first boot)"
  ollama pull "${MODEL}"
else
  echo "[ollama-entrypoint] ${MODEL} already present"
fi

# Hand control back to the server process.
wait $SERVER_PID
