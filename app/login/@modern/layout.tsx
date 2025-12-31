import { isIncomplete, isPasswordReset } from "@/lib/features/authentication/types";
import { getServerSession } from "@/lib/features/authentication/server-utils";
import { betterAuthSessionToAuthenticationData } from "@/lib/features/authentication/utilities";
import { redirect } from "next/navigation";
import WXYCPage from "@/src/Layout/WXYCPage";

export default async function ModernLoginLayout({
  normal,
  newuser,
  reset,
}: {
  normal: React.ReactNode;
  newuser: React.ReactNode;
  reset: React.ReactNode;
}) {
  // Check if user is already authenticated
  const session = await getServerSession();
  
  // Convert session to authentication data format for compatibility
  const authData = session ? betterAuthSessionToAuthenticationData(session) : { message: "Not Authenticated" };
  
  // If user is authenticated and complete, redirect to dashboard
  // If user is incomplete, allow them to access the newuser page
  if (session && !isIncomplete(authData)) {
    // User is authenticated and complete, redirect to dashboard
    redirect(String(process.env.NEXT_PUBLIC_DASHBOARD_HOME_PAGE || "/dashboard"));
  }

  return (
    <WXYCPage title="Login">
      {isPasswordReset(authData) ? reset : isIncomplete(authData) ? newuser : normal}
    </WXYCPage>
  );
}
