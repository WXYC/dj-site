"use client";

import { useEffect } from "react";
import { CircularProgress, Stack, Typography } from "@mui/joy";
import { RequireMD } from "@/src/components/shared/Authorization";
import { useLazyPeekArtistCodeQuery } from "@/lib/features/catalog/api";
import { useDebouncedValue } from "@/src/hooks/useDebouncedValue";

const DEBOUNCE_MS = 150;

export interface CallLetterPeekControlProps {
  code_letters: string;
  genre_id: number | null;
}

/**
 * MD+ preview of the code number a new artist would be assigned for a given
 * `code_letters` + `genre_id` pair, ahead of committing the artist-add form.
 * Controlled by props (no internal draft state) so the artist-add form can
 * drive it directly from its own field state.
 */
function CallLetterPeekControl({ code_letters, genre_id }: CallLetterPeekControlProps) {
  if (!code_letters || genre_id == null) return null;

  return (
    <RequireMD>
      <CallLetterPeek code_letters={code_letters} genre_id={genre_id} />
    </RequireMD>
  );
}

interface CallLetterPeekProps {
  code_letters: string;
  genre_id: number;
}

// Split out from CallLetterPeekControl so the peek query only mounts (and
// fires) once RequireMD has confirmed MD+ authority. The backend rejects the
// request with 403 for lower roles, and the effect firing unconditionally
// above the gate would spam that rejection on every keystroke.
function CallLetterPeek({ code_letters, genre_id }: CallLetterPeekProps) {
  const [peekArtistCode, { data, isFetching, error }] = useLazyPeekArtistCodeQuery();
  const debouncedCodeLetters = useDebouncedValue(code_letters, DEBOUNCE_MS);
  // The debounced value lags the prop for DEBOUNCE_MS after every keystroke;
  // treat that window as stale rather than rendering the previous letters'
  // code number as though it were current.
  const stale = debouncedCodeLetters !== code_letters;

  useEffect(() => {
    peekArtistCode({ code_letters: debouncedCodeLetters, genre_id });
  }, [debouncedCodeLetters, genre_id, peekArtistCode]);

  return (
    <Stack direction="row" spacing={1} alignItems="center">
      <Typography level="body-sm">Next code:</Typography>
      {stale || isFetching ? (
        <CircularProgress size="sm" aria-label="Loading next code number" />
      ) : error ? (
        <Typography level="body-sm" color="danger">
          Unable to preview code
        </Typography>
      ) : data ? (
        <Typography level="body-sm" fontWeight="lg" data-testid="next-code-number">
          {data.next_code_number}
        </Typography>
      ) : null}
    </Stack>
  );
}

export default CallLetterPeekControl;
