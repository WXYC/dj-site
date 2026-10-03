"use client";

import { Button, Stack, Typography } from "@mui/joy";

/**
 * Renders no table row or cell, so it fits inside a table's error cell and
 * outside any table alike. Keep it that way: a listing whose columns come from
 * one shared contract cannot take a full-width row with a literal colSpan.
 *
 * While `retrying`, the control stays mounted and focusable but inert:
 * `aria-disabled` rather than `disabled`, because a browser moves focus off an
 * element the moment it becomes disabled.
 *
 * Only the sentence is a live region, so relabelling the control does not
 * re-read the failure as if the retry had already failed. `failedRetries`
 * remounts it, which is what makes a repeated failure announce again.
 */
export default function FailedSearchNotice({
  onRetry,
  retrying = false,
  failedRetries = 0,
  align = "center",
}: {
  onRetry: () => void;
  retrying?: boolean;
  failedRetries?: number;
  align?: "center" | "start";
}) {
  return (
    <Stack
      direction="row"
      flexWrap="wrap"
      useFlexGap
      spacing={1}
      alignItems="center"
      justifyContent={align === "center" ? "center" : "flex-start"}
    >
      <Typography key={failedRetries} role="alert" level="body-sm" color="danger">
        An error occurred while searching.
      </Typography>
      <Button
        variant="outlined"
        color="danger"
        size="sm"
        aria-disabled={retrying}
        onClick={retrying ? undefined : onRetry}
      >
        {retrying ? "Retrying…" : "Try again"}
      </Button>
    </Stack>
  );
}
