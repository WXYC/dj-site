"use client";

import { useResetPassword } from "@/src/hooks/authenticationHooks";
import { Button, FormControl, FormLabel, Input, Typography } from "@mui/joy";
import { useState } from "react";

export default function RequestPasswordResetForm() {
  const { handleRequestReset, requestingReset } = useResetPassword();
  const [email, setEmail] = useState("");

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void handleRequestReset(email.trim());
  };

  return (
    <form onSubmit={handleSubmit} method="post">
      <FormControl required>
        <FormLabel>Email</FormLabel>
        <Input
          name="email"
          type="email"
          placeholder="you@example.com"
          value={email}
          disabled={requestingReset}
          onChange={(event) => setEmail(event.target.value)}
        />
      </FormControl>
      <Typography level="body-xs" sx={{ mt: 1 }}>
        We’ll send a reset link if the email exists in our system.
      </Typography>
      <Button
        type="submit"
        loading={requestingReset}
        disabled={requestingReset || !email.trim()}
        sx={{ mt: 2 }}
        fullWidth
      >
        Send Reset Link
      </Button>
    </form>
  );
}
