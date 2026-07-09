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

  const hasResetToken = !!searchParams?.get("token");
  const hasResetError =
    !!errorParam &&
    !isEmailNotVerified &&
    !isVerificationFailed;
  const hasResetParams = hasResetToken || hasResetError;

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
      {normal}
    </>
  );
}
