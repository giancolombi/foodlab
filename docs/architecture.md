# FoodLab Architecture

A reference for anyone touching the web app — human or agent.

## Two Surfaces, One Data Model

FoodLab has two independent interaction surfaces that share the same data:

1. **Markdown + agent chat** — `test-kitchen/` holds the source-of-truth
   recipe files, dietary profiles, weekly plans, and ratings. All agent
   workflows (`AGENTS.md`) read and write these files. No running process
   required.
2. **Self-hosted web app** — `app/` (React) + `api/` (Express + Postgres) +
   `ai/` (Ollama). It reads the same recipe files during seed/migration and
   exposes them through a REST API with streaming LLM endpoints.

If you're only running a meal-planning agent, you don't need the web app. If
you're running the web app, the markdown still works — it's just rendered
and interactive.

## Web App Layout

```
app/
  design-system/          Single import surface for all UI (see below)
  components/ui/          Low-level primitives (button, card, badge, …)
  components/layout/      AppLayout (header + nav), ProtectedRoute
  components/AddToPlanButton.tsx   Slot-picker popover
  components/RecipeModifyPanel.tsx LLM streaming "customize" panel
  contexts/               AuthContext, LanguageContext, PlanContext, CartContext
  hooks/                  Reusable hooks (useTranslatedRecipe, …)
  i18n/strings.ts         Flat key dictionary across en / es / pt-BR
  lib/
    api.ts                Typed fetch wrapper
    translator.ts         Batched IndexedDB-cached translation queue
    shoppingList.ts       Deterministic client-side consolidator
    dietaryTerms.ts       Multilingual dietary vocabulary
  pages/                  One file per top-level route
  types/                  Shared TypeScript types
api/
  index.ts                Express app wiring + middleware
  routes/                 One file per REST resource
  llm.ts                  Ollama client + LLM-backed consolidation
  db.ts                   pg pool
  schema.sql              Postgres schema
ai/
  Dockerfile              Ollama image
  ollama-entrypoint.sh    Model warmup loop
scripts/                  Migrate + seed runners
hooks/                    Shared agent-safety guards (used by all 6 agents)
```

## The Design System (`app/design-system/`)

**Rule:** every component that styles UI imports from `@/design-system`,
not from `@/components/ui/*` directly. That one import surface exposes:

- **Tokens** (`tokens.ts`) — semantic color roles (`BRAND.action`,
  `BRAND.soft`), container widths (`CONTAINER.prose`, `CONTAINER.wide`),
  standard page padding.
- **Compositions** (`components/*`) — opinionated patterns:
  - `PageHeader` — h1 + subtitle + right-aligned action slot
  - `SectionHeader` — h2 for in-page sections
  - `EmptyState` — dashed-border callout for empty lists
  - `ProfileChip` — toggle pill for profile selection
  - `LoadingRow` — spinner + label
- **Primitives** (re-exported) — `Button`, `Card`, `Badge`, `Input`, `Label`,
  `Textarea`, `Spinner`.

This keeps every page visually consistent and lets us swap the underlying
primitives (or theme tokens) without hunting through every feature file.

Color tokens live as CSS variables in `app/index.css` under `:root` /
`.dark` so theme swapping is a runtime CSS change, not a TS rebuild.

## Plan vs Cart

The app deliberately splits *what to eat* from *what to shop for*:

- **`/plan`** — 7-day × 3-meal grid (breakfast / lunch / dinner per day).
  State is `assignments: Record<"day-meal", { slug, assignedAt }>` in
  `PlanContext`. Mobile collapses the 7-column grid into per-day cards.
- **`/cart`** — consolidated shopping list derived from the plan's
  recipes + the profiles you're shopping for. Each line item has a
  checkbox; ticks persist in `localStorage` via `CartContext` so the
  list survives reloads while you shop.

The derivation is pure:
`plan recipes × active profiles → shoppingList.consolidate() →
ConsolidatedList (sections × items)`. The Cart page can optionally
upgrade this via a POST to `/api/plans/shopping-list` that runs the same
logic through Ollama for fuzzier de-duplication.

## Per-profile Version Selection

Every recipe ships with one `RecipeVersion` per dietary group (e.g. "With
feta", "Vegan"). When the user picks which profiles are eating, we fuzzy-
match each profile's `restrictions + allergies` against each version's
`group_label`/`name` to pick the right one. The matcher lives in
`lib/shoppingList.ts#pickVersion` and returns `{ version, matched }` — if
nothing matches, the UI shows a red "no matching version" badge and the
shopping list *excludes* that protein, never silently substituting.

Multilingual dietary terms ("vegetariano", "sem lácteos") are canonicalized
via `lib/dietaryTerms.ts` so a Spanish/Portuguese profile still matches
English version labels in the recipe files.

## i18n

- English is the base dictionary in `app/i18n/strings.ts`.
- Other locales are `Partial<Record<StringKey, string>>` — missing keys
  fall back to English so new strings never break a locale.
- Recipe content (titles, ingredients, instructions) is translated on
  demand via the LLM through `lib/translator.ts`. Translations are cached
  in IndexedDB and calls are batched in microtasks so a page render that
  needs 40 strings dispatches one request, not 40.

## Routing + Auth

- `AuthProvider` → `PlanProvider` → `CartProvider` wrap the router.
- `ProtectedRoute` gates everything behind a signed-in `AuthContext.user`;
  unauthenticated users land on `/signin`.
- Routes:
  - `/` — IngredientMatcher (what can I make?)
  - `/recipes` — catalog
  - `/recipes/:slug` — detail + modify panel
  - `/plan` — weekly grid
  - `/cart` — shopping list
  - `/profiles` — dietary profile CRUD

## Deployment

- `docker-compose.yml` runs app / api / db / ai locally.
- Railway: three services, each with its own `railway.*.json` at repo
  root pointing at `app/Dockerfile`, `api/Dockerfile`, `ai/Dockerfile`.
  Build context is the repo root so shared files (tsconfig, package.json)
  resolve correctly.

## Where Things Should Go

When adding a feature, use this decision tree:

| Adding…                                  | Put it in…                        |
| ---------------------------------------- | --------------------------------- |
| A new page route                         | `app/pages/`                      |
| A cross-page UI pattern                  | `app/design-system/components/`   |
| A shadcn-style primitive                 | `app/components/ui/`              |
| Feature-specific component               | `app/components/`                 |
| Cross-cutting browser state              | `app/contexts/`                   |
| Derived read hook                        | `app/hooks/`                      |
| Pure domain logic (no React)             | `app/lib/`                        |
| Backend route                            | `api/routes/`                     |
| Prompt / LLM utility                     | `api/llm.ts`                      |
| DB migration                             | `api/schema.sql` + `scripts/`     |
| Agent workflow change                    | `AGENTS.md`                       |

If a new pattern shows up in two pages, lift it into the design system
before it drifts into three different implementations.
