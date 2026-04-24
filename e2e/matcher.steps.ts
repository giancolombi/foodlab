import { Given, When, Then, loadFeature, runScenarios, expect } from "./support/bdd";
import { createTestUser, injectAuth } from "./support/helpers";

Given("I am signed in", async ({ page }) => {
  const user = await createTestUser();
  await injectAuth(page, user.token);
});

Given(/^I navigate to "(.+)"$/, async ({ page }, path) => {
  await page.goto(path);
  await page.waitForLoadState("networkidle");
});

When(/^I enter "(.+)" as ingredients$/, async ({ page }, text) => {
  await page.locator("textarea").first().fill(text);
});

When(/^I click the "(.+)" button$/, async ({ page }, name) => {
  await page.getByRole("button", { name: new RegExp(name, "i") }).click();
});

Then("I should see a loading indicator", async ({ page }) => {
  // Either the streaming indicator or the "thinking" text.
  const indicator = page.getByText(/thinking|streaming|progress/i)
    .or(page.locator(".animate-ping"));
  await expect(indicator.first()).toBeVisible({ timeout: 10000 });
});

loadFeature("matcher.feature");
runScenarios();
