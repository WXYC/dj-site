import { getServerSession, isUserIncomplete } from "@/lib/features/authentication/server-utils";
import { redirect } from "next/navigation";
import WXYCPage from "@/src/Layout/WXYCPage";
import LoginSlotSwitcher from "./LoginSlotSwitcher";
import { Metadata } from "next";
import { getPageTitle } from "@/lib/utils/page-title";

export const metadata: Metadata = {
  title: getPageTitle("Login"),
};

export default async function ModernLoginLayout({
  normal,
  newuser,
  reset,
}: {
  normal: React.ReactNode;
  newuser: React.ReactNode;
  reset: React.ReactNode;
}) {
  // Check if user is already authenticated and email-verified
  const session = await getServerSession();

  if (session?.user?.emailVerified) {
    // If user is incomplete (missing realName), show onboarding form
    if (isUserIncomplete(session)) {
      return (
        <WXYCPage>
          <LoginSlotSwitcher
            normal={normal}
            newuser={newuser}
            reset={reset}
            isIncomplete={true}
          />
        </WXYCPage>
      );
    }
    // User is authenticated, verified, and complete — redirect to dashboard
    redirect(String(process.env.NEXT_PUBLIC_DASHBOARD_HOME_PAGE || "/dashboard/catalog"));
  }
  // If authenticated but NOT verified, stay on login to show verification message

  return (
    <WXYCPage>
      <LoginSlotSwitcher
        normal={normal}
        newuser={newuser}
        reset={reset}
        isIncomplete={false}
      />
    </WXYCPage>
  );
}
