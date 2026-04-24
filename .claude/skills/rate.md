---
name: rate
description: Rate a recipe 1-5 stars
user_invocable: true
---

# Rate a Recipe

Add a star rating and notes for a recipe.

## Steps

1. If the user didn't specify which recipe, list all recipes from `test-kitchen/recipes/mains/` and `test-kitchen/recipes/breakfast/` and ask them to pick one
2. If the user didn't specify a rating (1-5), ask for it
3. Read `test-kitchen/test-kitchen/reviews/ratings.md`
4. Add a new row to the ratings table:
   - Dish: recipe slug (filename without `.md`)
   - Rating: star characters (★ for filled, ☆ for empty, 5 total)
   - Person: user's name (ask if not known)
   - Version: which dietary version they ate
   - Notes: what they liked/disliked (ask if not provided)
   - Date: today's date (YYYY-MM-DD)
5. Commit and push
6. Confirm: "Rated [recipe] [stars] — noted!"
