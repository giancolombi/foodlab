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
  // Auto-fill via API.
  const res = await fetch("http://localhost:3001/api/plans/generate", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ profileIds: [], excludeSlugs: [] }),
  });
  if (!res.ok) throw new Error(`Generate failed: ${res.status}`);
  const { assignments } = await res.json();
  // Save to plan API.
  await fetch("http://localhost:3001/api/plans", {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ assignments, activeProfileIds: [], includeServeWith: false }),
  });
  // Inject into localStorage so the page picks it up.
  await page.evaluate((a: any) => {
    localStorage.setItem("foodlab_plan_v2", JSON.stringify(a));
  }, assignments);
});

When(/^I click the "(.+)" button$/, async ({ page }, name) => {
  await page.getByRole("button", { name: new RegExp(name, "i") }).click();
});

When("I confirm the dialog", async ({ page }) => {
  page.on("dialog", (d) => d.accept());
  await page.waitForTimeout(200);
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
  await expect(page.getByRole("link", { name: new RegExp(text, "i") })).toBeVisible();
});

Then("I should see an empty state", async ({ page }) => {
  await page.waitForTimeout(1000);
  // After clearing, either the empty state text or the dashed placeholder slots appear.
  const empty = page.getByText(/no meals planned/i);
  await expect(empty).toBeVisible({ timeout: 5000 });
});

loadFeature("plan.feature");
runScenarios();
