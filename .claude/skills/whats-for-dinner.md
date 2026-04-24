---
name: whats-for-dinner
description: Pick a recipe for tonight with full ingredients and method
user_invocable: true
---

# What's for Dinner

Pick a single recipe for tonight and present it ready to cook.

## Steps

1. Read all profiles in `test-kitchen/profiles/` for dietary restrictions
2. Read all recipes in `test-kitchen/recipes/mains/`
3. Read `test-kitchen/test-kitchen/reviews/ratings.md` for ratings
4. Pick 1 recipe — favor highly rated ones, vary from recent suggestions
5. Read the full recipe file
6. Present it in a condensed, cook-friendly format:
   - Dish name, cuisine, prep + cook time
   - **Ingredients** for each dietary group (with quantities)
   - **Method** — condensed step-by-step
   - Serving suggestions
