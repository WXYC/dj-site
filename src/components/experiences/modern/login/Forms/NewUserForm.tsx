"use client";

import {
  djAttributeTitles,
  IncompleteUser,
  VerifiedData,
} from "@/lib/features/authentication/types";
import { useNewUser } from "@/src/hooks/authenticationHooks";
import { FormControl, FormLabel, Input } from "@mui/joy";
import { useEffect } from "react";
import RequiredBox from "./Fields/RequiredBox";
import { ValidatedSubmitButton } from "./Fields/ValidatedSubmitButton";

/**
 * Onboarding completion for a signed-in incomplete user (/login?incomplete=true).
 * The session authenticates the request and the user already knows their
 * password, so this only collects the missing profile fields.
 */
export default function NewUserForm({ requiredAttributes }: IncompleteUser) {
  const { handleNewUser, verified, authenticating, addRequiredCredentials } =
    useNewUser("session");

  useEffect(() => {
    addRequiredCredentials(requiredAttributes as (keyof VerifiedData)[]);
  }, [requiredAttributes]);

  return (
    <form onSubmit={handleNewUser} method="put">
      {requiredAttributes.map((attribute: keyof VerifiedData) => (
        <RequiredBox
          key={attribute}
          name={attribute}
          title={djAttributeTitles[attribute] || String(attribute)}
          placeholder={djAttributeTitles[attribute] || String(attribute)}
          type="text"
          disabled={authenticating}
        />
      ))}
      <FormControl>
        <FormLabel>DJ Name (optional)</FormLabel>
        <Input
          name="djName"
          placeholder="DJ Name"
          disabled={authenticating}
        />
      </FormControl>
      <ValidatedSubmitButton
        authenticating={authenticating}
        valid={verified}
        fullWidth
      />
    </form>
  );
}
