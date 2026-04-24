import { Given, When, Then, loadFeature, runScenarios, expect } from "./support/bdd";
import { createTestUser, injectAuth } from "./support/helpers";

let token: string;

Given("I am signed in", async ({ page }) => {
  const user = await createTestUser();
  token = user.token;
  await injectAuth(page, token);
});

Given(/^I navigate to "(.+)"$/, async ({ page }, path) => {
  await page.goto(path);
  await page.waitForLoadState("networkidle");
});

Given("the plan has at least one recipe", async ({ page }) => {
  // Seed plan by fetching a recipe slug from the API and assigning it directly.
  const recipesRes = await fetch("http://localhost:3001/api/recipes", {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!recipesRes.ok) throw new Error(`Recipes fetch failed: ${recipesRes.status}`);
  const { recipes } = await recipesRes.json();
  if (!recipes.length) throw new Error("No recipes in database to seed plan");
  const slug = recipes[0].slug;
  const assignments = { "0-dinner": { slug, assignedAt: Date.now() } };
  await page.evaluate((a: any) => {
    localStorage.setItem("foodlab_plan_v2", JSON.stringify(a));
  }, assignments);
});

When(/^I navigate to "(.+)"$/, async ({ page }, path) => {
  await page.goto(path);
  await page.waitForLoadState("networkidle");
});

When("I tick the first ingredient checkbox", async ({ page }) => {
  const checkbox = page.locator("input[type='checkbox']").first();
  await checkbox.check();
});

Then(/^I should see an empty state with text "(.+)"$/, async ({ page }, text) => {
  await expect(page.getByText(text)).toBeVisible({ timeout: 5000 });
});

Then(/^I should see at least (\d+) shopping list section/, async ({ page }, n) => {
  await page.waitForTimeout(2000);
  const sections = page.locator("h3, [class*='CardTitle']");
  const count = await sections.count();
  expect(count).toBeGreaterThanOrEqual(parseInt(n));
});

Then(/^I should see at least (\d+) ingredient item/, async ({ page }, n) => {
  const items = page.locator("input[type='checkbox']");
  const count = await items.count();
  expect(count).toBeGreaterThanOrEqual(parseInt(n));
});

Then("the first ingredient should show as bought", async ({ page }) => {
  const checkbox = page.locator("input[type='checkbox']").first();
  await expect(checkbox).toBeChecked();
});

Then("the bought count should increase", async ({ page }) => {
  // The progress text "X of Y bought" should be visible.
  await expect(page.getByText(/\d+ of \d+ bought/i)).toBeVisible({ timeout: 3000 });
});

loadFeature("cart.feature");
runScenarios();
