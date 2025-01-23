import { Metadata } from "next";
import UserPasswordForm from "../components/Forms/UserPasswordForm";
import WelcomeQuotes from "../components/Quotes/Welcome";

export default function LoginPage() {
  return (
    <>
      <WelcomeQuotes />
      <UserPasswordForm />
    </>
  );
}

export const metadata: Metadata = {
  title: "WXYC | Login",
};
