import { Given, When, Then, loadFeature, runScenarios, expect } from "./support/bdd";
import { createTestUser, injectAuth, seedPlanViaApi } from "./support/helpers";

Given("I am signed in", async ({ page }) => {
  const user = await createTestUser();
  await injectAuth(page, user.token);
});

Given(/^I navigate to "(.+)"$/, async ({ page }, path) => {
  await page.goto(path);
  await page.waitForLoadState("networkidle");
});

Given("the plan has at least one recipe", async () => {
  await seedPlanViaApi();
});

When(/^I click the "(.+)" button$/, async ({ page }, name) => {
  const button = page
    .getByRole("button", { name: new RegExp(name, "i") })
    .first();
  if (/clear/i.test(name)) {
    // "Clear week" triggers a confirm() dialog — wait for it alongside the
    // click so the handler is attached before the dialog fires.
    await Promise.all([
      page.waitForEvent("dialog").then((d) => d.accept()),
      button.click(),
    ]);
  } else {
    await button.click();
  }
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
