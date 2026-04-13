---
name: add-profile
description: Set up or edit a dietary profile for a family member
user_invocable: true
---

# Add/Edit Dietary Profile

Create or update a dietary profile for someone who eats these meals.

## Steps

1. Ask for the person's name (if not provided)
2. Check if `profiles/<name>.md` already exists — if so, read it and show current settings
3. Ask about:
   - **Restrictions**: What can't they eat? (vegetarian, no soy, no dairy, no gluten, no nuts, etc.)
   - **Preferences**: What do they love? (spicy food, specific cuisines, one-pot meals, etc.)
   - **Allergies**: Any hard allergies? (these are never included, even as optional)
   - **Notes**: Any substitution rules? (e.g., "use coconut aminos instead of soy sauce")
4. Write `profiles/<name>.md` following the format in `profiles/README.md`
5. Commit and push
6. Confirm: "Profile for [name] saved! Recipes will now accommodate their restrictions."
