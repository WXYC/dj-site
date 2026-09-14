"use client";

import { useId } from "react";
import { CircularProgress, Stack, Typography } from "@mui/joy";
import type { ArtistCodePeek } from "@/src/hooks/useArtistCodePeek";

export interface CallLetterPeekControlProps {
  peek: ArtistCodePeek;
}

/**
 * The "Next code" status line for a caller-held `useArtistCodePeek` result.
 *
 * Display only, deliberately: the caller derives the code-number field's
 * clean rendered value from the same peek this line reports, so the fetch has
 * to live above both readers — a self-fetching preview would make this
 * control a second owner of the value the field is derived from. That is
 * also why nothing here is authorization-gated: with no query of its own
 * there is nothing to gate, and every consumer already sits under an MD gate.
 */
function CallLetterPeekControl({ peek }: CallLetterPeekControlProps) {
  const labelId = useId();

  if (!peek.arg) return null;

  return (
    <Stack direction="row" spacing={1} alignItems="center" role="status" aria-live="polite">
      <Typography level="body-sm" id={labelId}>
        Next code:
      </Typography>
      {peek.pending ? (
        <CircularProgress size="sm" aria-label="Loading next code number" />
      ) : peek.isError ? (
        <Typography level="body-sm" color="danger" aria-labelledby={labelId}>
          Unable to preview code
        </Typography>
      ) : peek.nextCodeNumber != null ? (
        <Typography
          level="body-sm"
          fontWeight="lg"
          data-testid="next-code-number"
          aria-labelledby={labelId}
        >
          {peek.nextCodeNumber}
        </Typography>
      ) : null}
    </Stack>
  );
}

export default CallLetterPeekControl;
