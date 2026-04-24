# FoodLab

AI-powered meal planning that adapts to everyone's dietary needs. Find recipes, generate weekly menus with shopping lists, and match what's in your fridge to what you can cook.

## Get Started (Browser — No Install Needed)

### Claude.ai (any plan, including free)

Open a new chat, paste one prompt, and go. Full setup guides:

- [English](docs/setup-claude-chat-en.md)
- [Español (Latinoamérica)](docs/setup-claude-chat-es.md)
- [Português (Brasil)](docs/setup-claude-chat-pt-br.md)

**Paid plans (Pro/Max/Team)** get two better options:
- Upload [`foodlab-skill.zip`](https://raw.githubusercontent.com/giancolombi/foodlab/main/foodlab-skill.zip) in Settings > Features — skill loads automatically
- Use [claude.ai/code](https://claude.ai/code) — full slash commands (`/find-recipe`, `/weekly-menu`, etc.)

### ChatGPT (any plan, including free)

Open a new chat, paste one prompt, and go. Full setup guides:

- [English](docs/setup-chatgpt-en.md)
- [Español (Latinoamérica)](docs/setup-chatgpt-es.md)
- [Português (Brasil)](docs/setup-chatgpt-pt-br.md)

FoodLab reads recipes, profiles, and ratings directly from this GitHub repo — no install needed.

### Just Browse
Read recipes directly on GitHub: [`test-kitchen/recipes/mains/`](https://github.com/giancolombi/foodlab/tree/main/test-kitchen/recipes/mains)

---

## What You Can Ask

Just talk naturally — or use slash commands in Claude Code:

| What to say | What happens |
|------------|-------------|
| *"Find me a Thai curry recipe"* | Searches the web, creates a recipe for each person's diet |
| *"I have chicken and sweet potatoes — what can I make?"* | Matches your ingredients to existing recipes |
| *"Generate a weekly menu"* | Picks 4 mains + 1 breakfast with a shopping list |
| *"What should I cook tonight?"* | Picks a recipe with ingredients + method |
| *"I'm vegetarian, my partner can't eat soy or dairy"* | Sets up dietary profiles — every recipe adapts |
| *"Rate the moroccan tagine 5 stars"* | Saves your rating — future menus favor your favorites |

## How It Works

1. **Tell it who's eating** — each person gets a dietary profile (vegetarian, no dairy, gluten-free, etc.)
2. **Every recipe adapts** — one version per person, same base dish, only the protein and restricted ingredients change
3. **Recipes grow automatically** — an AI agent searches the web for new recipes and adds them
4. **Your ratings matter** — rate dishes 1-5 stars, and the meal planner learns what you like

All recipes are high protein, freezer-friendly, and veggie-loaded.

---

## For Developers

**[Developer Guide](docs/developer-guide.md)** — integrate FoodLab into your own apps. Includes parsing examples (JavaScript + Python), GitHub API usage, ingredient matching, writing back ratings/recipes, and a reference implementation.

<details>
<summary>CLI / IDE setup (click to expand)</summary>

```bash
git clone https://github.com/giancolombi/foodlab.git
cd foodlab
```

| Tool | Command | Skills |
|------|---------|--------|
| **Claude Code** | `claude` | Slash commands auto-loaded: `/find-recipe`, `/weekly-menu`, `/whats-for-dinner`, `/what-can-i-make`, `/rate`, `/add-profile` |
| **Codex (OpenAI)** | `codex` | Reads `AGENTS.md` — ask naturally |
| **Gemini CLI** | `gemini` | Reads `AGENTS.md` — ask naturally |
| **Cursor** | Open folder | Reads `.cursor/settings.json` |
| **GitHub Copilot** | `gh copilot` | Reads `AGENTS.md` |
| **OpenClaw** | `openclaw` | Reads `AGENTS.md` |

### Safety Hooks

Agents run with [safety guards](hooks/README.md) inspired by [Sondera's Cedar policies](https://github.com/sondera-ai/sondera-coding-agent-hooks). These block destructive operations (force push, rm -rf), detect secrets in output, and prevent prompt injection.

### Repo Structure

```
test-kitchen/
  profiles/            Dietary profiles (one per person)
  recipes/mains/       Full recipes (one version per dietary group)
  recipes/breakfast/   Breakfast recipes
  plans/               Weekly menus + shopping lists
  reviews/ratings.md   Rate recipes 1-5 stars
app/                   React frontend (Vite + React 19)
  design-system/       Shared UI tokens + compositions (import from @/design-system)
  components/ui/       shadcn-style primitives (button, card, badge, …)
  components/layout/   AppLayout, ProtectedRoute
  contexts/            Auth, Language, Plan (weekly slots), Cart (tick state)
  hooks/               Reusable hooks (useTranslatedRecipe, …)
  i18n/                Flat key dictionary (en / es / pt-BR)
  lib/                 api client, translator, shoppingList consolidator, dietaryTerms
  pages/               IngredientMatcher · Recipes · RecipeDetail · Plan · Cart · Profiles · SignIn / SignUp
  types/               Shared TS types
api/                   Express backend + Postgres
  routes/              Route modules (auth, profiles, recipes, plans, …)
  llm.ts               Ollama client + shopping-list consolidator
ai/                    Ollama container + entrypoint
scripts/               DB migrate + seed
hooks/                 Agent safety guards
.claude/skills/        Slash commands for Claude Code
.chatgpt/skills/       Skill manifest for ChatGPT
docs/                  Setup guides, developer guide, architecture notes
AGENTS.md              Agent instructions (CLAUDE.md symlinks here)
```

**Design system.** Anything that styles UI imports from `@/design-system` — never from `@/components/ui/*` directly. That single import surface re-exports primitives (Button, Card, Badge) plus higher-level compositions (PageHeader, SectionHeader, EmptyState, ProfileChip, LoadingRow) and exposes typed color / spacing tokens so a theme change in one place propagates everywhere.

**Plan vs Cart.** The web app splits scheduling from shopping:
- `/plan` is a 7-day × 3-meal grid (breakfast / lunch / dinner per day). Each slot holds one recipe.
- `/cart` is the consolidated shopping list derived from the current plan — with per-item checkboxes that survive reloads so you can tick as you shop.

### Automated Jobs

When running Claude Code locally, two cron jobs run in the background:
- **Recipe Hunter** (every other day) — searches the web for new recipes, commits them
- **Meal Planner** (1st and 15th) — generates a weekly menu + shopping list

</details>
