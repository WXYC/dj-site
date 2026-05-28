"use client";

import { applicationSlice } from "@/lib/features/application/frontend";
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
    </form>
  );
}
