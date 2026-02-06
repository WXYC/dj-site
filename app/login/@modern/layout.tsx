import { getServerSession } from "@/lib/features/authentication/server-utils";
import { redirect } from "next/navigation";
import WXYCPage from "@/src/Layout/WXYCPage";
import LoginSlotSwitcher from "./LoginSlotSwitcher";

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
    // User is authenticated and verified — redirect to dashboard
    redirect(String(process.env.NEXT_PUBLIC_DASHBOARD_HOME_PAGE || "/dashboard/catalog"));
  }
  // If authenticated but NOT verified, stay on login to show verification message

  return (
    <WXYCPage title="Login">
      <LoginSlotSwitcher
        normal={normal}
        newuser={newuser}
        reset={reset}
        isIncomplete={false}
      />
    </WXYCPage>
  );
}
