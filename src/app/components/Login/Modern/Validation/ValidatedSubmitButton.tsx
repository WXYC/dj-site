"use client";

import { useAppSelector } from "@/lib/hooks";
import {
  getIsPending,
  getIsValid,
} from "@/lib/slices/authentication/selectors";
import { Button, ButtonProps } from "@mui/joy";

export const ValidatedSubmitButton = (
  props: Omit<ButtonProps, "type" | "disabled" | "loading">
) => {
  const isValid = useAppSelector(getIsValid);
  const authenticating = useAppSelector(getIsPending);
  return (
    <Button
      {...props}
      type="submit"
      disabled={authenticating || !isValid}
      loading={authenticating}
    >
      Submit
    </Button>
  );
};
