import { getServerSession } from "@/lib/features/authentication/server-utils";
import { redirect } from "next/navigation";
import { DEFAULT_DASHBOARD_HOME_PAGE } from "@/lib/features/application/constants";

// The site root has no page of its own. A verified session skips the login form
// here rather than relying on /login to bounce it: the classic login page renders
// its form to signed-in visitors.
export default async function HomePage() {
  const session = await getServerSession();
  redirect(
    session?.user?.emailVerified
      ? process.env.NEXT_PUBLIC_DASHBOARD_HOME_PAGE || DEFAULT_DASHBOARD_HOME_PAGE
      : "/login"
  );
}
