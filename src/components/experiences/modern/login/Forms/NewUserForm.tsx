"use client";

import { authenticationSlice } from "@/lib/features/authentication/frontend";
import {
  djAttributeTitles,
  IncompleteUser,
  VerifiedData,
} from "@/lib/features/authentication/types";
import { useAppDispatch } from "@/lib/hooks";
import { useNewUser } from "@/src/hooks/authenticationHooks";
import { Typography } from "@mui/joy";
import { useEffect, useState } from "react";
import RequiredBox from "./Fields/RequiredBox";
import { ValidatedSubmitButton } from "./Fields/ValidatedSubmitButton";

export default function NewUserForm({
  username,
  requiredAttributes,
}: IncompleteUser) {
  const [newPassword, setNewPassword] = useState("");

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
      <RequiredBox
        name="password"
        title="New Password"
        type="password"
        disabled={authenticating}
        helper={
          <Typography level="body-xs">
            Must be at least 8 characters, with at least 1 number and 1 capital
            letter
          </Typography>
        }
        validationFunction={(value: string) => {
          setNewPassword(value);
          return (
            value.length >= 8 &&
            !!value.match(/[A-Z]/) &&
            !!value.match(/[0-9]/)
          );
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
