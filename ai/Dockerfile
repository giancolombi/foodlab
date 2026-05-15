FROM ollama/ollama:latest

# Model to pre-pull on first start. Override with OLLAMA_MODEL env.
#
# Default is qwen3.5:4b — multilingual JSON, thinking-capable, ~3.4GB on disk,
# fits a small Railway volume + 7.5GB-RAM dyno. The entrypoint removes any
# other model on boot, so a model swap never needs double the disk.
ENV OLLAMA_MODEL=qwen3.5:4b

# Entrypoint: start ollama serve, wait for it, pull model, keep running.
# Build context: repo root (foodlab/).
# OLLAMA_HOST + bound port are set in entrypoint.sh from Railway's $PORT.
COPY ai/entrypoint.sh /usr/local/bin/ollama-entrypoint.sh
RUN chmod +x /usr/local/bin/ollama-entrypoint.sh

ENTRYPOINT ["/usr/local/bin/ollama-entrypoint.sh"]
