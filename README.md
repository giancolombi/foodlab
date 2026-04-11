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

| Ask this | What happens |
|----------|-------------|
| *"Help"* | Shows all available commands |
| *"Add a profile for me"* | Sets up your dietary restrictions |
| *"Find me a Thai curry recipe"* | Searches the web, writes a recipe with versions for each person |
| *"I have chicken and sweet potatoes — what can I make?"* | Matches your ingredients against existing recipes |
| *"Generate a weekly menu"* | Picks 4 mains + 1 breakfast, creates a prep guide + shopping list |
| *"What should I cook tonight?"* | Picks a recipe and shows ingredients + method for your group |
| *"Rate the moroccan tagine 5 stars"* | Adds your rating — future menus prioritize favorites |

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
AGENTS.md            Agent instructions (CLAUDE.md symlinks here)
```

## Rate a Recipe

Tell your agent *"Rate the moroccan tagine 5 stars — loved the flavors"* or edit [`reviews/ratings.md`](reviews/ratings.md) directly:

```
| moroccan-tagine | ★★★★★ | Gian | veg | Loved it, great flavors | 2026-04-10 |
```

## Setup

Clone the repo and use any AI coding tool. The agent reads `AGENTS.md` / `CLAUDE.md` for instructions automatically.

### Claude Code

```bash
cd foodlab && claude
# CLAUDE.md is read automatically — just start asking
# First: "Add a profile for me"
```

### Codex (OpenAI)

```bash
cd foodlab && codex
# Ask: "Read AGENTS.md, then add a profile for me"
```

### Gemini CLI (Google)

```bash
cd foodlab && gemini
# AGENTS.md is read automatically
# First: "Add a profile for me"
```

### OpenClaw

```bash
cd foodlab && openclaw
# Ask: "Read AGENTS.md, then add a profile for me"
```

### No AI? No Problem

Browse [`recipes/`](recipes/) for dishes, [`weeks/`](weeks/) for meal plans with shopping lists, and create your profile manually in [`profiles/`](profiles/).
