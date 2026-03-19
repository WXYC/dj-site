"use client";

import { authenticationSlice } from "@/lib/features/authentication/frontend";
import {
  djAttributeTitles,
  IncompleteUser,
  VerifiedData,
} from "@/lib/features/authentication/types";
import { useAppDispatch } from "@/lib/hooks";
import { useNewUser } from "@/src/hooks/authenticationHooks";
import { useEffect } from "react";
import RequiredBox from "./Fields/RequiredBox";
import { ValidatedSubmitButton } from "./Fields/ValidatedSubmitButton";

export default function NewUserForm({
  username,
  requiredAttributes,
}: IncompleteUser) {
  const { handleNewUser, verified, authenticating, addRequiredCredentials } =
    useNewUser();

  useEffect(() => {
    addRequiredCredentials(requiredAttributes as (keyof VerifiedData)[]);
  }, [requiredAttributes]);

  const dispatch = useAppDispatch();
  useEffect(() => {
    dispatch(
      authenticationSlice.actions.verify({
        key: "username",
        value: username.length > 0,
      })
    );
  }, [username]);

  return (
    <form onSubmit={handleNewUser} method="put">
      <input type="hidden" name="username" value={username} />
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
      <ValidatedSubmitButton
        authenticating={authenticating}
        valid={verified}
        fullWidth
      />
    </form>
  );
}
