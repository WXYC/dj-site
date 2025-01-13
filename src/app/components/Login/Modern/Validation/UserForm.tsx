"use client";

import { useAppSelector } from "@/lib/hooks";
import { getNeedsNewPassword } from "@/lib/slices/authentication/selectors";
import UserDataForm from "./UserDataForm";
import UserPasswordForm from "./UserPasswordForm";

export default function UserForm() {
  const needsNewPassword = useAppSelector(getNeedsNewPassword);

  return needsNewPassword ? <UserDataForm /> : <UserPasswordForm />;
}
