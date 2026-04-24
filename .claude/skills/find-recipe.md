---
name: find-recipe
description: Search the web for a new recipe and add it to the FoodLab collection
user_invocable: true
---

# Find Recipe

Search the web for a new recipe matching the user's request and add it to the repo.

## Steps

1. Read all profiles in `test-kitchen/profiles/` for dietary restrictions
2. Read `ls test-kitchen/recipes/mains/ test-kitchen/recipes/breakfast/` to check what already exists
3. Search the web for recipes matching the user's request (cuisine, style, ingredient focus)
4. Write the recipe file in `test-kitchen/recipes/mains/` (or `test-kitchen/recipes/breakfast/`) with one version per dietary group, following the format in AGENTS.md
5. Commit and push
6. Show the user a summary: dish name, cuisine, versions, key ingredients

If the user didn't specify what kind of recipe, ask them: "What are you in the mood for? A cuisine, a style (one-pot, sheet-pan), or a specific ingredient?"
