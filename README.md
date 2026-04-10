# FoodLab

A living recipe repository for weekly meal prep. Two versions of every dish:
- **Vegetarian** — tofu, legumes, dairy OK
- **Meat** — chicken, pork, beef; **no soy, no dairy**

## How it works
- Every ~2 weeks, a new menu is generated: 4 mains + 1 breakfast
- Recipes are high protein, freezer-friendly, and veggie-loaded
- Each dish shares a common base — only the protein swaps between versions
- Menus mix new recipes with returning favorites

## Structure
```
recipes/
  mains/       # Individual recipe files
  breakfast/   # Breakfast recipes
weeks/         # Weekly menu plans
shopping-lists/ # Consolidated shopping lists per week
```

## Agent Instructions

See [AGENTS.md](AGENTS.md) for full instructions on how the automated recipe hunter works, dietary rules, and recipe file format. (`CLAUDE.md` is a symlink to the same file.)

## Dietary Rules
| | Vegetarian | Meat |
|---|---|---|
| Soy | OK | **NO** |
| Dairy | OK | **NO** |
| Soy sauce sub | — | Coconut aminos |
| Butter sub | — | Olive oil / coconut oil |
| Yogurt sub | — | Lemon + olive oil + herbs |
