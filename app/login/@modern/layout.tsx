import {
  getServerSession,
  isUserIncomplete,
} from "@/lib/features/authentication/server-utils";
import WXYCPage from "@/src/Layout/WXYCPage";
import LoginSlotSwitcher from "./LoginSlotSwitcher";
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

  // Incomplete (verified but missing realName): show the onboarding form.
  if (session?.user?.emailVerified && isUserIncomplete(session)) {
    return (
      <WXYCPage>
        <Suspense fallback={null}>
          <LoginSlotSwitcher
            normal={normal}
            newuser={newuser}
            reset={reset}
            isIncomplete={true}
          />
        </Suspense>
      </WXYCPage>
    );
  }

  // A signed-in, verified, onboarding-complete user is redirected by the
  // @normal slot page (a server component that CAN read searchParams), not
  // here: a layout cannot see searchParams, so redirecting to the dashboard
  // here dropped OIDC authorize params and abandoned the "Sign in with WXYC"
  // round-trip (#762). Unverified users fall through to the login form to see
  // the verification message.
  return (
    <WXYCPage>
      <Suspense fallback={null}>
        <LoginSlotSwitcher
          normal={normal}
          newuser={newuser}
          reset={reset}
          isIncomplete={false}
        />
      </Suspense>
    </WXYCPage>
  );
}
