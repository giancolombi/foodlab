import { Given, When, Then, loadFeature, runScenarios, expect } from "./support/bdd";
import {
  createTestUser,
  injectAuth,
  createProfile,
  getCurrentTestUser,
} from "./support/helpers";

Given("I am signed in", async ({ page }) => {
  const user = await createTestUser();
  await injectAuth(page, user.token);
});

Given(/^I navigate to "(.+)"$/, async ({ page }, path) => {
  await page.goto(path);
  await page.waitForLoadState("networkidle");
});

Given(/^a profile "(.+)" exists$/, async (_world, name) => {
  await createProfile(getCurrentTestUser().token, { name, restrictions: ["no soy"] });
});

When(/^I click the "(.+)" button$/, async ({ page }, name) => {
  await page.getByRole("button", { name: new RegExp(name, "i") }).first().click();
});

When(/^I fill in "(.+)" with "(.+)"$/, async ({ page }, field, value) => {
  await page.locator(`#${field}`).fill(value);
});

When(/^I click the edit button for "(.+)"$/, async ({ page }, name) => {
  // Find the card whose title matches, then click its labeled edit button.
  const card = page.locator("[class*='card' i], [data-slot='card']").filter({ hasText: name }).first();
  await card.getByRole("button", { name: /edit profile/i }).click();
});

When(/^I click the delete button for "(.+)"$/, async ({ page }, name) => {
  page.once("dialog", (d) => d.accept());
  const card = page.locator("[class*='card' i], [data-slot='card']").filter({ hasText: name }).first();
  await card.getByRole("button", { name: /delete this profile/i }).click();
});

When("I confirm the dialog", async () => {
  // Dialog is accepted by the handler registered in the delete step;
  // the assertion that follows does the waiting.
});

Then(/^I should see a profile card for "(.+)"$/, async ({ page }, name) => {
  await expect(page.getByText(name)).toBeVisible({ timeout: 5000 });
});

Then(/^the profile card should show "(.+)" and "(.+)"$/, async ({ page }, a, b) => {
  await expect(page.getByText(a)).toBeVisible();
  await expect(page.getByText(b)).toBeVisible();
});

Then(/^the profile card for "(.+)" should show "(.+)" and "(.+)"$/, async ({ page }, _name, a, b) => {
  await expect(page.getByText(a)).toBeVisible();
  await expect(page.getByText(b)).toBeVisible();
});

Then(/^I should not see a profile card for "(.+)"$/, async ({ page }, name) => {
  await expect(page.getByText(name)).not.toBeVisible({ timeout: 5000 });
});

loadFeature("profiles.feature");
runScenarios();
