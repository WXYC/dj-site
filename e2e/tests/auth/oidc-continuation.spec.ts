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
 * the hop off the redirect chain rather than driving the upstream: the fake
 * client is unregistered, so authorize will 4xx after the hop — that landing is
 * irrelevant, the /login → /auth/oauth2/authorize redirect (params intact) is
 * what's in dj-site's control. Asserting the chain (not a route interception)
 * matters: Chromium follows a server 307 on a top-level navigation internally,
 * so page.route on the redirect target never fires — redirectedFrom() is the
 * documented way to see each server 3xx hop.
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

    // "commit" settles as soon as the final response commits, so an authorize
    // 4xx (unregistered client) can't hang or fail the navigation — page.goto
    // rejects on transport errors, not HTTP status.
    const response = await page.goto(`/login?${oidcParams.toString()}`, {
      waitUntil: "commit",
    });

    // Walk the redirect chain: response.request() is the final hop, and
    // redirectedFrom() steps back through every preceding server 3xx.
    const chain: string[] = [];
    let request = response?.request() ?? null;
    while (request) {
      chain.push(request.url());
      request = request.redirectedFrom();
    }

    const authorizeHop = chain.find(
      (url) => new URL(url).pathname === "/auth/oauth2/authorize"
    );
    expect(
      authorizeHop,
      `expected a /auth/oauth2/authorize hop in the redirect chain, saw: ${chain.join(
        " <- "
      )}`
    ).toBeDefined();

    const target = new URL(authorizeHop as string);
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
