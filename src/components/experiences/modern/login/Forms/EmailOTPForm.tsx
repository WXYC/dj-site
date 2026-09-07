"use client";

import { applicationSlice } from "@/lib/features/application/frontend";
import { isQrLoginEnabled, isStationSignupEnabled } from "@/lib/features/authentication/flags";
import { savePreferredLoginMethod } from "@/lib/features/application/login-method-storage";
import { useAppDispatch } from "@/lib/hooks";
import { useOTPRequest } from "@/src/hooks/authenticationHooks";
import { Button, FormControl, FormLabel, Input, Link, Typography } from "@mui/joy";
import { useState } from "react";

export default function EmailOTPForm({
  onCodeSent,
}: {
  onCodeSent: (state: { identifier: string; email: string }) => void;
}) {
  const dispatch = useAppDispatch();
  const { handleSendOTP, isLoading } = useOTPRequest();
  const [identifier, setIdentifier] = useState("");

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmedIdentifier = identifier.trim();
    try {
      const { email } = await handleSendOTP(trimmedIdentifier);
      onCodeSent({ identifier: trimmedIdentifier, email });
      dispatch(applicationSlice.actions.setAuthStage("otp-verify"));
    } catch {
      // Error already handled in hook
    }
  };

  const handleSwitchToPassword = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    savePreferredLoginMethod("password");
    dispatch(applicationSlice.actions.setAuthStage("password"));
  };

  const handleSwitchToQr = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    savePreferredLoginMethod("qr");
    dispatch(applicationSlice.actions.setAuthStage("qr"));
  };

  return (
    <form onSubmit={handleSubmit} method="post">
      <FormControl required>
        <FormLabel>Username or email</FormLabel>
        <Input
          name="identifier"
          type="text"
          placeholder="Username or email"
          value={identifier}
          disabled={isLoading}
          onChange={(event) => setIdentifier(event.target.value)}
          slotProps={{ input: { autoCapitalize: "none", autoCorrect: "off" } }}
        />
      </FormControl>
      <Typography level="body-xs" sx={{ mt: 1 }}>
        We&apos;ll send a 6-digit code to your registered email.
      </Typography>
      <Button
        type="submit"
        loading={isLoading}
        disabled={isLoading || !identifier.trim()}
        sx={{ mt: 2 }}
        fullWidth
      >
        Send login code
      </Button>
      <Typography level="body-sm" sx={{ mt: 2, textAlign: "center" }}>
        <Link
          component="button"
          type="button"
          onClick={handleSwitchToPassword}
          disabled={isLoading}
        >
          Sign in with password instead
        </Link>
      </Typography>
      {isQrLoginEnabled() && (
        <Typography level="body-sm" sx={{ mt: 1, textAlign: "center" }}>
          <Link
            component="button"
            type="button"
            onClick={handleSwitchToQr}
            disabled={isLoading}
          >
            Sign in with a QR code
          </Link>
        </Typography>
      )}
      {isStationSignupEnabled() && (
        <Typography level="body-sm" sx={{ mt: 1, textAlign: "center" }}>
          <Link
            component="button"
            type="button"
            onClick={(event: React.MouseEvent<HTMLButtonElement>) => {
              event.preventDefault();
              // Signup is not a sign-in method: never savePreferredLoginMethod
              // here, or a DJ who once signed up would land back on the signup
              // form instead of the sign-in they now need. This is the form a
              // brand-new DJ lands on, so the entry point has to live here too,
              // not only behind "Sign in with password instead".
              dispatch(applicationSlice.actions.setAuthStage("signup"));
            }}
            disabled={isLoading}
          >
            Sign up here
          </Link>
        </Typography>
      )}
    </form>
  );
}
