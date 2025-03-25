import { IncompleteUser } from "@/lib/features/authentication/types";
import { createServerSideProps } from "@/lib/features/session";
import NewUserForm from "@/src/components/modern/login/Forms/NewUserForm";

export default async function ResetPasswordPage() {
  return (
    <>
      <h1>Welcome to Next.js</h1>
      <p>This is a classic reset password page template.</p>
    </>
  );
}
