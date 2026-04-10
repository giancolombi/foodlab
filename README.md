# FoodLab

Weekly meal prep recipes with two versions of every dish: **vegetarian** and **meat** (no soy, no dairy). Powered by AI agents that find new recipes, generate meal plans, and respond to your requests.

## Quick Start

```bash
git clone https://github.com/giancolombi/foodlab.git
cd foodlab
```

Then open your AI coding tool of choice (see [Setup](#setup) below) and start asking:

## What You Can Ask

| Ask this | What happens |
|----------|-------------|
| *"Find me a Thai curry recipe"* | Searches the web, writes a new recipe with both versions, commits it |
| *"I have chicken, sweet potatoes, and coconut milk — what can I make?"* | Searches existing recipes for matches, suggests top 3 options |
| *"Generate a weekly menu"* | Picks 4 mains + 1 breakfast, creates a prep guide + shopping list |
| *"What should I cook tonight?"* | Picks a recipe and gives you ingredients + method |
| *"Rate the moroccan tagine 5 stars"* | Adds your rating to `reviews/ratings.md` — future menus prioritize your favorites |

## How It Works

- All recipes have two versions: **vegetarian** (tofu/legumes/dairy OK) and **meat** (no soy, no dairy)
- Both versions share the same base — only the protein swaps
- Recipes are high protein, freezer-friendly, and veggie-loaded
- The agent searches the web for new recipes and adds them to the repo
- When generating meal plans, it reads your ratings to prioritize favorites and skip duds

## Dietary Rules

| | Vegetarian | Meat |
|---|---|---|
| Soy / tofu | OK | **NO** — use coconut aminos |
| Dairy | OK | **NO** — use olive oil / coconut oil |
| Meats | — | Chicken, pork, or beef |

## Repo Structure

```
recipes/mains/       Full recipes (both versions)
recipes/breakfast/   Breakfast recipes
weeks/               Weekly menus + shopping lists
reviews/ratings.md   Rate recipes 1-5 stars
AGENTS.md            Agent instructions (CLAUDE.md symlinks here)
```

## Rate a Recipe

Tell your agent *"Rate the moroccan tagine 5 stars — loved the fig and apricot sweetness"* or edit [`reviews/ratings.md`](reviews/ratings.md) directly:

```
| moroccan-tagine | ★★★★★ | veg | Loved it, great flavors | 2026-04-10 |
```

## Setup

Clone the repo and use any AI coding tool. The agent reads `AGENTS.md` / `CLAUDE.md` for instructions automatically.

### Claude Code

```bash
cd foodlab && claude
# CLAUDE.md is read automatically — just start asking
```

### Codex (OpenAI)

```bash
cd foodlab && codex
# Ask: "Read AGENTS.md, then find me a new recipe"
```

### Gemini CLI (Google)

```bash
cd foodlab && gemini
# AGENTS.md is read automatically — just start asking
```

### OpenClaw

```bash
cd foodlab && openclaw
# Ask: "Read AGENTS.md, then find me a new recipe"
```

### No AI? No Problem

Just browse [`recipes/`](recipes/) for dishes and [`weeks/`](weeks/) for ready-made meal plans with shopping lists.
