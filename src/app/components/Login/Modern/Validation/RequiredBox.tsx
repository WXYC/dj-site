"use client";

import { useAppDispatch, useAppSelector } from "@/lib/hooks";
import { Credentials } from "@/lib/models/authentication/types";
import { getCredentials, getValidation } from "@/lib/slices/authentication/selectors";
import { authenticationSlice } from "@/lib/slices/authentication/slice";
import FormControl from "@mui/joy/FormControl";
import FormLabel from "@mui/joy/FormLabel";
import Input from "@mui/joy/Input";
import Typography from "@mui/joy/Typography";
import { useEffect, useState } from "react";

export default function RequiredBox({
  name,
  title,
  placeholder,
  helper,
  disabled,
  type,
}: {
  name: keyof Credentials;
  title: string;
  placeholder?: string;
  helper?: string;
  disabled?: boolean;
  type?: React.HTMLInputTypeAttribute;
}): JSX.Element {
  const dispatch = useAppDispatch();

  const credentials = useAppSelector(getCredentials);

  const validation = useAppSelector(getValidation);
  return (
    <FormControl required>
      <FormLabel>{title}{validation[name]}</FormLabel>
      <Input
        placeholder={placeholder || `Enter your ${title.toLocaleLowerCase()}`}
        type={type || "text"}
        name={name}
        disabled={disabled}
        color={credentials[name]?.length ?? 0 > 0 ? "success" : "primary"}
        onChange={(e) => {
          let value = e.target.value;
          if (value.length > 0) {
            dispatch(authenticationSlice.actions.updateValidation({ field: name, approved: true }));
          } else {
            dispatch(authenticationSlice.actions.updateValidation({ field: name, approved: false }));
          }
      
          dispatch(
            authenticationSlice.actions.updateCredentials({
              ...credentials,
              [name]: value,
            })
          );
        }}
        value={credentials[name]}
      />
      {helper && (<Typography level="body-xs">{helper}</Typography>)}
    </FormControl>
  );
}
