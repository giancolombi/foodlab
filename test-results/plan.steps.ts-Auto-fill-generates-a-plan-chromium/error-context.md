# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: plan.steps.ts >> Auto-fill generates a plan
- Location: e2e/support/bdd.ts:79:5

# Error details

```
Error: expect(received).toBeGreaterThanOrEqual(expected)

Expected: >= 1
Received:    0
```

# Page snapshot

```yaml
- generic [ref=e2]:
  - generic [ref=e3]:
    - banner [ref=e4]:
      - generic [ref=e5]:
        - link "FoodLab" [ref=e6] [cursor=pointer]:
          - /url: /
          - img [ref=e7]
          - text: FoodLab
        - navigation [ref=e9]:
          - link "What can I make?" [ref=e10] [cursor=pointer]:
            - /url: /
          - link "Recipes" [ref=e11] [cursor=pointer]:
            - /url: /recipes
          - link "Plan" [ref=e12] [cursor=pointer]:
            - /url: /plan
          - link "Cart" [ref=e13] [cursor=pointer]:
            - /url: /cart
          - link "Profiles" [ref=e14] [cursor=pointer]:
            - /url: /profiles
        - generic [ref=e15]:
          - link "Plan" [ref=e16] [cursor=pointer]:
            - /url: /plan
            - img [ref=e17]
          - link "Cart" [ref=e19] [cursor=pointer]:
            - /url: /cart
            - img [ref=e20]
          - button "Measurement units" [ref=e24]:
            - img [ref=e25]
            - generic [ref=e31]: US
          - button "Language" [ref=e33]:
            - img [ref=e34]
            - generic [ref=e37]: en
          - generic [ref=e38]: Tester 3
          - button "Sign out" [ref=e39]:
            - img [ref=e40]
    - main [ref=e43]:
      - generic [ref=e44]:
        - generic [ref=e46]:
          - heading "Weekly plan" [level=1] [ref=e47]
          - paragraph [ref=e48]: Pick what you're eating for breakfast, lunch, and dinner each day.
        - generic [ref=e49]:
          - img [ref=e51]
          - generic [ref=e53]:
            - paragraph [ref=e54]: Your plan is empty.
            - paragraph [ref=e55]: Browse the catalog and use the calendar button on any recipe to schedule it into breakfast, lunch, or dinner.
          - generic [ref=e57]:
            - button "Auto-fill" [ref=e58]:
              - img [ref=e59]
              - text: Auto-fill
            - link "Browse recipes" [ref=e62] [cursor=pointer]:
              - /url: /recipes
              - img [ref=e63]
              - text: Browse recipes
    - contentinfo [ref=e65]: FoodLab · open-source
  - region "Notifications alt+T":
    - list:
      - listitem [ref=e66]:
        - img [ref=e68]
        - generic [ref=e71]: Request failed (404)
```

# Test source

```ts
  1  | import { Given, When, Then, loadFeature, runScenarios, expect } from "./support/bdd";
  2  | import { createTestUser, injectAuth } from "./support/helpers";
  3  | 
  4  | let token: string;
  5  | 
  6  | Given("I am signed in", async ({ page }) => {
  7  |   const user = await createTestUser();
  8  |   token = user.token;
  9  |   await injectAuth(page, token);
  10 | });
  11 | 
  12 | Given(/^I navigate to "(.+)"$/, async ({ page }, path) => {
  13 |   await page.goto(path);
  14 |   await page.waitForLoadState("networkidle");
  15 | });
  16 | 
  17 | Given("the plan has at least one recipe", async ({ page }) => {
  18 |   const recipesRes = await fetch("http://localhost:3001/api/recipes", {
  19 |     headers: { Authorization: `Bearer ${token}` },
  20 |   });
  21 |   if (!recipesRes.ok) throw new Error(`Recipes fetch failed: ${recipesRes.status}`);
  22 |   const { recipes } = await recipesRes.json();
  23 |   if (!recipes.length) throw new Error("No recipes in database to seed plan");
  24 |   const slug = recipes[0].slug;
  25 |   const assignments = { "0-dinner": { slug, assignedAt: Date.now() } };
  26 |   await page.evaluate((a: any) => {
  27 |     localStorage.setItem("foodlab_plan_v2", JSON.stringify(a));
  28 |   }, assignments);
  29 | });
  30 | 
  31 | When(/^I click the "(.+)" button$/, async ({ page }, name) => {
  32 |   // If this is a destructive action, register a dialog handler first.
  33 |   if (/clear/i.test(name)) {
  34 |     page.once("dialog", (d) => d.accept());
  35 |   }
  36 |   await page.getByRole("button", { name: new RegExp(name, "i") }).click();
  37 | });
  38 | 
  39 | When("I confirm the dialog", async ({ page }) => {
  40 |   // Dialog was accepted by the handler set before the triggering click.
  41 |   await page.waitForTimeout(300);
  42 | });
  43 | 
  44 | Then(/^I should see an empty state with text "(.+)"$/, async ({ page }, text) => {
  45 |   await expect(page.getByText(text)).toBeVisible({ timeout: 5000 });
  46 | });
  47 | 
  48 | Then(/^I should see an? "(.+)" button$/, async ({ page }, name) => {
  49 |   await expect(
  50 |     page.getByRole("button", { name: new RegExp(name, "i") }),
  51 |   ).toBeVisible();
  52 | });
  53 | 
  54 | Then(/^I should see at least (\d+) assigned meal slot$/, async ({ page }, _n) => {
  55 |   // An assigned slot has a link to a recipe.
  56 |   await page.waitForTimeout(2000);
  57 |   const links = page.locator("a[href^='/recipes/']");
  58 |   const count = await links.count();
> 59 |   expect(count).toBeGreaterThanOrEqual(1);
     |                 ^ Error: expect(received).toBeGreaterThanOrEqual(expected)
  60 | });
  61 | 
  62 | Then(/^I should see a "(.+)" link$/, async ({ page }, text) => {
  63 |   await expect(page.getByRole("link", { name: new RegExp(text, "i") })).toBeVisible();
  64 | });
  65 | 
  66 | 
  67 | loadFeature("plan.feature");
  68 | runScenarios();
  69 | 
```