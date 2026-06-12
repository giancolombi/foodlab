import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  testMatch: "**/*.steps.ts",
  fullyParallel: false,
  retries: 0,
  workers: 1,
  reporter: "list",
  use: {
    // Vite dev serves on 8080 (vite.config.ts), same port as the Docker app.
    baseURL: process.env.BASE_URL || "http://localhost:8080",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  // Boot the stack when it isn't already running (Postgres must be up —
  // `docker compose up -d db`). With BASE_URL set we assume an external
  // stack and start nothing.
  webServer: process.env.BASE_URL
    ? undefined
    : [
        {
          // migrate → seed → api on :3001
          command: "pnpm start",
          url: "http://localhost:3001/api/health",
          reuseExistingServer: true,
          timeout: 120_000,
        },
        {
          command: "pnpm dev",
          url: "http://localhost:8080",
          reuseExistingServer: true,
          timeout: 120_000,
        },
      ],
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "mobile",
      use: { ...devices["iPhone 14"] },
    },
  ],
});
