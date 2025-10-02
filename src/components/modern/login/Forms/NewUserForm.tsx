"use client";

import { authenticationSlice } from "@/lib/features/authentication/frontend";
import {
  VerifiedData,
  djAttributeTitles,
} from "@/lib/features/authentication/types";
import { useAppDispatch } from "@/lib/hooks";
import { useNewUser } from "@/src/hooks/authenticationHooks";
import { Typography } from "@mui/joy";
import { useEffect, useState } from "react";
import RequiredBox from "./Fields/RequiredBox";
import { ValidatedSubmitButton } from "./Fields/ValidatedSubmitButton";
import { toast } from "sonner";

export default function NewUserForm({
  username,
  requiredAttributes,
  onboardingToken,
}: {
  username: string;
  requiredAttributes: string[];
  onboardingToken?: string;
}) {
  const [newPassword, setNewPassword] = useState("");
  const [tokenUser, setTokenUser] = useState<{ username: string; email: string; realName: string; djName: string } | null>(null);
  const [tokenValidated, setTokenValidated] = useState(false);

  const { handleNewUser, verified, authenticating, addRequiredCredentials } =
    useNewUser();

  // Validate onboarding token and get user info
  useEffect(() => {
    if (onboardingToken && !tokenValidated) {
      const validateToken = async () => {
        try {
          const response = await fetch(`/api/auth/onboard?token=${onboardingToken}`);
          const result = await response.json();
          
          if (response.ok && result.valid) {
            setTokenUser(result.user);
            setTokenValidated(true);
          } else {
            toast.error(result.error || "Invalid onboarding token");
          }
        } catch (error) {
          toast.error("Failed to validate onboarding token");
          console.error("[NewUserForm] Token validation error:", error);
        }
      };
      
      validateToken();
    }
  }, [onboardingToken, tokenValidated]);

  useEffect(() => {
    addRequiredCredentials(
      requiredAttributes.filter((attr) =>
        [
          "username",
          "realName",
          "djName",
          "password",
          "confirmPassword",
          "code",
        ].includes(attr)
      ) as (keyof VerifiedData)[]
    );
  }, [requiredAttributes, addRequiredCredentials]);

  const dispatch = useAppDispatch();
  useEffect(() => {
    const usernameValue = tokenUser?.username || username;
    dispatch(
      authenticationSlice.actions.verify({
        key: "username",
        value: usernameValue.length > 0,
      })
    );
  }, [username, tokenUser, dispatch]);

  // Show loading state while validating token
  if (onboardingToken && !tokenValidated) {
    return (
      <div style={{ textAlign: "center", padding: "2rem" }}>
        <Typography level="body-lg">Validating onboarding link...</Typography>
      </div>
    );
  }

  return (
    <form onSubmit={handleNewUser} method="put">
      <input type="hidden" name="username" value={tokenUser?.username || username} />
      {onboardingToken && <input type="hidden" name="token" value={onboardingToken} />}
      {requiredAttributes.map((attribute: string) => {
        const verifiedAttribute = attribute as keyof VerifiedData;
        const title = djAttributeTitles[verifiedAttribute] || attribute;
        
        // Get default value from token if available
        let defaultValue = "";
        if (tokenUser) {
          if (attribute === "realName") defaultValue = tokenUser.realName;
          if (attribute === "djName") defaultValue = tokenUser.djName;
        }
        
        return (
          <RequiredBox
            key={attribute}
            name={verifiedAttribute}
            title={title}
            placeholder={title}
            type="text"
            disabled={authenticating}
            defaultValue={defaultValue}
          />
        );
      })}
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
