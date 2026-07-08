import { getServerSession, isUserIncomplete } from "@/lib/features/authentication/server-utils";
import WXYCPage from "@/src/Layout/WXYCPage";
import ModernLoginShell from "./ModernLoginShell";
import { Metadata } from "next";
import { getPageTitle } from "@/lib/utils/page-title";
import { Suspense } from "react";

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
  const session = await getServerSession();
  const emailVerified = session?.user?.emailVerified ?? false;
  const incomplete =
    emailVerified && !!session?.user && isUserIncomplete(session);
  const completeAuthenticated =
    emailVerified && !!session?.user && !incomplete;

  return (
    <WXYCPage>
      <Suspense fallback={null}>
        <ModernLoginShell
          redirectCompleteToDashboard={completeAuthenticated}
          isIncomplete={incomplete}
          normal={normal}
          newuser={newuser}
          reset={reset}
        />
      </Suspense>
    </WXYCPage>
  );
}
