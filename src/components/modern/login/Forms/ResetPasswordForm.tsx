"use client";

import { authenticationSlice } from "@/lib/features/authentication/frontend";
import { useAppDispatch } from "@/lib/hooks";
import { useResetPassword } from "@/src/hooks/authenticationHooks";
import { Typography } from "@mui/joy";
import { useEffect, useState } from "react";
import RequiredBox from "./Fields/RequiredBox";
import { ValidatedSubmitButton } from "./Fields/ValidatedSubmitButton";
import { PasswordResetUser } from "@/lib/features/authentication/types";

export default function ResetPasswordForm({
    username
} : PasswordResetUser) {
  const [newPassword, setNewPassword] = useState("");

  const { handleReset, verified, requestingReset } = useResetPassword();

  const dispatch = useAppDispatch();
  useEffect(() => {
    dispatch(authenticationSlice.actions.addRequiredCredentials(["code"]));
    dispatch(
        authenticationSlice.actions.verify({
          key: "username",
          value: username.length > 0,
        })
      );
  }, [dispatch]);

  return (
    <form onSubmit={handleReset} method="post">
      <input type="hidden" name="username" value={username} />
      <RequiredBox
        name="code"
        title="Code"
        placeholder="Code"
        type="number"
        disabled={requestingReset}
      />
      <RequiredBox
        name="password"
        title="New Password"
        type="password"
        helper={
          <Typography level="body-xs">
            Must be at least 8 characters, with at least 1 number and 1 capital
            letter
          </Typography>
        }
        validationFunction={(value: string) => {
          setNewPassword(value);
          return (
            value.length >= 8 &&
            !!value.match(/[A-Z]/) &&
            !!value.match(/[0-9]/)
          );
        }}
        disabled={requestingReset}
      />
      <RequiredBox
        name="confirmPassword"
        title="Confirm New Password"
        placeholder="Confirm New Password"
        type="password"
        validationFunction={(value: string) =>
          value === newPassword && value.length >= 8
        }
        disabled={requestingReset}
      />
      <ValidatedSubmitButton
        authenticating={requestingReset}
        valid={verified}
        fullWidth
      />
    </form>
  );
}
