import { PasswordResetUser } from "@/lib/features/authentication/types";
import AuthBackButton from "@/src/components/experiences/modern/login/Forms/AuthBackButton";
import PasswordResetForms from "@/src/components/experiences/modern/login/Forms/PasswordResetForms";
import ForgotQuotes, {
  pickForgotQuote,
} from "@/src/components/experiences/modern/login/Quotes/Forgot";
import { Alert } from "@mui/joy";
import { firstSearchParam } from "@/lib/utils/search-params";

// No metadata export: parallel-slot metadata resolves statically per pathname,
// so a title here bleeds into plain /login (verified on a preview deploy) —
// the layout's "Login" title stands for every view of this path.

type PasswordResetPageProps = {
  searchParams: Promise<{ token?: string | string[]; error?: string | string[] }>;
};

export default async function PasswordResetPage({
  searchParams,
}: PasswordResetPageProps) {
  const params = await searchParams;
  const token = firstSearchParam(params.token);
  const error = firstSearchParam(params.error);

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
