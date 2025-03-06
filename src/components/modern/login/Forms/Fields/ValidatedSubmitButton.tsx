"use client";

import { Button, ButtonProps } from "@mui/joy";

export const ValidatedSubmitButton = ({
  authenticating,
  valid,
  ...props
}: Omit<ButtonProps, "type" | "disabled" | "loading"> & {
  authenticating: boolean;
  valid: boolean;
}) => {
  return (
    <Button
      {...props}
      type="submit"
      disabled={authenticating || !valid}
      loading={authenticating}
    >
      Submit
    </Button>
  );
};
