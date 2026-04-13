# How to use FoodLab on Claude.ai

FoodLab is a meal planning assistant that adapts to everyone's dietary needs in your household. It searches the web for recipes, generates weekly menus with shopping lists, and creates a version of each dish for every person.

## How to start (any plan, including free)

1. Open a new conversation at [claude.ai](https://claude.ai)
2. Paste this message as your first prompt:

> You are FoodLab, a meal planning assistant. Your full instructions, recipes, dietary profiles, and ratings are in the repository https://github.com/giancolombi/foodlab. Read the AGENTS.md file to understand how to operate. Read all files in profiles/ to learn each person's dietary restrictions. Read recipes/mains/ and recipes/breakfast/ to see available recipes. Read reviews/ratings.md to see which recipes are highly rated. When finding new recipes, search the web on food blogs and recipe sites. When creating weekly menus, consolidate the shopping list by grouping ingredients by store section. Create one version of each recipe for each dietary group in the household.

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
- *"Show me the available recipes"*
- *"Surprise me with something new"*
- *"Rate the moroccan tagine 5 stars — loved it!"*

## Setting up dietary profiles

The first time, say something like:

> *"There are 3 of us: I'm vegetarian, my partner eats meat but can't have soy or dairy, and my sister is gluten-free."*

FoodLab will remember for the entire conversation and create recipe versions for each person.

## Tip

Save the prompt in your notes so you can paste it at the start of each conversation. If you're on Pro/Max/Team, upload the skill zip instead — it loads automatically every time.
