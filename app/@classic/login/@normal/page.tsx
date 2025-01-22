import { Metadata } from "next";
import UserPasswordForm from "../components/Forms/UserPasswordForm";

export default function ClassicLoginPage() {
  return <UserPasswordForm />;
}

export const metadata: Metadata = {
  title: "WXYC | Login",
};
