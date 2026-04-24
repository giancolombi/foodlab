# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: cart.steps.ts >> Cart shows items after plan is filled
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
            - generic [ref=e19]: "1"
          - link "Cart" [ref=e20] [cursor=pointer]:
            - /url: /cart
            - img [ref=e21]
            - generic "You have recipes planned — review your shopping list" [ref=e25]
          - button "Measurement units" [ref=e26]:
            - img [ref=e27]
            - generic [ref=e33]: US
          - button "Language" [ref=e35]:
            - img [ref=e36]
            - generic [ref=e39]: en
          - generic [ref=e40]: Tester 4
          - button "Sign out" [ref=e41]:
            - img [ref=e42]
    - main [ref=e45]:
      - generic [ref=e46]:
        - generic [ref=e47]:
          - generic [ref=e48]:
            - heading "Shopping cart" [level=1] [ref=e49]
            - paragraph [ref=e50]: Tick items off as you shop. Your progress is saved on this device.
          - generic [ref=e51]:
            - button "Smart consolidate" [ref=e52]:
              - img [ref=e53]
              - generic [ref=e56]: Smart consolidate
            - button "Share" [ref=e57]:
              - img [ref=e58]
              - generic [ref=e64]: Share
            - button "Download" [ref=e65]:
              - img [ref=e66]
              - generic [ref=e69]: Download
        - heading "Shopping list (13)" [level=2] [ref=e71]:
          - text: Shopping list
          - generic [ref=e72]: (13)
        - generic [ref=e73]:
          - generic [ref=e74]:
            - generic [ref=e76]: Produce
            - list [ref=e78]:
              - listitem [ref=e79]:
                - generic [ref=e80] [cursor=pointer]:
                  - checkbox "Mark bell peppers as bought" [ref=e81]
                  - generic [ref=e83]:
                    - generic [ref=e84]: bell peppers
                    - generic [ref=e85]: "2"
              - listitem [ref=e86]:
                - generic [ref=e87] [cursor=pointer]:
                  - checkbox "Mark mushrooms as bought" [ref=e88]
                  - generic [ref=e90]:
                    - generic [ref=e91]: mushrooms
                    - generic [ref=e92]: 8 oz
              - listitem [ref=e93]:
                - generic [ref=e94] [cursor=pointer]:
                  - checkbox "Mark onion as bought" [ref=e95]
                  - generic [ref=e97]:
                    - generic [ref=e98]: onion
                    - generic [ref=e99]: "1"
              - listitem [ref=e100]:
                - generic [ref=e101] [cursor=pointer]:
                  - checkbox "Mark salt, pepper, cumin to taste as bought" [ref=e102]
                  - generic [ref=e103]:
                    - generic [ref=e105]: salt, pepper, cumin to taste
                    - generic [ref=e106]: Salt, pepper, cumin to taste
          - generic [ref=e107]:
            - generic [ref=e109]: Proteins
            - list [ref=e111]:
              - listitem [ref=e112]:
                - generic [ref=e113] [cursor=pointer]:
                  - checkbox "Mark eggs, scrambled as bought" [ref=e114]
                  - generic [ref=e116]:
                    - generic [ref=e117]: eggs, scrambled
                    - generic [ref=e118]: "8"
          - generic [ref=e119]:
            - generic [ref=e121]: Pantry
            - list [ref=e123]:
              - listitem [ref=e124]:
                - generic [ref=e125] [cursor=pointer]:
                  - checkbox "Mark black beans as bought" [ref=e126]
                  - generic [ref=e128]:
                    - generic [ref=e129]: black beans
                    - generic [ref=e130]: 1 can
              - listitem [ref=e131]:
                - generic [ref=e132] [cursor=pointer]:
                  - checkbox "Mark olive oil as bought" [ref=e133]
                  - generic [ref=e135]:
                    - generic [ref=e136]: olive oil
                    - generic [ref=e137]: 1 tbsp
              - listitem [ref=e138]:
                - generic [ref=e139] [cursor=pointer]:
                  - 'checkbox "Mark reheat: unwrap foil, wrap in damp paper towel, microwave 2–3 min, flipping halfway. as bought" [ref=e140]'
                  - generic [ref=e141]:
                    - generic [ref=e143]: "reheat: unwrap foil, wrap in damp paper towel, microwave 2–3 min, flipping halfway."
                    - generic [ref=e144]: "Reheat: unwrap foil, wrap in damp paper towel, microwave 2–3 min, flipping halfway."
              - listitem [ref=e145]:
                - generic [ref=e146] [cursor=pointer]:
                  - checkbox "Mark siete tortillas as bought" [ref=e147]
                  - generic [ref=e149]:
                    - generic [ref=e150]: siete tortillas
                    - generic [ref=e151]: "8"
              - listitem [ref=e152]:
                - generic [ref=e153] [cursor=pointer]:
                  - checkbox "Mark wrap each burrito tightly in foil. as bought" [ref=e154]
                  - generic [ref=e155]:
                    - generic [ref=e157]: wrap each burrito tightly in foil.
                    - generic [ref=e158]: Wrap each burrito tightly in foil.
          - generic [ref=e159]:
            - generic [ref=e161]: Other
            - list [ref=e163]:
              - listitem [ref=e164]:
                - generic [ref=e165] [cursor=pointer]:
                  - checkbox "Mark freeze up to 3 months. as bought" [ref=e166]
                  - generic [ref=e167]:
                    - generic [ref=e169]: freeze up to 3 months.
                    - generic [ref=e170]: Freeze up to 3 months.
              - listitem [ref=e171]:
                - generic [ref=e172] [cursor=pointer]:
                  - checkbox "Mark place in freezer bag, squeeze out air. as bought" [ref=e173]
                  - generic [ref=e174]:
                    - generic [ref=e176]: place in freezer bag, squeeze out air.
                    - generic [ref=e177]: Place in freezer bag, squeeze out air.
              - listitem [ref=e178]:
                - generic [ref=e179] [cursor=pointer]:
                  - checkbox "Mark salsa verde on the side as bought" [ref=e180]
                  - generic [ref=e181]:
                    - generic [ref=e183]: salsa verde on the side
                    - generic [ref=e184]: Salsa verde on the side
    - contentinfo [ref=e185]: FoodLab · open-source
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
  39 |   await checkbox.check();
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
> 50 |   expect(count).toBeGreaterThanOrEqual(parseInt(n));
     |                 ^ Error: expect(received).toBeGreaterThanOrEqual(expected)
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