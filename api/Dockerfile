# Build context: repo root (foodlab/). This Dockerfile copies api/, scripts/, and
# test-kitchen/recipes so the seed script can read the markdown catalog at runtime.
FROM node:24-alpine AS base
# libc6-compat stays in base: prebuilt native modules (argon2, swc) need it at runtime.
RUN apk add --no-cache libc6-compat
RUN corepack enable && corepack prepare pnpm@10.23.0 --activate
WORKDIR /app

FROM base AS deps
# Compiler toolchain only where native modules are built — not in the runtime image.
RUN apk add --no-cache python3 make g++
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

FROM base AS runtime
COPY --from=deps --chown=node:node /app/node_modules ./node_modules
COPY --chown=node:node package.json tsconfig.json tsconfig.api.json ./
COPY --chown=node:node api ./api
COPY --chown=node:node scripts ./scripts
# Recipes markdown (readonly seed source)
COPY --chown=node:node test-kitchen/recipes /recipes
ENV RECIPES_DIR=/recipes
ENV NODE_ENV=production
USER node
EXPOSE 3001
# migrate → seed → start
CMD ["pnpm", "start"]
