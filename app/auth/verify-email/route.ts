import { NextRequest, NextResponse } from "next/server";

/**
 * Intercepts better-auth's email verification links. The backend keeps its
 * baseURL as api.wxyc.org (to preserve JWT issuer/audience and JWKS) but
 * rewrites the verification link's host to dj.wxyc.org, which lands here —
 * this filesystem route takes precedence over the Next.js rewrite.
 *
 * Forwards the request to the real backend, strips the backend's Domain=
 * attribute from any Set-Cookie response so the cookie scopes to the
 * frontend domain, and redirects the browser with a clean URL. If the
 * backend set session cookies (autoSignInAfterVerification), the user lands
 * signed in; otherwise they're sent to /login to sign in manually.
 */

/**
 * getSetCookie() is the standard way to read multiple Set-Cookie headers but
 * isn't available in every runtime (some Cloudflare Workers / OpenNext
 * polyfills omit it); fall back to splitting the raw joined header on ", "
 * followed by what looks like a cookie name, since real cookie values rarely
 * contain that sequence themselves (e.g. "Expires=Thu, 01 Jan 2026 …").
 */
function extractSetCookieHeaders(headers: Headers): string[] {
  if (typeof headers.getSetCookie === "function") {
    const cookies = headers.getSetCookie();
    if (cookies.length > 0) return cookies;
  }

  const raw = headers.get("set-cookie");
  if (!raw) return [];

  return raw.split(/,\s*(?=[A-Za-z0-9_.-]+=)/).map((s) => s.trim());
}

/**
 * Constrains a caller-supplied `callbackURL` to a same-origin relative path.
 * Rejects absolute URLs, protocol-relative `//host`, and backslash-escaped
 * `/\host` (browsers may treat it as `//host`) in favour of `fallback`, then
 * re-resolves against the request origin to catch encoded-slash tricks the
 * URL parser would otherwise normalise into `//host` (#597) — without this,
 * the route becomes an open redirect that also leaks the session cookie
 * off-site.
 */
function safeCallbackPath(
  raw: string | null,
  requestUrl: string,
  fallback: string,
): string {
  if (!raw) return fallback;

  if (!raw.startsWith("/") || raw.startsWith("//") || raw.startsWith("/\\")) {
    return fallback;
  }

  try {
    const requestOrigin = new URL(requestUrl).origin;
    const resolved = new URL(raw, requestUrl);
    if (resolved.origin !== requestOrigin) return fallback;
    return resolved.pathname + resolved.search + resolved.hash;
  } catch {
    return fallback;
  }
}

// HEAD gives email-client link previews a cheap 200 without consuming the
// token or triggering verification.
export function HEAD() {
  return new Response(null, { status: 200 });
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const token = searchParams.get("token");
  // callbackURL normally arrives relative (e.g. "/onboarding") since the
  // backend rewrites only the host, but nothing guarantees that — see
  // safeCallbackPath (#597).
  const rawCallbackURL = searchParams.get("callbackURL");
  const callbackURL = safeCallbackPath(rawCallbackURL, request.url, "/onboarding");

  if (!token) {
    const dest = new URL("/login?error=missing-verification-token", request.url);
    return NextResponse.redirect(dest);
  }

  const backendBaseURL =
    process.env.NEXT_PUBLIC_BETTER_AUTH_URL || "https://api.wxyc.org/auth";

  // redirect: "manual" lets us inspect response headers (especially
  // Set-Cookie) instead of following the redirect blindly.
  const backendURL = new URL(`${backendBaseURL}/verify-email`);
  backendURL.searchParams.set("token", token);
  if (rawCallbackURL) {
    // Forward the sanitised value, never the attacker-supplied raw one.
    backendURL.searchParams.set("callbackURL", callbackURL);
  }

  try {
    const backendResponse = await fetch(backendURL.toString(), {
      redirect: "manual",
    });

    const status = backendResponse.status;
    console.log(
      `[verify-email] backend responded ${status}; ` +
        `Location: ${backendResponse.headers.get("location") ?? "(none)"}; ` +
        `Set-Cookie present: ${backendResponse.headers.has("set-cookie")}`
    );

    // 302/301 means the backend is redirecting to callbackURL; 200 also
    // counts as success for some configurations.
    const verificationSucceeded =
      status === 200 || status === 301 || status === 302;

    if (!verificationSucceeded) {
      console.warn(
        `[verify-email] verification failed with status ${status}`
      );
      const dest = new URL("/login?error=verification-failed", request.url);
      return NextResponse.redirect(dest);
    }

    // When autoSignInAfterVerification is enabled, the backend attaches
    // Set-Cookie headers with the session token to its redirect response.
    const setCookieHeaders = extractSetCookieHeaders(backendResponse.headers);

    console.log(
      `[verify-email] extracted ${setCookieHeaders.length} Set-Cookie header(s)`,
      setCookieHeaders.map((c) => c.substring(0, 60) + "…")
    );

    // Cookies that look like session tokens mean the backend created a
    // session; send the user straight to callbackURL. Otherwise they need to
    // sign in manually.
    const hasSessionCookies = setCookieHeaders.some(
      (c) =>
        c.includes("session_token") ||
        c.includes("better-auth") ||
        c.includes("session")
    );

    console.log(
      `[verify-email] hasSessionCookies: ${hasSessionCookies}; ` +
        `callbackURL: ${callbackURL}`
    );

    const destination = hasSessionCookies
      ? new URL(callbackURL, request.url)
      : new URL("/login?verified=true", request.url);

    const response = NextResponse.redirect(destination);

    // Strip the backend's Domain= (api.wxyc.org) so the cookie implicitly
    // scopes to the frontend domain, and force Path=/ so it's sent on all
    // frontend routes.
    for (const raw of setCookieHeaders) {
      let adjusted = raw
        .replace(/\s*Domain=[^;]*;?\s*/i, " ")
        .replace(/Path=[^;]*/i, "Path=/")
        .trim();

      // The replace above only rewrites an EXISTING Path attribute; if
      // upstream omitted Path entirely (spec-valid) it's a no-op and the
      // cookie would default to /auth/verify-email, breaking auto-sign-in
      // on /dashboard/* (#633).
      if (!/Path=/i.test(adjusted)) {
        adjusted += "; Path=/";
      }

      response.headers.append("Set-Cookie", adjusted);
    }

    return response;
  } catch (error) {
    console.error("Email verification proxy error:", error);
    const dest = new URL("/login?error=verification-failed", request.url);
    return NextResponse.redirect(dest);
  }
}
