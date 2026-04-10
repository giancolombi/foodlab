# FoodLab — Agent Instructions

## What This Repo Is
A living recipe repository for weekly meal prep. Agents search the web for new recipes, generate meal plans, and respond to user requests. Anyone can clone it and run their own agent.

## Dietary Rules (MUST follow for every recipe)

**Two versions of every dish:**

| | Vegetarian | Meat |
|---|---|---|
| Soy | OK | **NO** |
| Dairy | OK | **NO** |
| Tofu | OK | **NO** |
| Soy sauce | OK | Use **coconut aminos** |
| Butter | OK | Use **olive oil** or **coconut oil** |
| Yogurt/cream | OK | Use **lemon + olive oil + herbs** |
| Cheese | OK | **Skip entirely** |

**Meat options:** chicken, pork, or beef only.

Both versions MUST share the same base recipe (spices, veggies, sauce, cooking method). Only the protein swaps.

## Recipe Requirements
- **Simple recipes, simple ingredients** — if a home cook can't find it at a regular grocery store, don't use it. Avoid obscure or specialty ingredients unless they're central to the dish (e.g., gochujang for Korean, berbere for Ethiopian). When in doubt, suggest a common substitute.
- **Fewer steps, fewer pans** — one-pot, one-pan, and sheet-pan methods are preferred. If it can be done in one pot, don't use two.
- High protein
- Freezer-friendly
- Veggie-loaded (hide veggies in sauces and bases)
- Diverse global cuisines — avoid duplicating cuisines already in the repo
- Seasonal ingredients when possible

## Shopping List Rules
- **Consolidate ingredients across dishes** — if 3 dishes use onions, list "Yellow onions (5)" once, not 3 separate lines. Same for garlic, bell peppers, olive oil, canned tomatoes, broth, etc.
- **Group by grocery store section** so the user can shop aisle by aisle
- **Skip pantry staples** the user likely already has: salt, black pepper, olive oil. Still list spice blends and less common spices.
- **Use specific quantities** — "3 cans" not "some cans", "2 lbs" not "enough chicken"
- **Note which dish each specialty item is for** — but don't annotate common ingredients that appear in multiple dishes

---

## User Commands

Users can ask for any of the following. Match their intent and follow the corresponding workflow.

### "Help" / "How do I use this?" / "What can I do?"

When a user asks for help, show them this:

```
Welcome to FoodLab! Here's what you can ask me:

🔍 FIND RECIPES
   "Find me a Thai curry recipe"
   "I want something Korean"
   "Find a quick one-pan dinner"

🥕 COOK WITH WHAT YOU HAVE
   "I have chicken, sweet potatoes, and coconut milk — what can I make?"
   "What can I make with lentils and spinach?"

📋 MEAL PLANNING
   "Generate a weekly menu"
   "Give me a meal plan for this week"

🍽️ TONIGHT'S DINNER
   "What should I cook tonight?"
   "Give me a recipe for today"

⭐ RATE A RECIPE
   "Rate the moroccan tagine 5 stars — loved the flavors"
   "The bibimbap was just okay, 3 stars"

📖 BROWSE
   Check recipes/mains/ for all main dishes
   Check recipes/breakfast/ for breakfast options
   Check weeks/ for past meal plans + shopping lists
   Check reviews/ratings.md for ratings

Every recipe has two versions: vegetarian and meat (no soy, no dairy).
```

### "Find me a [type] recipe" / "I want something [cuisine/style]"

When a user requests a specific type of recipe:

1. Search the web for recipes matching their request (cuisine, style, ingredient focus, etc.)
2. Check `recipes/mains/` and `recipes/breakfast/` to avoid duplicates
3. Write the recipe file following the Recipe File Format below
4. Commit and push
5. Show the user the recipe summary — dish name, both versions, key ingredients

### "What can I make with [ingredients]?"

When a user tells you what ingredients they have:

1. Read all recipes in `recipes/mains/` and `recipes/breakfast/`
2. Find recipes where the user's ingredients cover most of the base (ignore pantry staples like oil, salt, garlic, onion, common spices)
3. Rank matches: best match = fewest missing ingredients
4. Show the user their top 3 matches with:
   - Recipe name and cuisine
   - Which of their ingredients it uses
   - What they're missing (if anything)
   - Quick summary of the method
5. If no good matches exist, search the web for a recipe that uses their ingredients, write it to the repo, and present it

### "Give me a weekly menu" / "Generate a meal plan"

When a user asks for a weekly meal plan:

1. Read all recipes in `recipes/mains/` and `recipes/breakfast/`
2. Read `reviews/ratings.md` for feedback
3. Read the most recent file in `weeks/` to avoid repeating the same lineup
4. Pick 4 mains + 1 breakfast:
   - Prioritize 4–5 star rated recipes as returning favorites
   - Avoid 1–2 star recipes unless modified
   - Include 1–2 unrated/new recipes for variety
   - Ensure variety in cuisines and cooking methods
5. Read each selected recipe file for exact ingredients
6. Generate `weeks/week-NN.md` in the Weekly Meal Plan Format below
7. Commit and push

### "Give me a recipe for today" / "What should I cook tonight?"

When a user asks for a single meal:

1. Read all recipes in `recipes/mains/`
2. Read `reviews/ratings.md` for feedback
3. Pick 1 recipe — favor highly rated ones, vary from recent suggestions
4. Present it in a condensed format:
   - Dish name and cuisine
   - **Ingredients** — full list with quantities (veg version + meat version diffs)
   - **Method** — condensed step-by-step
   - Prep and cook time

### "Rate [recipe]" / feedback on a dish

When a user gives feedback on a recipe:

1. Read `reviews/ratings.md`
2. Add their rating as a new row in the table: dish name (kebab-case filename without `.md`), star rating (★ characters), version (veg/meat), notes, and today's date
3. Commit and push

---

## Recipe File Format

- Location: `recipes/mains/` or `recipes/breakfast/`
- Filename: kebab-case (e.g., `west-african-peanut-stew.md`)
- Structure:
  1. Dish name as H1
  2. Metadata: Cuisine, Freezer-friendly status, Prep time, Cook time
  3. Shared base ingredients and spice mix
  4. Serving suggestions
  5. `---` separator
  6. **Vegetarian Version** — protein + full numbered instructions
  7. `---` separator
  8. **Meat Version (No Soy / No Dairy)** — protein + full numbered instructions
  9. `---` separator
  10. Source URLs at the bottom

---

## Weekly Meal Plan + Shopping List Format

Generate as a single file in `weeks/week-NN.md`. This is a **simplified, cook-friendly document** — not the full recipe files.

### Structure:

1. **Header** with week number, meal count, and dietary reminder
2. **Summary table** — all 5 meals with veg + meat protein columns
3. **Per-dish sections** (numbered, separated by `---`), each containing:
   - **Base:** All shared ingredients in one line (oil, aromatics, spices, broth, extras). Include specific quantities.
   - **Veg add:** Vegetarian protein/additions in one line
   - **Meat add:** Meat protein/additions in one line (no soy, no dairy)
   - **Method:** Condensed cooking instructions in 2-3 sentences. Include temps and times.
4. **Consolidated Shopping List** at the bottom, organized by:
   - Proteins (list each item with quantity and which dish it's for)
   - Canned beans
   - Produce
   - Pantry / Carbs
   - Canned / jarred
   - Dried fruit + nuts (if applicable)
   - Spices (note overlaps across dishes)
   - Other (wine, broth, cheese for veg only, etc.)
5. **Freezing note** at the very end

### Example:

```markdown
# Meal Prep List — Week N (Simplified)

5 meals — 4 mains (veg + meat versions) + 1 breakfast.
**Meat eater:** No soy, no dairy.

| # | Dish | Vegetarian | Meat |
|---|------|-----------|------|
| 1 | Dish Name | Veg protein | Meat protein |
| 2 | ... | ... | ... |

---

## 1. Dish Name

**Base:** olive oil, 1 onion, 3 garlic cloves, spices, 1½ cups broth, etc. Serve over rice.

**Veg add:** 1 can chickpeas, 1 sweet potato (cubed)
**Meat add:** 6 chicken thighs (sear first)

**Method:** Sear chicken if using. Sauté onion 10 min, add garlic + spices. Add broth + protein. Cover and simmer 30 min.

---

# Consolidated Shopping List

## Proteins
- Chicken thighs, bone-in (6) — Dish 1 (meat)

## Canned beans
- Chickpeas (1 can)

## Produce
- Yellow onions (3)

(continue all sections)

---

**Freezing:** Cool completely, freeze in portions, label with dates. All dishes keep 2–3 months.
```

### Key principles:
- Keep it **concise and actionable** — this is a prep-day reference, not a cookbook
- All quantities should be specific (not "some" or "to taste" — give actual amounts)
- Group the shopping list so you can shop section by section
- Note which dish each protein/specialty item is for
- Feta and other dairy items are veg-only — call this out in the shopping list

---

## Reviews & Ratings

User feedback lives in `reviews/ratings.md`. Anyone can add a row to rate a recipe 1–5 stars.

| Stars | Meaning |
|-------|---------|
| ★★★★★ | Amazing — make again soon |
| ★★★★☆ | Really good — keep in rotation |
| ★★★☆☆ | Fine — not a priority |
| ★★☆☆☆ | Meh — needs changes or skip |
| ★☆☆☆☆ | Bad — don't make again |

### How agents should use ratings:
- **When generating weekly menus:** Prioritize 4–5 star recipes as returning favorites. Avoid 1–2 star recipes unless modified. Unrated recipes are fair game.
- **When suggesting daily recipes:** Favor highly rated dishes.
- **When searching for new recipes:** If a dish was rated poorly with notes, look for alternatives that address the feedback.

---

## Automated Jobs

These run in the background when the agent session is active:

### Recipe Hunter (every other day)
1. Check existing recipes to avoid duplicates
2. Search the web for trending/seasonal recipes
3. Write 1-2 new recipes in the format above
4. Commit and push to main

### Meal Planner (1st and 15th of each month)
1. Read all available recipes and existing week plans
2. Read `reviews/ratings.md` to prioritize favorites and avoid poorly rated dishes
3. Pick 4 mains + 1 breakfast, mixing highly rated returning favorites with new/unrated recipes
4. Generate a weekly menu + consolidated shopping list in the format above
5. Commit and push to main
