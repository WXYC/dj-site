import { type NextRequest, NextResponse } from "next/server";
import { Authorization } from "./lib/features/admin/types";
import { isAuthenticated } from "./lib/features/authentication/types";
import { createServerSideProps } from "./lib/features/session";

export const runtime = "experimental-edge";

export async function middleware(request: NextRequest) {
  const sessionData = await createServerSideProps();

  const isOnLogin = request.nextUrl.pathname.startsWith("/login");

  const isOnDashboard = request.nextUrl.pathname.startsWith("/dashboard");
  const isOnAdminArea = request.nextUrl.pathname.startsWith("/dashboard/admin");

  if (isOnDashboard) {
    if (!isAuthenticated(sessionData.authentication))
      return NextResponse.redirect(new URL("/login", request.nextUrl));
    if (
      isOnAdminArea &&
      sessionData.authentication.user !== undefined &&
      sessionData.authentication.user.authority <= Authorization.DJ
    )
      return NextResponse.redirect(
        new URL(
          String(process.env.NEXT_PUBLIC_DASHBOARD_HOME_PAGE),
          request.nextUrl
        )
      );
  } else if (isOnLogin) {
    if (
      isAuthenticated(sessionData.authentication) &&
      sessionData.authentication.user !== undefined
    )
      return NextResponse.redirect(
        new URL(
          String(process.env.NEXT_PUBLIC_DASHBOARD_HOME_PAGE),
          request.nextUrl
        )
      );
  }

  return NextResponse.next();
}

export const config = {
  /*
   * Match all request paths except for the ones starting with
   */
  matcher: [
    "/((?!api|_next/static|_next/image|.*\\.png$|.*\\.gif$|.*\\.jpg$).*)",
  ],
};
