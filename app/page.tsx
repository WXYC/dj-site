import { getServerSessionResult } from "@/lib/features/authentication/server-session";
import { getSessionCookie } from "better-auth/cookies";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { DEFAULT_DASHBOARD_HOME_PAGE } from "@/lib/features/application/constants";

// The site root has no page of its own. A verified session skips the login form
// here rather than relying on /login to bounce it: the classic login page renders
// its form to signed-in visitors.
//
// A failed session read (auth service rate-limited or down) goes to the
// dashboard when the visitor holds a session cookie: its layout shows a retry
// notice instead of signing out a DJ whose cookie may still be valid, where
// /login would show them a sign-in form. Without a cookie that notice ("your
// session hasn't ended") would be false, so a cookieless visitor gets /login.
export default async function HomePage() {
  const read = await getServerSessionResult();
  const toDashboard =
    read.kind === "session"
      ? read.session.user.emailVerified
      : read.kind === "unavailable" && getSessionCookie(await headers()) !== null;
  redirect(
    toDashboard
      ? process.env.NEXT_PUBLIC_DASHBOARD_HOME_PAGE || DEFAULT_DASHBOARD_HOME_PAGE
      : "/login"
  );
}
