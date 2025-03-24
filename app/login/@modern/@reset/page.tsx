import { PasswordResetUser } from "@/lib/features/authentication/types";
import { createServerSideProps } from "@/lib/features/session";
import AuthBackButton from "@/src/components/modern/login/Forms/AuthBackButton";
import ResetPasswordForm from "@/src/components/modern/login/Forms/ResetPasswordForm";
import ForgotQuotes from "@/src/components/modern/login/Quotes/Forgot";
import { Alert } from "@mui/joy";

export default async function PasswordResetPage() {
  const resetData = (await createServerSideProps())
    .authentication as PasswordResetUser;

  return (
    <>
      <AuthBackButton text="Never mind, I remembered" />
      <ForgotQuotes />
      
      <Alert>{resetData.confirmationMessage}</Alert>

      <ResetPasswordForm {...resetData} />
    </>
  );
}
