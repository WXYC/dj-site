"use client";

import {
  IncompleteUser,
  VerifiedData,
} from "@/lib/features/authentication/types";
import { useLogin } from "@/src/hooks/authenticationHooks";
import RequiredBox from "./Fields/RequiredBox";
import { ValidatedSubmitButton } from "./Fields/ValidatedSubmitButton";

const names: Record<string, keyof VerifiedData> = {
  name: "realName",
  "custom:dj-name": "djName",
};

const titles: Record<string, string> = {
  name: "Real Name",
  "custom:dj-name": "DJ Name",
};

export default function ResetPasswordForm({
  username,
  requiredAttributes,
}: IncompleteUser) {
  const { handleLogin, verified, authenticating } = useLogin();

  return (
    <form onSubmit={handleLogin} method="post">
      {requiredAttributes.map((attribute) => (
        <RequiredBox
          key={attribute}
          name={names[attribute]}
          title={titles[attribute]}
          placeholder={titles[attribute]}
          type="text"
          disabled={authenticating}
        />
      ))}
      <RequiredBox
        name="code"
        title="Code"
        type="number"
        disabled={authenticating}
        helper="Check your email for the code"
      />
      <RequiredBox
        name="password"
        title="New Password"
        type="password"
        disabled={authenticating}
        helper={"Must be at least 8 characters, with at least 1 number and 1 capital letter"}
      />
      <ValidatedSubmitButton
        authenticating={authenticating}
        valid={verified}
        fullWidth
      />
    </form>
  );
}
