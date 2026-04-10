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

## Want a New Week?

Ask Claude: *"Generate a new weekly menu from the recipe collection"* — it'll pick 4 mains + 1 breakfast, write a simplified prep guide, and create a shopping list.
