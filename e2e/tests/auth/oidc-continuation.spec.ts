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
 * Backend-Service E2E auth instance, which does not exist yet. So the upstream
 * authorize request is intercepted and stubbed rather than driven: the assertion
 * stays entirely within dj-site's control and never depends on the fake client
 * being accepted (the upstream would 4xx an unregistered client after the hop).
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

    // Intercepting the hop's target keeps the navigation from reaching the auth
    // proxy: recording the request URL proves dj-site issued the redirect, and
    // the stub response lets page.goto settle without a live authorize endpoint.
    let authorizeUrl: string | undefined;
    await page.route("**/oauth2/authorize**", async (route) => {
      authorizeUrl = route.request().url();
      await route.fulfill({
        status: 200,
        contentType: "text/plain",
        body: "intercepted",
      });
    });

    await page.goto(`/login?${oidcParams.toString()}`);

    expect(
      authorizeUrl,
      "expected dj-site to server-redirect /login to /auth/oauth2/authorize"
    ).toBeDefined();

    const target = new URL(authorizeUrl as string);
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
