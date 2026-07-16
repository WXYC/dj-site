import { test, expect } from "../../fixtures/auth.fixture";
import path from "path";

const authDir = path.join(__dirname, "../../.auth");

/**
 * Scope: the dj-site hop only. An already-signed-in, verified, onboarding-
 * complete DJ arriving at /login with OIDC authorize params is server-redirected
 * to /auth/oauth2/authorize with the query (state + PKCE included) preserved,
 * instead of being dropped to the dashboard.
 *
 * The full authorize round-trip needs a registered OIDC client seeded in the
 * Backend-Service E2E auth instance, which does not exist yet. So this asserts
 * only the hop: wait for the request to /auth/oauth2/authorize and check its
 * params. The authorize navigation arrives asynchronously after the /login
 * response settles, so the wait is load-bearing — sampling synchronously right
 * after goto misses it. Asserting on the request (not its response) tolerates
 * the upstream 4xx'ing the unregistered fake client after the hop.
 */
test.describe("OIDC authorize continuation (signed-in DJ)", () => {
  // dj2's saved session is verified and onboarding-complete, and no other spec
  // logs it out, so it survives arbitrary shard ordering.
  test.use({ storageState: path.join(authDir, "dj2.json") });

  test("redirects /login → /auth/oauth2/authorize with OIDC params preserved", async ({
    page,
  }) => {
    const oidcParams = new URLSearchParams({
      client_id: "e2e-oidc-continuation-probe",
      response_type: "code",
      redirect_uri: "https://client.example.wxyc.org/callback",
      state: "e2e-state-8f3c1a",
      code_challenge: "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM",
      code_challenge_method: "S256",
      scope: "openid profile",
    });

    // Register the wait before navigating so no request is missed. "commit"
    // lets goto resolve without waiting for a full load the authorize hop may
    // interrupt.
    const authorizeRequest = page.waitForRequest(
      (req) => req.url().includes("/auth/oauth2/authorize"),
      { timeout: 12000 }
    );
    await page.goto(`/login?${oidcParams.toString()}`, { waitUntil: "commit" });

    let target: URL;
    try {
      target = new URL((await authorizeRequest).url());
    } catch {
      throw new Error(
        `expected a navigation to /auth/oauth2/authorize; browser settled at ${page.url()}`
      );
    }

    expect(target.pathname).toBe("/auth/oauth2/authorize");
    for (const [key, value] of Array.from(oidcParams.entries())) {
      expect(
        target.searchParams.get(key),
        `authorize param "${key}" preserved`
      ).toBe(value);
    }
  });

  test("plain /login lands on the dashboard (control)", async ({ page }) => {
    await page.goto("/login");

    await page.waitForURL((url) => url.pathname.startsWith("/dashboard"), {
      timeout: 15000,
    });
    expect(new URL(page.url()).pathname).not.toContain("/login");
  });
});
