"use client";

import { authenticationSlice } from "@/lib/features/authentication/frontend";
import { VerifiedData } from "@/lib/features/authentication/types";
import { useAppDispatch } from "@/lib/hooks";
import { useNewUser } from "@/src/hooks/authenticationHooks";
import { isStrongPassword } from "@/src/utilities/passwordValidation";
import { FormControl, FormLabel, Input, Typography } from "@mui/joy";
import { useEffect, useState } from "react";
import RequiredBox from "./Fields/RequiredBox";
import { ValidatedSubmitButton } from "./Fields/ValidatedSubmitButton";

type OnboardingFormProps = {
  realName?: string;
  djName?: string;
};

/**
 * Invite-token onboarding at /onboarding?token=…. The DJ confirms their name
 * and chooses the password they will sign in with; the token authenticates
 * the request, so no session is needed.
 */
export default function OnboardingForm({ realName, djName }: OnboardingFormProps) {
  const [newPassword, setNewPassword] = useState("");
  const { handleNewUser, verified, authenticating, addRequiredCredentials } =
    useNewUser("invite");

  const dispatch = useAppDispatch();

  useEffect(() => {
    const required: (keyof VerifiedData)[] = [
      "realName",
      "password",
      "confirmPassword",
    ];
    addRequiredCredentials(required);
  }, [addRequiredCredentials]);

  return (
    <form onSubmit={handleNewUser} method="put">
      <RequiredBox
        name="realName"
        title="Real Name"
        placeholder="Real Name"
        disabled={authenticating}
        initialValue={realName}
      />
      <FormControl>
        <FormLabel>DJ Name (optional)</FormLabel>
        <Input
          name="djName"
          placeholder="DJ Name"
          disabled={authenticating}
          defaultValue={djName}
        />
      </FormControl>
      <RequiredBox
        name="password"
        title="New Password"
        type="password"
        disabled={authenticating}
        helper={
          <Typography level="body-xs">
            Choose the password you will use to sign in. Must be at least 8
            characters, with at least 1 number and 1 capital letter.
          </Typography>
        }
        validationFunction={(value: string) => {
          setNewPassword(value);
          return isStrongPassword(value);
        }}
      />
      <RequiredBox
        name="confirmPassword"
        title="Confirm New Password"
        placeholder="Confirm New Password"
        type="password"
        disabled={authenticating}
        validationFunction={(value: string) =>
          value === newPassword && value.length >= 8
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
