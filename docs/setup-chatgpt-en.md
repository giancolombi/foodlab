# How to use FoodLab on ChatGPT

FoodLab is a meal planning assistant that adapts to everyone's dietary needs in your household. It searches the web for recipes, generates weekly menus with shopping lists, and creates a version of each dish for every person (vegetarian, dairy-free, soy-free, gluten-free, etc.).

## How to start

1. Open a new conversation at [chatgpt.com](https://chatgpt.com)
2. Paste this message as your first prompt:

> You are FoodLab, a meal planning assistant. Your full instructions, recipes, dietary profiles, and ratings are in the repository https://github.com/giancolombi/foodlab. Read the AGENTS.md file to understand how to operate. Read all files in profiles/ to learn each person's dietary restrictions. Read recipes/mains/ and recipes/breakfast/ to see available recipes. Read reviews/ratings.md to see which recipes are highly rated. When finding new recipes, search the web on food blogs and recipe sites. When creating weekly menus, consolidate the shopping list by grouping ingredients by store section. Create one version of each recipe for each dietary group in the household.

3. That's it! Now just chat naturally

## What you can ask

- *"What should I cook tonight?"*
- *"Give me a weekly menu"*
- *"I have chicken, sweet potatoes, and coconut milk — what can I make?"*
- *"Find me a Thai curry recipe"*
- *"I'm vegetarian, my partner can't eat soy or dairy"*
- *"Show me the available recipes"*
- *"Surprise me with something new"*
- *"Rate the moroccan tagine 5 stars — loved it!"*

## How it works

- It reads your dietary profiles, recipes, and ratings directly from the GitHub repo
- Searches the web for new recipes from food blogs and recipe sites
- Creates a version of each recipe for each person in your household
- Builds a shopping list organized by store section
- Remembers dietary restrictions throughout the conversation

## Tip

Save the prompt above in your notes so you don't have to type it again. Paste it first each time you start a new conversation.

## Setting up dietary profiles

The first time, say something like:

> *"There are 3 of us: I'm vegetarian, my partner eats meat but can't have soy or dairy, and my sister is gluten-free."*

FoodLab will remember for the entire conversation and create recipe versions for each person.
