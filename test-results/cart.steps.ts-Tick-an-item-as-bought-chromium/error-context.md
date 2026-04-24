# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: cart.steps.ts >> Tick an item as bought
- Location: e2e/support/bdd.ts:79:5

# Error details

```
Test timeout of 30000ms exceeded.
```

```
Error: locator.check: Test timeout of 30000ms exceeded.
Call log:
  - waiting for locator('input[type=\'checkbox\']').first()

```

# Page snapshot

```yaml
- generic [ref=e2]:
  - generic [ref=e4]:
    - generic [ref=e5]:
      - generic [ref=e6]: Welcome back
      - generic [ref=e7]: Sign in to find recipes for what's in your fridge.
    - generic [ref=e8]:
      - generic [ref=e9]:
        - generic [ref=e10]:
          - text: Email
          - textbox "Email" [ref=e11]
        - generic [ref=e12]:
          - text: Password
          - textbox "Password" [ref=e13]
      - generic [ref=e14]:
        - button "Sign in" [ref=e15]
        - paragraph [ref=e16]:
          - text: New here?
          - link "Create an account" [ref=e17] [cursor=pointer]:
            - /url: /signup
  - region "Notifications alt+T"
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
  18 |   // Seed plan by fetching a recipe slug from the API and assigning it directly.
  19 |   const recipesRes = await fetch("http://localhost:3001/api/recipes", {
  20 |     headers: { Authorization: `Bearer ${token}` },
  21 |   });
  22 |   if (!recipesRes.ok) throw new Error(`Recipes fetch failed: ${recipesRes.status}`);
  23 |   const { recipes } = await recipesRes.json();
  24 |   if (!recipes.length) throw new Error("No recipes in database to seed plan");
  25 |   const slug = recipes[0].slug;
  26 |   const assignments = { "0-dinner": { slug, assignedAt: Date.now() } };
  27 |   await page.evaluate((a: any) => {
  28 |     localStorage.setItem("foodlab_plan_v2", JSON.stringify(a));
  29 |   }, assignments);
  30 | });
  31 | 
  32 | When(/^I navigate to "(.+)"$/, async ({ page }, path) => {
  33 |   await page.goto(path);
  34 |   await page.waitForLoadState("networkidle");
  35 | });
  36 | 
  37 | When("I tick the first ingredient checkbox", async ({ page }) => {
  38 |   const checkbox = page.locator("input[type='checkbox']").first();
> 39 |   await checkbox.check();
     |                  ^ Error: locator.check: Test timeout of 30000ms exceeded.
  40 | });
  41 | 
  42 | Then(/^I should see an empty state with text "(.+)"$/, async ({ page }, text) => {
  43 |   await expect(page.getByText(text)).toBeVisible({ timeout: 5000 });
  44 | });
  45 | 
  46 | Then(/^I should see at least (\d+) shopping list section/, async ({ page }, n) => {
  47 |   await page.waitForTimeout(2000);
  48 |   const sections = page.locator("h3, [class*='CardTitle']");
  49 |   const count = await sections.count();
  50 |   expect(count).toBeGreaterThanOrEqual(parseInt(n));
  51 | });
  52 | 
  53 | Then(/^I should see at least (\d+) ingredient item/, async ({ page }, n) => {
  54 |   const items = page.locator("input[type='checkbox']");
  55 |   const count = await items.count();
  56 |   expect(count).toBeGreaterThanOrEqual(parseInt(n));
  57 | });
  58 | 
  59 | Then("the first ingredient should show as bought", async ({ page }) => {
  60 |   const checkbox = page.locator("input[type='checkbox']").first();
  61 |   await expect(checkbox).toBeChecked();
  62 | });
  63 | 
  64 | Then("the bought count should increase", async ({ page }) => {
  65 |   // The progress text "X of Y bought" should be visible.
  66 |   await expect(page.getByText(/\d+ of \d+ bought/i)).toBeVisible({ timeout: 3000 });
  67 | });
  68 | 
  69 | loadFeature("cart.feature");
  70 | runScenarios();
  71 | 
```