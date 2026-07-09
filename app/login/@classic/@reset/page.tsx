"use client";

import { PasswordResetUser } from "@/lib/features/authentication/types";
import RequestPasswordResetForm from "@/src/components/experiences/modern/login/Forms/RequestPasswordResetForm";
import ResetPasswordForm from "@/src/components/experiences/modern/login/Forms/ResetPasswordForm";
import AuthLinkSessionGuard from "@/src/components/experiences/modern/login/AuthLinkSessionGuard";
import { Alert } from "@mui/joy";
import { useSearchParams } from "next/navigation";

export default function ClassicPasswordResetPage() {
  const searchParams = useSearchParams();
  const token = searchParams?.get("token") || undefined;
  const error = searchParams?.get("error") || undefined;

  const confirmationMessage = error
    ? "This reset link is invalid or expired. Please request a new one."
    : token
      ? "Enter your new password below."
      : "Enter your email to receive a reset link.";

  const resetData: PasswordResetUser = {
    token,
    error,
    confirmationMessage,
  };

  return (
    <>
      <Alert color={error ? "danger" : "neutral"}>{confirmationMessage}</Alert>
      {token ? (
        <AuthLinkSessionGuard
          linkToken={token}
          loadingMessage="Preparing password reset…"
        >
          <ResetPasswordForm {...resetData} />
        </AuthLinkSessionGuard>
      ) : (
        <RequestPasswordResetForm />
      )}
    </>
  );
}
