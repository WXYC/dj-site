import { IncompleteUser } from "@/lib/features/authentication/types";
import { createServerSideProps } from "@/lib/features/session";
import AuthBackButton from "@/src/components/experiences/modern/login/Forms/AuthBackButton";
import NewUserForm from "@/src/components/experiences/modern/login/Forms/NewUserForm";
export default async function NewUserPage() {
  const resetData = (await createServerSideProps())
    .authentication as IncompleteUser;

  return (
    <>
      <AuthBackButton text="Login with a different account" />
      <NewUserForm {...resetData} />
    </>
  );
}
