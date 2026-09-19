import { IncompleteUser } from "@/lib/features/authentication/types";
import { createServerSideProps } from "@/lib/features/session";
import NewUserForm from "@/src/components/experiences/modern/login/Forms/NewUserForm";

// Allowed to block: the root layout resolves the session before this renders,
// so nothing below it can prerender until that read moves behind Suspense.
export const instant = false;

export default async function ResetPasswordPage() {


  return (
    <>
      <h1>Welcome to Next.js</h1>
      <p>This is a classic reset password page template.</p>
    </>
  );
}
