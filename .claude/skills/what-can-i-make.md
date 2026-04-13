---
name: what-can-i-make
description: Tell me what ingredients you have and I'll find matching recipes
user_invocable: true
---

# What Can I Make

Match the user's available ingredients against the recipe collection.

## Steps

1. Ask the user: "What ingredients do you have?" (if not already provided)
2. Read all profiles in `profiles/` to filter out restricted ingredients
3. Read all recipes in `recipes/mains/` and `recipes/breakfast/`
4. For each recipe, compare the user's ingredients against the shared base (ignore pantry staples: oil, salt, garlic, onion, common spices)
5. Rank by match ratio: best = most ingredients matched, fewest missing
6. Show the top 3 matches:
   - Recipe name and cuisine
   - Which of their ingredients it uses
   - What they're missing (if anything)
   - Quick method summary
7. If no good matches, search the web for a recipe using their ingredients and add it to the repo
