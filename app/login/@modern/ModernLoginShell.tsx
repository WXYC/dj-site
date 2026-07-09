"use client";

import LoginSlotSwitcher from "./LoginSlotSwitcher";
import { useRouter, useSearchParams } from "next/navigation";
import { ReactNode, useEffect } from "react";

const dashboardHome = () =>
  String(process.env.NEXT_PUBLIC_DASHBOARD_HOME_PAGE || "/dashboard/catalog");

type ModernLoginShellProps = {
  /** Signed-in, verified user who has finished onboarding. */
  redirectCompleteToDashboard: boolean;
  isIncomplete: boolean;
  normal: ReactNode;
  newuser: ReactNode;
  reset: ReactNode;
};

function isPasswordResetFlow(searchParams: ReturnType<typeof useSearchParams>) {
  const errorParam = searchParams?.get("error");
  const isEmailNotVerified = errorParam === "email-not-verified";
  const isVerificationFailed = errorParam === "verification-failed";
  const hasResetToken = !!searchParams?.get("token");
  const hasResetError =
    !!errorParam && !isEmailNotVerified && !isVerificationFailed;
  return hasResetToken || hasResetError;
}

/**
 * Client gate for /login: complete sessions normally bounce to the dashboard,
 * but password-reset links (?token= / reset errors) must stay on login even
 * when another account is signed in.
 */
export default function ModernLoginShell({
  redirectCompleteToDashboard,
  isIncomplete,
  normal,
  newuser,
  reset,
}: ModernLoginShellProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const hasResetFlow = isPasswordResetFlow(searchParams);

  useEffect(() => {
    if (redirectCompleteToDashboard && !hasResetFlow) {
      router.replace(dashboardHome());
    }
  }, [redirectCompleteToDashboard, hasResetFlow, router]);

  if (redirectCompleteToDashboard && !hasResetFlow) {
    return null;
  }

  return (
    <LoginSlotSwitcher
      normal={normal}
      newuser={newuser}
      reset={reset}
      isIncomplete={isIncomplete}
    />
  );
}
