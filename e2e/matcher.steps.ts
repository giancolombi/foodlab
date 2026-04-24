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

Then("the submit button should be disabled while streaming", async ({ page }) => {
  // After clicking submit, the button becomes disabled during streaming.
  const btn = page.getByRole("button", { name: /recommend|streaming/i });
  await expect(btn).toBeDisabled({ timeout: 5000 });
});

loadFeature("matcher.feature");
runScenarios();
