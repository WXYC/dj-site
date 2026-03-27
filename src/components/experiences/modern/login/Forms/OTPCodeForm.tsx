"use client";

import { useOTPVerify } from "@/src/hooks/authenticationHooks";
import { Button, FormControl, FormLabel, Input, Link, Typography } from "@mui/joy";
import { useState } from "react";

export default function OTPCodeForm({
  email,
  onChangeEmail,
}: {
  email: string;
  onChangeEmail: () => void;
}) {
  const { handleVerifyOTP, handleResendOTP, isLoading } = useOTPVerify();
  const [otp, setOtp] = useState("");

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await handleVerifyOTP(email, otp.trim());
  };

  const handleResend = async (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    await handleResendOTP(email);
  };

  return (
    <form onSubmit={handleSubmit} method="post">
      <Typography level="body-sm" sx={{ mb: 2 }}>
        Code sent to <strong>{email}</strong>
      </Typography>
      <FormControl required>
        <FormLabel>Login code</FormLabel>
        <Input
          name="otp"
          inputMode="numeric"
          placeholder="000000"
          slotProps={{ input: { maxLength: 6, autoComplete: "one-time-code" } }}
          autoFocus
          value={otp}
          disabled={isLoading}
          onChange={(event) => setOtp(event.target.value.replace(/\D/g, ""))}
        />
      </FormControl>
      <Button
        type="submit"
        loading={isLoading}
        disabled={isLoading || otp.length < 6}
        sx={{ mt: 2 }}
        fullWidth
      >
        Sign in
      </Button>
      <Typography level="body-sm" sx={{ mt: 2, display: "flex", justifyContent: "space-between" }}>
        <Link
          component="button"
          type="button"
          onClick={handleResend}
          disabled={isLoading}
        >
          Resend code
        </Link>
        <Link
          component="button"
          type="button"
          onClick={onChangeEmail}
          disabled={isLoading}
        >
          Try a different email
        </Link>
      </Typography>
    </form>
  );
}
