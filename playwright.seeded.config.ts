import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: "seeded.spec.ts",
  workers: 1,
  fullyParallel: false,
  reporter: "list",
  timeout: 45_000,
  use: {
    baseURL: "http://127.0.0.1:3000",
    ...devices["Desktop Chrome"],
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    storageState: "test-results/seeded-auth.json",
  },
  webServer: {
    command: "npm start -- --hostname 127.0.0.1",
    url: "http://127.0.0.1:3000/api/health",
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
