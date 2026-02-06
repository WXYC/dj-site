"use client";

import { applicationSlice } from "@/lib/features/application/frontend";
import { useAppDispatch, useAppSelector } from "@/lib/hooks";
import { useSearchParams } from "next/navigation";
import { ReactNode, useEffect } from "react";
import { Alert } from "@mui/joy";

export default function LoginSlotSwitcher({
  normal,
  newuser,
  reset,
  isIncomplete,
}: {
  normal: ReactNode;
  newuser: ReactNode;
  reset: ReactNode;
  isIncomplete: boolean;
}) {
  const searchParams = useSearchParams();
  const dispatch = useAppDispatch();
  const authStage = useAppSelector(applicationSlice.selectors.getAuthStage);

  const errorParam = searchParams?.get("error");
  const isEmailNotVerified = errorParam === "email-not-verified";
  const isVerificationFailed = errorParam === "verification-failed";
  const isVerified = searchParams?.get("verified") === "true";

  useEffect(() => {
    // Only trigger reset flow for password-reset-specific params.
    // The "token" param is ONLY used by the password reset flow — email
    // verification is now handled by /auth/verify-email/route.ts which
    // redirects to /login?verified=true (no raw token in the URL).
    const hasResetToken = !!searchParams?.get("token");
    const hasResetError =
      !!errorParam &&
      !isEmailNotVerified &&
      !isVerificationFailed;

    if (hasResetToken || hasResetError) {
      dispatch(applicationSlice.actions.setAuthStage("reset"));
    }
  }, [dispatch, searchParams, errorParam, isEmailNotVerified, isVerificationFailed]);

  if (isIncomplete) return <>{newuser}</>;

  if (authStage === "forgot" || authStage === "reset") {
    return <>{reset}</>;
  }

  return (
    <>
      {isVerified && (
        <Alert color="success" sx={{ mb: 2 }}>
          Your email has been verified! Please sign in with the temporary
          password from your welcome email to complete onboarding.
        </Alert>
      )}
      {isEmailNotVerified && (
        <Alert color="warning" sx={{ mb: 2 }}>
          Please verify your email before continuing. Check your inbox for a
          verification link.
        </Alert>
      )}
      {isVerificationFailed && (
        <Alert color="danger" sx={{ mb: 2 }}>
          Email verification failed — the link may have expired. Please contact
          an administrator for a new invitation.
        </Alert>
      )}
      {normal}
    </>
  );
}
