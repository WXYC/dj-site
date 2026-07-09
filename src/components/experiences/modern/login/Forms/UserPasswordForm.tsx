"use client";

import { applicationSlice } from "@/lib/features/application/frontend";
import { isQrLoginEnabled } from "@/lib/features/authentication/flags";
import { savePreferredLoginMethod } from "@/lib/features/application/login-method-storage";
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
        title="Username or email"
        placeholder="Username or email"
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
      <Typography level="body-sm" sx={{ mt: 2, textAlign: "center" }}>
        <Link
          component="button"
          type="button"
          onClick={(event: React.MouseEvent<HTMLButtonElement>) => {
            event.preventDefault();
            savePreferredLoginMethod("otp-email");
            dispatch(applicationSlice.actions.setAuthStage("otp-email"));
          }}
          disabled={authenticating}
        >
          Sign in with email code instead
        </Link>
      </Typography>
      {isQrLoginEnabled() && (
        <Typography level="body-sm" sx={{ mt: 1, textAlign: "center" }}>
          <Link
            component="button"
            type="button"
            onClick={(event: React.MouseEvent<HTMLButtonElement>) => {
              event.preventDefault();
              savePreferredLoginMethod("qr");
              dispatch(applicationSlice.actions.setAuthStage("qr"));
            }}
            disabled={authenticating}
          >
            Sign in with a QR code
          </Link>
        </Typography>
      )}
    </form>
  );
}
