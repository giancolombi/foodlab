// Shared test helpers — API seeding, auth, navigation shortcuts.

import type { Page } from "@playwright/test";

const API_BASE = "http://localhost:3001/api";

export interface TestUser {
  email: string;
  password: string;
  displayName: string;
  token: string;
}

let userCounter = 0;

/** Create a fresh user via the API and return credentials + token. */
export async function createTestUser(overrides?: Partial<TestUser>): Promise<TestUser> {
  userCounter++;
  const email = overrides?.email ?? `test${userCounter}-${Date.now()}@foodlab.test`;
  const password = overrides?.password ?? "TestPass123!";
  const displayName = overrides?.displayName ?? `Tester ${userCounter}`;

  const res = await fetch(`${API_BASE}/auth/signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, displayName }),
  });
  if (!res.ok) {
    throw new Error(`Failed to create test user: ${res.status} ${await res.text()}`);
  }
  const data = await res.json();
  return { email, password, displayName, token: data.token };
}

/** Sign in through the UI. */
export async function signInUI(page: Page, email: string, password: string) {
  await page.goto("/signin");
  await page.getByLabel(/email/i).fill(email);
  await page.getByLabel(/password/i).fill(password);
  await page.getByRole("button", { name: /sign in/i }).click();
  // Wait for redirect to home.
  await page.waitForURL("/", { timeout: 10000 });
}

/** Inject a token into localStorage so the page is already authenticated. */
export async function injectAuth(page: Page, token: string) {
  await page.goto("/signin");
  await page.evaluate((t) => localStorage.setItem("foodlab_token", t), token);
  await page.goto("/");
  await page.waitForURL("/", { timeout: 10000 });
}

/** Create a profile via the API. */
export async function createProfile(
  token: string,
  profile: { name: string; restrictions?: string[]; preferences?: string[]; allergies?: string[] },
) {
  const res = await fetch(`${API_BASE}/profiles`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      restrictions: [],
      preferences: [],
      allergies: [],
      ...profile,
    }),
  });
  if (!res.ok) throw new Error(`Failed to create profile: ${res.status}`);
  return (await res.json()).profile;
}
