import { Given, When, Then, loadFeature, runScenarios, expect } from "./support/bdd";
import { createTestUser, signInUI } from "./support/helpers";

let testUser: { email: string; password: string; token: string; displayName: string };

Given("I am on the sign-up page", async ({ page }) => {
  await page.goto("/signup");
});

Given("I am on the sign-in page", async ({ page }) => {
  await page.goto("/signin");
});

Given(/^a user exists with email "(.+)" and password "(.+)"$/, async (_world, email, password) => {
  testUser = await createTestUser({ email, password });
});

Given("I am signed in", async ({ page }) => {
  testUser = await createTestUser();
  await signInUI(page, testUser.email, testUser.password);
});

When(/^I fill in "(.+)" with "(.+)"$/, async ({ page }, field, value) => {
  await page.locator(`#${field}`).fill(value);
});

When(/^I click the "(.+)" button$/, async ({ page }, name) => {
  await page.getByRole("button", { name: new RegExp(name, "i") }).click();
});

When("I click the sign-out button", async ({ page }) => {
  await page.getByRole("button", { name: /sign out|log out/i }).click();
});

Then("I should be on the home page", async ({ page }) => {
  await page.waitForURL("/", { timeout: 10000 });
  await expect(page).toHaveURL("/");
});

Then("I should be on the sign-in page", async ({ page }) => {
  await page.waitForURL(/signin/, { timeout: 10000 });
  await expect(page).toHaveURL(/signin/);
});

Then(/^I should see "(.+)" in the header$/, async ({ page }, text) => {
  await expect(page.locator("header")).toContainText(text);
});

loadFeature("auth.feature");
runScenarios();
