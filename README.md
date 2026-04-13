# FoodLab

AI-powered meal planning that adapts to everyone's dietary needs. Find recipes, generate weekly menus with shopping lists, and match what's in your fridge to what you can cook.

## Get Started (Browser — No Install Needed)

### Claude.ai (Recommended)

**Option A — Agent Skill (best experience):**
1. [Download `foodlab-skill.zip`](https://raw.githubusercontent.com/giancolombi/foodlab/main/foodlab-skill.zip)
2. In claude.ai: go to **Settings** > **Features** > upload the zip
3. Start chatting: *"What should I cook tonight?"*

Works on Claude Pro, Max, Team, and Enterprise plans.

**Option B — Claude Code (web):**
1. Go to [claude.ai/code](https://claude.ai/code)
2. Connect this repo: `https://github.com/giancolombi/foodlab`
3. Type `/foodlab-help` to see all commands

### ChatGPT

**ChatGPT Plus/Team** — Create a Custom GPT:
1. Go to [chatgpt.com/gpts](https://chatgpt.com/gpts) > **Create**
2. Paste the instructions from [`.chatgpt/skills/foodlab-meal-planner.json`](https://raw.githubusercontent.com/giancolombi/foodlab/main/.chatgpt/skills/foodlab-meal-planner.json)
3. Share the GPT link with anyone

**ChatGPT Business/Enterprise** — Upload as a Skill:
1. [Download `foodlab-meal-planner.json`](https://raw.githubusercontent.com/giancolombi/foodlab/main/.chatgpt/skills/foodlab-meal-planner.json)
2. Profile > **Skills** > **New skill** > **Upload**
3. Share with your workspace

### Just Browse
Read recipes directly on GitHub: [`recipes/mains/`](https://github.com/giancolombi/foodlab/tree/main/recipes/mains)

---

## What You Can Ask

Just talk naturally — or use slash commands in Claude Code:

| What to say | What happens |
|------------|-------------|
| *"Find me a Thai curry recipe"* | Searches the web, creates a recipe for each person's diet |
| *"I have chicken and sweet potatoes — what can I make?"* | Matches your ingredients to existing recipes |
| *"Generate a weekly menu"* | Picks 4 mains + 1 breakfast with a shopping list |
| *"What should I cook tonight?"* | Picks a recipe with ingredients + method |
| *"I'm vegetarian, my partner can't eat soy or dairy"* | Sets up dietary profiles — every recipe adapts |
| *"Rate the moroccan tagine 5 stars"* | Saves your rating — future menus favor your favorites |

## How It Works

1. **Tell it who's eating** — each person gets a dietary profile (vegetarian, no dairy, gluten-free, etc.)
2. **Every recipe adapts** — one version per person, same base dish, only the protein and restricted ingredients change
3. **Recipes grow automatically** — an AI agent searches the web for new recipes and adds them
4. **Your ratings matter** — rate dishes 1-5 stars, and the meal planner learns what you like

All recipes are high protein, freezer-friendly, and veggie-loaded.

---

## For Developers

<details>
<summary>CLI / IDE setup (click to expand)</summary>

```bash
git clone https://github.com/giancolombi/foodlab.git
cd foodlab
```

| Tool | Command | Skills |
|------|---------|--------|
| **Claude Code** | `claude` | Slash commands auto-loaded: `/find-recipe`, `/weekly-menu`, `/whats-for-dinner`, `/what-can-i-make`, `/rate`, `/add-profile` |
| **Codex (OpenAI)** | `codex` | Reads `AGENTS.md` — ask naturally |
| **Gemini CLI** | `gemini` | Reads `AGENTS.md` — ask naturally |
| **Cursor** | Open folder | Reads `.cursor/settings.json` |
| **GitHub Copilot** | `gh copilot` | Reads `AGENTS.md` |
| **OpenClaw** | `openclaw` | Reads `AGENTS.md` |

### Safety Hooks

Agents run with [safety guards](hooks/README.md) inspired by [Sondera's Cedar policies](https://github.com/sondera-ai/sondera-coding-agent-hooks). These block destructive operations (force push, rm -rf), detect secrets in output, and prevent prompt injection.

### Repo Structure

```
profiles/            Dietary profiles (one per person)
recipes/mains/       Full recipes (one version per dietary group)
recipes/breakfast/   Breakfast recipes
weeks/               Weekly menus + shopping lists
reviews/ratings.md   Rate recipes 1-5 stars
hooks/               Safety guards
.claude/skills/      Slash commands for Claude Code
.chatgpt/skills/     Skill manifest for ChatGPT
AGENTS.md            Agent instructions (CLAUDE.md symlinks here)
```

### Automated Jobs

When running Claude Code locally, two cron jobs run in the background:
- **Recipe Hunter** (every other day) — searches the web for new recipes, commits them
- **Meal Planner** (1st and 15th) — generates a weekly menu + shopping list

</details>
