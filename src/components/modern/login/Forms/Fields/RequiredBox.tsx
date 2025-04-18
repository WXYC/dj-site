"use client";

import { authenticationSlice } from "@/lib/features/authentication/frontend";
import { VerifiedData } from "@/lib/features/authentication/types";
import { useAppDispatch, useAppSelector } from "@/lib/hooks";
import FormControl from "@mui/joy/FormControl";
import FormLabel from "@mui/joy/FormLabel";
import Input from "@mui/joy/Input";
import { useState } from "react";

export default function RequiredBox({
  name,
  title,
  type,
  placeholder,
  helper,
  disabled,
  validationFunction,
}: {
  name: keyof VerifiedData;
  title: string;
  placeholder?: string;
  helper?: string | React.ReactNode;
  disabled?: boolean;
  type?: React.HTMLInputTypeAttribute;
  validationFunction?: (value: string) => boolean;
}): JSX.Element {
  const [value, setValue] = useState("");

  const validated = useAppSelector((state) =>
    authenticationSlice.selectors.getVerification(
      state,
      String(name) as keyof VerifiedData
    )
  );

  const dispatch = useAppDispatch();
  const reportValidation = (value: boolean) =>
    dispatch(
      authenticationSlice.actions.verify({
        key: String(name) as keyof VerifiedData,
        value,
      })
    );

  return (
    <FormControl required>
      <FormLabel>{title}</FormLabel>
      <Input
        placeholder={placeholder || `Enter your ${title.toLocaleLowerCase()}`}
        type={type || "text"}
        name={String(name)}
        disabled={disabled}
        color={validated ? "success" : "primary"}
        onChange={(e) => {
          let value = e.target.value;
          setValue(value);
          reportValidation(
            (validationFunction ?? ((value) => value.length > 0))(value)
          );
        }}
        value={value}
      />
      {helper}
    </FormControl>
  );
}
