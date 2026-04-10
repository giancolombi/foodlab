# FoodLab

Weekly meal prep recipes with two versions of every dish: **vegetarian** and **meat** (no soy, no dairy).

## Quick Start

1. **Browse recipes** in [`recipes/mains/`](recipes/mains/) and [`recipes/breakfast/`](recipes/breakfast/)
2. **Grab a weekly menu** from [`weeks/`](weeks/) — includes simplified recipes + a consolidated shopping list
3. **Cook** — each dish has a shared base, you just swap the protein between veg and meat

## How It Works

- A recipe-hunting agent runs every other day, searching the web for new recipes and adding them here
- Every ~2 weeks, a new weekly menu is generated: **4 mains + 1 breakfast**
- All recipes are high protein, freezer-friendly, and veggie-loaded
- New menus mix returning favorites with new discoveries

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
AGENTS.md            Agent instructions (CLAUDE.md symlinks here)
```

## Running the Agents

Clone the repo and use any AI coding tool to automate recipe hunting and meal planning. The instructions live in `AGENTS.md` (also symlinked as `CLAUDE.md`).

### Claude Code

```bash
git clone https://github.com/giancolombi/foodlab.git
cd foodlab
claude
# Claude reads CLAUDE.md automatically on startup
# Ask: "Search for new recipes and add them to the repo"
# Ask: "Generate a new weekly menu + shopping list"
```

### Codex (OpenAI)

```bash
git clone https://github.com/giancolombi/foodlab.git
cd foodlab
codex
# Point it at AGENTS.md for instructions:
# Ask: "Read AGENTS.md, then search for new recipes and add them following those instructions"
```

### Gemini CLI (Google)

```bash
git clone https://github.com/giancolombi/foodlab.git
cd foodlab
gemini
# Gemini reads AGENTS.md when present
# Ask: "Search for new recipes and add them to the repo"
# Ask: "Generate a new weekly menu + shopping list"
```

### OpenClaw

```bash
git clone https://github.com/giancolombi/foodlab.git
cd foodlab
openclaw
# Ask: "Read AGENTS.md for instructions, then search for new recipes and add them to the repo"
```

### Manual Use

No AI tools needed — just browse `recipes/` for dishes and `weeks/` for ready-made meal plans with shopping lists.

## Want a New Week?

Ask your AI coding tool: *"Generate a new weekly menu from the recipe collection"* — it'll read `AGENTS.md`, pick 4 mains + 1 breakfast, write a simplified prep guide, and create a consolidated shopping list.
