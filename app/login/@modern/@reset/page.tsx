import { PasswordResetUser } from "@/lib/features/authentication/types";
import { getPageTitle } from "@/lib/utils/page-title";
import AuthBackButton from "@/src/components/experiences/modern/login/Forms/AuthBackButton";
import PasswordResetForms from "@/src/components/experiences/modern/login/Forms/PasswordResetForms";
import ForgotQuotes, {
  pickForgotQuote,
} from "@/src/components/experiences/modern/login/Quotes/Forgot";
import { Alert } from "@mui/joy";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: getPageTitle("Reset Password"),
};

type PasswordResetPageProps = {
  searchParams: Promise<{ token?: string; error?: string }>;
};

export default async function PasswordResetPage({
  searchParams,
}: PasswordResetPageProps) {
  const { token, error } = await searchParams;

  const confirmationMessage = error
    ? "This reset link is invalid or expired. Please request a new one."
    : token
      ? "Enter your new password below."
      : "Enter your email to receive a reset link.";

  const resetData: PasswordResetUser = { token, error, confirmationMessage };

  return (
    <>
      <AuthBackButton text="Never mind, I remembered" />
      <ForgotQuotes quote={pickForgotQuote()} />

      <Alert color={error ? "danger" : "neutral"}>{confirmationMessage}</Alert>

      <PasswordResetForms {...resetData} />
    </>
  );
}
