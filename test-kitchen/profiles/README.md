# Dietary Profiles

Each person who eats these meals gets their own profile file. The agent reads all profiles and generates recipes that work for everyone.

## How to Add a Profile

Create a file named `<name>.md` (e.g., `gian.md`, `alex.md`) with this format:

```markdown
# Name

## Restrictions
- No dairy
- No soy
- Vegetarian

## Preferences
- Loves spicy food
- Prefers one-pot meals
- Favorite cuisines: Korean, Mexican

## Allergies
- Tree nuts

## Notes
- OK with eggs
- Uses coconut aminos instead of soy sauce
```

## Fields

| Field | Required | What it does |
|-------|----------|-------------|
| **Restrictions** | Yes | What this person cannot or will not eat. The agent avoids these ingredients. |
| **Preferences** | No | What this person enjoys. The agent favors these when picking recipes. |
| **Allergies** | No | Hard restrictions — the agent will never include these, even as optional. |
| **Notes** | No | Substitution rules, additional context. |

## How Agents Use Profiles

1. **Read all profiles** in `profiles/` before generating any recipe or meal plan
2. **Generate one version per unique dietary group** — if two people have the same restrictions, they share a version. If restrictions differ, each gets their own version.
3. **Shared base stays the same** — only proteins and restricted ingredients swap between versions
4. **Label each version** with the profile name(s) it's for
5. **Shopping lists** note which items are for which version

## Examples

**Two people, same diet:** One recipe version, no labels needed.

**Vegetarian + meat eater (no soy/dairy):**
- Version 1 (Gian): chickpeas, tofu, feta OK
- Version 2 (Alex): chicken thighs, coconut aminos, no cheese

**Three people, three diets:**
- Version 1 (Gian): vegetarian, dairy OK
- Version 2 (Alex): meat, no soy, no dairy
- Version 3 (Sam): meat, no gluten, dairy OK
