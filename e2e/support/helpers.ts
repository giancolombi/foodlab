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

// Tracks the most recently signed-in user so step definitions registered in
// other files (plan, cart, profiles) can reach the token even when the
// `I am signed in` step that claimed the scenario lives in auth.steps.ts.
let currentTestUser: TestUser | null = null;

export function getCurrentTestUser(): TestUser {
  if (!currentTestUser) throw new Error("No test user signed in — call createTestUser first");
  return currentTestUser;
}

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
  if (res.status === 409) {
    // Already exists — sign in instead.
    const signInRes = await fetch(`${API_BASE}/auth/signin`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    if (!signInRes.ok) throw new Error(`Sign-in fallback failed: ${signInRes.status}`);
    const data = await signInRes.json();
    currentTestUser = { email, password, displayName, token: data.token };
    return currentTestUser;
  }
  if (!res.ok) {
    throw new Error(`Failed to create test user: ${res.status} ${await res.text()}`);
  }
  const data = await res.json();
  currentTestUser = { email, password, displayName, token: data.token };
  return currentTestUser;
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
  // Set token before the app boots so AuthContext picks it up on /auth/me.
  await page.context().addCookies([]); // ensure context is initialized
  await page.goto("/signin", { waitUntil: "commit" });
  await page.evaluate((t) => localStorage.setItem("foodlab_token", t), token);
  await page.goto("/");
  // Wait for either the home page or a redirect — AuthContext needs time
  // to call /auth/me and set the user before ProtectedRoute lets us through.
  await page.waitForURL((url) => !url.pathname.includes("signin"), {
    timeout: 10000,
  });
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
