import { Metadata } from "next";
import UserPasswordForm from "@/src/components/experiences/classic/login/Forms/UserPasswordForm";

// Allowed to block: the root layout resolves the session before this renders,
// so nothing below it can prerender until that read moves behind Suspense.
export const instant = false;

export default function ClassicLoginPage() {
  return <UserPasswordForm />;
}
