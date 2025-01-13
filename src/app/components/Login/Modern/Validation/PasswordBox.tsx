"use client";

import { useAppDispatch, useAppSelector } from "@/lib/hooks";
import {
  getCredentials,
  getValidation,
} from "@/lib/slices/authentication/selectors";
import { authenticationSlice } from "@/lib/slices/authentication/slice";
import {
  FormControl,
  FormLabel,
  Input,
  LinearProgress,
  Typography,
} from "@mui/joy";
import { useEffect, useState } from "react";

export default function PasswordBox({
  minLength,
  disabled,
  guide,
  blocklist,
}: {
  minLength?: number;
  disabled?: boolean;
  guide?: boolean;
  blocklist?: string[];
}) {
  const dispatch = useAppDispatch();

  const [pWordStrength, setPWordStrength] = useState(""); // for the password strength meter

  const credentials = useAppSelector(getCredentials);
  const validation = useAppSelector(getValidation);

  useEffect(() => {
    if (guide) {
      let strengthString = "Needs ";
      if (blocklist?.includes(credentials.password)) {
        strengthString = "Password cannot be previous password";
      } else {
        // Needs one capital letter, one lowercase letter, and one number
        // Needs to be at least 8 characters long
        // start with capital letter test:
        if (!credentials.password.match(/[A-Z]/g)) {
          strengthString += "one capital letter";
        }
        // lowercase letter test:
        if (!credentials.password.match(/[a-z]/g)) {
          strengthString +=
            strengthString === "Needs "
              ? "one lowercase letter"
              : ", one lowercase letter";
        }
        // number test:
        if (!credentials.password.match(/[0-9]/g)) {
          strengthString +=
            strengthString === "Needs " ? "one number" : ", one number";
        }
        // length test:
        if (credentials.password.length < (minLength || 8)) {
          strengthString +=
            strengthString === "Needs "
              ? `to be at least ${minLength || 8} characters long`
              : `, to be at least ${minLength || 8} characters long`;
        }
        // add 'and' if there are multiple requirements at second-to-last requirement
        if ((strengthString?.match(/,/g)?.length ?? 0) > 0) {
          strengthString = strengthString.replace(/,([^,]*)$/, " and$1");
        }
      }
      // if all tests pass, strengthString will still be 'Needs '
      if (strengthString === "Needs ") {
        strengthString = "Strong";
        dispatch(
          authenticationSlice.actions.updateValidation({
            field: "password",
            approved: true,
          })
        );
      } else {
        dispatch(
          authenticationSlice.actions.updateValidation({
            field: "password",
            approved: false,
          })
        );
      }
      setPWordStrength(strengthString);
    } else {
      if (credentials.password.length > 0) {
        dispatch(
          authenticationSlice.actions.updateValidation({
            field: "password",
            approved: true,
          })
        );
      } else {
        dispatch(
          authenticationSlice.actions.updateValidation({
            field: "password",
            approved: false,
          })
        );
      }
    }
  }, [credentials.password, minLength, guide]);

  return (
    <FormControl
      required
      sx={{
        "--hue": blocklist?.includes(credentials.password)
          ? 0
          : Math.min(credentials.password.length * 10, 120),
      }}
    >
      <FormLabel>Password</FormLabel>
      <Input
        placeholder="•••••••"
        type="password"
        name={"password"}
        disabled={disabled}
        onChange={(e) => {
          dispatch(
            authenticationSlice.actions.updateCredentials({
              ...credentials,
              password: e.target.value,
            })
          );
        }}
        value={credentials.password}
        error={validation.password}
        color={
          validation.password ? (guide ? "success" : "neutral") : "primary"
        }
      />
      {guide && (
        <>
          <LinearProgress
            determinate
            size="sm"
            value={Math.min(
              (credentials.password.length * 100) / (minLength || 8),
              100
            )}
            sx={{
              mt: 1,
              bgcolor: "background.level3",
              color: "hsl(var(--hue) 80% 40%)",
            }}
          />
          <Typography
            level="body-xs"
            sx={{
              alignSelf: "flex-end",
              color: "hsl(var(--hue) 80% 30%)",
            }}
          >
            {pWordStrength}
          </Typography>
        </>
      )}
    </FormControl>
  );
}
