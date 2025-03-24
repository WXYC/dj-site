import { IncompleteUser } from "@/lib/features/authentication/types";
import { createServerSideProps } from "@/lib/features/session";
import AuthBackButton from "@/src/components/modern/login/Forms/AuthBackButton";
import NewUserForm from "@/src/components/modern/login/Forms/NewUserForm";
import HoldOnQuotes from "@/src/components/modern/login/Quotes/HoldOn";

export default async function ResetPasswordPage() {
  const resetData = (await createServerSideProps())
    .authentication as IncompleteUser;

  return (
    <>
      <AuthBackButton text="Login with a different account" />
      <HoldOnQuotes />
      <NewUserForm {...resetData} />
    </>
  );
}
