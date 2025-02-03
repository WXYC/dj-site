"use client";

import { useLogin } from "@/src/hooks/authenticationHooks";
import RequiredBox from "./Fields/RequiredBox";
import { ValidatedSubmitButton } from "./Fields/ValidatedSubmitButton";

export default function UserPasswordForm() {
  const { handleLogin, verified, authenticating } = useLogin();

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
      />
      <ValidatedSubmitButton
        authenticating={authenticating}
        valid={verified}
        fullWidth
      />
    </form>
  );
}
