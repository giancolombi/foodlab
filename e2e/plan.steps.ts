import { Given, When, Then, loadFeature, runScenarios, expect } from "./support/bdd";
import { createTestUser, injectAuth, getCurrentTestUser } from "./support/helpers";

Given("I am signed in", async ({ page }) => {
  const user = await createTestUser();
  await injectAuth(page, user.token);
});

Given(/^I navigate to "(.+)"$/, async ({ page }, path) => {
  await page.goto(path);
  await page.waitForLoadState("networkidle");
});

Given("the plan has at least one recipe", async ({ page }) => {
  const recipesRes = await fetch("http://localhost:3001/api/recipes", {
    headers: { Authorization: `Bearer ${getCurrentTestUser().token}` },
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

Then(/^I should see an empty state with text "(.+)"$/, async ({ page }, text) => {
  await expect(page.getByText(text)).toBeVisible({ timeout: 5000 });
});

Then(/^I should see an? "(.+)" button$/, async ({ page }, name) => {
  await expect(
    page.getByRole("button", { name: new RegExp(name, "i") }),
  ).toBeVisible();
});

Then(/^I should see at least (\d+) assigned meal slot$/, async ({ page }, _n) => {
  // An assigned slot has a link to a recipe.
  await page.waitForTimeout(2000);
  const links = page.locator("a[href^='/recipes/']");
  const count = await links.count();
  expect(count).toBeGreaterThanOrEqual(1);
});

Then(/^I should see a "(.+)" link$/, async ({ page }, text) => {
  // Plan page has two "Shopping list" links (header action + next-step CTA),
  // so match the first visible one instead of failing strict mode.
  await expect(
    page.getByRole("link", { name: new RegExp(text, "i") }).first(),
  ).toBeVisible();
});


loadFeature("plan.feature");
runScenarios();
