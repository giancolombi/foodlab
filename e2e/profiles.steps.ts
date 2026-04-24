import { Given, When, Then, loadFeature, runScenarios, expect } from "./support/bdd";
import { createTestUser, injectAuth, createProfile } from "./support/helpers";

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

Given(/^a profile "(.+)" exists$/, async () => {
  await createProfile(token, { name: "Gian", restrictions: ["no soy"] });
});

When(/^I click the "(.+)" button$/, async ({ page }, name) => {
  await page.getByRole("button", { name: new RegExp(name, "i") }).click();
});

When(/^I fill in "(.+)" with "(.+)"$/, async ({ page }, field, value) => {
  await page.locator(`#${field}`).fill(value);
});

When(/^I click the edit button for "(.+)"$/, async ({ page }, name) => {
  const card = page.locator("div").filter({ hasText: name }).first();
  await card.getByRole("button", { name: /edit/i }).or(
    card.locator("button").filter({ has: page.locator("svg.lucide-pencil") })
  ).first().click();
});

When(/^I click the delete button for "(.+)"$/, async ({ page }, name) => {
  const card = page.locator("div").filter({ hasText: name }).first();
  await card.getByRole("button", { name: /delete/i }).or(
    card.locator("button").filter({ has: page.locator("svg.lucide-trash-2") })
  ).first().click();
});

When("I confirm the dialog", async ({ page }) => {
  page.on("dialog", (d) => d.accept());
  // Re-trigger for already-queued dialogs.
  await page.waitForTimeout(200);
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
