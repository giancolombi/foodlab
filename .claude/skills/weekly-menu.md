---
name: weekly-menu
description: Generate a weekly meal plan with 4 mains + 1 breakfast and a consolidated shopping list
user_invocable: true
---

# Weekly Menu

Generate a complete weekly meal plan with recipes and a shopping list.

## Steps

1. Read all profiles in `profiles/` for dietary restrictions
2. Read all recipes in `recipes/mains/` and `recipes/breakfast/`
3. Read `reviews/ratings.md` for feedback
4. Read the most recent file in `weeks/` to avoid repeating the same lineup
5. Pick 4 mains + 1 breakfast:
   - Prioritize 4-5 star rated recipes as returning favorites
   - Avoid 1-2 star recipes unless modified
   - Include 1-2 unrated/new recipes for variety
   - Ensure variety in cuisines and cooking methods
   - Favor preferences listed in profiles
6. Read each selected recipe file for exact ingredients
7. Generate `weeks/week-NN.md` following the simplified format in AGENTS.md:
   - Summary table with one column per dietary group
   - Per-dish sections: Base / [Group] add / Method
   - Consolidated shopping list (ingredients merged across dishes, grouped by store section)
   - Freezing note
8. Commit and push
9. Show the user the menu summary
