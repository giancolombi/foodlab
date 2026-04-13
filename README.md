# FoodLab

Weekly meal prep recipes that adapt to everyone's dietary needs. Powered by AI agents that find new recipes, generate meal plans, and respond to your requests.

## Quick Start

```bash
git clone https://github.com/giancolombi/foodlab.git
cd foodlab
```

Then open your AI coding tool and type **"help"** to see everything you can do.

## Set Up Your Dietary Profiles

**First thing to do after cloning:** create a profile for each person eating these meals.

```bash
# Tell your agent:
"Add a profile for me — I'm vegetarian"
"Add a profile for Alex — no soy, no dairy, eats chicken and beef"
```

Or create files manually in `profiles/`:

```markdown
# Alex

## Restrictions
- No soy
- No dairy

## Preferences
- High protein
- Chicken, pork, and beef

## Allergies
(none)

## Notes
- Use coconut aminos instead of soy sauce
- Use olive oil instead of butter
```

The agent reads all profiles and generates a version of each recipe for every dietary group. See [`profiles/README.md`](profiles/README.md) for the full format.

## What You Can Ask

| Slash Command | Natural Language | What happens |
|--------------|-----------------|-------------|
| `/foodlab-help` | *"Help"* | Shows all available commands |
| `/add-profile` | *"Add a profile for me"* | Sets up dietary restrictions for a family member |
| `/find-recipe` | *"Find me a Thai curry recipe"* | Searches the web, writes a recipe for each dietary group |
| `/what-can-i-make` | *"I have chicken and sweet potatoes"* | Matches your ingredients against existing recipes |
| `/weekly-menu` | *"Generate a weekly menu"* | Picks 4 mains + 1 breakfast, creates prep guide + shopping list |
| `/whats-for-dinner` | *"What should I cook tonight?"* | Picks a recipe with full ingredients + method |
| `/rate` | *"Rate the moroccan tagine 5 stars"* | Adds your rating — future menus prioritize favorites |

You can use either the slash command or just ask naturally — the agent understands both.

## How It Works

- Each recipe has **one version per dietary group** in your household
- All versions share the same base (spices, veggies, sauce) — only restricted ingredients swap
- Recipes are high protein, freezer-friendly, and veggie-loaded
- An agent searches the web for new recipes every other day
- Ratings influence which recipes get picked for weekly menus

## Repo Structure

```
profiles/            Dietary profiles (one per person)
recipes/mains/       Full recipes (one version per dietary group)
recipes/breakfast/   Breakfast recipes
weeks/               Weekly menus + shopping lists
reviews/ratings.md   Rate recipes 1-5 stars
hooks/               Safety guards (block destructive commands, detect secrets, prevent injection)
AGENTS.md            Agent instructions (CLAUDE.md symlinks here)
```

## Safety Hooks

Agents run with [safety guards](hooks/README.md) inspired by [Sondera's Cedar policies](https://github.com/sondera-ai/sondera-coding-agent-hooks). These block destructive operations (force push, rm -rf, reset --hard), detect secrets in output, and prevent prompt injection — all without requiring Rust or external dependencies. See [`hooks/`](hooks/) for details.

## Rate a Recipe

Tell your agent *"Rate the moroccan tagine 5 stars — loved the flavors"* or edit [`reviews/ratings.md`](reviews/ratings.md) directly:

```
| moroccan-tagine | ★★★★★ | Gian | veg | Loved it, great flavors | 2026-04-10 |
```

## Setup

### Browser (No Install)

| Platform | How to use |
|----------|-----------|
| **Claude Code (Web)** | Go to [claude.ai/code](https://claude.ai/code), connect this repo, and use `/find-recipe`, `/weekly-menu`, etc. |
| **ChatGPT** | Upload `.chatgpt/skills/foodlab-meal-planner.json` via Profile > Skills > Upload. Then just ask for recipes. |
| **Homebase Web App** | Open the Meals tab > FoodLab — browse recipes, set dietary profiles, rate dishes, generate shopping lists. |
| **Browse directly** | Read recipes on [GitHub](https://github.com/giancolombi/foodlab/tree/main/recipes/mains) — no tools needed. |

### CLI / IDE

```bash
git clone https://github.com/giancolombi/foodlab.git
cd foodlab
```

| Tool | Command | Skills |
|------|---------|--------|
| **Claude Code** | `claude` | Auto-loaded from `.claude/skills/` — use `/find-recipe`, `/weekly-menu`, etc. |
| **Codex (OpenAI)** | `codex` | Reads `AGENTS.md` — ask naturally |
| **Gemini CLI** | `gemini` | Reads `AGENTS.md` — ask naturally |
| **Cursor** | Open folder | Reads `.cursor/settings.json` — ask naturally |
| **GitHub Copilot** | `gh copilot` | Reads `AGENTS.md` — ask naturally |
| **OpenClaw** | `openclaw` | Reads `AGENTS.md` — ask naturally |

### First thing to do after setup

Type `/add-profile` (or *"Add a profile for me"*) to set up your dietary restrictions. This personalizes every recipe to your needs.
