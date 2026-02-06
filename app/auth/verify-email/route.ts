import { NextRequest, NextResponse } from "next/server";

/**
 * Route handler that intercepts better-auth's email verification links.
 *
 * Better-auth generates links like:
 *   https://dj.wxyc.org/auth/verify-email?token=xxx&callbackURL=https://dj.wxyc.org/onboarding
 *
 * The Next.js rewrite normally proxies /auth/* to the backend, but on
 * Cloudflare Pages the upstream 302 redirect is followed internally —
 * the browser URL never updates, and the verification token leaks into
 * the login page's search params, triggering the password-reset UI.
 *
 * This filesystem route takes precedence over the rewrite. It:
 *   1. Forwards the verification request to the real backend
 *   2. Extracts any session cookies the backend set (autoSignInAfterVerification)
 *   3. Forwards those cookies to the browser on the frontend domain
 *   4. Issues a proper 302 back to the browser with a clean URL
 *
 * When the backend has `emailVerification.autoSignInAfterVerification: true`,
 * the backend will return Set-Cookie headers with a session token alongside
 * its redirect. We forward those cookies so the user is seamlessly signed in
 * on the frontend domain — making the verification link act as a magic link.
 *
 * If the backend does NOT set session cookies (autoSignInAfterVerification
 * is not enabled), we fall back to redirecting to /login?verified=true so
 * the user can sign in manually.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const token = searchParams.get("token");
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

    // A 302/301 means verification succeeded (backend is redirecting to
    // callbackURL). A 200 also counts as success for some configurations.
    const verificationSucceeded =
      backendResponse.ok ||
      backendResponse.status === 302 ||
      backendResponse.status === 301;

    if (!verificationSucceeded) {
      const dest = new URL("/login?error=verification-failed", request.url);
      return NextResponse.redirect(dest);
    }

    // --- Extract session cookies from the backend response ---
    // When autoSignInAfterVerification is enabled, the backend attaches
    // Set-Cookie headers with the session token to its redirect response.
    const setCookieHeaders: string[] = backendResponse.headers.getSetCookie?.() ?? [];

    // Check whether the backend actually created a session (i.e. set cookies
    // that look like session tokens). If so we can send the user straight to
    // the callbackURL; otherwise they need to sign in manually.
    const hasSessionCookies = setCookieHeaders.some(
      (c) =>
        c.includes("session_token") ||
        c.includes("better-auth") ||
        c.includes("session")
    );

    // Choose destination: onboarding (auto-signed-in) or login (manual sign-in)
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
