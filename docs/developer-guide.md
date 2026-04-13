# FoodLab Developer Guide

Integrate FoodLab's recipe database, dietary profile system, and meal planning into your own applications.

## Architecture Overview

FoodLab is a **git-based recipe database** with structured markdown files. There's no API server — your app reads directly from the repo (via GitHub API, git clone, or raw file URLs).

```
github.com/giancolombi/foodlab/
├── profiles/            Per-person dietary restrictions (markdown)
├── recipes/
│   ├── mains/           Main dish recipes (markdown)
│   └── breakfast/       Breakfast recipes (markdown)
├── weeks/               Weekly meal plans + shopping lists (markdown)
├── reviews/ratings.md   Star ratings table (markdown)
├── AGENTS.md            Agent behavior instructions
└── .claude/skills/      Claude Code slash commands
```

## Reading Data

### Option 1: GitHub Raw URLs (simplest)

Fetch files directly — no auth needed for public repos.

```
https://raw.githubusercontent.com/giancolombi/foodlab/main/recipes/mains/moroccan-tagine.md
https://raw.githubusercontent.com/giancolombi/foodlab/main/profiles/example-vegetarian.md
https://raw.githubusercontent.com/giancolombi/foodlab/main/reviews/ratings.md
```

### Option 2: GitHub API (structured)

List files in a directory:

```bash
curl https://api.github.com/repos/giancolombi/foodlab/contents/recipes/mains
```

Returns JSON array of file objects with `name`, `path`, `download_url`.

Get file content:

```bash
curl https://api.github.com/repos/giancolombi/foodlab/contents/recipes/mains/moroccan-tagine.md \
  -H "Accept: application/vnd.github.raw"
```

### Option 3: Git clone (full local access)

```bash
git clone https://github.com/giancolombi/foodlab.git
```

Best for apps that need offline access or want to write back (new recipes, ratings).

## Data Formats

### Recipe Files (`recipes/mains/*.md`, `recipes/breakfast/*.md`)

Each recipe is a markdown file with this structure:

```markdown
# [Dish Name]

**Cuisine:** [X] | **Freezer-friendly:** Yes/No | **Prep:** [X] min | **Cook:** [X] min

## Shared Base / Shared Ingredients
- [ingredient with quantity]
- [ingredient with quantity]

## Serve With
- [serving suggestion]

---

## Vegetarian Version
**Protein:** [description]

1. [Step 1]
2. [Step 2]

---

## Meat Version (No Soy / No Dairy)
**Protein:** [description]

1. [Step 1]
2. [Step 2]

---

*Sources: [Name](URL)*
```

**Parsing tips:**
- Title: first line starting with `# `
- Metadata: line containing `**Cuisine:**` — parse with regex: `\*\*Cuisine:\*\*\s*([^|]+)`
- Ingredients: lines starting with `- ` before the first `---`
- Versions: sections split by `---`, look for `## Vegetarian` / `## Meat`
- Protein: line matching `\*\*Protein:\*\*\s*(.+)`
- Steps: numbered lines (`1. `, `2. `, etc.) within each version section
- Sources: markdown links in the last section

### Profile Files (`profiles/*.md`)

```markdown
# [Person Name]

## Restrictions
- No dairy
- No soy
- Vegetarian

## Preferences
- Loves spicy food
- Favorite cuisines: Korean, Mexican

## Allergies
- Tree nuts

## Notes
- Use coconut aminos instead of soy sauce
```

**Parsing tips:**
- Name: first `# ` line
- Sections: split by `## ` headers
- Items: lines starting with `- ` within each section

### Ratings (`reviews/ratings.md`)

Markdown table:

```
| Dish | Rating | Person | Version | Notes | Date |
|------|--------|--------|---------|-------|------|
| moroccan-tagine | ★★★★★ | — | veg | Loved it | 2026-04-10 |
```

**Parsing tips:**
- Skip header rows (containing `Dish` or `---`)
- Rating: count `★` characters (1-5)
- Dish matches recipe filename without `.md`

### Weekly Plans (`weeks/week-NN.md`)

Simplified cook-friendly documents with:
- Summary table of all meals
- Per-dish sections: Base / Version adds / Method
- Consolidated shopping list grouped by store section

## Example: Parsing a Recipe (JavaScript)

```javascript
function parseRecipe(filename, markdown) {
  const lines = markdown.split('\n');

  // Title
  const titleLine = lines.find(l => l.startsWith('# '));
  const title = titleLine?.replace(/^#\s+/, '') || filename;

  // Metadata
  const metaLine = lines.find(l => l.includes('**Cuisine:**'));
  const cuisine = metaLine?.match(/\*\*Cuisine:\*\*\s*([^|]+)/)?.[1]?.trim() || '';
  const prepTime = metaLine?.match(/\*\*Prep:\*\*\s*([^|]+)/)?.[1]?.trim() || '';
  const cookTime = metaLine?.match(/\*\*Cook:\*\*\s*([^|]+)/)?.[1]?.trim() || '';
  const freezerFriendly = !metaLine?.match(/Freezer-friendly:\*\*\s*No/i);

  // Split by --- separators
  const sections = markdown.split(/\n---\n/);

  // Shared base: ingredient lines before first ---
  const sharedBase = sections[0]
    .split('\n')
    .filter(l => l.startsWith('- '))
    .map(l => l.replace(/^-\s+/, ''));

  // Find version sections
  const vegSection = sections.find(s =>
    s.includes('## Vegetarian')
  );
  const meatSection = sections.find(s =>
    s.includes('## Meat')
  );

  const parseVersion = (section) => {
    if (!section) return { protein: '', steps: [] };
    const protein = section.match(/\*\*Protein:\*\*\s*(.+)/)?.[1]?.trim() || '';
    const steps = section
      .split('\n')
      .filter(l => /^\d+\.\s/.test(l.trim()))
      .map(l => l.trim().replace(/^\d+\.\s+/, ''));
    return { protein, steps };
  };

  return {
    slug: filename.replace(/\.md$/, ''),
    title,
    cuisine,
    prepTime,
    cookTime,
    freezerFriendly,
    sharedBase,
    vegVersion: parseVersion(vegSection),
    meatVersion: parseVersion(meatSection),
  };
}
```

## Example: Parsing a Recipe (Python)

```python
import re

def parse_recipe(filename: str, markdown: str) -> dict:
    lines = markdown.split('\n')

    # Title
    title_line = next((l for l in lines if l.startswith('# ')), '')
    title = title_line.lstrip('# ').strip() or filename

    # Metadata
    meta_line = next((l for l in lines if '**Cuisine:**' in l), '')
    cuisine = re.search(r'\*\*Cuisine:\*\*\s*([^|]+)', meta_line)
    prep = re.search(r'\*\*Prep:\*\*\s*([^|]+)', meta_line)
    cook = re.search(r'\*\*Cook:\*\*\s*([^|]+)', meta_line)

    # Split by ---
    sections = re.split(r'\n---\n', markdown)

    # Shared base
    shared_base = [
        l.lstrip('- ').strip()
        for l in sections[0].split('\n')
        if l.startswith('- ')
    ]

    def parse_version(keyword):
        section = next((s for s in sections if keyword in s), '')
        protein_match = re.search(r'\*\*Protein:\*\*\s*(.+)', section)
        steps = [
            re.sub(r'^\d+\.\s+', '', l.strip())
            for l in section.split('\n')
            if re.match(r'^\d+\.\s', l.strip())
        ]
        return {
            'protein': protein_match.group(1).strip() if protein_match else '',
            'steps': steps,
        }

    return {
        'slug': filename.replace('.md', ''),
        'title': title,
        'cuisine': cuisine.group(1).strip() if cuisine else '',
        'prep_time': prep.group(1).strip() if prep else '',
        'cook_time': cook.group(1).strip() if cook else '',
        'shared_base': shared_base,
        'veg_version': parse_version('## Vegetarian'),
        'meat_version': parse_version('## Meat'),
    }
```

## Example: Fetching All Recipes (JavaScript)

```javascript
async function fetchAllRecipes() {
  // List recipe files
  const res = await fetch(
    'https://api.github.com/repos/giancolombi/foodlab/contents/recipes/mains'
  );
  const files = await res.json();

  // Fetch and parse each recipe
  const recipes = await Promise.all(
    files
      .filter(f => f.name.endsWith('.md'))
      .map(async (f) => {
        const content = await fetch(f.download_url).then(r => r.text());
        return parseRecipe(f.name, content);
      })
  );

  return recipes;
}
```

## Example: Matching Ingredients (JavaScript)

```javascript
function matchIngredients(recipes, userIngredients) {
  const normalized = userIngredients.map(i => i.toLowerCase().trim());

  return recipes
    .map(recipe => {
      const matched = [];
      const missing = [];

      for (const ing of recipe.sharedBase) {
        const found = normalized.some(u =>
          ing.toLowerCase().includes(u) || u.includes(ing.toLowerCase())
        );
        (found ? matched : missing).push(ing);
      }

      return { recipe, matched, missing };
    })
    .filter(r => r.matched.length > 0)
    .sort((a, b) => {
      const ratioA = a.matched.length / (a.matched.length + a.missing.length);
      const ratioB = b.matched.length / (b.matched.length + b.missing.length);
      return ratioB - ratioA;
    });
}
```

## Example: Parsing Ratings (JavaScript)

```javascript
function parseRatings(markdown) {
  return markdown
    .split('\n')
    .filter(line => line.startsWith('|') && !line.includes('Dish') && !line.includes('---'))
    .map(line => {
      const cols = line.split('|').map(c => c.trim()).filter(Boolean);
      if (cols.length < 6) return null;
      return {
        dish: cols[0],
        rating: (cols[1].match(/★/g) || []).length,
        person: cols[2],
        version: cols[3],
        notes: cols[4],
        date: cols[5],
      };
    })
    .filter(Boolean);
}
```

## Writing Back to the Repo

If your app needs to add recipes, ratings, or profiles, use the GitHub API with a personal access token:

### Add a rating

```bash
# 1. Get current ratings file
CONTENT=$(curl -s https://api.github.com/repos/giancolombi/foodlab/contents/reviews/ratings.md \
  -H "Authorization: Bearer $GITHUB_TOKEN")
SHA=$(echo "$CONTENT" | jq -r '.sha')
CURRENT=$(echo "$CONTENT" | jq -r '.content' | base64 -d)

# 2. Append new rating row
NEW_LINE="| moroccan-tagine | ★★★★★ | Alex | veg | Amazing | 2026-04-12 |"
UPDATED=$(echo "$CURRENT"; echo "$NEW_LINE")

# 3. Push update
curl -X PUT https://api.github.com/repos/giancolombi/foodlab/contents/reviews/ratings.md \
  -H "Authorization: Bearer $GITHUB_TOKEN" \
  -d "{
    \"message\": \"Add rating for moroccan-tagine\",
    \"content\": \"$(echo "$UPDATED" | base64)\",
    \"sha\": \"$SHA\"
  }"
```

### Add a recipe

Same pattern — create a new file via the GitHub Contents API:

```bash
curl -X PUT https://api.github.com/repos/giancolombi/foodlab/contents/recipes/mains/new-recipe.md \
  -H "Authorization: Bearer $GITHUB_TOKEN" \
  -d "{
    \"message\": \"Add new recipe\",
    \"content\": \"$(cat recipe.md | base64)\"
  }"
```

## Integrating with AI Agents

If your app uses an AI agent (Claude API, OpenAI API, etc.), include the FoodLab repo URL in the system prompt:

```
You are a meal planning assistant. Read recipes, profiles, and ratings
from https://github.com/giancolombi/foodlab to help users plan meals.
```

The agent will fetch files from the repo as needed. For the full agent behavior spec, read [`AGENTS.md`](../AGENTS.md).

## Existing Integration: Homebase

The [homebase](https://github.com/giancolombi/homebase) app has a working FoodLab integration as a reference implementation. Key files:

| File | What it does |
|------|-------------|
| `app/types/foodlab.ts` | TypeScript types for recipes, ratings, dietary restrictions |
| `app/lib/foodlabParser.ts` | Recipe parser, ingredient matcher, format converter |
| `app/data/foodlabDemo.ts` | Demo recipe data for offline/demo mode |
| `app/components/foodlab/` | React UI: recipe cards, star ratings, ingredient matcher, dietary editor |
| `app/store/familyStore.ts` | Zustand store with FoodLab state and actions |

## Rate Limits

The GitHub API has rate limits:
- **Unauthenticated**: 60 requests/hour
- **Authenticated** (personal access token): 5,000 requests/hour

For production apps serving multiple users, consider:
- Caching recipes locally (they don't change often)
- Using a git clone with periodic `git pull` instead of API calls
- Setting up a webhook to get notified of repo changes

## Contributing Recipes

To contribute recipes back to the FoodLab collection:

1. Fork the repo
2. Add recipe files following the format in `AGENTS.md`
3. Open a pull request
4. Recipes must have versions for each dietary group in `profiles/`

## License

FoodLab is open source. See the repo for license details.
