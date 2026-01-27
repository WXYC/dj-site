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
  testDir: "./tests",
  /* Output directory for test artifacts */
  outputDir: "../test-results",
  /* Run tests in files in parallel */
  fullyParallel: true,
  /* Fail the build on CI if you accidentally left test.only in the source code */
  forbidOnly: !!process.env.CI,
  /* Retry on CI only */
  retries: process.env.CI ? 2 : 0,
  /* Parallel workers - safe with session reuse */
  workers: process.env.CI ? 4 : undefined,
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
    {
      name: "setup",
      testMatch: /auth\.setup\.ts/,
    },

    /* Main test project - uses storageState where configured in test files */
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
      dependencies: ["setup"],
      testIgnore: /auth\.setup\.ts/,
    },
  ],

  /* Configure timeout for individual tests */
  timeout: 60000,
  expect: {
    timeout: 15000,
  },
});
