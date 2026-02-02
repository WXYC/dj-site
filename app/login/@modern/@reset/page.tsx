"use client";

import { PasswordResetUser } from "@/lib/features/authentication/types";
import AuthBackButton from "@/src/components/experiences/modern/login/Forms/AuthBackButton";
import RequestPasswordResetForm from "@/src/components/experiences/modern/login/Forms/RequestPasswordResetForm";
import ResetPasswordForm from "@/src/components/experiences/modern/login/Forms/ResetPasswordForm";
import ForgotQuotes from "@/src/components/experiences/modern/login/Quotes/Forgot";
import { Alert } from "@mui/joy";
import { useSearchParams } from "next/navigation";

export default function PasswordResetPage() {
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
      <AuthBackButton text="Never mind, I remembered" />
      <ForgotQuotes />
      
      <Alert color={error ? "danger" : "neutral"}>{resetData.confirmationMessage}</Alert>

      {token ? (
        <ResetPasswordForm {...resetData} />
      ) : (
        <RequestPasswordResetForm />
      )}
    </>
  );
}
