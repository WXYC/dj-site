"use client";

import { applicationSlice } from "@/lib/features/application/frontend";
import { useAppDispatch } from "@/lib/hooks";
import { useLogin } from "@/src/hooks/authenticationHooks";
import { Link, Typography } from "@mui/joy";
import RequiredBox from "./Fields/RequiredBox";
import { ValidatedSubmitButton } from "./Fields/ValidatedSubmitButton";

export default function UserPasswordForm() {
  const dispatch = useAppDispatch();
  const { handleLogin, verified, authenticating } = useLogin();

  const handleForgot = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    dispatch(applicationSlice.actions.setAuthStage("forgot"));
  };

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
              type="button"
              onClick={handleForgot}
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
