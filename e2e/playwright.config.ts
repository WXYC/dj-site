import { defineConfig, devices } from "@playwright/test";

/**
 * E2E Test Configuration for dj-site
 *
 * Local development:
 * - dj-site (Next.js frontend) on :3000
 * - Backend-Service API on :8080
 * - Auth Service on :8082
 * - PostgreSQL on :5432 with test seed data
 *
 * CI (E2E profile):
 * - dj-site on :3000
 * - Backend-Service API on :8085
 * - Auth Service on :8084
 * - PostgreSQL on :5434
 */
export default defineConfig({
  testDir: "./tests",
  /* Output directory for test artifacts */
  outputDir: "../test-results",
  /* Run tests in files in parallel */
  fullyParallel: true,
  /* Fail the build on CI if you accidentally left test.only in the source code */
  forbidOnly: !!process.env.CI,
  /* Retry on CI only */
  retries: process.env.CI ? 2 : 0,
  /* Opt out of parallel tests on CI for stability */
  workers: process.env.CI ? 1 : undefined,
  /* Reporter to use */
  reporter: process.env.CI
    ? [
        ["github"],
        ["html", { outputFolder: "../playwright-report", open: "never" }],
        ["junit", { outputFile: "../test-results/junit.xml" }],
      ]
    : [
        ["html", { outputFolder: "../playwright-report" }],
        ["list"],
      ],
  /* Shared settings for all projects */
  use: {
    baseURL: process.env.E2E_BASE_URL || "http://localhost:3000",
    /* Collect trace when retrying the failed test */
    trace: "on-first-retry",
    /* Capture screenshot on failure */
    screenshot: "only-on-failure",
    /* Record video on first retry */
    video: "on-first-retry",
    /* Maximum time each action such as click() can take */
    actionTimeout: 10000,
  },

  /* Configure projects for major browsers */
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "firefox",
      use: { ...devices["Desktop Firefox"] },
    },
    {
      name: "webkit",
      use: { ...devices["Desktop Safari"] },
    },
  ],

  /* Configure timeout for individual tests */
  timeout: 60000,
  expect: {
    timeout: 15000,
  },

  /* Run your local dev server before starting the tests */
  // Uncomment if you want Playwright to automatically start the frontend
  // webServer: {
  //   command: "npm run dev",
  //   url: "http://localhost:3000",
  //   reuseExistingServer: !process.env.CI,
  //   timeout: 120000,
  // },
});
