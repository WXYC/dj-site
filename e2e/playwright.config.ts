import { defineConfig, devices } from "@playwright/test";
import path from "path";

const authDir = path.join(__dirname, ".auth");

/**
 * Publishes the go-live takeover projects. Off by default, and set only by the
 * dedicated `e2e-takeover` workflow job.
 *
 * `testIgnore` on `chromium` keeps the takeover spec out of that project, but a
 * project is still a schedulable unit in its own right: every unscoped
 * invocation runs *all* projects, and neither the sharded job
 * (`npm run test:e2e -- --shard=N/4`) nor `scripts/e2e-local.sh` passes
 * `--project`. Without this gate the spec lands in a shard — on a
 * Backend-Service without FLOWSHEET_TAKEOVER_ENABLED, shared with a sibling
 * worker whose show its "End Existing Show" click is free to close.
 *
 * A gate rather than a `--project` flag at each call site because the property
 * that has to hold is "nothing schedules this by accident", and every new
 * invocation site would otherwise have to remember.
 */
const takeoverProjectsEnabled = process.env.E2E_TAKEOVER_PROJECT === "1";

/** Titles of the setup steps that provision the takeover spec's identity pair. */
const takeoverSetupTitle = /go-live takeover identity/;

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
      // The takeover pair's provisioning is a live admin-roster creation plus a
      // full onboarding flow, and this project is a dependency of `chromium`,
      // so leaving those two steps here makes all four shards pay for — and be
      // able to fail on — identities no test in `chromium` uses. They move to
      // `setup-takeover` below, which only exists when the takeover job asks.
      grepInvert: takeoverSetupTitle,
    },

    /* Main test project - uses storageState where configured in test files */
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
      dependencies: ["setup"],
      testMatch: /tests\/.+\.spec\.ts/,
      // go-live-takeover.spec.ts runs in its own workflow job against its
      // own Backend-Service (see chromium-takeover below and that job in
      // .github/workflows/e2e-tests.yml) — it must never also run here.
      // `mode: "serial"` inside that spec only serializes within its own
      // describe block; this config's `fullyParallel: true` plus 2 CI
      // workers would still schedule it alongside every other file in this
      // project, and within a shard two workers share one Backend-Service.
      // A takeover from that shared Backend would end a sibling worker's
      // show mid-test.
      testIgnore: /tests\/flowsheet\/go-live-takeover\.spec\.ts/,
    },

    /* go-live-takeover.spec.ts only, and only when E2E_TAKEOVER_PROJECT asks
     * for it. A dedicated project alone would not be enough isolation —
     * `workers` is a TestConfig-level option, not a TestProject one, so
     * project-level `fullyParallel: false` would still let Playwright schedule
     * this project's tests across this run's worker pool. Its own workflow job
     * invokes this project with `--workers=1` on the CLI, which is what
     * actually gives it a Backend-Service to itself. */
    ...(takeoverProjectsEnabled
      ? [
          {
            name: "setup-takeover",
            testMatch: /auth\.setup\.ts/,
            fullyParallel: false,
            grep: takeoverSetupTitle,
          },
          {
            name: "chromium-takeover",
            use: { ...devices["Desktop Chrome"] },
            dependencies: ["setup", "setup-takeover"],
            testMatch: /tests\/flowsheet\/go-live-takeover\.spec\.ts/,
          },
        ]
      : []),
  ],

  /* 20s per test — 15s is too tight for CI runners */
  timeout: 20000,
  expect: {
    /* Aligned with actionTimeout */
    timeout: 10000,
  },
});
