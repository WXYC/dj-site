"use client";

import { useAppDispatch, useAppSelector } from "@/lib/hooks";
import { Credentials } from "@/lib/models";
import { authenticationSlice } from "@/lib/slices";
import {
  getCredentials,
  getValidation,
} from "@/lib/slices/authentication/selectors";
import { Visibility, VisibilityOff } from "@mui/icons-material";
import { Checkbox } from "@mui/joy";
import FormControl from "@mui/joy/FormControl";
import FormLabel from "@mui/joy/FormLabel";
import Input from "@mui/joy/Input";
import { useEffect, useState } from "react";

export default function ConfirmBox({
  name,
  title,
  disabled,
  placeholder,
}: {
  name: keyof Credentials;
  title: string;
  disabled?: boolean;
  placeholder?: string;
}): JSX.Element {
  const dispatch = useAppDispatch();
  const credentials = useAppSelector(getCredentials);

  const [compareTo, setCompareTo] = useState("");
  const [value, setValue] = useState("");

  const [viewable, setViewable] = useState(false);

  useEffect(() => {
    setCompareTo(credentials[name] ?? "");
  }, [credentials]);

  useEffect(() => {
    if (compareTo === value && value.length > 0) {
      dispatch(
        authenticationSlice.actions.updateValidation({
          field: "compareTo",
          approved: true,
        })
      );
    } else {
      dispatch(
        authenticationSlice.actions.updateValidation({
          field: "compareTo",
          approved: false,
        })
      );
    }
  }, [value, compareTo]);

  const validation = useAppSelector(getValidation);

  return (
    <FormControl required>
      <FormLabel>{title}</FormLabel>
      <Input
        placeholder={placeholder || `Confirm your Password`}
        type={viewable ? "text" : "password"}
        name={name}
        disabled={disabled}
        onChange={(e) => {
          setValue(e.target.value);
        }}
        value={value}
        error={!validation["compareTo"]}
        color={validation["compareTo"] ? "success" : "primary"}
        endDecorator={
          <FormControl required={false}>
          <Checkbox
            variant="plain"
            checkedIcon={<Visibility sx={{ fontSize: "1rem", ml: -0.5 }} />}
            uncheckedIcon={
              <VisibilityOff sx={{ fontSize: "1rem", ml: -0.5 }} />
            }
            checked={viewable}
            onChange={(e) => setViewable(e.target.checked)}
            slotProps={{
              input: {
                title: "",
                name: "",
              },
            }}
          />
          </FormControl>
        }
      />
    </FormControl>
  );
}
