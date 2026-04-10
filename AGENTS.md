# FoodLab — Claude Instructions

## What This Repo Is
A living recipe repository for weekly meal prep. An automated agent searches the web for new recipes every other day and commits them here.

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
- High protein
- Freezer-friendly
- Veggie-loaded (hide veggies in sauces and bases)
- Diverse global cuisines — avoid duplicating cuisines already in the repo
- Seasonal ingredients when possible

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

## Weekly Meal Plan + Shopping List Format

Every ~2 weeks, generate a combined meal plan and shopping list as a single file in `weeks/week-NN.md`. The format is a **simplified, cook-friendly document** — not the full recipe files (those live in `recipes/`). Pick 4 mains + 1 breakfast from the recipe collection, mixing returning favorites with new additions.

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

## 2. ...

---

# Consolidated Shopping List

## Proteins
- Chicken thighs, bone-in (6) — Dish 1 (meat)
- ...

## Canned beans
- Chickpeas (1 can)
- ...

## Produce
- Yellow onions (3)
- ...

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

## Automated Recipe Hunter
A local cron job runs every other day to:
1. Check existing recipes to avoid duplicates
2. Search the web for trending/seasonal recipes
3. Write 1-2 new recipes in the format above
4. Commit and push to main
