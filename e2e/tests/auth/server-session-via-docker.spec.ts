import { test, expect } from "@playwright/test";
import path from "path";

const authDir = path.join(__dirname, "..", "..", ".auth");
const DJ_STORAGE = path.join(authDir, "dj2.json");

/**
 * Regression test for `lib/features/authentication/server-client.ts:getBaseURL()`.
 *
 * Bug (surfaced 2026-05-26 live-updates staging bring-up): in container
 * deployments where the auth service is reachable from the host at
 * `NEXT_PUBLIC_BETTER_AUTH_URL` but NOT from inside the dj-site container
 * (because the container's `localhost` is the container itself, not the
 * host), `getServerSession()` silently returns null and SSR-only routes
 * redirect to `/login`. Fix adds `AUTH_REWRITE_URL` as a higher-precedence
 * server-only override, matching the rewrite path in next.config.mjs:7-10.
 *
 * Test strategy: rather than spinning up an actual Docker stack, we simulate
 * the bug surface by running a SECOND dj-site instance built with
 * `NEXT_PUBLIC_BETTER_AUTH_URL=http://127.0.0.99:9999/auth` (a loopback
 * address nothing listens on, so connections fail fast with ECONNREFUSED).
 * `AUTH_REWRITE_URL=http://localhost:8084/auth` (the real auth) is exported
 * at runtime. The failure modes are identical to the Docker scenario:
 *
 *   Docker:     `localhost:8082` resolves to the container itself; auth lives
 *               at the service-name `http://auth:8082/auth`.
 *   Simulated:  `127.0.0.99:9999` has no listener; auth lives at
 *               `http://localhost:8084/auth`.
 *
 * In both cases the question is the same: does `getBaseURL()` prefer
 * `AUTH_REWRITE_URL` over `NEXT_PUBLIC_BETTER_AUTH_URL`? With the fix:
 * yes -> SSR session fetch succeeds -> dashboard renders. Without the fix:
 * no -> session=null -> redirect to /login.
 *
 * The second instance is started by `scripts/e2e-local.sh` (and the CI
 * workflow) on `:$SECOND_FRONTEND_PORT` (default 3002). If the env var is
 * unset, the test is skipped — keeps `npx playwright test` against the
 * primary instance from failing on a missing instance.
 */

const SECOND_FRONTEND_PORT = process.env.SECOND_FRONTEND_PORT;
const SECOND_INSTANCE_URL = SECOND_FRONTEND_PORT
  ? `http://localhost:${SECOND_FRONTEND_PORT}`
  : null;

test.describe("Auth — SSR session via Docker-like split (AUTH_REWRITE_URL)", () => {
  test.skip(
    !SECOND_INSTANCE_URL,
    "Requires SECOND_FRONTEND_PORT env var (set by scripts/e2e-local.sh and the E2E CI workflow)."
  );

  test.use({ storageState: DJ_STORAGE, baseURL: SECOND_INSTANCE_URL ?? undefined });

  test("authed user lands on /dashboard/flowsheet, not /login", async ({ page }) => {
    const response = await page.goto("/dashboard/flowsheet");

    // The redirect-to-login bug manifests as either a 307 redirect or a
    // server-side `redirect()` that lands the URL on /login. Either way the
    // final URL is the assertion.
    expect(response).not.toBeNull();
    expect(page.url()).toContain("/dashboard/flowsheet");
    expect(page.url()).not.toContain("/login");

    // Sanity: confirm the dashboard actually rendered, not just that the URL
    // happens to match (e.g. via a partial server-rendered shell). The
    // flowsheet search form is dashboard-only.
    await expect(page.locator('[data-testid="flowsheet-search-form"]').first()).toBeVisible({
      timeout: 10_000,
    });
  });
});
