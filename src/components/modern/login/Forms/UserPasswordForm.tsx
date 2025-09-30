"use client";

import { Link, Typography } from "@mui/joy";
import { useCallback } from "react";
import RequiredBox from "./Fields/RequiredBox";
import { ValidatedSubmitButton } from "./Fields/ValidatedSubmitButton";
import { useLogin, useResetPassword } from "@/src/hooks/authenticationHooks";
import { toast } from "sonner";

export default function UserPasswordForm() {
  const { handleLogin, verified, authenticating, setUsername, setPassword } = useLogin();
  const { handleResetPassword } = useResetPassword();

  const handleRequestReset = useCallback(() => {
    // TODO: Implement password reset functionality
    toast.info("Password reset functionality coming soon");
  }, []);

  return (
    <form onSubmit={handleLogin} method="post">
      <RequiredBox
        name="username"
        title="Username"
        placeholder="Username"
        type="text"
        disabled={authenticating}
        validationFunction={(value: string) => {
          setUsername(value);
          return value.length > 0;
        }}
      />
      <RequiredBox
        name="password"
        title="Password"
        type="password"
        disabled={authenticating}
        validationFunction={(value: string) => {
          setPassword(value);
          return value.length > 0;
        }}
        helper={
          <Typography level="body-xs" sx={{ textAlign: "right" }}>
            <Link
              component="button"
              type="button"
              onClick={handleRequestReset}
              disabled={authenticating}
            >
              Forgot?
            </Link>
          </Typography>
        }
      />
      <ValidatedSubmitButton
        authenticating={authenticating}
        valid={verified}
        fullWidth
      />
    </form>
  );
}