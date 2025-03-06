import { IncompleteUser } from "@/lib/features/authentication/types";
import { createServerSideProps } from "@/lib/features/session";
import ResetBackButton from "@/src/components/modern/login/Forms/ResetBackButton";
import ResetPasswordForm from "@/src/components/modern/login/Forms/ResetPasswordForm";
import HoldOnQuotes from "@/src/components/modern/login/Quotes/HoldOn";

export default async function ResetPasswordPage() {
  const resetData = (await createServerSideProps())
    .authentication as IncompleteUser;

  return (
    <>
      <ResetBackButton />
      <HoldOnQuotes />
      <ResetPasswordForm {...resetData} />
    </>
  );
}
