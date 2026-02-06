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

  useEffect(() => {
    // Only trigger reset flow for reset-specific params, not email-verification errors
    const hasResetToken = !!searchParams?.get("token");
    const hasResetError = !!errorParam && !isEmailNotVerified;

    if (hasResetToken || hasResetError) {
      dispatch(applicationSlice.actions.setAuthStage("reset"));
    }
  }, [dispatch, searchParams, errorParam, isEmailNotVerified]);

  if (isIncomplete) return <>{newuser}</>;

  if (authStage === "forgot" || authStage === "reset") {
    return <>{reset}</>;
  }

  return (
    <>
      {isEmailNotVerified && (
        <Alert color="warning" sx={{ mb: 2 }}>
          Please verify your email before continuing. Check your inbox for a
          verification link.
        </Alert>
      )}
      {normal}
    </>
  );
}
