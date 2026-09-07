import { describe, expect, it } from "vitest";
import {
  loginHrefWithSignup,
  loginHrefWithoutSignup,
} from "@/src/utilities/loginHref";

// The query a Better Auth OIDC `authorize` bounce parks on /login.
const AUTHORIZE_QUERY =
  "client_id=wxyc-relying-party&response_type=code&redirect_uri=https%3A%2F%2Frp.example%2Fcb&state=xyz789";

describe("loginHrefWithSignup", () => {
  it("adds signup=1 to an empty query", () => {
    expect(loginHrefWithSignup(new URLSearchParams(""))).toBe(
      "/login?signup=1"
    );
  });

  it("adds signup=1 without a router context", () => {
    expect(loginHrefWithSignup(null)).toBe("/login?signup=1");
    expect(loginHrefWithSignup(undefined)).toBe("/login?signup=1");
  });

  it("keeps every param of a live authorize bounce", () => {
    const href = loginHrefWithSignup(new URLSearchParams(AUTHORIZE_QUERY));
    const target = new URL(href, "https://dj.wxyc.org");

    expect(target.pathname).toBe("/login");
    expect(target.searchParams.get("signup")).toBe("1");
    expect(target.searchParams.get("client_id")).toBe("wxyc-relying-party");
    expect(target.searchParams.get("response_type")).toBe("code");
    expect(target.searchParams.get("redirect_uri")).toBe("https://rp.example/cb");
    expect(target.searchParams.get("state")).toBe("xyz789");
  });

  it("does not stack a second signup value on an already-signup URL", () => {
    expect(loginHrefWithSignup(new URLSearchParams("signup=1"))).toBe(
      "/login?signup=1"
    );
  });
});

describe("loginHrefWithoutSignup", () => {
  it("returns the bare path when signup was the only param", () => {
    expect(loginHrefWithoutSignup(new URLSearchParams("signup=1"))).toBe(
      "/login"
    );
  });

  it("returns the bare path when there was no query at all", () => {
    expect(loginHrefWithoutSignup(new URLSearchParams(""))).toBe("/login");
    expect(loginHrefWithoutSignup(null)).toBe("/login");
  });

  it("drops only signup and keeps a live authorize bounce intact", () => {
    const href = loginHrefWithoutSignup(
      new URLSearchParams(`signup=1&${AUTHORIZE_QUERY}`)
    );
    const target = new URL(href, "https://dj.wxyc.org");

    expect(target.pathname).toBe("/login");
    expect(target.searchParams.get("signup")).toBeNull();
    expect(target.searchParams.get("client_id")).toBe("wxyc-relying-party");
    expect(target.searchParams.get("response_type")).toBe("code");
    expect(target.searchParams.get("redirect_uri")).toBe("https://rp.example/cb");
    expect(target.searchParams.get("state")).toBe("xyz789");
  });

  it("leaves an unrelated query untouched when there is no signup key", () => {
    expect(loginHrefWithoutSignup(new URLSearchParams("bounced=no-session"))).toBe(
      "/login?bounced=no-session"
    );
  });
});
