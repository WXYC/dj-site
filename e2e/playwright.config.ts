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
  /* Retry once on CI to absorb timing flakiness from shared runners */
  retries: process.env.CI ? 1 : 0,
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
    /* Retain trace + video for every failed attempt, not just the retry.
     * When the original attempt fails differently than the retry (timeout
     * on first run, hang on second), we need both traces to discriminate
     * between hypotheses. Only failed attempts retain artifacts, so cost
     * scales with failure count (and per-spec retry overrides like
     * entry-caching's retries=2). See #572. */
    trace: "retain-on-failure",
    /* Capture screenshot on failure */
    screenshot: "only-on-failure",
    video: "retain-on-failure",
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

  /* 20s per test — 15s is too tight for CI runners */
  timeout: 20000,
  expect: {
    /* Aligned with actionTimeout */
    timeout: 10000,
  },
});
