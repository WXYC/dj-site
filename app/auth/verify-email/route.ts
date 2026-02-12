import { NextRequest, NextResponse } from "next/server";

/**
 * Route handler that intercepts better-auth's email verification links.
 *
 * The backend keeps its baseURL as api.wxyc.org (to preserve JWT issuer/
 * audience and JWKS), but rewrites the host of the verification URL in its
 * sendVerificationEmail callback to point to dj.wxyc.org — which lands here.
 *
 * This filesystem route takes precedence over the Next.js rewrite. It:
 *   1. Forwards the verification request to the real backend at api.wxyc.org
 *   2. Extracts any session cookies the backend set (autoSignInAfterVerification)
 *   3. Strips the backend Domain= attribute and forwards the cookies so they
 *      are scoped to the frontend domain (dj.wxyc.org)
 *   4. Issues a proper 302 back to the browser with a clean URL
 *
 * When the backend has `emailVerification.autoSignInAfterVerification: true`,
 * the verify-email endpoint returns Set-Cookie headers with a session token
 * alongside its redirect. We forward those cookies so the user is seamlessly
 * signed in on the frontend domain — making the verification link act as a
 * magic link.
 *
 * If the backend does NOT set session cookies, we fall back to redirecting
 * to /login?verified=true so the user can sign in manually.
 */

/**
 * Extract all Set-Cookie header values from a Response.
 *
 * Headers.getSetCookie() is the standard API but may not be available in every
 * runtime (some Cloudflare Workers / OpenNext polyfills omit it).  We try
 * getSetCookie() first, then fall back to parsing the raw "set-cookie" header
 * (which joins multiple values with ", " — not ideal, but good enough to
 * detect presence and forward whole cookies).
 */
function extractSetCookieHeaders(headers: Headers): string[] {
  // Preferred: getSetCookie() returns one entry per Set-Cookie header
  if (typeof headers.getSetCookie === "function") {
    const cookies = headers.getSetCookie();
    if (cookies.length > 0) return cookies;
  }

  // Fallback: raw header string — multiple Set-Cookie values are joined
  // with ", " by the Headers spec.  Split carefully on ", " that is followed
  // by a cookie-name= pattern (letters/digits/dash/underscore then "=").
  const raw = headers.get("set-cookie");
  if (!raw) return [];

  // Simple heuristic split: cookies rarely have ", <word>=" in their values
  // except in "Expires=Thu, 01 Jan 2026 …" — so we split on ", " only when
  // followed by a token that looks like a cookie name and "=".
  return raw.split(/,\s*(?=[A-Za-z0-9_.-]+=)/).map((s) => s.trim());
}

// Explicitly handle HEAD so email-client link previews get a cheap 200
// without consuming the token or triggering verification.
export function HEAD() {
  return new Response(null, { status: 200 });
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const token = searchParams.get("token");
  // The callbackURL arrives as a relative path (e.g. "/onboarding") because
  // the backend rewrites only the host, leaving query params untouched.
  const callbackURL = searchParams.get("callbackURL");

  if (!token) {
    const dest = new URL("/login?error=missing-verification-token", request.url);
    return NextResponse.redirect(dest);
  }

  const backendBaseURL =
    process.env.NEXT_PUBLIC_BETTER_AUTH_URL || "https://api.wxyc.org/auth";

  // Forward the verification request to the real backend.
  // Use redirect: "manual" so we can inspect the response headers (especially
  // Set-Cookie) instead of following the redirect blindly.
  const backendURL = new URL(`${backendBaseURL}/verify-email`);
  backendURL.searchParams.set("token", token);
  if (callbackURL) {
    backendURL.searchParams.set("callbackURL", callbackURL);
  }

  try {
    const backendResponse = await fetch(backendURL.toString(), {
      redirect: "manual",
    });

    const status = backendResponse.status;
    // eslint-disable-next-line no-console -- server-side diagnostic log for email verification flow
    console.log(
      `[verify-email] backend responded ${status}; ` +
        `Location: ${backendResponse.headers.get("location") ?? "(none)"}; ` +
        `Set-Cookie present: ${backendResponse.headers.has("set-cookie")}`
    );

    // A 302/301 means verification succeeded (backend is redirecting to
    // callbackURL). A 200 also counts as success for some configurations.
    const verificationSucceeded =
      status === 200 || status === 301 || status === 302;

    if (!verificationSucceeded) {
      console.warn(
        `[verify-email] verification failed with status ${status}`
      );
      const dest = new URL("/login?error=verification-failed", request.url);
      return NextResponse.redirect(dest);
    }

    // --- Extract session cookies from the backend response ---
    // When autoSignInAfterVerification is enabled, the backend attaches
    // Set-Cookie headers with the session token to its redirect response.
    const setCookieHeaders = extractSetCookieHeaders(backendResponse.headers);

    // eslint-disable-next-line no-console -- server-side diagnostic log for email verification flow
    console.log(
      `[verify-email] extracted ${setCookieHeaders.length} Set-Cookie header(s)`,
      setCookieHeaders.map((c) => c.substring(0, 60) + "…")
    );

    // Check whether the backend actually created a session (i.e. set cookies
    // that look like session tokens). If so we can send the user straight to
    // the callbackURL; otherwise they need to sign in manually.
    const hasSessionCookies = setCookieHeaders.some(
      (c) =>
        c.includes("session_token") ||
        c.includes("better-auth") ||
        c.includes("session")
    );

    // eslint-disable-next-line no-console -- server-side diagnostic log for email verification flow
    console.log(
      `[verify-email] hasSessionCookies: ${hasSessionCookies}; ` +
        `callbackURL: ${callbackURL}`
    );

    // Choose destination: onboarding (auto-signed-in) or login (manual sign-in).
    // callbackURL is a relative path like "/onboarding", resolved against the
    // frontend origin by the URL constructor.
    const destination = hasSessionCookies
      ? new URL(callbackURL || "/onboarding", request.url)
      : new URL("/login?verified=true", request.url);

    const response = NextResponse.redirect(destination);

    // Forward the backend's Set-Cookie headers to the browser.
    // Strip any Domain= attribute the backend set (it would be api.wxyc.org)
    // so the cookie is implicitly scoped to the frontend domain (dj.wxyc.org).
    // Also ensure Path=/ so the cookie is sent on all frontend routes.
    for (const raw of setCookieHeaders) {
      const adjusted = raw
        // Remove Domain=...; (case-insensitive, with optional trailing semicolon/space)
        .replace(/\s*Domain=[^;]*;?\s*/i, " ")
        // Normalise the path so the session cookie covers the whole site
        .replace(/Path=[^;]*/i, "Path=/")
        .trim();

      response.headers.append("Set-Cookie", adjusted);
    }

    return response;
  } catch (error) {
    console.error("Email verification proxy error:", error);
    const dest = new URL("/login?error=verification-failed", request.url);
    return NextResponse.redirect(dest);
  }
}
