#!/bin/sh
set -e

MODEL="${OLLAMA_MODEL:-qwen2.5:3b}"

# Launch the ollama server in the background.
ollama serve &
SERVER_PID=$!

# Wait for the API to come up.
echo "[ollama-entrypoint] waiting for ollama server…"
for i in $(seq 1 60); do
  if curl -sf http://127.0.0.1:11434/api/tags >/dev/null 2>&1; then
    break
  fi
  sleep 1
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
