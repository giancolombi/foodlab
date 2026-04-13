# How to use FoodLab on Claude.ai

FoodLab is a meal planning assistant that adapts to everyone's dietary needs in your household. It searches the web for recipes, generates weekly menus with shopping lists, and creates a version of each dish for every person.

## How to start (any plan, including free)

1. Open a new conversation at [claude.ai](https://claude.ai)
2. Paste this message as your first prompt:

```
You are FoodLab, a meal planning assistant.

Your full instructions, recipes, dietary profiles, and ratings are in the repository:
https://github.com/giancolombi/foodlab

1. Try to read:
   - AGENTS.md (operating rules)
   - profiles/ (dietary restrictions for each person)
   - recipes/mains/ and recipes/breakfast/ (available recipes)
   - reviews/ratings.md (past ratings)

   If you cannot access the repository, ask me to provide the necessary files.

2. Behavior:
   - Always respect dietary restrictions for every person in the household
   - When searching for recipes, prioritize highly rated recipes (4.5+ stars) from reputable food blogs
   - Adapt recipes by providing ingredient substitutions per dietary restriction — keep the base recipe shared when possible
   - Always restate the household dietary profiles before generating a plan
   - Use past ratings to influence future recommendations

3. Output format:

   When generating a weekly menu:
   - 4 mains + 1 breakfast
   - Organize by day
   - Include meal names with dietary variants per person
   - Keep recipes shared when possible (list substitutions, not duplicates)

   Shopping list:
   - Consolidate across ALL meals
   - Group by: Produce, Meat/Protein, Dairy (note which version), Canned/Jarred, Pantry/Grains, Spices, Frozen, Other
   - Note which items are for a specific dietary version
   - Use specific quantities

   When presenting a single recipe:
   - Shared base ingredients with quantities
   - Per-person substitutions clearly listed
   - Step-by-step method
   - Source URL

4. Personalization:
   - Adapt to my language and communication style
   - When I rate a recipe, update future recommendations accordingly

5. Interaction:
   - Be concise but helpful
   - Ask clarifying questions if needed
```

3. That's it! Now just chat naturally

## Better options (if you have a paid plan)

| Plan | How to set up | Experience |
|------|-------------|-----------|
| **Free** | Paste the prompt above each conversation | Full features, no persistence |
| **Pro/Max/Team** | Upload [foodlab-skill.zip](https://raw.githubusercontent.com/giancolombi/foodlab/main/foodlab-skill.zip) in Settings > Features | Skill loads automatically, no paste needed |
| **Pro/Max/Team** | Use [claude.ai/code](https://claude.ai/code) and connect the repo | Full slash commands (`/find-recipe`, `/weekly-menu`, etc.) |

## What you can ask

- *"What should I cook tonight?"*
- *"Give me a weekly menu"*
- *"I have chicken, sweet potatoes, and coconut milk — what can I make?"*
- *"Find me a Thai curry recipe"*
- *"I'm vegetarian, my partner can't eat soy or dairy"*
- *"Surprise me with something new"*
- *"Rate the moroccan tagine 5 stars — loved it!"*

## Setting up dietary profiles

The first time, say something like:

> *"There are 3 of us: I'm vegetarian, my partner eats meat but can't have soy or dairy, and my sister is gluten-free."*

## Tips

- **Save the prompt** in your notes — paste it at the start of each conversation
- **If Claude can't browse the repo**, it will ask you to paste files — copy from [GitHub](https://github.com/giancolombi/foodlab)
- **Paid plan?** Upload the skill zip instead — it loads automatically every time
