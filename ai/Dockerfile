FROM ollama/ollama:latest

# Model to pre-pull on first start. Override with OLLAMA_MODEL env.
ENV OLLAMA_MODEL=qwen2.5:3b

# Entrypoint: start ollama serve, wait for it, pull model, keep running.
# Build context: repo root (foodlab/).
COPY ai/entrypoint.sh /usr/local/bin/ollama-entrypoint.sh
RUN chmod +x /usr/local/bin/ollama-entrypoint.sh

ENTRYPOINT ["/usr/local/bin/ollama-entrypoint.sh"]
