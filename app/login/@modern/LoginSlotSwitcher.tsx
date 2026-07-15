"use client";

import { applicationSlice } from "@/lib/features/application/frontend";
import { useAppDispatch, useAppSelector } from "@/lib/hooks";
import { useSearchParams } from "next/navigation";
import { ReactNode, useEffect } from "react";
import { Alert } from "@mui/joy";

// Error codes that belong to the password-reset flow. better-auth's
// reset-password link redirects to its redirectTo (/login, set in
// useResetPassword.handleRequestReset) with ?error=INVALID_TOKEN when the token
// is expired/invalid — the same code documented for the onboarding link in
// app/onboarding/@modern/page.tsx. Only these route to the reset slot; every
// other ?error= is NOT a reset error and must render the normal login form with
// the error surfaced — notably verify-email's `missing-verification-token` and
// `verification-failed` (app/auth/verify-email/route.ts) and server-utils'
// `email-not-verified`, none of which previously routed anywhere sensible (#617).
const RESET_ERROR_CODES: readonly string[] = ["INVALID_TOKEN"];

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

  const hasResetToken = !!searchParams?.get("token");
  // Allowlist, not denylist: only known reset error codes fall into the reset
  // flow. An unknown ?error= (e.g. a broken verification link) must not drop
  // the user into a password-reset form with no reset token (#617).
  const hasResetError = !!errorParam && RESET_ERROR_CODES.includes(errorParam);
  const hasResetParams = hasResetToken || hasResetError;

  // An error code that is neither a reset error nor one of the specifically
  // handled verify-email states: surface it on the normal login form instead of
  // silently swallowing it (#617).
  const hasUnrecognizedError =
    !!errorParam &&
    !hasResetError &&
    !isEmailNotVerified &&
    !isVerificationFailed;

  useEffect(() => {
    if (hasResetParams) {
      dispatch(applicationSlice.actions.setAuthStage("reset"));
    }
  }, [dispatch, hasResetParams]);

  const effectiveAuthStage = hasResetParams ? "reset" : authStage;

  // Password-reset / invite links with ?token= must win over the incomplete-user
  // onboarding slot — otherwise a signed-in incomplete DJ on a shared machine
  // would see NewUserForm instead of the reset form for someone else's link.
  if (effectiveAuthStage === "forgot" || effectiveAuthStage === "reset") {
    return <>{reset}</>;
  }

  if (isIncomplete) return <>{newuser}</>;

  return (
    <>
      {isVerified && (
        <Alert color="success" sx={{ mb: 2 }}>
          Your email has been verified! Please sign in to complete onboarding.
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
      {hasUnrecognizedError && (
        <Alert color="danger" sx={{ mb: 2 }}>
          Something went wrong with that link. Please sign in below, or contact
          an administrator if the problem persists.
        </Alert>
      )}
      {normal}
    </>
  );
}
