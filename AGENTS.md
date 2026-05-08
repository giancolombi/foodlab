# FoodLab — Agent Instructions

## What This Repo Is
A living recipe repository for weekly meal prep. Agents search the web for new recipes, generate meal plans, and respond to user requests. Anyone can clone it, set up their dietary profiles, and run their own agent.

There are two interaction surfaces:
- **Markdown + agent chat** — the recipes, profiles, plans, and ratings that live under `test-kitchen/` are the source of truth. All agent workflows below read and write these files.
- **Web app** (`app/` + `api/` + `ai/`) — an optional self-hosted UI that consumes the same data model via Postgres + a small Express API. It separates scheduling (`/plan` — a 7-day × 3-meal grid) from shopping (`/cart` — consolidated tickable list derived from the plan). If you're editing the web app, import UI from `@/design-system` (tokens + shared compositions) rather than `@/components/ui/*`.

## Language Support

**Always respond in the language the user writes in.** Detect their language and respond entirely in it — recipe names, ingredients, instructions, shopping lists, everything.

Supported languages and file suffixes:
- **English** — `.en.md` — canonical version, always required
- **Spanish (`es`)** — `.es.md` — Latin American variants (Cuban, Peruvian, Colombian, Dominican, Venezuelan, Mexican). Use "frijoles", "aguacate", "taza", "cucharada", "cucharadita".
- **Brazilian Portuguese (`pt`)** — `.pt.md` — Use "xícara", "colher de sopa", "colher de chá", "feijão", "abacate", "mandioca", "geladeira".

**Recipes are stored pre-translated in all three languages, not translated at runtime** — runtime translation drifts on measurements and ingredient names and breaks the dish. Each recipe lives as three files sharing the same kebab-case slug: `west-african-peanut-stew.en.md`, `.es.md`, `.pt.md`.

When you create or modify a recipe, **always write all three language files in the same commit**. The English version is canonical; the others are translations that preserve the structure (metadata block, shared base, version splits, numbered steps, source URLs) and only swap the human-readable text. Numeric quantities and units stay the same — translate only the words around them ("1 cup onion" → "1 taza de cebolla" / "1 xícara de cebola"). Slug stays identical across languages.

When reading recipes (matcher, planner, "what's tonight"), prefer the file in the user's language and fall back to `.en.md` if the translation hasn't been written yet — and write the missing translation as part of completing the task.

Plans, shopping lists, and ratings notes are written directly in the user's language at creation time — there is no separate translation pass.

## Communication Style

**Adapt to how the user communicates.** Match their formality, detail level, tone, and cooking experience. If they're casual, be casual. If they use regional dialect ("habichuelas" instead of "frijoles"), match it. If they correct you or rephrase, adapt going forward. Learn from each interaction to feel natural, not robotic.

## Dietary Profiles

**Before generating any recipe or meal plan, ALWAYS read all files in `test-kitchen/profiles/`.**

Each person who eats these meals has their own profile in `test-kitchen/profiles/<name>.md` defining their restrictions, preferences, allergies, and substitution notes. See `test-kitchen/profiles/README.md` for the format.

### How to use profiles:

1. **Read all profiles** at the start of every task
2. **Group people by dietary compatibility** — if two people share the same restrictions, they share one recipe version
3. **Generate one version per unique dietary group** — label each version with the name(s) it's for
4. **Shared base stays the same** across all versions — only swap proteins and restricted ingredients
5. **Never include allergens** even as optional ingredients
6. **Apply substitution rules** from each profile's Notes section (e.g., "coconut aminos instead of soy sauce")
7. **Favor preferences** when searching for new recipes or picking weekly menus

### If no profiles exist:
Generate a single version of each recipe with no dietary restrictions. Prompt the user to create profiles: *"Create a file in profiles/ for each person — see profiles/README.md for the format."*

### Setting up / editing profiles:

When a user says "add a profile", "set up dietary restrictions", "I'm vegetarian", "my partner can't eat dairy", etc.:

1. Create or update the appropriate file in `test-kitchen/profiles/<name>.md`
2. Follow the format in `test-kitchen/profiles/README.md`
3. Commit and push
4. Confirm what was saved

## Recipe Requirements
- **Simple recipes, simple ingredients** — if a home cook can't find it at a regular grocery store, don't use it. Avoid obscure or specialty ingredients unless they're central to the dish (e.g., gochujang for Korean, berbere for Ethiopian). When in doubt, suggest a common substitute.
- **Fewer steps, fewer pans** — one-pot, one-pan, and sheet-pan methods are preferred. If it can be done in one pot, don't use two.
- High protein
- Freezer-friendly
- Veggie-loaded (hide veggies in sauces and bases)
- Diverse global cuisines — avoid duplicating cuisines already in the repo
- Seasonal ingredients when possible

## Shopping List Rules
- **Consolidate ingredients across dishes** — if 3 dishes use onions, list "Yellow onions (5)" once, not 3 separate lines
- **Group by grocery store section** so the user can shop aisle by aisle
- **Skip pantry staples** the user likely already has: salt, black pepper, olive oil
- **Use specific quantities** — "3 cans" not "some cans", "2 lbs" not "enough chicken"
- **Note which dish each specialty item is for** — but don't annotate common ingredients
- **Separate version-specific items** — clearly mark which items are for which dietary group (e.g., "Feta — Version 1 only", "Chicken thighs — Version 2 only")

---

## User Commands

Users can ask for any of the following. Match their intent and follow the corresponding workflow.

### "Help" / "How do I use this?" / "What can I do?"

When a user asks for help, show them this:

```
Welcome to FoodLab! Here's what you can ask me:

👤 SET UP PROFILES
   "Add a profile for me — I'm vegetarian"
   "My partner can't eat soy or dairy"
   "Show me the current dietary profiles"

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
   "Rate the moroccan tagine 5 stars"
   "The bibimbap was just okay, 3 stars"

📖 BROWSE
   Check test-kitchen/recipes/mains/ and test-kitchen/recipes/breakfast/ for dishes
   (each dish has .en.md / .es.md / .pt.md — same slug, three languages)
   Check test-kitchen/plans/ for past meal plans + shopping lists
   Check test-kitchen/reviews/ratings.md for ratings
   Check test-kitchen/profiles/ for dietary profiles

Each recipe has a version for every dietary group in your household, pre-translated into English, Spanish, and Portuguese.
```

### "Add a profile" / "I'm vegetarian" / "My partner can't eat X"

When a user wants to set up or modify dietary profiles:

1. Ask for the person's name if not provided
2. Ask about restrictions, preferences, allergies, and substitution notes
3. Create or update `test-kitchen/profiles/<name>.md` following the format in `test-kitchen/profiles/README.md`
4. Commit and push
5. Confirm what was saved and how it will affect recipes

### "Find me a [type] recipe" / "I want something [cuisine/style]"

When a user requests a specific type of recipe:

1. **Read all profiles in `test-kitchen/profiles/`**
2. Search the web for recipes matching their request
3. Check `test-kitchen/recipes/mains/` and `test-kitchen/recipes/breakfast/` to avoid duplicates (slug exists in any language counts as a duplicate)
4. Write **three** recipe files — `<slug>.en.md`, `<slug>.es.md`, `<slug>.pt.md` — each with one version per dietary group, following the Recipe File Format below
5. Commit and push (all three in the same commit)
6. Show the user the recipe summary in their language — dish name, all versions, key ingredients

### "What can I make with [ingredients]?"

When a user tells you what ingredients they have:

1. Read recipes in `test-kitchen/recipes/mains/` and `test-kitchen/recipes/breakfast/` — pick the file in the user's language (`.en.md` / `.es.md` / `.pt.md`), falling back to `.en.md` when a translation is missing
2. **Read all profiles in `test-kitchen/profiles/`** to filter out recipes with restricted ingredients
3. Find recipes where the user's ingredients cover most of the base
4. Rank matches: best match = fewest missing ingredients
5. Show top 3 matches with: recipe name, cuisine, matched/missing ingredients, quick method
6. If no good matches, search the web for a recipe using their ingredients (and write it in all three languages)

### "Give me a weekly menu" / "Generate a meal plan"

When a user asks for a weekly meal plan:

1. **Read all profiles in `test-kitchen/profiles/`**
2. Read all recipes in `test-kitchen/recipes/mains/` and `test-kitchen/recipes/breakfast/`
3. Read `test-kitchen/reviews/ratings.md` for feedback
4. Read the most recent file in `test-kitchen/plans/` to avoid repeating
5. Pick 4 mains + 1 breakfast:
   - Prioritize 4–5 star rated recipes
   - Avoid 1–2 star recipes unless modified
   - Include 1–2 unrated/new recipes
   - Ensure variety in cuisines and cooking methods
   - Favor preferences listed in profiles
6. Generate `test-kitchen/plans/week-NN.md` in the Weekly Meal Plan Format below, with columns for each dietary group
7. Commit and push

### "Give me a recipe for today" / "What should I cook tonight?"

When a user asks for a single meal:

1. **Read all profiles in `test-kitchen/profiles/`**
2. Read recipes and ratings
3. Pick 1 recipe — favor highly rated, vary from recent
4. Present with ingredients and method for each dietary group

### "Rate [recipe]" / feedback on a dish

When a user gives feedback:

1. Read `test-kitchen/reviews/ratings.md`
2. Add their rating: dish slug, stars (★), person name, version, notes, date
3. Commit and push

---

## Recipe File Format

- Location: `test-kitchen/recipes/mains/` or `test-kitchen/recipes/breakfast/`
- Filename: `<kebab-case-slug>.<lang>.md` — three files per dish, one per supported language (e.g., `west-african-peanut-stew.en.md`, `.es.md`, `.pt.md`). Slug is identical across languages.
- Structure (same in every language file):
  1. Dish name as H1, translated
  2. Metadata line — translated label + value: `**Cuisine:** ... | **Freezer-friendly:** ... | **Prep:** ... | **Cook:** ...` in English, or the localized labels (`**Cocina:** / **Apta para congelar:** / **Preparación:** / **Cocción:**` in Spanish; `**Cozinha:** / **Vai ao freezer:** / **Preparo:** / **Cozimento:**` in Portuguese)
  3. Shared base ingredients and spice mix (safe for ALL dietary groups), bullets translated
  4. Serving suggestions, bullets translated
  5. `---` separator
  6. **For each dietary group:** version header (translated, e.g. `## Vegetarian Version` / `## Versión Vegetariana` / `## Versão Vegetariana`) with the dietary group label in parentheses if present, `**Protein:**` line (or `**Proteína:**`), and full numbered instructions, separated by `---`
  7. Source URLs at the bottom (`*Source:* / *Fuente:* / *Fonte:*`)

If there's only one dietary group (or no profiles), write a single version with no group labels.

Numeric quantities and units stay the same across languages — translate only the words ("1 tsp cumin" → "1 cucharadita de comino" / "1 colher de chá de cominho"). Translate measurement-unit *words* but never convert magnitudes between systems.

---

## Weekly Meal Plan + Shopping List Format

Generate as a single file in `test-kitchen/plans/week-NN.md`.

### Structure:

1. **Header** with week number, meal count, and list of dietary groups
2. **Summary table** — all meals with one protein column per dietary group
3. **Per-dish sections** (numbered, separated by `---`), each containing:
   - **Base:** shared ingredients in one line with quantities
   - **[Group name] add:** protein/additions for that group, one line per group
   - **Method:** condensed instructions, 2-3 sentences
4. **Consolidated Shopping List** organized by grocery section, with version-specific items clearly labeled
5. **Freezing note**

### Key principles:
- Keep it **concise and actionable**
- Specific quantities everywhere
- Group shopping list by store section
- Label version-specific items with the dietary group name
- Consolidate shared ingredients across dishes

---

## Reviews & Ratings

User feedback lives in `test-kitchen/reviews/ratings.md`. Anyone can add a row.

| Column | Description |
|--------|-------------|
| Dish | Recipe slug (filename without the `.<lang>.md` suffix) |
| Rating | 1-5 stars using ★ and ☆ characters |
| Person | Who rated it |
| Version | Which dietary version they ate |
| Notes | What they liked/disliked |
| Date | YYYY-MM-DD |

### How agents should use ratings:
- Prioritize 4–5 star recipes as returning favorites
- Avoid 1–2 star recipes unless modified
- If rated poorly with notes, search for alternatives that address the feedback
- Pay attention to which version was rated — a dish might be great for one group and bad for another

---

## Automated Jobs

These run in the background when the agent session is active:

### Recipe Hunter (every other day)
1. **Read all profiles in `test-kitchen/profiles/`**
2. Check existing recipes (any language file) to avoid duplicate slugs
3. Search the web for trending/seasonal recipes
4. Write 1-2 new recipes with versions for each dietary group, each in **all three languages** (`.en.md`, `.es.md`, `.pt.md`)
5. Commit and push to main

### Meal Planner (1st and 15th of each month)
1. **Read all profiles in `test-kitchen/profiles/`**
2. Read all available recipes and existing week plans
3. Read `test-kitchen/reviews/ratings.md` to prioritize favorites
4. Pick 4 mains + 1 breakfast, favoring profile preferences
5. Generate a weekly menu + consolidated shopping list
6. Commit and push to main
