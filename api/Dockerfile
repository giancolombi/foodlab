# Build context: repo root (foodlab/). This Dockerfile copies api/, scripts/, and
# test-kitchen/recipes so the seed script can read the markdown catalog at runtime.
FROM node:24-alpine AS base
RUN apk add --no-cache python3 make g++ libc6-compat
RUN corepack enable && corepack prepare pnpm@10.23.0 --activate
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-lock.yaml* ./
RUN pnpm install --frozen-lockfile || pnpm install

FROM base AS runtime
COPY --from=deps /app/node_modules ./node_modules
COPY package.json tsconfig.json tsconfig.api.json ./
COPY api ./api
COPY scripts ./scripts
# Recipes markdown (readonly seed source)
COPY test-kitchen/recipes /recipes
ENV RECIPES_DIR=/recipes
ENV NODE_ENV=production
EXPOSE 3001
# migrate → seed → start
CMD ["pnpm", "start"]
