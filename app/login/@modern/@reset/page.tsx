import { PasswordResetUser } from "@/lib/features/authentication/types";
import { getServerSideProps } from "@/lib/features/authentication/session";
import AuthBackButton from "@/src/components/modern/login/Forms/AuthBackButton";
import ResetPasswordForm from "@/src/components/modern/login/Forms/ResetPasswordForm";
import ForgotQuotes from "@/src/components/modern/login/Quotes/Forgot";
import { Alert } from "@mui/joy";

export default async function PasswordResetPage() {
  const serverSideProps = await getServerSideProps();
  const resetData = serverSideProps.authentication as PasswordResetUser | null;

  return (
    <>
      <AuthBackButton text="Never mind, I remembered" />
      <ForgotQuotes />
      
      {resetData?.confirmationMessage && (
        <Alert>{resetData.confirmationMessage}</Alert>
      )}

      {resetData && <ResetPasswordForm {...resetData} />}
    </>
  );
}
