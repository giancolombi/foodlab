FROM ollama/ollama:latest

# Model to pre-pull on first start. Override with OLLAMA_MODEL env.
#
# Default is qwen3.6:27b — multilingual JSON, thinking-capable, ~17GB at q4.
# On smaller Railway plans (under ~24GB RAM) override to a lighter qwen3
# variant (e.g. qwen3:8b or qwen2.5:3b) via the service's OLLAMA_MODEL env.
ENV OLLAMA_MODEL=qwen3.6:27b

# Entrypoint: start ollama serve, wait for it, pull model, keep running.
# Build context: repo root (foodlab/).
# OLLAMA_HOST + bound port are set in entrypoint.sh from Railway's $PORT.
COPY ai/entrypoint.sh /usr/local/bin/ollama-entrypoint.sh
RUN chmod +x /usr/local/bin/ollama-entrypoint.sh

ENTRYPOINT ["/usr/local/bin/ollama-entrypoint.sh"]
