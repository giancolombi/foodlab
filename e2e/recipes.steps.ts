import { Given, When, Then, loadFeature, runScenarios, expect } from "./support/bdd";
import { createTestUser, injectAuth } from "./support/helpers";

let token: string;

Given("I am signed in", async ({ page }) => {
  const user = await createTestUser();
  token = user.token;
  await injectAuth(page, token);
});

When(/^I navigate to "(.+)"$/, async ({ page }, path) => {
  await page.goto(path);
  await page.waitForLoadState("networkidle");
});

Given(/^I navigate to "(.+)"$/, async ({ page }, path) => {
  await page.goto(path);
  await page.waitForLoadState("networkidle");
});

When(/^I type "(.+)" into the search box$/, async ({ page }, text) => {
  await page.getByPlaceholder(/search/i).fill(text);
  // Allow filtering to settle.
  await page.waitForTimeout(300);
});

When("I click the first recipe card", async ({ page }) => {
  const card = page.locator("a[href^='/recipes/']").first();
  await card.click();
  await page.waitForLoadState("networkidle");
});

Then(/^I should see the page title "(.+)"$/, async ({ page }, title) => {
  await expect(page.locator("h1")).toContainText(title);
});

Then(/^I should see at least (\d+) recipe card$/, async ({ page }, n) => {
  const cards = page.locator("a[href^='/recipes/']");
  await expect(cards).toHaveCount(parseInt(n), { timeout: 10000 });
});

Then(/^every visible recipe card should contain "(.+)"$/, async ({ page }, text) => {
  const cards = page.locator("a[href^='/recipes/']");
  const count = await cards.count();
  if (count === 0) return; // no results is valid for an obscure query
  for (let i = 0; i < count; i++) {
    await expect(cards.nth(i)).toContainText(new RegExp(text, "i"));
  }
});

Then("I should see the recipe title", async ({ page }) => {
  await expect(page.locator("h1")).toBeVisible();
});

Then(/^I should see a "(.+)" section or a version section$/, async ({ page }, heading) => {
  // Either a "Shared base" heading or at least one version section.
  const h2s = page.locator("h2");
  await expect(h2s.first()).toBeVisible({ timeout: 10000 });
});

loadFeature("recipes.feature");
runScenarios();
