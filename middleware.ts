import { NextResponse, type NextRequest } from "next/server";
import { getSessionCookie } from "better-auth/cookies";

// dj-site is a better-auth client with no auth secret at the edge, so the
// session cookie can be checked for presence but not verified or decoded. Role
// authorization stays in the admin Server Component's requireRole; adding a
// Backend-Service round-trip per request here is not acceptable.
export function middleware(request: NextRequest) {
  const sessionCookie = getSessionCookie(request);

  if (!sessionCookie) {
    return NextResponse.redirect(new URL("/login?bounced=no-session", request.url), 307);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/admin/:path*"],
};
