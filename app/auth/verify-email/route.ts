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
 *   2. Checks whether verification succeeded
 *   3. Issues a proper 302 back to the browser with a clean URL
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const token = searchParams.get("token");
  const callbackURL = searchParams.get("callbackURL") || "/login";

  if (!token) {
    const dest = new URL("/login?error=missing-verification-token", request.url);
    return NextResponse.redirect(dest);
  }

  const backendBaseURL =
    process.env.NEXT_PUBLIC_BETTER_AUTH_URL || "https://api.wxyc.org/auth";

  // Forward the verification request to the real backend.
  // Use redirect: "manual" so we inspect the response instead of following it.
  const backendURL = new URL(`${backendBaseURL}/verify-email`);
  backendURL.searchParams.set("token", token);
  // Pass the callbackURL through so the backend's own logic is preserved
  backendURL.searchParams.set("callbackURL", callbackURL);

  try {
    const backendResponse = await fetch(backendURL.toString(), {
      redirect: "manual",
    });

    // A 302/301 redirect from the backend means verification succeeded
    // (it's redirecting to the callbackURL). A 200 also counts as success
    // for some better-auth configurations.
    if (
      backendResponse.ok ||
      backendResponse.status === 302 ||
      backendResponse.status === 301
    ) {
      // Verification succeeded — send user to login with a success message.
      // They still need to sign in (verify-email doesn't create a session).
      const dest = new URL("/login?verified=true", request.url);
      return NextResponse.redirect(dest);
    }

    // Verification failed (expired/invalid token)
    const dest = new URL("/login?error=verification-failed", request.url);
    return NextResponse.redirect(dest);
  } catch (error) {
    console.error("Email verification proxy error:", error);
    const dest = new URL("/login?error=verification-failed", request.url);
    return NextResponse.redirect(dest);
  }
}
