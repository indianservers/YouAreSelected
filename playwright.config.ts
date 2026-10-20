import { defineConfig, devices } from "@playwright/test";
import { randomBytes } from "node:crypto";
// Random credentials exist only for the isolated test harness, never production.
process.env.E2E_ADMIN_PASSWORD ??= randomBytes(24).toString("base64url");
process.env.E2E_ADMIN_EMAIL ??= "admin@isolated.test";
export default defineConfig({
  testDir: "./e2e",
  timeout: 180000,
  expect: { timeout: 20000 },
  workers: 1,
  fullyParallel: false,
  use: { baseURL: "http://localhost:3000", trace: "off" },
  webServer: {
    command: "npx tsx scripts/test-server.mts",
    url: "http://localhost:3000",
    reuseExistingServer: false,
    timeout: 120000,
    env: {
      E2E_ADMIN_PASSWORD: process.env.E2E_ADMIN_PASSWORD,
      E2E_ADMIN_EMAIL: process.env.E2E_ADMIN_EMAIL,
    },
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
