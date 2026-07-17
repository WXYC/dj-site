import { PasswordResetUser } from "@/lib/features/authentication/types";
import { getPageTitle } from "@/lib/utils/page-title";
import PasswordResetForms from "@/src/components/experiences/modern/login/Forms/PasswordResetForms";
import { Alert } from "@mui/joy";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: getPageTitle("Reset Password"),
};

type ClassicPasswordResetPageProps = {
  searchParams: Promise<{ token?: string; error?: string }>;
};

export default async function ClassicPasswordResetPage({
  searchParams,
}: ClassicPasswordResetPageProps) {
  const { token, error } = await searchParams;

  const confirmationMessage = error
    ? "This reset link is invalid or expired. Please request a new one."
    : token
      ? "Enter your new password below."
      : "Enter your email to receive a reset link.";

  const resetData: PasswordResetUser = { token, error, confirmationMessage };

  return (
    <>
      <Alert color={error ? "danger" : "neutral"}>{confirmationMessage}</Alert>
      <PasswordResetForms {...resetData} />
    </>
  );
}
