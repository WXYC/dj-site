import { defineConfig, devices } from "@playwright/test";
import path from "path";

const authDir = path.join(__dirname, ".auth");

/**
 * E2E Test Configuration for dj-site
 *
 * Uses authenticated storage state to speed up tests:
 * - Setup project logs in once per role and saves session
 * - Test projects reuse saved sessions (no login per test)
 *
 * Projects:
 * - setup: Authenticates and saves session state for each role
 * - chromium: Runs all tests with appropriate auth state
 */
export default defineConfig({
  testDir: ".",
  /* Output directory for test artifacts */
  outputDir: "../test-results",
  /* Hard cap on entire Playwright run to prevent runaway CI */
  globalTimeout: 10 * 60 * 1000,
  /* Run tests in files in parallel */
  fullyParallel: true,
  /* Fail the build on CI if you accidentally left test.only in the source code */
  forbidOnly: !!process.env.CI,
  /* No retries during development -- re-enable once suite is stable */
  retries: 0,
  /* Limit parallel workers to avoid overwhelming auth service */
  workers: process.env.CI ? 2 : 3,
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

  projects: [
    /* Setup project - authenticates and saves session state */
    /* Run sequentially to avoid auth service concurrency issues */
    {
      name: "setup",
      testMatch: /auth\.setup\.ts/,
      fullyParallel: false,
    },

    /* Main test project - uses storageState where configured in test files */
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
      dependencies: ["setup"],
      testMatch: /tests\/.+\.spec\.ts/,
    },
  ],

  /* 15s per test (3x the ~5s baseline) */
  timeout: 15000,
  expect: {
    /* Aligned with actionTimeout */
    timeout: 10000,
  },
});
