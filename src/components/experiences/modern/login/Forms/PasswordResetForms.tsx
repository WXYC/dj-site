import { PasswordResetUser } from "@/lib/features/authentication/types";
import AuthLinkSessionGuard from "@/src/components/experiences/modern/login/AuthLinkSessionGuard";
import RequestPasswordResetForm from "./RequestPasswordResetForm";
import ResetPasswordForm from "./ResetPasswordForm";

/**
 * Interactive branch of the password-reset flow, shared by the classic and
 * modern @reset pages. `token` is known at request time, so the branch is
 * chosen by the Server Component page; only the forms/guard below are client.
 */
export default function PasswordResetForms(resetData: PasswordResetUser) {
  const { token } = resetData;

  if (!token) {
    return <RequestPasswordResetForm />;
  }

  return (
    <AuthLinkSessionGuard
      linkToken={token}
      loadingMessage="Preparing password reset…"
    >
      <ResetPasswordForm {...resetData} />
    </AuthLinkSessionGuard>
  );
}
