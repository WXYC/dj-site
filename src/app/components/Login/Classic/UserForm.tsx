"use client";
import { useAppSelector } from "@/lib/hooks";
import { getNeedsNewPassword } from "@/lib/slices/authentication/selectors";
import LeaveClassic from "../../Theme/Classic/LeaveClassic";
import UserDataForm from "./UserDataForm";
import UserPasswordForm from "./UserPasswordForm";

export default function UserForm(): JSX.Element {
  const needsNewPassword = useAppSelector(getNeedsNewPassword);
  return (
    <div
      style={{
        width: "100%",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        flexDirection: "column",
      }}
    >
      <div style={{ marginBottom: 20 }}>
        <LeaveClassic />
      </div>
      <div>{needsNewPassword ? <UserDataForm /> : <UserPasswordForm />}</div>
    </div>
  );
}
