// Lightweight BDD helper that maps Gherkin-style feature files to Playwright
// tests. Each .feature file is parsed into scenarios, and step definitions
// are matched by regex against a registry built via Given/When/Then helpers.
//
// Usage in .steps.ts files:
//   import { loadFeature, Given, When, Then, runScenarios } from "./support/bdd";
//   Given("I am on the home page", async ({ page }) => { ... });
//   loadFeature("auth.feature");
//   runScenarios();

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { test, expect, type Page, type BrowserContext } from "@playwright/test";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export { expect };

export interface World {
  page: Page;
  context: BrowserContext;
}

type StepFn = (world: World, ...args: string[]) => Promise<void> | void;

interface StepDef {
  pattern: RegExp;
  fn: StepFn;
}

const steps: StepDef[] = [];

function register(pattern: string | RegExp, fn: StepFn) {
  const re = typeof pattern === "string"
    ? new RegExp("^" + pattern.replace(/\{string\}/g, '"([^"]*)"').replace(/\{int\}/g, "(\\d+)") + "$")
    : pattern;
  steps.push({ pattern: re, fn });
}

export const Given = register;
export const When = register;
export const Then = register;

interface Scenario {
  name: string;
  steps: Array<{ keyword: string; text: string }>;
}

let scenarios: Scenario[] = [];

export function loadFeature(featureFile: string) {
  const filePath = path.resolve(__dirname, "..", featureFile);
  const content = fs.readFileSync(filePath, "utf-8");
  const lines = content.split("\n");

  let current: Scenario | null = null;
  for (const raw of lines) {
    const line = raw.trim();
    if (line.startsWith("Scenario:")) {
      if (current) scenarios.push(current);
      current = { name: line.replace("Scenario:", "").trim(), steps: [] };
    } else if (/^(Given|When|Then|And|But)\s/.test(line)) {
      if (!current) continue;
      const match = line.match(/^(Given|When|Then|And|But)\s+(.*)/);
      if (match) {
        current.steps.push({ keyword: match[1], text: match[2] });
      }
    }
  }
  if (current) scenarios.push(current);
}

export function runScenarios() {
  const toRun = [...scenarios];
  scenarios = [];

  for (const scenario of toRun) {
    test(scenario.name, async ({ page, context }) => {
      const world: World = { page, context };
      for (const step of scenario.steps) {
        const def = steps.find((s) => s.pattern.test(step.text));
        if (!def) {
          throw new Error(
            `No step definition matches: "${step.text}"\n` +
            `Registered patterns:\n${steps.map((s) => `  ${s.pattern}`).join("\n")}`,
          );
        }
        const match = step.text.match(def.pattern)!;
        const args = match.slice(1);
        await def.fn(world, ...args);
      }
    });
  }
}
