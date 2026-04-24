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
  // Some pages render the same action twice (header CTA + empty-state CTA),
  // so target the first match to avoid strict-mode violations.
  const button = page
    .getByRole("button", { name: new RegExp(name, "i") })
    .first();
  if (/clear/i.test(name)) {
    // "Clear week" / "Clear bought" trigger a confirm() dialog — wait for it
    // alongside the click so the handler is attached before the dialog fires.
    await Promise.all([
      page.waitForEvent("dialog").then((d) => d.accept()),
      button.click(),
    ]);
  } else {
    await button.click();
  }
});

When("I click the sign-out button", async ({ page }) => {
  await page.getByRole("button", { name: /sign out|log out/i }).click();
});

Then("I should be on the home page", async ({ page }) => {
  // After sign-up the app may redirect to /profiles or / depending on state.
  await page.waitForURL((url) => !url.pathname.includes("sign"), { timeout: 10000 });
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
