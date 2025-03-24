"use client";

import { useLogin, useResetPassword } from "@/src/hooks/authenticationHooks";
import { Link, Typography } from "@mui/joy";
import { useState } from "react";
import RequiredBox from "./Fields/RequiredBox";
import { ValidatedSubmitButton } from "./Fields/ValidatedSubmitButton";
import { useAppDispatch, useAppSelector } from "@/lib/hooks";
import { authenticationSlice } from "@/lib/features/authentication/frontend";

export default function UserPasswordForm() {
  const { handleLogin, verified, authenticating } = useLogin();
  const { handleRequestReset } = useResetPassword();

  const hasUsername = useAppSelector((state) => authenticationSlice.selectors.getVerification(state, "username"))

  return (
    <form onSubmit={handleLogin} method="post">
      <RequiredBox
        name="username"
        title="Username"
        placeholder="Username"
        type="text"
        disabled={authenticating}
      />
      <RequiredBox
        name="password"
        title="Password"
        type="password"
        disabled={authenticating}
        helper={
          <Typography level="body-xs" sx={{ textAlign: "right" }}>
            <Link
              component="button"
              onClick={handleRequestReset}
              disabled={!hasUsername || authenticating}
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
