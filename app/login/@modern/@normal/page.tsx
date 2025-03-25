import UserPasswordForm from "@/src/components/modern/login/Forms/UserPasswordForm";
import WelcomeQuotes from "@/src/components/modern/login/Quotes/Welcome";

export default function LoginPage() {
  return (
    <>
      <WelcomeQuotes />
      <UserPasswordForm />
    </>
  );
}
