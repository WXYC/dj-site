"use client";

import { useEffect, useId, useMemo } from "react";
import { CircularProgress, Stack, Typography } from "@mui/joy";
import { RequireMD } from "@/src/components/shared/Authorization";
import { useLazyPeekArtistCodeQuery } from "@/lib/features/catalog/api";
import type { PeekArtistCodeQuery } from "@/lib/features/catalog/types";
import { useDebouncedValue } from "@/src/hooks/useDebouncedValue";

const DEBOUNCE_MS = 150;

export interface CallLetterPeekControlProps {
  code_letters: string;
  genre_id: number | null;
}

/**
 * MD+ preview of the code number a new artist would be assigned for a given
 * `code_letters` + `genre_id` pair. Controlled by props (no internal draft
 * state) so a composing form can drive it directly from its own field state.
 */
function CallLetterPeekControl({ code_letters, genre_id }: CallLetterPeekControlProps) {
  return (
    <RequireMD>
      <CallLetterPeek code_letters={code_letters} genre_id={genre_id} />
    </RequireMD>
  );
}

// The input-validity guard lives here, inside RequireMD's child, rather than
// above RequireMD in CallLetterPeekControl: unmounting RequireMD on every
// empty input would drop its resolved-authority state and force a full
// org-role re-fetch on the next non-empty keystroke.
function CallLetterPeek({ code_letters, genre_id }: CallLetterPeekControlProps) {
  const labelId = useId();
  const [peekArtistCode, { data, isFetching, error }] = useLazyPeekArtistCodeQuery();

  // code_letters and genre_id are debounced together as one composed value
  // so a genre change mid-typing can never pair with letters the user hasn't
  // finished composing (or vice versa).
  const trimmedCodeLetters = code_letters.trim();
  const peekArg: PeekArtistCodeQuery | null = useMemo(
    () =>
      trimmedCodeLetters && genre_id != null
        ? { code_letters: trimmedCodeLetters, genre_id }
        : null,
    [trimmedCodeLetters, genre_id],
  );
  const debouncedPeekArg = useDebouncedValue(peekArg, DEBOUNCE_MS);
  // The debounced value lags peekArg for DEBOUNCE_MS after every change;
  // treat that window as stale rather than rendering the previous pair's
  // code number as though it were current.
  const stale = debouncedPeekArg !== peekArg;

  useEffect(() => {
    if (!debouncedPeekArg) return;
    // preferCacheValue=true: the assigned code number for a letters/genre
    // pair only moves if another artist is added under it while this control
    // is open, and the backend re-validates the number at actual add time
    // regardless of what this preview last showed. Reusing the cache avoids
    // re-hitting the backend on every genre-dropdown flip-flop.
    peekArtistCode(debouncedPeekArg, true);
  }, [debouncedPeekArg, peekArtistCode]);

  if (!peekArg) return null;

  return (
    <Stack direction="row" spacing={1} alignItems="center" role="status" aria-live="polite">
      <Typography level="body-sm" id={labelId}>
        Next code:
      </Typography>
      {stale || isFetching ? (
        <CircularProgress size="sm" aria-label="Loading next code number" />
      ) : error ? (
        <Typography level="body-sm" color="danger" aria-labelledby={labelId}>
          Unable to preview code
        </Typography>
      ) : data ? (
        <Typography
          level="body-sm"
          fontWeight="lg"
          data-testid="next-code-number"
          aria-labelledby={labelId}
        >
          {data.next_code_number}
        </Typography>
      ) : null}
    </Stack>
  );
}

export default CallLetterPeekControl;
