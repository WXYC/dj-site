import { describe, it, expect } from "vitest";
import { getOidcRedirectTarget } from "./oidcRedirectTarget";

const AUTH_BASE = "https://api.wxyc.org/auth";

describe("getOidcRedirectTarget", () => {
  it("returns the authorize URL when client_id and response_type=code are both present", () => {
    const params = new URLSearchParams(
      "client_id=flowsheet&response_type=code&redirect_uri=https://flowsheet.wxyc.org/auth/callback&state=xyz&code_challenge=abc&code_challenge_method=S256"
    );

    expect(getOidcRedirectTarget(params, AUTH_BASE)).toBe(
      `${AUTH_BASE}/oauth2/authorize?${params.toString()}`
    );
  });

  it("preserves every query param the authorize endpoint sent here (round-trip contract)", () => {
    // Better Auth's `oidcProvider` redirects to `${loginPage}?${full original
    // query string}` and expects the loginPage to bounce back to authorize
    // with the same params so it can re-run with the now-established session.
    // Dropping or mutating params here breaks PKCE / state binding.
    const params = new URLSearchParams(
      "client_id=flowsheet&response_type=code&scope=openid+profile&state=opaque%2Btoken&redirect_uri=https%3A%2F%2Fexample%2Fcb"
    );

    const target = getOidcRedirectTarget(params, AUTH_BASE);
    expect(target).not.toBeNull();
    const back = new URL(target!);
    expect(back.searchParams.get("client_id")).toBe("flowsheet");
    expect(back.searchParams.get("response_type")).toBe("code");
    expect(back.searchParams.get("state")).toBe("opaque+token");
    expect(back.searchParams.get("redirect_uri")).toBe("https://example/cb");
    expect(back.searchParams.get("scope")).toBe("openid profile");
  });

  it("returns null when client_id is missing", () => {
    const params = new URLSearchParams("response_type=code");
    expect(getOidcRedirectTarget(params, AUTH_BASE)).toBeNull();
  });

  it("returns null when response_type is missing", () => {
    const params = new URLSearchParams("client_id=flowsheet");
    expect(getOidcRedirectTarget(params, AUTH_BASE)).toBeNull();
  });

  it("returns null when response_type is something other than code", () => {
    // `response_type=token` is the OAuth implicit flow. The Better Auth
    // `oidcProvider` plugin only supports `code`, so a bare `response_type`
    // value of anything else means this isn't an authorize bounce we should
    // honor — fall back to the normal dashboard redirect.
    const params = new URLSearchParams(
      "client_id=flowsheet&response_type=token"
    );
    expect(getOidcRedirectTarget(params, AUTH_BASE)).toBeNull();
  });

  it("returns null for an unrelated /login visit with no OIDC params", () => {
    const params = new URLSearchParams("incomplete=true");
    expect(getOidcRedirectTarget(params, AUTH_BASE)).toBeNull();
  });

  it("strips a trailing slash on the auth base URL before appending /oauth2/authorize", () => {
    // Operators routinely paste `https://api.wxyc.org/auth/` with a trailing
    // slash. A doubled slash (`/auth//oauth2/authorize`) silently breaks the
    // round-trip on some proxies. Normalize at the boundary.
    const params = new URLSearchParams(
      "client_id=flowsheet&response_type=code"
    );

    expect(getOidcRedirectTarget(params, "https://api.wxyc.org/auth/")).toBe(
      `https://api.wxyc.org/auth/oauth2/authorize?${params.toString()}`
    );
  });
});
