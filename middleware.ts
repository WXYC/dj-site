import { type NextRequest, NextResponse } from "next/server";
import { Authorization } from "./lib/features/admin/types";
import { AuthenticationStage } from "./lib/features/authentication/types";
import { createServerSideProps } from "./lib/features/session";

export async function middleware(request: NextRequest) {
  const response = NextResponse.next();

  const sessionData = await createServerSideProps();

  const isOnLogin = request.nextUrl.pathname.startsWith("/login");

  const isOnDashboard = request.nextUrl.pathname.startsWith("/dashboard");
  const isOnAdminArea = request.nextUrl.pathname.startsWith("/dashboard/admin");

  if (isOnDashboard) {
    if (
      !sessionData?.authentication?.user ||
      sessionData.authentication.stage !== AuthenticationStage.Authenticated
    )
      return NextResponse.redirect(new URL("/login", request.nextUrl));
    if (
      isOnAdminArea &&
      sessionData.authentication.user.authority <= Authorization.DJ
    )
      return NextResponse.redirect(new URL("/dashboard", request.nextUrl));
    return response;
  } else if (isOnLogin) {
    if (
      sessionData?.authentication?.user &&
      sessionData.authentication.stage === AuthenticationStage.Authenticated
    )
      return NextResponse.redirect(new URL("/dashboard", request.nextUrl));
    return response;
  } else {
    return NextResponse.redirect(new URL("/dashboard", request.nextUrl));
  }
}

export const config = {
  /*
   * Match all request paths except for the ones starting with
   */
  matcher: [
    "/((?!api|_next/static|_next/image|.*\\.png$|.*\\.gif$|.*\\.jpg$).*)",
  ],
};
