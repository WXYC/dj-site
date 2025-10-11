"use client";

import { authenticationSlice } from "@/lib/features/authentication/frontend";
import { ModifiableData } from "@/lib/features/authentication/types";
import { useAppDispatch } from "@/lib/hooks";
import { Input, InputProps } from "@mui/joy";
import { useState } from "react";

export default function SettingsInput({
  name,
  backendValue,
  ...props
}: {
  name: keyof ModifiableData;
  backendValue?: string;
} & InputProps) {
  const dispatch = useAppDispatch();

  const [value, setValue] = useState<string>(
    backendValue !== undefined ? backendValue : ""
  );

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    const newValue = e.target.value;
    setValue(newValue);
    dispatch(
      authenticationSlice.actions.modify({
        key: name,
        value: backendValue !== newValue && newValue !== "" ? true : false,
      })
    );
  };

  return <Input name={name} onChange={handleChange} value={value} {...props} />;
}
