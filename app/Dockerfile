# Build context: repo root (foodlab/).
FROM node:24-alpine AS builder
RUN corepack enable && corepack prepare pnpm@10.23.0 --activate
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
COPY vite.config.ts tsconfig.json tsconfig.app.json tsconfig.api.json tsconfig.node.json tsconfig.e2e.json index.html postcss.config.js components.json vite-env.d.ts ./
COPY app ./app
COPY public ./public
RUN pnpm build

FROM nginx:1.27-alpine AS runtime
COPY --from=builder /app/dist /usr/share/nginx/html
COPY app/nginx.conf /etc/nginx/conf.d/default.conf
# Renders the resolver + API upstream into nginx.conf, then execs nginx —
# so a bare `docker run` works without compose/Railway command overrides.
COPY app/docker-entrypoint.sh /usr/local/bin/app-entrypoint.sh
RUN chmod +x /usr/local/bin/app-entrypoint.sh
ENV API_UPSTREAM=http://api:3001
EXPOSE 8080
CMD ["/usr/local/bin/app-entrypoint.sh"]
