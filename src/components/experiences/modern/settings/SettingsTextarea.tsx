"use client";

import { authenticationSlice } from "@/lib/features/authentication/frontend";
import { ModifiableData } from "@/lib/features/authentication/types";
import { useAppDispatch } from "@/lib/hooks";
import { Textarea, TextareaProps } from "@mui/joy";
import { useState } from "react";

export default function SettingsTextarea({
  name,
  backendValue,
  ...props
}: {
  name: keyof ModifiableData;
  backendValue?: string;
} & TextareaProps) {
  const dispatch = useAppDispatch();

  const [value, setValue] = useState<string>(
    backendValue !== undefined ? backendValue : ""
  );

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    e.preventDefault();
    const newValue = e.target.value;
    setValue(newValue);
    dispatch(
      authenticationSlice.actions.modify({
        // Any divergence from the backend value is a modification — including
        // clearing a set field to "" — so the clear survives to the save
        // payload instead of being dropped as unmodified (#609).
        key: name,
        value: (backendValue ?? "") !== newValue,
      })
    );
  };

  return (
    <Textarea
      name={name}
      onChange={handleChange}
      value={value}
      minRows={2}
      maxRows={4}
      {...props}
    />
  );
}
